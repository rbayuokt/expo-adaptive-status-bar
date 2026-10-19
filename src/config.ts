import type { NativeConfig } from './AdaptiveStatusBarModule'
import type { AdaptiveStatusBarConfig } from './types'

const STRATEGIES = ['automatic', 'hybrid', 'manual']
const PERFORMANCE = ['battery', 'balanced', 'responsive']
const STYLES = ['light', 'dark']

function fail(message: string): never {
  throw new RangeError(`[@rbayuokt/expo-adaptive-status-bar] ${message}`)
}

function checkNumber(name: string, value: number | undefined, min: number, max: number) {
  if (value === undefined) return
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) {
    fail(`${name} must be a number between ${min} and ${max}, got ${String(value)}`)
  }
}

/** Validates the config and flattens it for native. Throws a RangeError on bad input. */
export function toNativeConfig(config: AdaptiveStatusBarConfig): NativeConfig {
  const {
    strategy = 'hybrid',
    performance = 'balanced',
    samplingInterval,
    maxInterval,
    quietInterval,
    idleInterval,
    hysteresis = true,
    confirmSamples,
    minTransitionInterval,
    animation = true,
    fallbackStyle,
    ios,
  } = config

  if (!STRATEGIES.includes(strategy)) fail(`unknown strategy "${strategy}"`)
  if (!PERFORMANCE.includes(performance)) fail(`unknown performance mode "${performance}"`)
  if (fallbackStyle !== undefined && !STYLES.includes(fallbackStyle)) {
    fail(`fallbackStyle must be "light" or "dark"`)
  }
  checkNumber('samplingInterval', samplingInterval, 16, 10000)
  checkNumber('maxInterval', maxInterval, 16, 60000)
  checkNumber('quietInterval', quietInterval, 16, 60000)
  checkNumber('idleInterval', idleInterval, 0, 600000)
  checkNumber('minTransitionInterval', minTransitionInterval, 0, 10000)
  checkNumber('confirmSamples', confirmSamples, 1, 10)
  if (confirmSamples !== undefined && !Number.isInteger(confirmSamples)) {
    fail('confirmSamples must be an integer')
  }
  if (
    maxInterval !== undefined &&
    samplingInterval !== undefined &&
    maxInterval < samplingInterval
  ) {
    fail('maxInterval must be at least samplingInterval')
  }
  if (quietInterval !== undefined && maxInterval !== undefined && quietInterval < maxInterval) {
    fail('quietInterval must be at least maxInterval')
  }
  if (idleInterval !== undefined && idleInterval > 0 && idleInterval < 100) {
    fail('idleInterval must be 0 (off) or at least 100 ms')
  }
  if (ios?.captureMethod !== undefined && !['layer', 'hierarchy'].includes(ios.captureMethod)) {
    fail(`unknown ios.captureMethod "${ios.captureMethod}"`)
  }

  let thresholds: { darkThreshold?: number; lightThreshold?: number } = {}
  if (typeof hysteresis === 'object') {
    checkNumber('hysteresis.darkThreshold', hysteresis.darkThreshold, 0, 1)
    checkNumber('hysteresis.lightThreshold', hysteresis.lightThreshold, 0, 1)
    if (hysteresis.darkThreshold > hysteresis.lightThreshold) {
      fail('hysteresis.darkThreshold must not exceed hysteresis.lightThreshold')
    }
    thresholds = hysteresis
  }

  return {
    strategy,
    performance,
    samplingInterval,
    maxInterval,
    quietInterval,
    idleInterval,
    hysteresis: hysteresis !== false,
    darkThreshold: thresholds.darkThreshold,
    lightThreshold: thresholds.lightThreshold,
    confirmSamples,
    minTransitionInterval,
    animation,
    fallbackStyle,
    iosCaptureMethod: ios?.captureMethod,
  }
}
