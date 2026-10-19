import Foundation

public struct SamplingConfig: Equatable {
  /// Fastest rate, used right after content under the status bar changes.
  public var minInterval: TimeInterval = 0.1
  /// Back-off cap while the app keeps drawing but the strip stays the same.
  public var maxInterval: TimeInterval = 0.3
  /// Longest interval once the strip has stayed the same for a while, for apps whose main thread
  /// never really sleeps. A touch or a changed reading drops straight back to the fastest rate.
  public var quietInterval: TimeInterval = 0.9
  /// Fallback sample with no activity at all, 0 turns it off. Off by default: what changes pixels
  /// without run loop activity (video, Metal) can't be captured anyway, and each wake-up costs battery.
  public var idleInterval: TimeInterval = 0
  /// Lightness change that counts as "the strip changed".
  public var stableDelta: Float = 0.02

  public init(minInterval: TimeInterval = 0.1, maxInterval: TimeInterval = 0.3, quietInterval: TimeInterval = 0.9, idleInterval: TimeInterval = 0) {
    self.minInterval = minInterval
    self.maxInterval = maxInterval
    self.quietInterval = quietInterval
    self.idleInterval = idleInterval
  }

  public static func preset(_ name: String?) -> SamplingConfig {
    switch name {
    case "battery": return SamplingConfig(minInterval: 0.25, maxInterval: 1, quietInterval: 3, idleInterval: 0)
    case "responsive": return SamplingConfig(minInterval: 0.05, maxInterval: 0.15, quietInterval: 0.3, idleInterval: 2)
    default: return SamplingConfig()
    }
  }

  public func validate() throws {
    guard minInterval > 0 else { throw ConfigError("samplingInterval must be positive") }
    guard maxInterval >= minInterval else { throw ConfigError("maxInterval must be at least samplingInterval") }
    guard quietInterval >= maxInterval else { throw ConfigError("quietInterval must be at least maxInterval") }
    guard idleInterval >= 0 else { throw ConfigError("idleInterval must not be negative") }
  }
}

/// Decides when the next sample runs. Nothing is polled: the platform reports activity (the run
/// loop did UI work), this answers with a delay or nil for "stay idle". One sample at a time, and
/// a trailing sample always follows the last activity so the final frame is measured.
public final class SamplingScheduler {
  public var config: SamplingConfig
  public private(set) var interval: TimeInterval
  /// Time the next tick is due, nil when nothing is scheduled.
  public private(set) var dueAt: TimeInterval?
  public private(set) var inFlight = false
  private var lastActivity = -TimeInterval.greatestFiniteMagnitude
  private var sampleStart = -TimeInterval.greatestFiniteMagnitude
  private var lastLightness: Float?
  private var stableAtMax = 0
  /// Stable samples at the back-off cap before the quiet interval kicks in.
  public static let quietAfter = 4

  public init(config: SamplingConfig = SamplingConfig()) {
    self.config = config
    interval = config.minInterval
  }

  /// Returns the delay to (re)schedule the tick at, or nil when the current schedule already covers it.
  public func onActivity(now: TimeInterval) -> TimeInterval? {
    lastActivity = now
    if inFlight { return nil }
    let due = max(now, sampleStart + interval)
    if let d = dueAt, d <= due { return nil }
    dueAt = due
    return due - now
  }

  public func onTick(now: TimeInterval) {
    dueAt = nil
    inFlight = true
    sampleStart = now
  }

  /// `lightness` is nil when the capture failed or was skipped. `pending` keeps sampling while the
  /// decider waits to confirm a switch. Returns the next delay, or nil to go idle.
  public func onSampleFinished(now: TimeInterval, lightness: Float?, pending: Bool = false) -> TimeInterval? {
    inFlight = false
    let c = config
    if let l = lightness {
      let changed = lastLightness.map { abs(l - $0) > c.stableDelta } ?? true
      stableAtMax = changed || interval < c.maxInterval ? 0 : stableAtMax + 1
      if changed {
        interval = c.minInterval
      } else if stableAtMax >= Self.quietAfter {
        interval = min(interval * 2, c.quietInterval)
      } else {
        interval = min(interval * 2, c.maxInterval)
      }
      lastLightness = l
    } else {
      stableAtMax = 0
      interval = c.maxInterval
    }
    let delay: TimeInterval
    if pending || lastActivity > sampleStart {
      delay = max(0, sampleStart + interval - now)
    } else if c.idleInterval > 0 {
      delay = c.idleInterval
    } else {
      return nil
    }
    dueAt = now + delay
    return delay
  }

  /// The user touched the screen: content is about to move, go back to the fastest rate. Returns
  /// the delay to reschedule at, like `onActivity`.
  public func onInteraction(now: TimeInterval) -> TimeInterval? {
    interval = config.minInterval
    stableAtMax = 0
    if dueAt != nil { dueAt = .greatestFiniteMagnitude }
    return onActivity(now: now)
  }

  /// Forget timing and the last reading, e.g. after resuming or a config change.
  public func reset() {
    interval = config.minInterval
    dueAt = nil
    inFlight = false
    lastActivity = -TimeInterval.greatestFiniteMagnitude
    sampleStart = -TimeInterval.greatestFiniteMagnitude
    lastLightness = nil
    stableAtMax = 0
  }
}
