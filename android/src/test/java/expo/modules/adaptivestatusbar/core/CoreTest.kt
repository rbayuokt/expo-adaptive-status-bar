package expo.modules.adaptivestatusbar.core

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

// Mirrors ios/Tests/CoreTests.swift. Keep the two in step.
class CoreTest {
  private val w = 96
  private val h = 8

  private fun strip(left: Int, middle: Int, right: Int): IntArray {
    val zone = (w * LuminanceAnalyzer.ZONE_FRACTION).toInt()
    return IntArray(w * h) { i ->
      val x = i % w
      val v = when {
        x < zone -> left
        x >= w - zone -> right
        else -> middle
      }
      (0xFF shl 24) or (v shl 16) or (v shl 8) or v
    }
  }

  private fun measure(left: Int, middle: Int, right: Int) = LuminanceAnalyzer.analyze(strip(left, middle, right), w, h)

  @Test fun blackAndWhiteAreTheEnds() {
    assertEquals(0f, measure(0, 0, 0).lightness, 1e-4f)
    assertEquals(1f, measure(255, 255, 255).lightness, 1e-4f)
  }

  @Test fun srgbIsLinearized() {
    assertEquals(0.2158f, LuminanceAnalyzer.luminance(0xFF808080.toInt()), 1e-3f)
    // sRGB 119 is close to perceptual mid grey.
    assertEquals(0.5f, measure(119, 119, 119).lightness, 0.01f)
  }

  @Test fun greenCountsMoreThanBlue() {
    assertTrue(LuminanceAnalyzer.luminance(0xFF00FF00.toInt()) > LuminanceAnalyzer.luminance(0xFF0000FF.toInt()) * 5)
  }

  @Test fun splitBackgroundLandsOnTheContrastCrossover() {
    val m = measure(0, 128, 255)
    assertEquals(0f, m.left, 1e-4f)
    assertEquals(1f, m.right, 1e-4f)
    // White and black icons tie at linear luminance 0.179, L* 0.494.
    assertEquals(0.494f, m.lightness, 0.005f)
  }

  @Test fun middleIsIgnored() {
    assertEquals(0f, measure(0, 255, 0).lightness, 1e-4f)
  }

  @Test fun firstReadingCommitsImmediately() {
    val d = StyleDecider()
    assertEquals(IconStyle.DARK, d.offer(0.55f, 0))
    assertEquals(IconStyle.DARK, d.style)
  }

  @Test fun readingsBetweenThresholdsKeepTheStyle() {
    val d = StyleDecider()
    d.offer(0.9f, 0)
    assertNull(d.offer(0.5f, 1000))
    assertNull(d.offer(0.43f, 2000))
    assertEquals(IconStyle.DARK, d.style)
    assertFalse(d.hasPending)
  }

  @Test fun nearThresholdNeedsConfirmation() {
    val d = StyleDecider()
    d.offer(0.9f, 0)
    assertNull(d.offer(0.40f, 1000))
    assertTrue(d.hasPending)
    assertEquals(IconStyle.LIGHT, d.offer(0.40f, 1100))
  }

  @Test fun interruptedConfirmationStartsOver() {
    val d = StyleDecider()
    d.offer(0.9f, 0)
    assertNull(d.offer(0.40f, 1000))
    assertNull(d.offer(0.50f, 1100))
    assertFalse(d.hasPending)
    assertNull(d.offer(0.40f, 1200))
  }

  @Test fun strongReadingSwitchesAtOnce() {
    val d = StyleDecider()
    d.offer(0.9f, 0)
    assertEquals(IconStyle.LIGHT, d.offer(0.1f, 1000))
  }

  @Test fun minTransitionHoldsBackASwitch() {
    val d = StyleDecider()
    d.offer(0.9f, 0)
    assertNull(d.offer(0.05f, 100))
    assertTrue(d.hasPending)
    assertEquals(IconStyle.LIGHT, d.offer(0.05f, 260))
  }

  @Test fun noHysteresisFlipsAtMidpoint() {
    val d = StyleDecider(DeciderConfig.NO_HYSTERESIS)
    d.offer(0.6f, 0)
    assertEquals(IconStyle.LIGHT, d.offer(0.49f, 1))
    assertEquals(IconStyle.DARK, d.offer(0.5f, 2))
  }

  @Test(expected = IllegalArgumentException::class)
  fun invertedThresholdsAreRejected() {
    DeciderConfig(darkThreshold = 0.6f, lightThreshold = 0.4f)
  }

  @Test fun firstActivitySamplesRightAway() {
    val s = SamplingScheduler()
    assertEquals(0L, s.onActivity(1000))
    assertNull(s.onActivity(1005))
  }

  @Test fun activityDuringASampleGetsATrailingSample() {
    val s = SamplingScheduler(SamplingConfig(100, 400, 400, 0))
    s.onActivity(1000)
    s.onTick(1000)
    assertNull(s.onActivity(1010))
    assertEquals(90L, s.onSampleFinished(1010, 0.5f))
  }

  @Test fun noActivityFallsBackToIdleInterval() {
    val s = SamplingScheduler(SamplingConfig(100, 400, 400, 2000))
    s.onActivity(1000)
    s.onTick(1000)
    assertEquals(2000L, s.onSampleFinished(1004, 0.5f))
    assertEquals(3004L, s.dueAtMs)
  }

  @Test fun idleIntervalZeroGoesIdle() {
    val s = SamplingScheduler(SamplingConfig(100, 400, 400, 0))
    s.onActivity(1000)
    s.onTick(1000)
    assertNull(s.onSampleFinished(1004, 0.5f))
    assertEquals(-1L, s.dueAtMs)
  }

  @Test fun activityPullsTheIdleSampleForward() {
    val s = SamplingScheduler(SamplingConfig(100, 400, 400, 2000))
    s.onActivity(1000)
    s.onTick(1000)
    s.onSampleFinished(1004, 0.5f)
    assertEquals(0L, s.onActivity(1500))
  }

  @Test fun stableReadingsBackOffAndChangesReset() {
    val s = SamplingScheduler(SamplingConfig(100, 400, 400, 0))
    var t = 0L
    fun step(l: Float): Long {
      s.onActivity(t)
      s.onTick(t)
      s.onActivity(t)
      s.onSampleFinished(t, l)
      t += 1000
      return s.intervalMs
    }
    assertEquals(100L, step(0.5f))
    assertEquals(200L, step(0.5f))
    assertEquals(400L, step(0.51f))
    assertEquals(400L, step(0.5f))
    assertEquals(100L, step(0.9f))
  }

  @Test fun longStableStretchBacksOffToTheQuietInterval() {
    val s = SamplingScheduler(SamplingConfig(100, 400, 1600, 0))
    var t = 0L
    val seen = mutableListOf<Long>()
    repeat(10) {
      s.onActivity(t)
      s.onTick(t)
      s.onActivity(t + 1)
      s.onSampleFinished(t + 1, 0.5f)
      seen += s.intervalMs
      t += 2000
    }
    // 100 first reading, doubling to the 400 cap, 4 stable samples there, then on to 1600.
    assertEquals(listOf(100L, 200L, 400L, 400L, 400L, 400L, 800L, 1600L, 1600L, 1600L), seen)
  }

  @Test fun touchDropsBackToTheFastestRate() {
    val s = SamplingScheduler(SamplingConfig(100, 400, 1600, 0))
    var t = 0L
    repeat(10) {
      s.onActivity(t)
      s.onTick(t)
      s.onActivity(t + 1)
      s.onSampleFinished(t + 1, 0.5f)
      t += 2000
    }
    assertEquals(1600L, s.intervalMs)
    // Next sample was 1600 out, a touch pulls it to now.
    assertEquals(0L, s.onInteraction(t))
    assertEquals(100L, s.intervalMs)
  }

  @Test fun failedCaptureUsesTheSlowestInterval() {
    val s = SamplingScheduler(SamplingConfig(100, 400, 400, 0))
    s.onActivity(0)
    s.onTick(0)
    s.onActivity(1)
    assertEquals(399L, s.onSampleFinished(1, null))
  }

  @Test fun pendingDecisionKeepsSampling() {
    val s = SamplingScheduler(SamplingConfig(100, 400, 400, 0))
    s.onActivity(0)
    s.onTick(10)
    assertEquals(100L, s.onSampleFinished(10, 0.4f, pending = true))
  }

  @Test fun presetsAreOrdered() {
    val b = SamplingConfig.preset("battery")
    val n = SamplingConfig.preset("balanced")
    val r = SamplingConfig.preset("responsive")
    assertTrue(b.minIntervalMs > n.minIntervalMs && n.minIntervalMs > r.minIntervalMs)
    assertEquals(0L, b.idleIntervalMs)
    assertEquals(0L, n.idleIntervalMs)
    assertTrue(r.idleIntervalMs > 0)
    assertTrue(b.maxIntervalMs > n.maxIntervalMs && n.maxIntervalMs > r.maxIntervalMs)
  }
}
