package expo.modules.adaptivestatusbar

import android.app.Activity
import android.graphics.Bitmap
import android.graphics.Rect
import android.os.Build
import android.os.Handler
import android.os.HandlerThread
import android.os.Looper
import android.os.SystemClock
import android.util.Log
import android.view.PixelCopy
import android.view.ViewTreeObserver
import androidx.core.view.ViewCompat
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import expo.modules.adaptivestatusbar.core.DeciderConfig
import expo.modules.adaptivestatusbar.core.IconStyle
import expo.modules.adaptivestatusbar.core.LuminanceAnalyzer
import expo.modules.adaptivestatusbar.core.Measurement
import expo.modules.adaptivestatusbar.core.SamplingConfig
import expo.modules.adaptivestatusbar.core.SamplingScheduler
import expo.modules.adaptivestatusbar.core.StyleDecider
import java.lang.ref.WeakReference

enum class Strategy { AUTOMATIC, HYBRID, MANUAL }

data class ControllerConfig(
  val strategy: Strategy = Strategy.HYBRID,
  val sampling: SamplingConfig = SamplingConfig(),
  val decider: DeciderConfig = DeciderConfig(),
  /** Used when nothing else decides: manual mode with no hint, or sampling unsupported. */
  val fallback: IconStyle? = null,
)

/**
 * Samples the strip under the status bar with PixelCopy and sets the icon appearance. Has no
 * Expo dependency, so it works from a plain Android app too: `attach(activity)`, then `enable()`.
 *
 * Threads: scheduling, PixelCopy requests and appearance writes run on the main thread and are
 * all cheap. The copy itself runs on the GPU, the pixel read and analysis on a worker thread.
 * At most one copy is in flight, so requests can never pile up.
 */
class AdaptiveStatusBarController(private val onChange: (IconStyle, String, Float) -> Unit = { _, _, _ -> }) {
  var config = ControllerConfig()
    private set
  var override: IconStyle? = null
    private set
  var hint: IconStyle? = null
    private set

  private val main = Handler(Looper.getMainLooper())
  private var worker: HandlerThread? = null
  private var workerHandler: Handler? = null
  private var activityRef = WeakReference<Activity>(null)
  private var enabled = false
  private var paused = false
  private var listening = false

  private val scheduler = SamplingScheduler()
  private val decider = StyleDecider()
  private val rect = Rect()
  private val measurement = Measurement()
  private var bitmap: Bitmap? = null
  // Fixed size and never swapped, a late copy may still be writing into it.
  private val pixels = IntArray(SAMPLE_WIDTH * SAMPLE_HEIGHT)
  private var applied: IconStyle? = null
  private var appliedSource = "none"
  private var requestNs = 0L
  /** Bumped on every pause/disable so a copy that finishes late is ignored. */
  private var generation = 0

  var stats = Stats()
    private set

  private val drawListener = ViewTreeObserver.OnDrawListener {
    stats.activitySignals++
    scheduler.onActivity(SystemClock.uptimeMillis())?.let(::schedule)
  }

  private val tick = Runnable { sample() }

  // One copy in flight at a time, so a single listener and result slot are reused for every
  // sample. Fields written on the worker are read on main after the post, which orders them.
  private var copyGeneration = 0
  private var copyStarted = 0L
  private var copyLightness = Float.NaN
  private var copyNs = 0L
  private var analysisNs = 0L

  // Lazy: PixelCopy doesn't exist before API 26 and this is only touched when supported.
  private val copyListener by lazy(LazyThreadSafetyMode.NONE) {
    PixelCopy.OnPixelCopyFinishedListener { result -> onCopied(result) }
  }

  private fun onCopied(result: Int) {
    val copied = SystemClock.elapsedRealtimeNanos()
    copyLightness = Float.NaN
    if (result == PixelCopy.SUCCESS) {
      bitmap?.getPixels(pixels, 0, SAMPLE_WIDTH, 0, 0, SAMPLE_WIDTH, SAMPLE_HEIGHT)
      copyLightness = LuminanceAnalyzer.analyze(pixels, SAMPLE_WIDTH, SAMPLE_HEIGHT, measurement).lightness
    }
    copyNs = copied - copyStarted
    analysisNs = SystemClock.elapsedRealtimeNanos() - copied
    main.post(deliver)
  }

  private val deliver = Runnable {
    if (copyGeneration != generation) return@Runnable
    val lightness = copyLightness.takeUnless { it.isNaN() }
    if (lightness == null) stats.failures++
    else stats.recordSample(copyNs, analysisNs, lightness, measurement.left, measurement.right)
    finish(SystemClock.uptimeMillis(), lightness)
  }

  fun attach(activity: Activity) {
    if (activityRef.get() === activity) return
    stopListening()
    activityRef = WeakReference(activity)
    if (enabled && !paused) start()
  }

  fun detach(activity: Activity? = null) {
    if (activity != null && activityRef.get() !== activity) return
    stopListening()
    activityRef = WeakReference(null)
  }

  fun enable(next: ControllerConfig = config) {
    config = next
    scheduler.config = next.sampling
    decider.config = next.decider
    enabled = true
    restart()
  }

  fun disable() {
    enabled = false
    stop()
    worker?.quitSafely()
    worker = null
    workerHandler = null
    // Not recycled: a late copy may still be reading it on the worker. The GC takes it.
    bitmap = null
    applied = null
    appliedSource = "none"
    decider.reset()
  }

  fun configure(next: ControllerConfig) {
    val strategyChanged = next.strategy != config.strategy
    config = next
    scheduler.config = next.sampling
    decider.config = next.decider
    if (!enabled) return
    if (strategyChanged) restart() else applyResolved()
  }

  fun setOverride(style: IconStyle?) {
    if (style == override) return
    override = style
    if (enabled) restart()
  }

  fun setHint(style: IconStyle?) {
    if (style == hint) return
    hint = style
    if (enabled) restart()
  }

  fun pause() {
    paused = true
    stop()
  }

  fun resume() {
    paused = false
    if (enabled) restart()
  }

  private fun restart() {
    stop()
    if (!paused) start()
  }

  private fun start() {
    if (activityRef.get() == null) return
    applyResolved()
    if (!needsSampling()) return
    if (worker == null) {
      worker = HandlerThread("AdaptiveStatusBar").also { it.start() }
      workerHandler = Handler(worker!!.looper)
    }
    startListening()
    schedule(0)
  }

  private fun stop() {
    generation++
    stopListening()
    main.removeCallbacks(tick)
    scheduler.reset()
    decider.reset()
  }

  /** Overrides always win, then the hint in hybrid/manual, so sampling would be wasted work. */
  private fun needsSampling() = when {
    override != null -> false
    config.strategy == Strategy.MANUAL -> false
    config.strategy == Strategy.HYBRID && hint != null -> false
    else -> supported
  }

  private fun startListening() {
    val decor = activityRef.get()?.window?.peekDecorView() ?: return
    if (listening) return
    decor.viewTreeObserver.addOnDrawListener(drawListener)
    listening = true
  }

  private fun stopListening() {
    if (!listening) return
    listening = false
    val observer = activityRef.get()?.window?.peekDecorView()?.viewTreeObserver ?: return
    if (!observer.isAlive) return
    try {
      observer.removeOnDrawListener(drawListener)
    } catch (e: IllegalStateException) {
      // Removing during a draw pass throws, try again right after it.
      main.post { if (!listening && observer.isAlive) observer.removeOnDrawListener(drawListener) }
    }
  }

  private fun schedule(delayMs: Long) {
    main.removeCallbacks(tick)
    main.postDelayed(tick, delayMs)
  }

  private fun sample() {
    val tickStart = SystemClock.elapsedRealtimeNanos()
    val now = SystemClock.uptimeMillis()
    scheduler.onTick(now)
    val window = activityRef.get()?.window
    val decor = window?.peekDecorView()
    val insets = decor?.let { ViewCompat.getRootWindowInsets(it) }
    val top = insets?.getInsets(WindowInsetsCompat.Type.statusBars())?.top ?: 0
    if (decor == null || insets == null || top <= 0 || decor.width <= 0 ||
      !insets.isVisible(WindowInsetsCompat.Type.statusBars())
    ) {
      // Hidden status bar or no window yet. Showing it again draws a frame, which wakes us up.
      stats.skipped++
      requestNs = SystemClock.elapsedRealtimeNanos() - tickStart
      finish(now, null)
      return
    }
    rect.set(0, 0, decor.width, top)
    val bmp = bitmap ?: Bitmap.createBitmap(SAMPLE_WIDTH, SAMPLE_HEIGHT, Bitmap.Config.ARGB_8888).also { bitmap = it }
    copyGeneration = generation
    copyStarted = SystemClock.elapsedRealtimeNanos()
    try {
      PixelCopy.request(window, rect, bmp, copyListener, workerHandler!!)
    } catch (e: IllegalArgumentException) {
      // No backing surface yet (first frame) or the window is going away.
      stats.failures++
      requestNs = SystemClock.elapsedRealtimeNanos() - tickStart
      finish(now, null)
      return
    }
    requestNs = SystemClock.elapsedRealtimeNanos() - tickStart
  }

  private fun finish(now: Long, lightness: Float?) {
    val start = SystemClock.elapsedRealtimeNanos()
    if (lightness != null) {
      decider.offer(lightness, now)?.let { stats.styleChanges++ }
    }
    applyResolved()
    scheduler.onSampleFinished(now, lightness, decider.hasPending)?.let(::schedule)
    // Main thread time for this sample: issuing the copy plus deciding and applying.
    stats.recordMain(requestNs + SystemClock.elapsedRealtimeNanos() - start)
  }

  private fun resolve(): Pair<IconStyle?, String> {
    override?.let { return it to "override" }
    if (config.strategy != Strategy.AUTOMATIC) hint?.let { return it to "hint" }
    if (config.strategy != Strategy.MANUAL) decider.style?.let { return it to "sample" }
    return config.fallback to "fallback"
  }

  private fun applyResolved() {
    val (style, source) = resolve()
    if (style == null) return
    val window = activityRef.get()?.window ?: return
    val decor = window.peekDecorView() ?: return
    val controller = WindowCompat.getInsetsController(window, decor)
    val lightIcons = style == IconStyle.LIGHT
    // The insets controller flag means "light status bar", which is dark icons.
    if (controller.isAppearanceLightStatusBars == lightIcons) {
      if (applied == style) stats.externalWrites++
      controller.isAppearanceLightStatusBars = !lightIcons
    }
    if (applied != style || appliedSource != source) {
      applied = style
      appliedSource = source
      onChange(style, source, stats.lightness)
    }
  }

  fun resetStats() {
    stats = Stats()
  }

  fun snapshot(): Map<String, Any?> = stats.toMap() + mapOf(
    "supported" to supported,
    "enabled" to enabled,
    "paused" to paused,
    "sampling" to listening,
    "style" to applied?.label,
    "source" to appliedSource,
    "intervalMs" to scheduler.intervalMs,
    "strategy" to config.strategy.name.lowercase(),
  )

  class Stats {
    var samples = 0L
    var failures = 0L
    var skipped = 0L
    var styleChanges = 0L
    var externalWrites = 0L
    var activitySignals = 0L
    var captureNsTotal = 0L
    var captureNsMax = 0L
    var analysisNsTotal = 0L
    var analysisNsMax = 0L
    var ticks = 0L
    var mainNsTotal = 0L
    var mainNsMax = 0L
    var lightness = Float.NaN
    var left = Float.NaN
    var right = Float.NaN

    fun recordSample(captureNs: Long, analysisNs: Long, l: Float, leftL: Float, rightL: Float) {
      samples++
      captureNsTotal += captureNs
      analysisNsTotal += analysisNs
      if (captureNs > captureNsMax) captureNsMax = captureNs
      if (analysisNs > analysisNsMax) analysisNsMax = analysisNs
      lightness = l
      left = leftL
      right = rightL
    }

    fun recordMain(ns: Long) {
      ticks++
      mainNsTotal += ns
      if (ns > mainNsMax) mainNsMax = ns
    }

    fun toMap(): Map<String, Any?> = mapOf(
      "samples" to samples,
      "failures" to failures,
      "skipped" to skipped,
      "styleChanges" to styleChanges,
      "externalWrites" to externalWrites,
      "activitySignals" to activitySignals,
      "captureMsAvg" to if (samples > 0) captureNsTotal / samples / 1e6 else 0.0,
      "captureMsMax" to captureNsMax / 1e6,
      "analysisMsAvg" to if (samples > 0) analysisNsTotal / samples / 1e6 else 0.0,
      "analysisMsMax" to analysisNsMax / 1e6,
      "mainThreadMsAvg" to if (ticks > 0) mainNsTotal / ticks / 1e6 else 0.0,
      "mainThreadMsMax" to mainNsMax / 1e6,
      "lightness" to lightness.takeUnless { it.isNaN() },
      "left" to left.takeUnless { it.isNaN() },
      "right" to right.takeUnless { it.isNaN() },
    )
  }

  companion object {
    const val SAMPLE_WIDTH = 96
    const val SAMPLE_HEIGHT = 8

    /** PixelCopy from a Window needs Android 8.0. */
    val supported = Build.VERSION.SDK_INT >= Build.VERSION_CODES.O

    init {
      if (!supported) Log.w("AdaptiveStatusBar", "PixelCopy needs API 26, using the fallback style only")
    }
  }
}
