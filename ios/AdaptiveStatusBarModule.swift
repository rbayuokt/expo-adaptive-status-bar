import ExpoModulesCore

struct ConfigRecord: Record {
  @Field var strategy: String = "hybrid"
  @Field var performance: String = "balanced"
  @Field var samplingInterval: Double?
  @Field var maxInterval: Double?
  @Field var quietInterval: Double?
  @Field var idleInterval: Double?
  @Field var hysteresis: Bool = true
  @Field var darkThreshold: Double?
  @Field var lightThreshold: Double?
  @Field var confirmSamples: Int?
  @Field var minTransitionInterval: Double?
  @Field var animation: Bool = true
  @Field var fallbackStyle: String?
  @Field var iosCaptureMethod: String?

  func config() throws -> ControllerConfig {
    var c = ControllerConfig()
    c.strategy = Strategy(rawValue: strategy) ?? .hybrid
    let preset = SamplingConfig.preset(performance)
    let minInterval = samplingInterval.map { $0 / 1000 } ?? preset.minInterval
    let maxI = maxInterval.map { $0 / 1000 } ?? max(preset.maxInterval, minInterval)
    c.sampling = SamplingConfig(
      minInterval: minInterval,
      maxInterval: maxI,
      quietInterval: quietInterval.map { $0 / 1000 } ?? max(preset.quietInterval, maxI),
      idleInterval: idleInterval.map { $0 / 1000 } ?? preset.idleInterval)
    var d = hysteresis ? DeciderConfig() : DeciderConfig.noHysteresis
    if let v = darkThreshold { d.darkThreshold = Float(v) }
    if let v = lightThreshold { d.lightThreshold = Float(v) }
    if let v = confirmSamples { d.confirmSamples = v }
    if let v = minTransitionInterval { d.minTransition = v / 1000 }
    c.decider = d
    c.fallback = fallbackStyle.flatMap(IconStyle.init(rawValue:))
    c.animated = animation
    c.captureMethod = iosCaptureMethod.flatMap(CaptureMethod.init(rawValue:)) ?? .layer
    do {
      try c.sampling.validate()
      try d.validate()
    } catch let e as ConfigError {
      throw InvalidConfigException(e.description)
    }
    return c
  }
}

final class InvalidConfigException: GenericException<String>, @unchecked Sendable {
  override var reason: String { "Invalid AdaptiveStatusBar config: \(param)" }
}

public class AdaptiveStatusBarModule: Module {
  // Built with the module, not lazily: getStats runs on the JS thread and enable on main, and a
  // lazy var raced between them and could create two controllers.
  private let controller = AdaptiveStatusBarController()

  public func definition() -> ModuleDefinition {
    Name("AdaptiveStatusBar")

    OnCreate {
      self.controller.onChange = { [weak self] style, source, lightness in
        self?.sendEvent("onStyleChange", ["style": style.rawValue, "source": source, "lightness": lightness])
      }
    }

    Events("onStyleChange")

    // JS calls arrive off the main thread. The controller is main-thread only and async dispatch
    // keeps calls in order.
    Function("enable") { (r: ConfigRecord) in
      let config = try r.config()
      DispatchQueue.main.async { self.controller.enable(config) }
    }

    Function("disable") {
      DispatchQueue.main.async { self.controller.disable() }
    }

    Function("configure") { (r: ConfigRecord) in
      let config = try r.config()
      DispatchQueue.main.async { self.controller.configure(config) }
    }

    Function("setOverride") { (style: String?) in
      DispatchQueue.main.async { self.controller.setOverride(style.flatMap(IconStyle.init(rawValue:))) }
    }

    Function("setHint") { (style: String?) in
      DispatchQueue.main.async { self.controller.setHint(style.flatMap(IconStyle.init(rawValue:))) }
    }

    // Reads a locked copy on the JS thread. Going through the main queue would wake the run loop
    // and count as app activity.
    Function("getStats") { () -> [String: Any?] in
      self.controller.snapshot()
    }

    Function("resetStats") {
      DispatchQueue.main.async { self.controller.resetStats() }
    }

    OnAppEntersBackground {
      DispatchQueue.main.async { self.controller.pause() }
    }

    OnAppEntersForeground {
      DispatchQueue.main.async { self.controller.resume() }
    }

    OnDestroy {
      DispatchQueue.main.async { self.controller.disable() }
    }
  }
}
