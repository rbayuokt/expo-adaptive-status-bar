package expo.modules.adaptivestatusbar.core

/** Icon color, same meaning as expo-status-bar: `LIGHT` is white icons for dark content. */
enum class IconStyle(val label: String) {
  LIGHT("light"),
  DARK("dark");

  companion object {
    fun of(label: String?): IconStyle? = entries.firstOrNull { it.label == label }
  }
}

data class DeciderConfig(
  val darkThreshold: Float = 0.42f,
  val lightThreshold: Float = 0.58f,
  /** Samples in a row that must agree before switching, unless the reading is far past a threshold. */
  val confirmSamples: Int = 2,
  /** How far past a threshold a reading switches on its own. */
  val strongMargin: Float = 0.12f,
  val minTransitionMs: Long = 250,
) {
  init {
    require(darkThreshold in 0f..1f && lightThreshold in 0f..1f) { "thresholds must be within 0..1" }
    require(darkThreshold <= lightThreshold) { "darkThreshold must not exceed lightThreshold" }
    require(confirmSamples >= 1) { "confirmSamples must be at least 1" }
  }

  companion object {
    val NO_HYSTERESIS = DeciderConfig(0.5f, 0.5f, confirmSamples = 1, minTransitionMs = 0)
  }
}

/**
 * Hysteresis plus a short confirmation so slow scrolls and animated gradients don't flicker the
 * icons. Readings between the thresholds keep the current style.
 */
class StyleDecider(var config: DeciderConfig = DeciderConfig()) {
  var style: IconStyle? = null
    private set
  /** A switch is waiting on confirmation or the transition interval, so sample again soon. */
  val hasPending get() = pending != null
  private var pending: IconStyle? = null
  private var pendingCount = 0
  private var changedAt = Long.MIN_VALUE / 2

  /** Returns the new style when it changes, otherwise null. */
  fun offer(lightness: Float, nowMs: Long): IconStyle? {
    val c = config
    val current = style
    if (current == null) {
      val first = if (lightness >= (c.darkThreshold + c.lightThreshold) / 2) IconStyle.DARK else IconStyle.LIGHT
      return commit(first, nowMs)
    }
    val candidate = when {
      lightness >= c.lightThreshold -> IconStyle.DARK
      lightness < c.darkThreshold -> IconStyle.LIGHT
      else -> current
    }
    if (candidate == current) {
      pending = null
      pendingCount = 0
      return null
    }
    pendingCount = if (candidate == pending) pendingCount + 1 else 1
    pending = candidate
    val strong = lightness >= c.lightThreshold + c.strongMargin || lightness <= c.darkThreshold - c.strongMargin
    if (!strong && pendingCount < c.confirmSamples) return null
    if (nowMs - changedAt < c.minTransitionMs) return null
    return commit(candidate, nowMs)
  }

  fun reset() {
    style = null
    pending = null
    pendingCount = 0
    changedAt = Long.MIN_VALUE / 2
  }

  private fun commit(next: IconStyle, nowMs: Long): IconStyle {
    style = next
    pending = null
    pendingCount = 0
    changedAt = nowMs
    return next
  }
}
