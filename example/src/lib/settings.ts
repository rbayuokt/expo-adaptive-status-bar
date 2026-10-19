import {
  AdaptiveStatusBar,
  type DetectionStrategy,
  type PerformanceMode,
} from '@rbayuokt/expo-adaptive-status-bar'
import { useSyncExternalStore } from 'react'

export type Settings = {
  enabled: boolean
  strategy: DetectionStrategy
  performance: PerformanceMode
  hysteresis: boolean
  captureMethod: 'layer' | 'hierarchy'
  hud: boolean
}

let settings: Settings = {
  enabled: true,
  strategy: 'hybrid',
  performance: 'balanced',
  hysteresis: true,
  captureMethod: 'layer',
  hud: true,
}
const listeners = new Set<() => void>()

function apply(s: Settings) {
  if (!s.enabled) {
    AdaptiveStatusBar.disable()
    return
  }
  AdaptiveStatusBar.enable({
    strategy: s.strategy,
    performance: s.performance,
    hysteresis: s.hysteresis,
    ios: { captureMethod: s.captureMethod },
  })
}

export function initSettings() {
  apply(settings)
}

export function updateSettings(patch: Partial<Settings>) {
  const next = { ...settings, ...patch }
  const native = Object.keys(patch).some((k) => k !== 'hud')
  settings = next
  if (native) apply(next)
  listeners.forEach((l) => l())
}

export function getSettings() {
  return settings
}

export function useSettings(): Settings {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => settings
  )
}
