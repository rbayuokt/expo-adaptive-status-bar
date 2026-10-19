import UIKit

public enum Strategy: String {
  case automatic, hybrid, manual
}

/// `layer` renders the window's layer tree on the CPU. `hierarchy` asks UIKit for the on-screen
/// snapshot, which includes blur views but costs more. See the README's iOS notes.
public enum CaptureMethod: String {
  case layer, hierarchy
}

public struct ControllerConfig {
  public var strategy: Strategy = .hybrid
  public var sampling = SamplingConfig()
  public var decider = DeciderConfig()
  /// Used when nothing else decides: manual mode with no hint, or sampling unsupported.
  public var fallback: IconStyle?
  public var animated = true
  public var captureMethod: CaptureMethod = .layer

  public init() {}
}

/// Samples the strip under the status bar and sets the app's status bar style. Has no Expo
/// dependency, so a plain UIKit app can use it too. Main thread only.
///
/// The style goes through `UIApplication.setStatusBarStyle`, the same call React Native's
/// StatusBar uses, which needs `UIViewControllerBasedStatusBarAppearance` set to NO. That is the
/// Expo and React Native default. With YES the system asks view controllers instead, which a
/// module can't take over without swizzling, so the controller reports itself unsupported.
public final class AdaptiveStatusBarController {
  public private(set) var config = ControllerConfig()
  public private(set) var override: IconStyle?
  public private(set) var hint: IconStyle?
  public private(set) var stats = Stats()
  /// Copy of the stats readable from any thread, so diagnostics never wake the main run loop.
  private let lock = NSLock()
  private var published: [String: Any?] = [:]

  /// Main thread only, set before enabling.
  public var onChange: (IconStyle, String, Float?) -> Void
  private let scheduler = SamplingScheduler()
  private let decider = StyleDecider()
  private let sampler = StatusBarSampler()
  private var enabled = false
  private var paused = false
  private var observer: CFRunLoopObserver?
  /// One reused timer. Leeway lets the system batch our wake-ups with others.
  private var timer: DispatchSourceTimer?
  /// Our own tick wakes the run loop too, that wake-up isn't app activity.
  private var ownWake = false
  private var applied: IconStyle?
  private var appliedSource = "none"

  public static let appearanceSupported: Bool = {
    let vcBased = Bundle.main.object(forInfoDictionaryKey: "UIViewControllerBasedStatusBarAppearance") as? Bool ?? true
    if vcBased {
      NSLog("[AdaptiveStatusBar] UIViewControllerBasedStatusBarAppearance is YES, the style can't be set. Set it to NO (the @rbayuokt/expo-adaptive-status-bar config plugin does this).")
    }
    return !vcBased
  }()

  public init(onChange: @escaping (IconStyle, String, Float?) -> Void = { _, _, _ in }) {
    self.onChange = onChange
    publish()
  }

  deinit {
    if let observer { CFRunLoopObserverInvalidate(observer) }
    timer?.cancel()
  }

  public func enable(_ next: ControllerConfig) {
    apply(config: next)
    enabled = true
    restart()
  }

  public func disable() {
    enabled = false
    stop()
    sampler.release()
    timer?.cancel()
    timer = nil
    applied = nil
    appliedSource = "none"
    publish()
  }

  public func configure(_ next: ControllerConfig) {
    let restartNeeded = next.strategy != config.strategy || next.captureMethod != config.captureMethod
    apply(config: next)
    guard enabled else { return }
    if restartNeeded { restart() } else { applyResolved(); publish() }
  }

  public func setOverride(_ style: IconStyle?) {
    guard style != override else { return }
    override = style
    if enabled { restart() }
  }

  public func setHint(_ style: IconStyle?) {
    guard style != hint else { return }
    hint = style
    if enabled { restart() }
  }

  public func pause() {
    paused = true
    stop()
    publish()
  }

  public func resume() {
    paused = false
    if enabled { restart() }
  }

  private func apply(config next: ControllerConfig) {
    config = next
    scheduler.config = next.sampling
    decider.config = next.decider
  }

  private func restart() {
    defer { publish() }
    stop()
    guard !paused else { return }
    applyResolved()
    guard needsSampling else { return }
    startObserving()
    schedule(after: 0)
  }

  private func stop() {
    timer?.schedule(deadline: .distantFuture)
    stopObserving()
    scheduler.reset()
    decider.reset()
  }

  /// Overrides always win, then the hint in hybrid/manual, so sampling would be wasted work.
  private var needsSampling: Bool {
    if override != nil || config.strategy == .manual { return false }
    if config.strategy == .hybrid && hint != nil { return false }
    return Self.appearanceSupported
  }

  private func startObserving() {
    guard observer == nil else { return }
    // Before waiting fires once per run loop turn that did work: touches, scrolling, display link
    // callbacks, React commits. An idle app sleeps and this never fires. Order runs it after
    // Core Animation's commit observer.
    let o = CFRunLoopObserverCreateWithHandler(nil, CFRunLoopActivity.beforeWaiting.rawValue, true, 2_000_001) { [weak self] _, _ in
      self?.onRunLoopActivity()
    }
    CFRunLoopAddObserver(CFRunLoopGetMain(), o, .commonModes)
    observer = o
    attachTouchObserver()
  }

  private func stopObserving() {
    touchObserver.view?.removeGestureRecognizer(touchObserver)
    guard let o = observer else { return }
    CFRunLoopObserverInvalidate(o)
    observer = nil
  }

  /// Touches reset the sampling rate to its fastest, so scrolling right after a quiet stretch is
  /// picked up at once. Watches the key window only, never recognizes, never delays or cancels.
  private lazy var touchObserver = TouchObserver { [weak self] in self?.onTouch() }

  private func attachTouchObserver() {
    guard let window = StatusBarSampler.activeScene()?.keyWindow, touchObserver.view !== window else { return }
    touchObserver.view?.removeGestureRecognizer(touchObserver)
    window.addGestureRecognizer(touchObserver)
  }

  private func onTouch() {
    if let delay = scheduler.onInteraction(now: CACurrentMediaTime()) { schedule(after: delay) }
  }

  private func onRunLoopActivity() {
    // Attaches once a key window exists, launch can start sampling before there is one.
    if touchObserver.view == nil { attachTouchObserver() }
    if ownWake {
      ownWake = false
      return
    }
    stats.activitySignals += 1
    if let delay = scheduler.onActivity(now: CACurrentMediaTime()) { schedule(after: delay) }
  }

  private func schedule(after delay: TimeInterval) {
    let t = timer ?? makeTimer()
    t.schedule(deadline: .now() + delay, repeating: .never, leeway: .milliseconds(max(1, Int(delay * 100))))
  }

  private func makeTimer() -> DispatchSourceTimer {
    let t = DispatchSource.makeTimerSource(queue: .main)
    t.setEventHandler { [weak self] in
      guard let self else { return }
      self.ownWake = true
      self.sample()
    }
    t.schedule(deadline: .distantFuture)
    t.resume()
    timer = t
    return t
  }

  private func sample() {
    let start = CACurrentMediaTime()
    scheduler.onTick(now: start)
    let result = sampler.capture(method: config.captureMethod)
    let end = CACurrentMediaTime()
    var lightness: Float?
    switch result {
    case let .measured(m, captureTime, analysisTime):
      stats.record(m, capture: captureTime, analysis: analysisTime)
      lightness = m.lightness
      if decider.offer(m.lightness, now: end) != nil { stats.styleChanges += 1 }
    case .skipped:
      // Hidden status bar, landscape iPhone, no active scene. Showing it again wakes the run loop.
      stats.skipped += 1
    }
    applyResolved()
    if let delay = scheduler.onSampleFinished(now: end, lightness: lightness, pending: decider.hasPending) {
      schedule(after: delay)
    }
    stats.recordMain(CACurrentMediaTime() - start)
    publish()
  }

  private func resolve() -> (IconStyle?, String) {
    if let o = override { return (o, "override") }
    if config.strategy != .automatic, let h = hint { return (h, "hint") }
    if config.strategy != .manual, let s = decider.style { return (s, "sample") }
    return (config.fallback, "fallback")
  }

  private func applyResolved() {
    let (resolved, source) = resolve()
    guard let style = resolved, Self.appearanceSupported else { return }
    let target: UIStatusBarStyle = style == .light ? .lightContent : .darkContent
    let app = UIApplication.shared
    let current = StatusBarSampler.activeScene()?.statusBarManager?.statusBarStyle
    if current != target {
      if applied == style { stats.externalWrites += 1 }
      app.setStatusBarStyle(target, animated: config.animated)
    }
    if applied != style || appliedSource != source {
      applied = style
      appliedSource = source
      onChange(style, source, stats.lightness)
    }
  }

  public func resetStats() {
    stats = Stats()
    publish()
  }

  /// Thread safe. Returns the stats as of the last sample or state change.
  public func snapshot() -> [String: Any?] {
    lock.lock()
    defer { lock.unlock() }
    return published
  }

  private func publish() {
    var s = stats.dictionary()
    s["supported"] = Self.appearanceSupported
    s["enabled"] = enabled
    s["paused"] = paused
    s["sampling"] = observer != nil
    s["style"] = applied?.rawValue
    s["source"] = appliedSource
    s["intervalMs"] = scheduler.interval * 1000
    s["strategy"] = config.strategy.rawValue
    lock.lock()
    published = s
    lock.unlock()
  }

  public struct Stats {
    public var samples = 0
    public var failures = 0
    public var skipped = 0
    public var styleChanges = 0
    public var externalWrites = 0
    public var activitySignals = 0
    public var captureTotal: TimeInterval = 0
    public var captureMax: TimeInterval = 0
    public var analysisTotal: TimeInterval = 0
    public var analysisMax: TimeInterval = 0
    public var ticks = 0
    public var mainTotal: TimeInterval = 0
    public var mainMax: TimeInterval = 0
    public var lightness: Float?
    public var left: Float?
    public var right: Float?

    mutating func record(_ m: Measurement, capture: TimeInterval, analysis: TimeInterval) {
      samples += 1
      captureTotal += capture
      analysisTotal += analysis
      captureMax = max(captureMax, capture)
      analysisMax = max(analysisMax, analysis)
      lightness = m.lightness
      left = m.left
      right = m.right
    }

    mutating func recordMain(_ t: TimeInterval) {
      ticks += 1
      mainTotal += t
      mainMax = max(mainMax, t)
    }

    func dictionary() -> [String: Any?] {
      let n = Double(max(samples, 1))
      return [
        "samples": samples,
        "failures": failures,
        "skipped": skipped,
        "styleChanges": styleChanges,
        "externalWrites": externalWrites,
        "activitySignals": activitySignals,
        "captureMsAvg": captureTotal / n * 1000,
        "captureMsMax": captureMax * 1000,
        "analysisMsAvg": analysisTotal / n * 1000,
        "analysisMsMax": analysisMax * 1000,
        "mainThreadMsAvg": mainTotal / Double(max(ticks, 1)) * 1000,
        "mainThreadMsMax": mainMax * 1000,
        "lightness": lightness,
        "left": left,
        "right": right,
      ]
    }
  }
}

/// Passive recognizer: reports touch starts and stays out of everyone's way.
final class TouchObserver: UIGestureRecognizer {
  private let onTouch: () -> Void

  init(onTouch: @escaping () -> Void) {
    self.onTouch = onTouch
    super.init(target: nil, action: nil)
    cancelsTouchesInView = false
    delaysTouchesBegan = false
    delaysTouchesEnded = false
    requiresExclusiveTouchType = false
  }

  override func touchesBegan(_ touches: Set<UITouch>, with event: UIEvent) {
    onTouch()
    // Failing straight away keeps it from ever taking part in recognition.
    state = .failed
  }

  override func canPrevent(_ preventedGestureRecognizer: UIGestureRecognizer) -> Bool { false }
  override func canBePrevented(by preventingGestureRecognizer: UIGestureRecognizer) -> Bool { false }
}
