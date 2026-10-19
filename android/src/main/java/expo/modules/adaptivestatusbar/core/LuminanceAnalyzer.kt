package expo.modules.adaptivestatusbar.core

import kotlin.math.cbrt
import kotlin.math.max
import kotlin.math.min
import kotlin.math.pow
import kotlin.math.sqrt

/** Lightness of the strip under the status bar, 0 (black) to 1 (white), plus each side's. */
class Measurement(var lightness: Float = 0f, var left: Float = 0f, var right: Float = 0f)

/**
 * Turns the sampled strip into one lightness value. Icons sit in the left and right clusters, so
 * only those zones count, the middle is usually empty or the camera cutout. Each zone averages
 * linear luminance, then the brightest and darkest zone are combined at the point where white and
 * black icons get the same WCAG contrast, so a split background picks the side-safe style.
 */
object LuminanceAnalyzer {
  const val ZONE_FRACTION = 0.35f

  private val linear = FloatArray(256) { i ->
    val c = i / 255f
    if (c <= 0.04045f) c / 12.92f else ((c + 0.055f) / 1.055f).pow(2.4f)
  }

  /** `pixels` are ARGB ints, row major. Fills and returns `out` so nothing is allocated per sample. */
  fun analyze(pixels: IntArray, width: Int, height: Int, out: Measurement = Measurement()): Measurement {
    val zone = max(1, (width * ZONE_FRACTION).toInt())
    var left = 0f
    var right = 0f
    for (y in 0 until height) {
      val row = y * width
      for (x in 0 until zone) left += luminance(pixels[row + x])
      for (x in width - zone until width) right += luminance(pixels[row + x])
    }
    val n = (zone * height).toFloat()
    left /= n
    right /= n
    out.left = lightness(left)
    out.right = lightness(right)
    out.lightness = lightness(balanced(min(left, right), max(left, right)))
    return out
  }

  fun luminance(argb: Int): Float =
    0.2126f * linear[(argb shr 16) and 0xFF] + 0.7152f * linear[(argb shr 8) and 0xFF] + 0.0722f * linear[argb and 0xFF]

  /** Luminance where the worse of the two zones is equally readable with either icon color. */
  fun balanced(darkest: Float, brightest: Float): Float =
    sqrt((darkest + 0.05f) * (brightest + 0.05f)) - 0.05f

  /** CIE L* scaled to 0..1, so 0.5 is perceptual mid grey rather than 50% linear light. */
  fun lightness(y: Float): Float {
    val l = if (y > 0.008856f) 116f * cbrt(y) - 16f else 903.3f * y
    return (l / 100f).coerceIn(0f, 1f)
  }
}
