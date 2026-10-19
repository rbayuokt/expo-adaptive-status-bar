import Foundation

/// Lightness of the strip under the status bar, 0 (black) to 1 (white), plus each side's.
public struct Measurement: Equatable {
  public var lightness: Float = 0
  public var left: Float = 0
  public var right: Float = 0
}

/// Turns the sampled strip into one lightness value. Icons sit in the left and right clusters, so
/// only those zones count, the middle is usually empty or the Dynamic Island. Each zone averages
/// linear luminance, then the brightest and darkest zone are combined at the point where white and
/// black icons get the same WCAG contrast, so a split background picks the side-safe style.
public enum LuminanceAnalyzer {
  public static let zoneFraction: Float = 0.35

  private static let linear: [Float] = (0..<256).map { i in
    let c = Float(i) / 255
    return c <= 0.04045 ? c / 12.92 : powf((c + 0.055) / 1.055, 2.4)
  }

  /// `pixels` is 4 bytes per pixel, red, green and blue in the first three (RGBA or RGBX).
  public static func analyze(_ pixels: UnsafePointer<UInt8>, width: Int, height: Int, bytesPerRow: Int) -> Measurement {
    let zone = max(1, Int(Float(width) * zoneFraction))
    var left: Float = 0
    var right: Float = 0
    linear.withUnsafeBufferPointer { lut in
      for y in 0..<height {
        let row = pixels + y * bytesPerRow
        for x in 0..<zone { left += luminance(row + x * 4, lut) }
        for x in (width - zone)..<width { right += luminance(row + x * 4, lut) }
      }
    }
    let n = Float(zone * height)
    left /= n
    right /= n
    return Measurement(
      lightness: lightness(balanced(darkest: min(left, right), brightest: max(left, right))),
      left: lightness(left),
      right: lightness(right))
  }

  @inline(__always)
  private static func luminance(_ p: UnsafePointer<UInt8>, _ lut: UnsafeBufferPointer<Float>) -> Float {
    0.2126 * lut[Int(p[0])] + 0.7152 * lut[Int(p[1])] + 0.0722 * lut[Int(p[2])]
  }

  public static func luminance(r: UInt8, g: UInt8, b: UInt8) -> Float {
    0.2126 * linear[Int(r)] + 0.7152 * linear[Int(g)] + 0.0722 * linear[Int(b)]
  }

  /// Luminance where the worse of the two zones is equally readable with either icon color.
  public static func balanced(darkest: Float, brightest: Float) -> Float {
    sqrtf((darkest + 0.05) * (brightest + 0.05)) - 0.05
  }

  /// CIE L* scaled to 0..1, so 0.5 is perceptual mid grey rather than 50% linear light.
  public static func lightness(_ y: Float) -> Float {
    let l = y > 0.008856 ? 116 * cbrtf(y) - 16 : 903.3 * y
    return min(1, max(0, l / 100))
  }
}
