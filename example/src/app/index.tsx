import Ionicons from '@expo/vector-icons/Ionicons'
import { Image } from 'expo-image'
import { LinearGradient } from 'expo-linear-gradient'
import { type Href, router } from 'expo-router'
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { ToggleRow } from '../components/ui'
import { updateSettings, useSettings } from '../lib/settings'
import { photos } from '../photos'
import { colors, radius, type } from '../theme'

type Demo = { href: Href; title: string; blurb: string; tag: string; preview: React.ReactNode }

const demos: Demo[] = [
  {
    href: '/gallery',
    title: 'Photo gallery',
    blurb: 'Swipe between dark and light photos',
    tag: 'Images',
    preview: <Image source={photos[0].source} style={StyleSheet.absoluteFill} contentFit="cover" />,
  },
  {
    href: '/feed',
    title: 'Editorial feed',
    blurb: 'Scroll past photos, paper and color',
    tag: 'ScrollView',
    preview: <Image source={photos[5].source} style={StyleSheet.absoluteFill} contentFit="cover" />,
  },
  {
    href: '/list',
    title: 'FlatList stress',
    blurb: '2,000 rows of shifting color',
    tag: 'FlatList',
    preview: (
      <View style={StyleSheet.absoluteFill}>
        {['#101827', '#F4D35E', '#0D3B66', '#FAF0CA', '#EE964B', '#1B1B1E'].map((c) => (
          <View key={c} style={{ flex: 1, backgroundColor: c }} />
        ))}
      </View>
    ),
  },
  {
    href: '/gradient',
    title: 'Animated sky',
    blurb: 'A Reanimated day and night loop',
    tag: 'Animation',
    preview: (
      <LinearGradient
        colors={['#0B1026', '#3A2A6B', '#F39C6B', '#FDE9C9']}
        style={StyleSheet.absoluteFill}
      />
    ),
  },
  {
    href: '/patterns',
    title: 'Edge cases',
    blurb: 'Split, striped and mid grey strips',
    tag: 'Contrast',
    preview: (
      <View style={[StyleSheet.absoluteFill, { flexDirection: 'row' }]}>
        <View style={{ flex: 1, backgroundColor: '#050505' }} />
        <View style={{ flex: 1, backgroundColor: '#F5F5F5' }} />
      </View>
    ),
  },
  {
    href: '/navigation',
    title: 'Navigation',
    blurb: 'Push light and dark screens, fast',
    tag: 'Expo Router',
    preview: <StackPreview />,
  },
  {
    href: '/video',
    title: 'Video',
    blurb: 'Where pixel sampling stops working',
    tag: 'Limits',
    preview: <Image source={photos[2].source} style={StyleSheet.absoluteFill} contentFit="cover" />,
  },
]

function StackPreview() {
  return (
    <View style={[StyleSheet.absoluteFill, { backgroundColor: '#F6F3EE' }]}>
      <View style={styles.stackCard} />
      <View style={[styles.stackCard, { top: 34, left: 34, backgroundColor: '#14141A' }]} />
    </View>
  )
}

export default function Home() {
  const insets = useSafeAreaInsets()
  const settings = useSettings()
  const { width } = useWindowDimensions()
  const columns = width >= 700 ? 3 : 2
  const cardWidth = (width - 28 - 12 * (columns - 1)) / columns

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.ink }}
      contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}>
      <LinearGradient
        colors={['#1B1640', colors.ink]}
        style={[styles.hero, { paddingTop: insets.top + 64 }]}>
        <Text style={styles.kicker}>@rbayuokt/expo-adaptive-status-bar</Text>
        <Text style={styles.title}>{'One line.\nA readable status bar, everywhere.'}</Text>
        <Text style={styles.lead}>
          The status bar icons switch between light and dark to match whatever is behind them, so
          you never set a style per screen again.
        </Text>
        <View style={styles.codeChip}>
          <Text style={styles.code}>AdaptiveStatusBar.enable()</Text>
        </View>
      </LinearGradient>

      <View style={styles.grid}>
        {demos.map((d) => (
          <Pressable
            key={d.title}
            accessibilityRole="button"
            onPress={() => router.push(d.href)}
            style={({ pressed }) => [styles.card, { width: cardWidth }, pressed && styles.pressed]}>
            <View style={styles.preview}>
              {d.preview}
              <View style={styles.tag}>
                <Text style={styles.tagText}>{d.tag}</Text>
              </View>
            </View>
            <Text style={styles.cardTitle}>{d.title}</Text>
            <Text style={styles.cardBlurb}>{d.blurb}</Text>
          </Pressable>
        ))}
      </View>

      <Pressable
        accessibilityRole="button"
        onPress={() => router.push('/benchmark')}
        style={({ pressed }) => [styles.bench, pressed && styles.pressed]}>
        <View style={styles.benchIcon}>
          <Ionicons name="speedometer-outline" size={22} color={colors.ink} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.cardTitle}>Benchmark</Text>
          <Text style={styles.cardBlurb}>
            Scripted scenarios with the library on and off: samples, capture cost, dropped frames
            and switch latency.
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.muted} />
      </Pressable>

      <View style={styles.settings}>
        <ToggleRow
          label="Diagnostics overlay"
          hint="The pill in the top right. It redraws once a second, which counts as activity."
          value={settings.hud}
          onChange={(hud) => updateSettings({ hud })}
        />
      </View>

      <Text style={styles.footer}>
        {Platform.OS === 'ios' ? 'iOS' : 'Android'} · photos from Unsplash
      </Text>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  hero: { paddingHorizontal: 20, paddingBottom: 28 },
  kicker: { ...type.caps, color: colors.moon, marginBottom: 12 },
  title: { ...type.display, color: colors.text },
  lead: { ...type.body, color: colors.muted, marginTop: 12 },
  codeChip: {
    alignSelf: 'flex-start',
    marginTop: 18,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.sm,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
  },
  code: {
    color: colors.sun,
    fontFamily: Platform.select({ ios: 'Menlo', default: 'monospace' }),
    fontSize: 13,
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 14, gap: 12 },
  card: { marginBottom: 8 },
  pressed: { opacity: 0.75, transform: [{ scale: 0.98 }] },
  preview: {
    aspectRatio: 0.82,
    borderRadius: radius.md,
    overflow: 'hidden',
    backgroundColor: colors.surface,
    marginBottom: 10,
  },
  tag: {
    position: 'absolute',
    left: 8,
    top: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  tagText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  cardTitle: { color: colors.text, fontSize: 16, fontWeight: '700' },
  cardBlurb: { ...type.small, color: colors.muted, marginTop: 2 },
  stackCard: {
    position: 'absolute',
    top: 18,
    left: 18,
    right: 18,
    bottom: 18,
    borderRadius: 12,
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 3,
  },
  bench: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginHorizontal: 14,
    marginTop: 16,
    padding: 16,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
  },
  benchIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.sun,
    alignItems: 'center',
    justifyContent: 'center',
  },
  settings: {
    marginHorizontal: 14,
    marginTop: 12,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
  },
  footer: { color: colors.faint, fontSize: 12, textAlign: 'center', marginTop: 24 },
})
