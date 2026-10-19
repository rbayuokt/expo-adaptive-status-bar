import { useFrameCallback, useSharedValue } from 'react-native-reanimated'

/**
 * Counts UI-thread frames on the UI thread itself. A frame counts as janky when it took longer
 * than 1.5x the display's usual frame time, which works on 60 and 120 Hz screens alike.
 */
export function useFrameMonitor() {
  const frames = useSharedValue(0)
  const janky = useSharedValue(0)
  const worst = useSharedValue(0)
  const typical = useSharedValue(1000 / 60)

  useFrameCallback(({ timeSincePreviousFrame: dt }) => {
    'worklet'
    if (dt == null || dt <= 0) return
    frames.value += 1
    // Slow frames stay out of the baseline. Snapping to the shortest interval broke on real
    // phones: one jittery 11 ms timestamp made every normal 60 Hz frame count as slow.
    if (dt > typical.value * 1.5) janky.value += 1
    else typical.value = typical.value * 0.95 + dt * 0.05
    if (dt > worst.value) worst.value = dt
  })

  return {
    read: () => ({ frames: frames.value, janky: janky.value, worstMs: worst.value }),
    reset: () => {
      frames.value = 0
      janky.value = 0
      worst.value = 0
    },
  }
}
