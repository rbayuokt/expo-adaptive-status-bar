import { useAdaptiveStatusBarStats } from '@rbayuokt/expo-adaptive-status-bar'
import { LinearGradient } from 'expo-linear-gradient'
import { useState } from 'react'
import { ScrollView, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { BackButton } from '../components/BackButton'
import { Stat } from '../components/ui'
import { colors, radius, type } from '../theme'

type Pattern = { key: string; label: string; note: string; render: () => React.ReactNode }

const half = (left: string, right: string) => () => (
  <View style={[StyleSheet.absoluteFill, { flexDirection: 'row' }]}>
    <View style={{ flex: 1, backgroundColor: left }} />
    <View style={{ flex: 1, backgroundColor: right }} />
  </View>
)

const patterns: Pattern[] = [
  {
    key: 'clock-dark',
    label: 'Clock dark',
    note: 'Black behind the clock, white behind the battery. The two sides tie on contrast, the call goes to the side that would be worse off.',
    render: half('#050505', '#F5F5F5'),
  },
  {
    key: 'clock-light',
    label: 'Clock light',
    note: 'Mirror image of the previous one. Same reading, so the result should match.',
    render: half('#F5F5F5', '#050505'),
  },
  {
    key: 'stripes',
    label: 'Stripes',
    note: 'Thin black and white stripes average out to a light reading: dark icons stay readable on half the pixels.',
    render: () => (
      <View style={[StyleSheet.absoluteFill, { flexDirection: 'row' }]}>
        {Array.from({ length: 24 }, (_, i) => (
          <View key={i} style={{ flex: 1, backgroundColor: i % 2 ? '#fff' : '#000' }} />
        ))}
      </View>
    ),
  },
  {
    key: 'center',
    label: 'Bright center',
    note: 'White only in the middle, where the notch or Dynamic Island sits. No icons there, so it is ignored.',
    render: () => (
      <View style={[StyleSheet.absoluteFill, { backgroundColor: '#0A0A0A', alignItems: 'center' }]}>
        <View style={{ width: '30%', height: '100%', backgroundColor: '#FFF' }} />
      </View>
    ),
  },
  {
    key: 'grey',
    label: 'Mid grey',
    note: 'sRGB 119 is perceptual middle grey, right inside the hysteresis band. Whatever style was active stays.',
    render: () => (
      <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgb(119,119,119)' }]} />
    ),
  },
  {
    key: 'blue',
    label: 'Pure blue',
    note: 'RGB average says 33% bright. Relative luminance says 7%. White icons.',
    render: () => <View style={[StyleSheet.absoluteFill, { backgroundColor: '#0000FF' }]} />,
  },
  {
    key: 'yellow',
    label: 'Pure yellow',
    note: 'RGB average says 67%. Relative luminance says 93%. Dark icons.',
    render: () => <View style={[StyleSheet.absoluteFill, { backgroundColor: '#FFFF00' }]} />,
  },
  {
    key: 'gradient',
    label: 'Horizontal gradient',
    note: 'Black on the left fading to white on the right.',
    render: () => (
      <LinearGradient
        colors={['#000', '#fff']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={StyleSheet.absoluteFill}
      />
    ),
  },
  {
    key: 'translucent',
    label: 'Translucent',
    note: 'A 50% white veil over black. What counts is the composited pixel, not the view tree.',
    render: () => (
      <View style={[StyleSheet.absoluteFill, { backgroundColor: '#000' }]}>
        <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(255,255,255,0.5)' }]} />
      </View>
    ),
  },
]

export default function Patterns() {
  const insets = useSafeAreaInsets()
  const [active, setActive] = useState(patterns[0])
  const stats = useAdaptiveStatusBarStats(300)

  return (
    <View style={{ flex: 1, backgroundColor: colors.ink }}>
      <View style={{ height: insets.top + 220 }}>{active.render()}</View>
      <BackButton />
      <ScrollView
        style={styles.sheet}
        contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 24 }}>
        <Text style={styles.title}>{active.label}</Text>
        <Text style={styles.note}>{active.note}</Text>
        <View style={styles.readout}>
          <Stat label="left zone" value={stats?.left?.toFixed(3) ?? '-'} />
          <Stat label="right zone" value={stats?.right?.toFixed(3) ?? '-'} />
          <Stat label="combined" value={stats?.lightness?.toFixed(3) ?? '-'} tone={colors.moon} />
          <Stat label="icons" value={stats?.style ?? '-'} tone={colors.sun} />
        </View>
        <View style={styles.chips}>
          {patterns.map((p) => (
            <Text
              key={p.key}
              onPress={() => setActive(p)}
              accessibilityRole="button"
              style={[styles.chip, p.key === active.key && styles.chipActive]}>
              {p.label}
            </Text>
          ))}
        </View>
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  sheet: {
    flex: 1,
    marginTop: -20,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    backgroundColor: colors.ink,
  },
  title: { ...type.title, color: colors.text },
  note: { ...type.body, color: colors.muted, marginTop: 6 },
  readout: {
    flexDirection: 'row',
    marginTop: 16,
    padding: 14,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 16 },
  chip: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: '600',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    overflow: 'hidden',
  },
  chipActive: { color: colors.ink, backgroundColor: colors.text },
})
