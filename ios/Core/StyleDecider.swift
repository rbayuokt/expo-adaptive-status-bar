import Foundation

/// Icon color, same meaning as expo-status-bar: `light` is white icons for dark content.
public enum IconStyle: String {
  case light
  case dark
}

public struct DeciderConfig: Equatable {
  public var darkThreshold: Float = 0.42
  public var lightThreshold: Float = 0.58
  /// Samples in a row that must agree before switching, unless the reading is far past a threshold.
  public var confirmSamples = 2
  /// How far past a threshold a reading switches on its own.
  public var strongMargin: Float = 0.12
  public var minTransition: TimeInterval = 0.25

  public init() {}

  public static var noHysteresis: DeciderConfig {
    var c = DeciderConfig()
    c.darkThreshold = 0.5
    c.lightThreshold = 0.5
    c.confirmSamples = 1
    c.minTransition = 0
    return c
  }

  public func validate() throws {
    guard (0...1).contains(darkThreshold), (0...1).contains(lightThreshold) else {
      throw ConfigError("thresholds must be within 0..1")
    }
    guard darkThreshold <= lightThreshold else { throw ConfigError("darkThreshold must not exceed lightThreshold") }
    guard confirmSamples >= 1 else { throw ConfigError("confirmSamples must be at least 1") }
  }
}

public struct ConfigError: Error, CustomStringConvertible {
  public let description: String
  public init(_ description: String) { self.description = description }
}

/// Hysteresis plus a short confirmation so slow scrolls and animated gradients don't flicker the
/// icons. Readings between the thresholds keep the current style.
public final class StyleDecider {
  public var config: DeciderConfig
  public private(set) var style: IconStyle?
  private var pending: IconStyle?
  private var pendingCount = 0
  private var changedAt = -TimeInterval.greatestFiniteMagnitude

  /// A switch is waiting on confirmation or the transition interval, so sample again soon.
  public var hasPending: Bool { pending != nil }

  public init(config: DeciderConfig = DeciderConfig()) {
    self.config = config
  }

  /// Returns the new style when it changes, otherwise nil.
  public func offer(_ lightness: Float, now: TimeInterval) -> IconStyle? {
    let c = config
    guard let current = style else {
      return commit(lightness >= (c.darkThreshold + c.lightThreshold) / 2 ? .dark : .light, now)
    }
    let candidate: IconStyle
    if lightness >= c.lightThreshold {
      candidate = .dark
    } else if lightness < c.darkThreshold {
      candidate = .light
    } else {
      candidate = current
    }
    if candidate == current {
      pending = nil
      pendingCount = 0
      return nil
    }
    pendingCount = candidate == pending ? pendingCount + 1 : 1
    pending = candidate
    let strong = lightness >= c.lightThreshold + c.strongMargin || lightness <= c.darkThreshold - c.strongMargin
    if !strong && pendingCount < c.confirmSamples { return nil }
    if now - changedAt < c.minTransition { return nil }
    return commit(candidate, now)
  }

  public func reset() {
    style = nil
    pending = nil
    pendingCount = 0
    changedAt = -TimeInterval.greatestFiniteMagnitude
  }

  private func commit(_ next: IconStyle, _ now: TimeInterval) -> IconStyle {
    style = next
    pending = nil
    pendingCount = 0
    changedAt = now
    return next
  }
}
