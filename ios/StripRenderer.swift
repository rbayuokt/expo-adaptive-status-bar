import UIKit

/// Draws only the part of a layer tree that touches the status bar strip. `CALayer.render(in:)`
/// on the window would draw every layer, including offscreen pages and whole screens hidden
/// under the current one. Here plain container layers get their background filled directly and
/// are walked into, layers with real content (images, text, gradients) are drawn with
/// `render(in:)` as leaves, and anything behind an opaque layer covering the strip is skipped.
///
/// Layers that don't touch the strip cost only transform math. Graphics state is saved only
/// around actual drawing, clipping and group opacity.
enum StripRenderer {
  /// `ctx`'s transform must map `root`'s coordinates to the bitmap.
  static func render(_ root: CALayer, strip: CGRect, in ctx: CGContext) {
    draw(root, toRoot: .identity, strip: strip, ctx: ctx)
  }

  private static func draw(_ layer: CALayer, toRoot: CGAffineTransform, strip: CGRect, ctx: CGContext) {
    let bounds = layer.bounds
    let hits = bounds.applying(toRoot).intersects(strip)
    let sublayers = layer.sublayers
    let hasSublayers = !(sublayers?.isEmpty ?? true)

    let kind = kind(of: layer, hasSublayers: hasSublayers)
    guard kind != .leaf else {
      // Sublayers can overflow an unclipped parent, so only clipped leaves are culled whole.
      if hits || (hasSublayers && !layer.masksToBounds) {
        ctx.saveGState()
        ctx.concatenate(toRoot)
        layer.render(in: ctx)
        ctx.restoreGState()
      }
      return
    }
    if !hits && (layer.masksToBounds || !hasSublayers) { return }

    // Group opacity and clipping wrap the children, so they need their own graphics state.
    let translucent = hits && layer.opacity < 1
    let clips = hits && layer.masksToBounds && hasSublayers
    if translucent || clips { ctx.saveGState() }
    if translucent {
      ctx.setAlpha(CGFloat(layer.opacity))
      ctx.beginTransparencyLayer(auxiliaryInfo: nil)
    }
    if hits, let bg = layer.backgroundColor, bg.alpha > 0 {
      ctx.saveGState()
      ctx.concatenate(toRoot)
      ctx.addPath(shape(layer, bounds))
      ctx.setFillColor(bg)
      ctx.fillPath()
      ctx.restoreGState()
    }
    if hits && kind == .content, let contents = layer.contents {
      // Only this layer's own image. Its children are walked below.
      ctx.saveGState()
      ctx.concatenate(toRoot)
      drawImageContents(of: layer, image: contents as! CGImage, in: ctx)
      ctx.restoreGState()
    }
    if clips {
      var t = toRoot
      if let clip = shape(layer, bounds).copy(using: &t) {
        ctx.addPath(clip)
        ctx.clip()
      }
    }

    if hasSublayers, let sublayers {
      drawSublayers(sublayers, toRoot: toRoot, strip: strip, ctx: ctx)
    }

    // Borders sit above the sublayers.
    if hits && layer.borderWidth > 0, let color = layer.borderColor {
      let w = layer.borderWidth
      let r = max(0, layer.cornerRadius - w / 2)
      let inset = bounds.insetBy(dx: w / 2, dy: w / 2)
      ctx.saveGState()
      ctx.concatenate(toRoot)
      ctx.addPath(r > 0 ? CGPath(roundedRect: inset, cornerWidth: r, cornerHeight: r, transform: nil) : CGPath(rect: inset, transform: nil))
      ctx.setStrokeColor(color)
      ctx.setLineWidth(w)
      ctx.strokePath()
      ctx.restoreGState()
    }
    if translucent { ctx.endTransparencyLayer() }
    if translucent || clips { ctx.restoreGState() }
  }

  private static func drawSublayers(_ sublayers: [CALayer], toRoot: CGAffineTransform, strip: CGRect, ctx: CGContext) {
    // React Native maps zIndex to zPosition. Stable sort keeps array order for equal values.
    var ordered = sublayers
    if sublayers.contains(where: { $0.zPosition != 0 }) {
      ordered = sublayers.enumerated()
        .sorted { ($0.element.zPosition, $0.offset) < ($1.element.zPosition, $1.offset) }
        .map(\.element)
    }
    var first = 0
    for i in stride(from: ordered.count - 1, through: 0, by: -1) {
      let child = ordered[i]
      if visible(child), let t = toParent(child), covers(child, toRoot: t.concatenating(toRoot), strip: strip) {
        first = i
        break
      }
    }
    for i in first..<ordered.count {
      let child = ordered[i]
      guard visible(child), let t = toParent(child) else { continue }
      draw(child, toRoot: t.concatenating(toRoot), strip: strip, ctx: ctx)
    }
  }

  private static func shape(_ layer: CALayer, _ bounds: CGRect) -> CGPath {
    let r = layer.cornerRadius
    return r > 0 ? CGPath(roundedRect: bounds, cornerWidth: r, cornerHeight: r, transform: nil) : CGPath(rect: bounds, transform: nil)
  }

  /// System layers that draw without `contents`. Matched by name, nothing private is called.
  private static let selfDrawingPrefixes = ["CABackdrop", "CASDF", "CAPortal", "CAMetal", "CAEAGL", "AVPlayer"]

  private enum Kind {
    /// Background, border and sublayers only, drawn here.
    case plain
    /// An image with a plain gravity plus sublayers. The image is drawn here, the sublayers walked.
    case content
    /// Handed to `render(in:)` whole: gradients, masks, anything without sublayers.
    case leaf
  }

  private static func kind(of layer: CALayer, hasSublayers: Bool) -> Kind {
    if layer.contents == nil { return isPlain(layer) ? .plain : .leaf }
    guard hasSublayers, layer.mask == nil, CATransform3DIsIdentity(layer.sublayerTransform), !isSelfDrawing(layer),
          CFGetTypeID(layer.contents as CFTypeRef) == CGImage.typeID, layer.contentsRect == CGRect(x: 0, y: 0, width: 1, height: 1),
          plainGravities.contains(layer.contentsGravity)
    else { return .leaf }
    return .content
  }

  private static let plainGravities: Set<CALayerContentsGravity> = [.resize, .resizeAspect, .resizeAspectFill, .center]

  /// Draws a layer's image contents the way CA would for the common gravities. Nothing here
  /// touches a layer: any CA mutation starts a transaction, wakes the run loop and would count
  /// as app activity, so the sampler would keep itself busy.
  private static func drawImageContents(of layer: CALayer, image: CGImage, in ctx: CGContext) {
    let b = layer.bounds
    let scale = max(layer.contentsScale, 1)
    let size = CGSize(width: CGFloat(image.width) / scale, height: CGFloat(image.height) / scale)
    let r: CGRect
    switch layer.contentsGravity {
    case .resizeAspect, .resizeAspectFill:
      let sx = b.width / max(size.width, 1)
      let sy = b.height / max(size.height, 1)
      let k = layer.contentsGravity == .resizeAspect ? min(sx, sy) : max(sx, sy)
      r = CGRect(x: b.midX - size.width * k / 2, y: b.midY - size.height * k / 2, width: size.width * k, height: size.height * k)
    case .center:
      r = CGRect(x: b.midX - size.width / 2, y: b.midY - size.height / 2, width: size.width, height: size.height)
    default:
      r = b
    }
    if layer.masksToBounds {
      ctx.addPath(shape(layer, b))
      ctx.clip()
    }
    // CG draws an image's first row at the rect's max y. The context is y-down like UIKit, so
    // flip around the rect to keep the image upright, as render(in:) shows it.
    ctx.translateBy(x: 0, y: r.minY + r.maxY)
    ctx.scaleBy(x: 1, y: -1)
    ctx.draw(image, in: r)
  }

  /// A container we can draw ourselves: background, border, sublayers. Shadows fall outside the
  /// layer and are left out. Window and UIKit wrapper layers are subclasses, so this goes by
  /// what a layer draws rather than its exact class.
  private static func isPlain(_ layer: CALayer) -> Bool {
    layer.contents == nil && layer.mask == nil && CATransform3DIsIdentity(layer.sublayerTransform) && !isSelfDrawing(layer)
  }

  private static func isSelfDrawing(_ layer: CALayer) -> Bool {
    let cls: AnyClass = type(of: layer)
    if cls == CALayer.self { return false }
    let id = ObjectIdentifier(cls)
    if let known = selfDrawingClasses[id] { return known }
    let selfDrawing = layer is CAGradientLayer || layer is CAShapeLayer || layer is CATextLayer || layer is CAReplicatorLayer
      || layer is CAEmitterLayer || layer is CATiledLayer
      || selfDrawingPrefixes.contains { NSStringFromClass(cls).hasPrefix($0) }
    selfDrawingClasses[id] = selfDrawing
    return selfDrawing
  }

  /// Main thread only, like the rest of the sampler.
  private static var selfDrawingClasses: [ObjectIdentifier: Bool] = [:]

  private static func visible(_ layer: CALayer) -> Bool {
    !layer.isHidden && layer.opacity > 0.01
  }

  /// Opaque and covering the whole strip, so nothing behind it can show.
  private static func covers(_ layer: CALayer, toRoot: CGAffineTransform, strip: CGRect) -> Bool {
    guard layer.opacity >= 1, layer.cornerRadius == 0, toRoot.b == 0, toRoot.c == 0,
          let bg = layer.backgroundColor, bg.alpha >= 1, isPlain(layer)
    else { return false }
    return layer.bounds.applying(toRoot).contains(strip)
  }

  /// Maps the layer's coordinates into its superlayer's. Nil for 3D transforms, which can't be
  /// drawn into a bitmap context.
  private static func toParent(_ layer: CALayer) -> CGAffineTransform? {
    let t3 = layer.transform
    guard CATransform3DIsAffine(t3) else { return nil }
    let b = layer.bounds
    let a = layer.anchorPoint
    let p = layer.position
    var t = CGAffineTransform(translationX: -a.x * b.width - b.minX, y: -a.y * b.height - b.minY)
    if !CATransform3DIsIdentity(t3) { t = t.concatenating(CATransform3DGetAffineTransform(t3)) }
    return t.concatenating(CGAffineTransform(translationX: p.x, y: p.y))
  }
}
