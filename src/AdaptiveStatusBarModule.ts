import { NativeModule, requireOptionalNativeModule } from 'expo'

import type { AdaptiveStatusBarStats, StyleChangeEvent } from './types'

export type NativeConfig = {
  strategy: string
  performance: string
  samplingInterval?: number
  maxInterval?: number
  quietInterval?: number
  idleInterval?: number
  hysteresis: boolean
  darkThreshold?: number
  lightThreshold?: number
  confirmSamples?: number
  minTransitionInterval?: number
  animation: boolean
  fallbackStyle?: string
  iosCaptureMethod?: string
}

type Events = {
  onStyleChange(event: StyleChangeEvent): void
}

declare class AdaptiveStatusBarNativeModule extends NativeModule<Events> {
  enable(config: NativeConfig): void
  disable(): void
  configure(config: NativeConfig): void
  setOverride(style: string | null): void
  setHint(style: string | null): void
  getStats(): AdaptiveStatusBarStats
  resetStats(): void
}

/** Null on web and in Expo Go, where the native module doesn't exist. */
export default requireOptionalNativeModule<AdaptiveStatusBarNativeModule>('AdaptiveStatusBar')
