import { useEffect, useState } from 'react'

import { AdaptiveStatusBar, stacks } from './AdaptiveStatusBar'
import type { AdaptiveStatusBarStats, IconStyle } from './types'

function useStackEntry(stack: typeof stacks.overrides, style: IconStyle | null) {
  const [key] = useState(() => ({}))
  useEffect(() => {
    stack.set(key, style)
  }, [stack, key, style])
  useEffect(() => () => stack.set(key, null), [stack, key])
}

/**
 * Forces a style while the component is mounted. Pass null to skip, e.g.
 * `useStatusBarOverride(isFocused ? 'light' : null)` with React Navigation's `useIsFocused`.
 */
export function useStatusBarOverride(style: IconStyle | null): void {
  useStackEntry(stacks.overrides, style)
}

/**
 * Declares what this screen looks like under the status bar. In `hybrid` (the default) sampling
 * pauses while a hint is set. Pass null when unfocused, the same way as `useStatusBarOverride`.
 */
export function useStatusBarHint(style: IconStyle | null): void {
  useStackEntry(stacks.hints, style)
}

function sameStats(a: AdaptiveStatusBarStats | null, b: AdaptiveStatusBarStats | null) {
  if (!a || !b) return a === b
  for (const k in b) {
    if (a[k as keyof AdaptiveStatusBarStats] !== b[k as keyof AdaptiveStatusBarStats]) return false
  }
  return true
}

/**
 * Polls `getStats` for debug overlays and benchmarks. Re-renders only when a value changed, an
 * idle app stays idle. `intervalMs` 0 stops polling.
 */
export function useAdaptiveStatusBarStats(intervalMs = 1000): AdaptiveStatusBarStats | null {
  const [stats, setStats] = useState<AdaptiveStatusBarStats | null>(null)
  useEffect(() => {
    if (intervalMs <= 0) return
    const poll = () => {
      const next = AdaptiveStatusBar.getStats()
      setStats((prev) => (sameStats(prev, next) ? prev : next))
    }
    poll()
    const id = setInterval(poll, intervalMs)
    return () => clearInterval(id)
  }, [intervalMs])
  return stats
}
