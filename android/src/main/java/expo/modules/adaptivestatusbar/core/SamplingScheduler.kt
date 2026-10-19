package expo.modules.adaptivestatusbar.core

import kotlin.math.abs
import kotlin.math.max
import kotlin.math.min

data class SamplingConfig(
  /** Fastest rate, used right after content under the status bar changes. */
  val minIntervalMs: Long = 100,
  /** Back-off cap while the app keeps drawing but the strip stays the same. */
  val maxIntervalMs: Long = 300,
  /**
   * Longest interval once the strip has stayed the same for a while, for apps whose main thread
   * never really sleeps. A touch or a changed reading drops straight back to the fastest rate.
   */
  val quietIntervalMs: Long = 900,
  /**
   * Fallback sample with no activity at all, 0 turns it off. Off by default: what changes pixels
   * without a draw (SurfaceView video) can't be captured anyway, and each wake-up costs battery.
   */
  val idleIntervalMs: Long = 0,
  /** Lightness change that counts as "the strip changed". */
  val stableDelta: Float = 0.02f,
) {
  init {
    require(minIntervalMs > 0) { "samplingInterval must be positive" }
    require(maxIntervalMs >= minIntervalMs) { "maxInterval must be at least samplingInterval" }
    require(quietIntervalMs >= maxIntervalMs) { "quietInterval must be at least maxInterval" }
    require(idleIntervalMs >= 0) { "idleInterval must not be negative" }
  }

  companion object {
    fun preset(name: String?): SamplingConfig = when (name) {
      "battery" -> SamplingConfig(250, 1000, 3000, 0)
      "responsive" -> SamplingConfig(50, 150, 300, 2000)
      else -> SamplingConfig()
    }
  }
}

/**
 * Decides when the next sample runs. Nothing is polled: the platform reports activity (a frame was
 * drawn, the run loop woke up), this answers with a delay or null for "stay idle". One sample at a
 * time, and a trailing sample always follows the last activity so the final frame is measured.
 */
class SamplingScheduler(var config: SamplingConfig = SamplingConfig()) {
  var intervalMs = config.minIntervalMs
    private set
  /** Uptime the next tick is due, -1 when nothing is scheduled. */
  var dueAtMs = -1L
    private set
  var inFlight = false
    private set
  private var lastActivityMs = Long.MIN_VALUE / 2
  private var sampleStartMs = Long.MIN_VALUE / 2
  private var lastLightness = Float.NaN
  private var stableAtMax = 0

  /** Returns the delay to (re)schedule the tick at, or null when the current schedule already covers it. */
  fun onActivity(nowMs: Long): Long? {
    lastActivityMs = nowMs
    if (inFlight) return null
    val due = max(nowMs, sampleStartMs + intervalMs)
    if (dueAtMs in 0..due) return null
    dueAtMs = due
    return due - nowMs
  }

  fun onTick(nowMs: Long) {
    dueAtMs = -1
    inFlight = true
    sampleStartMs = nowMs
  }

  /**
   * `lightness` is null when the capture failed or was skipped. `pending` keeps sampling while the
   * decider waits to confirm a switch. Returns the next delay, or null to go idle.
   */
  fun onSampleFinished(nowMs: Long, lightness: Float?, pending: Boolean = false): Long? {
    inFlight = false
    val c = config
    val changed = lightness != null && (lastLightness.isNaN() || abs(lightness - lastLightness) > c.stableDelta)
    if (lightness == null || changed || intervalMs < c.maxIntervalMs) stableAtMax = 0 else stableAtMax++
    intervalMs = when {
      lightness == null -> c.maxIntervalMs
      changed -> c.minIntervalMs
      stableAtMax >= QUIET_AFTER -> min(intervalMs * 2, c.quietIntervalMs)
      else -> min(intervalMs * 2, c.maxIntervalMs)
    }
    if (lightness != null) lastLightness = lightness
    val delay = when {
      pending || lastActivityMs > sampleStartMs -> max(0, sampleStartMs + intervalMs - nowMs)
      c.idleIntervalMs > 0 -> c.idleIntervalMs
      else -> return null
    }
    dueAtMs = nowMs + delay
    return delay
  }

  /**
   * The user touched the screen: content is about to move, go back to the fastest rate. Returns
   * the delay to reschedule at, like `onActivity`.
   */
  fun onInteraction(nowMs: Long): Long? {
    intervalMs = config.minIntervalMs
    stableAtMax = 0
    if (dueAtMs >= 0) dueAtMs = Long.MAX_VALUE
    return onActivity(nowMs)
  }

  /** Forget timing and the last reading, e.g. after resuming or a config change. */
  fun reset() {
    intervalMs = config.minIntervalMs
    dueAtMs = -1
    inFlight = false
    lastActivityMs = Long.MIN_VALUE / 2
    sampleStartMs = Long.MIN_VALUE / 2
    lastLightness = Float.NaN
    stableAtMax = 0
  }

  companion object {
    /** Stable samples at the back-off cap before the quiet interval kicks in. */
    const val QUIET_AFTER = 4
  }
}
