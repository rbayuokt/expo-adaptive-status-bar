import XCTest

// Mirrors android/src/test/.../CoreTest.kt. Keep the two in step.
final class CoreTests: XCTestCase {
  let w = 96
  let h = 8

  func measure(_ left: UInt8, _ middle: UInt8, _ right: UInt8) -> Measurement {
    let zone = Int(Float(w) * LuminanceAnalyzer.zoneFraction)
    var bytes = [UInt8](repeating: 255, count: w * h * 4)
    for i in 0..<(w * h) {
      let x = i % w
      let v = x < zone ? left : x >= w - zone ? right : middle
      bytes[i * 4] = v
      bytes[i * 4 + 1] = v
      bytes[i * 4 + 2] = v
    }
    return LuminanceAnalyzer.analyze(bytes, width: w, height: h, bytesPerRow: w * 4)
  }

  func testBlackAndWhiteAreTheEnds() {
    XCTAssertEqual(measure(0, 0, 0).lightness, 0, accuracy: 1e-4)
    XCTAssertEqual(measure(255, 255, 255).lightness, 1, accuracy: 1e-4)
  }

  func testSrgbIsLinearized() {
    XCTAssertEqual(LuminanceAnalyzer.luminance(r: 128, g: 128, b: 128), 0.2158, accuracy: 1e-3)
    // sRGB 119 is close to perceptual mid grey.
    XCTAssertEqual(measure(119, 119, 119).lightness, 0.5, accuracy: 0.01)
  }

  func testGreenCountsMoreThanBlue() {
    XCTAssertGreaterThan(LuminanceAnalyzer.luminance(r: 0, g: 255, b: 0), LuminanceAnalyzer.luminance(r: 0, g: 0, b: 255) * 5)
  }

  func testSplitBackgroundLandsOnTheContrastCrossover() {
    let m = measure(0, 128, 255)
    XCTAssertEqual(m.left, 0, accuracy: 1e-4)
    XCTAssertEqual(m.right, 1, accuracy: 1e-4)
    // White and black icons tie at linear luminance 0.179, L* 0.494.
    XCTAssertEqual(m.lightness, 0.494, accuracy: 0.005)
  }

  func testMiddleIsIgnored() {
    XCTAssertEqual(measure(0, 255, 0).lightness, 0, accuracy: 1e-4)
  }

  func testFirstReadingCommitsImmediately() {
    let d = StyleDecider()
    XCTAssertEqual(d.offer(0.55, now: 0), .dark)
    XCTAssertEqual(d.style, .dark)
  }

  func testReadingsBetweenThresholdsKeepTheStyle() {
    let d = StyleDecider()
    _ = d.offer(0.9, now: 0)
    XCTAssertNil(d.offer(0.5, now: 1))
    XCTAssertNil(d.offer(0.43, now: 2))
    XCTAssertEqual(d.style, .dark)
    XCTAssertFalse(d.hasPending)
  }

  func testNearThresholdNeedsConfirmation() {
    let d = StyleDecider()
    _ = d.offer(0.9, now: 0)
    XCTAssertNil(d.offer(0.40, now: 1))
    XCTAssertTrue(d.hasPending)
    XCTAssertEqual(d.offer(0.40, now: 1.1), .light)
  }

  func testInterruptedConfirmationStartsOver() {
    let d = StyleDecider()
    _ = d.offer(0.9, now: 0)
    XCTAssertNil(d.offer(0.40, now: 1))
    XCTAssertNil(d.offer(0.50, now: 1.1))
    XCTAssertFalse(d.hasPending)
    XCTAssertNil(d.offer(0.40, now: 1.2))
  }

  func testStrongReadingSwitchesAtOnce() {
    let d = StyleDecider()
    _ = d.offer(0.9, now: 0)
    XCTAssertEqual(d.offer(0.1, now: 1), .light)
  }

  func testMinTransitionHoldsBackASwitch() {
    let d = StyleDecider()
    _ = d.offer(0.9, now: 0)
    XCTAssertNil(d.offer(0.05, now: 0.1))
    XCTAssertTrue(d.hasPending)
    XCTAssertEqual(d.offer(0.05, now: 0.26), .light)
  }

  func testNoHysteresisFlipsAtMidpoint() {
    let d = StyleDecider(config: .noHysteresis)
    _ = d.offer(0.6, now: 0)
    XCTAssertEqual(d.offer(0.49, now: 0.001), .light)
    XCTAssertEqual(d.offer(0.5, now: 0.002), .dark)
  }

  func testInvertedThresholdsAreRejected() {
    var c = DeciderConfig()
    c.darkThreshold = 0.6
    c.lightThreshold = 0.4
    XCTAssertThrowsError(try c.validate())
  }

  func testFirstActivitySamplesRightAway() {
    let s = SamplingScheduler()
    XCTAssertEqual(s.onActivity(now: 1), 0)
    XCTAssertNil(s.onActivity(now: 1.005))
  }

  func testActivityDuringASampleGetsATrailingSample() {
    let s = SamplingScheduler(config: SamplingConfig(minInterval: 0.1, maxInterval: 0.4, quietInterval: 0.4, idleInterval: 0))
    _ = s.onActivity(now: 1)
    s.onTick(now: 1)
    XCTAssertNil(s.onActivity(now: 1.01))
    XCTAssertEqual(s.onSampleFinished(now: 1.01, lightness: 0.5) ?? -1, 0.09, accuracy: 1e-9)
  }

  func testNoActivityFallsBackToIdleInterval() {
    let s = SamplingScheduler(config: SamplingConfig(minInterval: 0.1, maxInterval: 0.4, quietInterval: 0.4, idleInterval: 2))
    _ = s.onActivity(now: 1)
    s.onTick(now: 1)
    XCTAssertEqual(s.onSampleFinished(now: 1.004, lightness: 0.5), 2)
    XCTAssertEqual(s.dueAt ?? -1, 3.004, accuracy: 1e-9)
  }

  func testIdleIntervalZeroGoesIdle() {
    let s = SamplingScheduler(config: SamplingConfig(minInterval: 0.1, maxInterval: 0.4, quietInterval: 0.4, idleInterval: 0))
    _ = s.onActivity(now: 1)
    s.onTick(now: 1)
    XCTAssertNil(s.onSampleFinished(now: 1.004, lightness: 0.5))
    XCTAssertNil(s.dueAt)
  }

  func testActivityPullsTheIdleSampleForward() {
    let s = SamplingScheduler(config: SamplingConfig(minInterval: 0.1, maxInterval: 0.4, quietInterval: 0.4, idleInterval: 2))
    _ = s.onActivity(now: 1)
    s.onTick(now: 1)
    _ = s.onSampleFinished(now: 1.004, lightness: 0.5)
    XCTAssertEqual(s.onActivity(now: 1.5), 0)
  }

  func testStableReadingsBackOffAndChangesReset() {
    let s = SamplingScheduler(config: SamplingConfig(minInterval: 0.1, maxInterval: 0.4, quietInterval: 0.4, idleInterval: 0))
    var t: TimeInterval = 0
    func step(_ l: Float) -> TimeInterval {
      _ = s.onActivity(now: t)
      s.onTick(now: t)
      _ = s.onActivity(now: t)
      _ = s.onSampleFinished(now: t, lightness: l)
      t += 1
      return s.interval
    }
    XCTAssertEqual(step(0.5), 0.1, accuracy: 1e-9)
    XCTAssertEqual(step(0.5), 0.2, accuracy: 1e-9)
    XCTAssertEqual(step(0.51), 0.4, accuracy: 1e-9)
    XCTAssertEqual(step(0.5), 0.4, accuracy: 1e-9)
    XCTAssertEqual(step(0.9), 0.1, accuracy: 1e-9)
  }

  func testLongStableStretchBacksOffToTheQuietInterval() {
    let s = SamplingScheduler(config: SamplingConfig(minInterval: 0.1, maxInterval: 0.4, quietInterval: 1.6, idleInterval: 0))
    var t: TimeInterval = 0
    var seen: [TimeInterval] = []
    for _ in 0..<10 {
      _ = s.onActivity(now: t)
      s.onTick(now: t)
      _ = s.onActivity(now: t + 0.001)
      _ = s.onSampleFinished(now: t + 0.001, lightness: 0.5)
      seen.append(s.interval)
      t += 2
    }
    // 0.1 first reading, doubling to the 0.4 cap, 4 stable samples there, then on to 1.6.
    XCTAssertEqual(seen, [0.1, 0.2, 0.4, 0.4, 0.4, 0.4, 0.8, 1.6, 1.6, 1.6])
  }

  func testTouchDropsBackToTheFastestRate() {
    let s = SamplingScheduler(config: SamplingConfig(minInterval: 0.1, maxInterval: 0.4, quietInterval: 1.6, idleInterval: 0))
    var t: TimeInterval = 0
    for _ in 0..<10 {
      _ = s.onActivity(now: t)
      s.onTick(now: t)
      _ = s.onActivity(now: t + 0.001)
      _ = s.onSampleFinished(now: t + 0.001, lightness: 0.5)
      t += 2
    }
    XCTAssertEqual(s.interval, 1.6)
    // Next sample was 1.6 out, a touch pulls it to now.
    XCTAssertEqual(s.onInteraction(now: t), 0)
    XCTAssertEqual(s.interval, 0.1)
  }

  func testFailedCaptureUsesTheSlowestInterval() {
    let s = SamplingScheduler(config: SamplingConfig(minInterval: 0.1, maxInterval: 0.4, quietInterval: 0.4, idleInterval: 0))
    _ = s.onActivity(now: 0)
    s.onTick(now: 0)
    _ = s.onActivity(now: 0.001)
    XCTAssertEqual(s.onSampleFinished(now: 0.001, lightness: nil) ?? -1, 0.399, accuracy: 1e-9)
  }

  func testPendingDecisionKeepsSampling() {
    let s = SamplingScheduler(config: SamplingConfig(minInterval: 0.1, maxInterval: 0.4, quietInterval: 0.4, idleInterval: 0))
    _ = s.onActivity(now: 0)
    s.onTick(now: 0.01)
    XCTAssertEqual(s.onSampleFinished(now: 0.01, lightness: 0.4, pending: true) ?? -1, 0.1, accuracy: 1e-9)
  }

  func testPresetsAreOrdered() {
    let b = SamplingConfig.preset("battery")
    let n = SamplingConfig.preset("balanced")
    let r = SamplingConfig.preset("responsive")
    XCTAssertTrue(b.minInterval > n.minInterval && n.minInterval > r.minInterval)
    XCTAssertEqual(b.idleInterval, 0)
    XCTAssertEqual(n.idleInterval, 0)
    XCTAssertGreaterThan(r.idleInterval, 0)
    XCTAssertTrue(b.maxInterval > n.maxInterval && n.maxInterval > r.maxInterval)
  }
}
