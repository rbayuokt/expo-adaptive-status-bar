package expo.modules.adaptivestatusbar

import android.os.Handler
import android.os.Looper
import expo.modules.adaptivestatusbar.core.DeciderConfig
import expo.modules.adaptivestatusbar.core.IconStyle
import expo.modules.adaptivestatusbar.core.SamplingConfig
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.records.Field
import expo.modules.kotlin.records.Record

class ConfigRecord : Record {
  @Field val strategy: String = "hybrid"
  @Field val performance: String = "balanced"
  @Field val samplingInterval: Double? = null
  @Field val maxInterval: Double? = null
  @Field val quietInterval: Double? = null
  @Field val idleInterval: Double? = null
  @Field val hysteresis: Boolean = true
  @Field val darkThreshold: Double? = null
  @Field val lightThreshold: Double? = null
  @Field val confirmSamples: Int? = null
  @Field val minTransitionInterval: Double? = null
  @Field val fallbackStyle: String? = null

  fun toConfig(): ControllerConfig {
    val preset = SamplingConfig.preset(performance)
    val min = samplingInterval?.toLong() ?: preset.minIntervalMs
    val max = maxInterval?.toLong() ?: maxOf(preset.maxIntervalMs, min)
    val sampling = SamplingConfig(
      minIntervalMs = min,
      maxIntervalMs = max,
      quietIntervalMs = quietInterval?.toLong() ?: maxOf(preset.quietIntervalMs, max),
      idleIntervalMs = idleInterval?.toLong() ?: preset.idleIntervalMs,
    )
    val base = if (hysteresis) DeciderConfig() else DeciderConfig.NO_HYSTERESIS
    val decider = base.copy(
      darkThreshold = darkThreshold?.toFloat() ?: base.darkThreshold,
      lightThreshold = lightThreshold?.toFloat() ?: base.lightThreshold,
      confirmSamples = confirmSamples ?: base.confirmSamples,
      minTransitionMs = minTransitionInterval?.toLong() ?: base.minTransitionMs,
    )
    val s = Strategy.entries.firstOrNull { it.name.equals(strategy, ignoreCase = true) } ?: Strategy.HYBRID
    return ControllerConfig(s, sampling, decider, IconStyle.of(fallbackStyle))
  }
}

class AdaptiveStatusBarModule : Module() {
  private val main = Handler(Looper.getMainLooper())

  private val controller = AdaptiveStatusBarController { style, source, lightness ->
    sendEvent(
      "onStyleChange",
      mapOf("style" to style.label, "source" to source, "lightness" to lightness.takeUnless { it.isNaN() })
    )
  }

  // JS calls arrive off the main thread. The controller is main-thread only, and posting keeps
  // calls in order.
  private fun onMain(block: () -> Unit) {
    main.post(block)
  }

  private fun attachCurrent() {
    appContext.currentActivity?.let(controller::attach)
  }

  override fun definition() = ModuleDefinition {
    Name("AdaptiveStatusBar")

    Events("onStyleChange")

    Function("enable") { r: ConfigRecord ->
      val config = r.toConfig()
      onMain {
        attachCurrent()
        controller.enable(config)
      }
    }

    Function("disable") { onMain { controller.disable() } }

    Function("configure") { r: ConfigRecord ->
      val config = r.toConfig()
      onMain { controller.configure(config) }
    }

    Function("setOverride") { style: String? -> onMain { controller.setOverride(IconStyle.of(style)) } }

    Function("setHint") { style: String? -> onMain { controller.setHint(IconStyle.of(style)) } }

    // Plain field reads on the JS thread, so polling never posts work to the main thread. A torn
    // read only skews one diagnostic poll.
    Function("getStats") { controller.snapshot() }

    Function("resetStats") { onMain { controller.resetStats() } }

    OnActivityEntersForeground {
      attachCurrent()
      controller.resume()
    }

    OnActivityEntersBackground { controller.pause() }

    OnActivityDestroys { controller.detach() }

    OnDestroy { main.post { controller.disable() } }
  }
}
