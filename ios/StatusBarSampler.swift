import UIKit

enum SampleResult {
  case measured(Measurement, captureTime: TimeInterval, analysisTime: TimeInterval)
  case skipped
}

/// Renders only the status bar strip of the key window into a tiny reused bitmap. No screen
/// capture API exists on iOS, so this draws the app's own layers: video layers, Metal and OpenGL
/// content come out empty with the `layer` method. The status bar itself lives in another
/// process and is never part of the capture.
final class StatusBarSampler {
  static let width = 96
  static let height = 8

  private var buffer: UnsafeMutablePointer<UInt8>?
  private var context: CGContext?

  deinit { release() }

  func release() {
    context = nil
    buffer?.deallocate()
    buffer = nil
  }

  func capture(method: CaptureMethod) -> SampleResult {
    guard let scene = Self.activeScene(),
          let manager = scene.statusBarManager, !manager.isStatusBarHidden,
          let window = scene.keyWindow ?? scene.windows.first(where: { $0.isKeyWindow }),
          let ctx = makeContext(), let pixels = buffer
    else { return .skipped }
    let frame = window.convert(manager.statusBarFrame, from: nil)
    guard frame.width > 0, frame.height > 0 else { return .skipped }

    let start = CACurrentMediaTime()
    let w = CGFloat(Self.width)
    let h = CGFloat(Self.height)
    ctx.saveGState()
    // Transparent areas show black on screen, so start from black.
    ctx.setFillColor(gray: 0, alpha: 1)
    ctx.fill(CGRect(x: 0, y: 0, width: w, height: h))
    // Flip to UIKit coordinates and scale the strip down to the bitmap.
    ctx.translateBy(x: 0, y: h)
    ctx.scaleBy(x: w / frame.width, y: -h / frame.height)
    ctx.translateBy(x: -frame.minX, y: -frame.minY)
    // Nearest neighbour reads only the pixels it needs. Smoother filters resample the whole source
    // image first, which cost ~9 ms for a full-screen photo.
    ctx.interpolationQuality = .none
    switch method {
    case .layer:
      StripRenderer.render(window.layer, strip: frame, in: ctx)
    case .hierarchy:
      UIGraphicsPushContext(ctx)
      window.drawHierarchy(in: window.bounds, afterScreenUpdates: false)
      UIGraphicsPopContext()
    }
    ctx.restoreGState()
    let captured = CACurrentMediaTime()
    let m = LuminanceAnalyzer.analyze(pixels, width: Self.width, height: Self.height, bytesPerRow: Self.width * 4)
    return .measured(m, captureTime: captured - start, analysisTime: CACurrentMediaTime() - captured)
  }

  private func makeContext() -> CGContext? {
    if let context { return context }
    let bytes = Self.width * Self.height * 4
    let data = UnsafeMutablePointer<UInt8>.allocate(capacity: bytes)
    data.initialize(repeating: 0, count: bytes)
    guard let space = CGColorSpace(name: CGColorSpace.sRGB),
          let ctx = CGContext(
            data: data, width: Self.width, height: Self.height, bitsPerComponent: 8, bytesPerRow: Self.width * 4,
            space: space, bitmapInfo: CGImageAlphaInfo.noneSkipLast.rawValue | CGBitmapInfo.byteOrder32Big.rawValue)
    else {
      data.deallocate()
      return nil
    }
    buffer = data
    context = ctx
    return ctx
  }

  static func activeScene() -> UIWindowScene? {
    var fallback: UIWindowScene?
    for case let scene as UIWindowScene in UIApplication.shared.connectedScenes {
      if scene.activationState == .foregroundActive { return scene }
      if scene.activationState == .foregroundInactive { fallback = scene }
    }
    return fallback
  }
}
