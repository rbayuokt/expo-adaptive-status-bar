import type { EventSubscription } from 'expo-modules-core'

import Native from './AdaptiveStatusBarModule'
import { StyleStack } from './StyleStack'
import { toNativeConfig } from './config'
import type {
  AdaptiveStatusBarConfig,
  AdaptiveStatusBarStats,
  IconStyle,
  StyleChangeEvent,
} from './types'

let config: AdaptiveStatusBarConfig = {}
let enabled = false
let warned = false
const imperativeKey = {}

function native() {
  if (!Native && !warned && __DEV__) {
    warned = true
    console.warn(
      '[@rbayuokt/expo-adaptive-status-bar] Native module not found. It needs a development build, it does not run in Expo Go or on web.'
    )
  }
  return Native
}

const overrides = new StyleStack((style) => native()?.setOverride(style))
const hints = new StyleStack((style) => native()?.setHint(style))

export const AdaptiveStatusBar = {
  /**
   * Starts adapting the status bar. Call once, e.g. in your root layout. Calling it again replaces
   * the config.
   */
  enable(options: AdaptiveStatusBarConfig = {}): void {
    const flat = toNativeConfig(options)
    config = options
    enabled = true
    native()?.enable(flat)
  },

  /** Stops sampling, releases native buffers and leaves the status bar as it is. */
  disable(): void {
    enabled = false
    native()?.disable()
  },

  /** Merges into the current config. Takes effect immediately when enabled. */
  configure(options: AdaptiveStatusBarConfig): void {
    const next = { ...config, ...options, ios: { ...config.ios, ...options.ios } }
    const flat = toNativeConfig(next)
    config = next
    if (enabled) native()?.configure(flat)
  },

  get isEnabled(): boolean {
    return enabled
  },

  get config(): Readonly<AdaptiveStatusBarConfig> {
    return config
  },

  /**
   * Forces a style in every strategy and pauses sampling until cleared. The most recent override
   * wins, whether it came from here or from `useStatusBarOverride`.
   */
  setOverride(style: IconStyle): void {
    overrides.set(imperativeKey, style)
  },

  clearOverride(): void {
    overrides.set(imperativeKey, null)
  },

  /**
   * Tells hybrid and manual mode what the current screen looks like, so it doesn't need sampling.
   * Prefer `useStatusBarHint` in screens, it cleans up on unmount.
   */
  setHint(style: IconStyle | null): void {
    hints.set(imperativeKey, style)
  },

  /** Diagnostics for benchmarks and debugging. Synchronous and cheap, it never touches the UI thread. */
  getStats(): AdaptiveStatusBarStats | null {
    return native()?.getStats() ?? null
  },

  /** Zeroes the counters and maxima, e.g. at the start of a benchmark run. */
  resetStats(): void {
    native()?.resetStats()
  },

  /** Fires when the applied style or its source changes. Never per sample. */
  addListener(listener: (event: StyleChangeEvent) => void): EventSubscription {
    return native()?.addListener('onStyleChange', listener) ?? { remove() {} }
  },
}

/** @internal used by the hooks */
export const stacks = { overrides, hints }
