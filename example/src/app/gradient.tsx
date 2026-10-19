import { useEffect, useState } from 'react'
import { StyleSheet, Text, useWindowDimensions, View } from 'react-native'
import Animated, {
  cancelAnimation,
  Easing,
  interpolate,
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { BackButton } from '../components/BackButton'
import { Segmented } from '../components/ui'
import { colors, radius, type } from '../theme'

const SPEEDS = [
  { value: 'slow', label: 'Slow 8s', ms: 8000 },
  { value: 'medium', label: 'Medium 3s', ms: 3000 },
  { value: 'fast', label: 'Fast 0.8s', ms: 800 },
] as const

export default function Gradient() {
  const { width, height } = useWindowDimensions()
  const insets = useSafeAreaInsets()
  const [speed, setSpeed] = useState<(typeof SPEEDS)[number]['value']>('slow')
  const t = useSharedValue(0)

  useEffect(() => {
    const ms = SPEEDS.find((s) => s.value === speed)!.ms
    t.value = 0
    t.value = withRepeat(
      withTiming(1, { duration: ms, easing: Easing.inOut(Easing.sin) }),
      -1,
      true
    )
    return () => cancelAnimation(t)
  }, [speed, t])

  const sky = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      t.value,
      [0, 0.45, 0.55, 1],
      ['#0B1026', '#3A2A6B', '#F39C6B', '#FDF1DC']
    ),
  }))
  const glow = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(t.value, [0, 1], ['#20305F', '#FFF6E5']),
    opacity: interpolate(t.value, [0, 1], [0.5, 0.9]),
  }))
  const orb = useAnimatedStyle(() => ({
    transform: [
      { translateY: interpolate(t.value, [0, 1], [height * 0.55, height * 0.18]) },
      { translateX: interpolate(t.value, [0, 1], [width * 0.15, width * 0.55]) },
    ],
    backgroundColor: interpolateColor(t.value, [0, 1], ['#DDE3F5', '#FFC35C']),
  }))

  return (
    <View style={{ flex: 1 }}>
      <Animated.View style={[StyleSheet.absoluteFill, sky]} />
      <Animated.View
        style={[styles.glow, glow, { top: -height * 0.2, width: width * 1.4, left: -width * 0.2 }]}
      />
      <Animated.View style={[styles.orb, orb]} />
      <BackButton />
      <View style={[styles.panel, { bottom: insets.bottom + 12 }]}>
        <Text style={styles.title}>Day and night</Text>
        <Text style={styles.body}>
          The sky animates on the UI thread with Reanimated. No layout changes, no JS. Native draw
          events wake the sampler, and hysteresis keeps the fast loop from strobing the icons.
        </Text>
        <Segmented value={speed} onChange={setSpeed} options={SPEEDS} />
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  glow: { position: 'absolute', height: 320, borderRadius: 400 },
  orb: { position: 'absolute', width: 96, height: 96, borderRadius: 48 },
  panel: {
    position: 'absolute',
    left: 12,
    right: 12,
    padding: 16,
    gap: 12,
    borderRadius: radius.md,
    backgroundColor: 'rgba(12,12,16,0.82)',
  },
  title: { color: colors.text, fontSize: 15, fontWeight: '700' },
  body: { ...type.small, color: '#C9C9D2' },
})
