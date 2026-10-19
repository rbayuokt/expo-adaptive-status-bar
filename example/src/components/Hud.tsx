import Ionicons from '@expo/vector-icons/Ionicons'
import {
  AdaptiveStatusBar,
  type IconStyle,
  type StyleSource,
  useAdaptiveStatusBarStats,
} from '@rbayuokt/expo-adaptive-status-bar'
import * as Haptics from 'expo-haptics'
import { useEffect, useRef, useState } from 'react'
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native'
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { colors, radius, type } from '../theme'
import { Label, Segmented, Stat, ToggleRow } from './ui'
import { updateSettings, useSettings } from '../lib/settings'

const SOURCE_LABEL: Record<StyleSource | 'none', string> = {
  sample: 'sampled',
  hint: 'screen hint',
  override: 'override',
  fallback: 'fallback',
  none: 'waiting',
}

/** Live readout of what the library sees. Sits below the status bar so it never gets sampled. */
export function Hud() {
  const insets = useSafeAreaInsets()
  const settings = useSettings()
  const [open, setOpen] = useState(false)
  const [live, setLive] = useState<{ style: IconStyle; source: StyleSource } | null>(null)
  // Full stats only while the panel is open. Collapsed, the pill re-renders only when what it
  // shows changes, otherwise every sample would redraw it and cause the next sample.
  const stats = useAdaptiveStatusBarStats(settings.hud && open ? 500 : 0)
  const [pillLightness, pillStyle] = usePillReading(settings.hud && !open)
  const rate = useRate(stats?.samples ?? 0, 500)
  const wakeups = useRate(stats?.activitySignals ?? 0, 500)

  useEffect(() => {
    const sub = AdaptiveStatusBar.addListener((e) => setLive({ style: e.style, source: e.source }))
    return () => sub.remove()
  }, [])

  if (!settings.hud) return null

  const style = live?.style ?? pillStyle ?? stats?.style ?? null
  const source = live?.source ?? stats?.source ?? 'none'
  const lightness = open ? stats?.lightness : pillLightness

  return (
    <View pointerEvents="box-none" style={[StyleSheet.absoluteFill, { top: insets.top + 8 }]}>
      <View pointerEvents="box-none" style={styles.anchor}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Status bar diagnostics"
          onPress={() => {
            Haptics.selectionAsync()
            setOpen((o) => !o)
          }}
          style={({ pressed }) => [styles.pill, pressed && { opacity: 0.8 }]}>
          <View style={[styles.dot, style === 'dark' ? styles.dotDark : styles.dotLight]} />
          <Text style={styles.pillText}>
            {!settings.enabled
              ? 'Off'
              : style
                ? `${style === 'light' ? 'Light' : 'Dark'} icons`
                : '...'}
          </Text>
          {settings.enabled && lightness != null ? (
            <Text style={styles.pillValue}>{lightness.toFixed(2)}</Text>
          ) : null}
          <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={14} color={colors.muted} />
        </Pressable>

        {open ? (
          <Animated.View
            entering={FadeIn.duration(140)}
            exiting={FadeOut.duration(100)}
            style={styles.panel}>
            <Meter
              value={lightness ?? null}
              left={stats?.left ?? null}
              right={stats?.right ?? null}
            />
            <Text style={styles.source}>
              {settings.enabled ? `Applied from ${SOURCE_LABEL[source]}` : 'Library disabled'}
              {stats && !stats.supported ? ' · unsupported here' : ''}
            </Text>

            <View style={styles.stats}>
              <Stat label="samples/s" value={rate.toFixed(1)} />
              <Stat label="main thread" value={`${(stats?.mainThreadMsAvg ?? 0).toFixed(2)} ms`} />
              <Stat label="interval" value={`${Math.round(stats?.intervalMs ?? 0)} ms`} />
            </View>
            <View style={styles.stats}>
              <Stat label="wake-ups/s" value={wakeups.toFixed(1)} />
              <Stat label="capture avg" value={`${(stats?.captureMsAvg ?? 0).toFixed(2)} ms`} />
              <Stat label="switches" value={`${stats?.styleChanges ?? 0}`} />
            </View>
            <View style={styles.stats}>
              <Stat label="samples" value={`${stats?.samples ?? 0}`} />
              <Stat label="main max" value={`${(stats?.mainThreadMsMax ?? 0).toFixed(1)} ms`} />
              <Stat label="skipped" value={`${stats?.skipped ?? 0}`} />
            </View>

            <View style={styles.divider} />
            <ToggleRow
              label="Adaptive status bar"
              value={settings.enabled}
              onChange={(enabled) => updateSettings({ enabled })}
            />
            <ToggleRow
              label="Hysteresis"
              hint="Off switches at exactly 0.5"
              value={settings.hysteresis}
              onChange={(hysteresis) => updateSettings({ hysteresis })}
            />
            <Label style={{ marginTop: 10 }}>Strategy</Label>
            <Segmented
              value={settings.strategy}
              onChange={(strategy) => updateSettings({ strategy })}
              options={[
                { value: 'automatic', label: 'Auto' },
                { value: 'hybrid', label: 'Hybrid' },
                { value: 'manual', label: 'Manual' },
              ]}
            />
            <Label style={{ marginTop: 12 }}>Performance</Label>
            <Segmented
              value={settings.performance}
              onChange={(performance) => updateSettings({ performance })}
              options={[
                { value: 'battery', label: 'Battery' },
                { value: 'balanced', label: 'Balanced' },
                { value: 'responsive', label: 'Responsive' },
              ]}
            />
            {Platform.OS === 'ios' ? (
              <>
                <Label style={{ marginTop: 12 }}>iOS capture</Label>
                <Segmented
                  value={settings.captureMethod}
                  onChange={(captureMethod) => updateSettings({ captureMethod })}
                  options={[
                    { value: 'layer', label: 'Layer' },
                    { value: 'hierarchy', label: 'Hierarchy' },
                  ]}
                />
              </>
            ) : null}
            <View style={styles.footer}>
              <Pressable hitSlop={8} onPress={() => AdaptiveStatusBar.resetStats()}>
                <Text style={styles.footerText}>Reset stats</Text>
              </Pressable>
              <Pressable hitSlop={8} onPress={() => updateSettings({ hud: false })}>
                <Text style={styles.footerText}>Hide overlay</Text>
              </Pressable>
            </View>
          </Animated.View>
        ) : null}
      </View>
    </View>
  )
}

function Meter({
  value,
  left,
  right,
}: {
  value: number | null
  left: number | null
  right: number | null
}) {
  const settings = useSettings()
  const [dark, light] = settings.hysteresis ? [0.42, 0.58] : [0.5, 0.5]
  return (
    <View>
      <View style={styles.meterHead}>
        <Text style={styles.meterTitle}>Lightness under the status bar</Text>
        <Text style={styles.meterValue}>{value == null ? '-' : value.toFixed(3)}</Text>
      </View>
      <View style={styles.track}>
        <View
          style={[styles.band, { left: `${dark * 100}%`, width: `${(light - dark) * 100}%` }]}
        />
        {left != null ? <View style={[styles.zoneTick, { left: `${left * 100}%` }]} /> : null}
        {right != null ? <View style={[styles.zoneTick, { left: `${right * 100}%` }]} /> : null}
        {value != null ? <View style={[styles.knob, { left: `${value * 100}%` }]} /> : null}
      </View>
      <View style={styles.meterLegend}>
        <Text style={styles.legend}>white icons</Text>
        <Text style={styles.legend}>
          L {left?.toFixed(2) ?? '-'} · R {right?.toFixed(2) ?? '-'}
        </Text>
        <Text style={styles.legend}>dark icons</Text>
      </View>
    </View>
  )
}

// The first style event can fire before the HUD subscribes, so the pill reads the style here too.
function usePillReading(active: boolean): [number | null, IconStyle | null] {
  const [lightness, setLightness] = useState<number | null>(null)
  const [style, setStyle] = useState<IconStyle | null>(null)
  useEffect(() => {
    if (!active) return
    const poll = () => {
      const s = AdaptiveStatusBar.getStats()
      // Same primitive values mean React bails out, no render.
      setLightness(s?.lightness == null ? null : Math.round(s.lightness * 100) / 100)
      setStyle(s?.style ?? null)
    }
    poll()
    const id = setInterval(poll, 1000)
    return () => clearInterval(id)
  }, [active])
  return [lightness, style]
}

/** Samples per second from the cumulative counter. */
function useRate(count: number, intervalMs: number) {
  const prev = useRef({ count, at: Date.now() })
  const [rate, setRate] = useState(0)
  useEffect(() => {
    const now = Date.now()
    const dt = (now - prev.current.at) / 1000
    if (count < prev.current.count) {
      // Stats were reset.
      prev.current = { count, at: now }
      setRate(0)
    } else if (dt >= intervalMs / 2000) {
      setRate(Math.max(0, (count - prev.current.count) / dt))
      prev.current = { count, at: now }
    }
  }, [count, intervalMs])
  return rate
}

const styles = StyleSheet.create({
  anchor: { position: 'absolute', right: 12, alignItems: 'flex-end', maxWidth: 340 },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    height: 36,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(12,12,16,0.82)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  dot: { width: 12, height: 12, borderRadius: 6, borderWidth: 1.5 },
  dotLight: { backgroundColor: '#fff', borderColor: '#fff' },
  dotDark: { backgroundColor: '#000', borderColor: 'rgba(255,255,255,0.7)' },
  pillText: { color: colors.text, fontSize: 13, fontWeight: '600' },
  pillValue: { color: colors.muted, fontSize: 13, ...type.mono },
  panel: {
    marginTop: 8,
    width: 316,
    padding: 16,
    borderRadius: radius.lg,
    backgroundColor: 'rgba(14,14,19,0.94)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.14)',
  },
  meterHead: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  meterTitle: { color: colors.muted, fontSize: 12 },
  meterValue: { color: colors.text, fontSize: 12, fontWeight: '700', ...type.mono },
  track: {
    height: 10,
    borderRadius: 5,
    backgroundColor: '#888',
    experimental_backgroundImage: 'linear-gradient(90deg, #000 0%, #fff 100%)',
    overflow: 'visible',
  },
  band: {
    position: 'absolute',
    top: -3,
    bottom: -3,
    borderRadius: 3,
    borderWidth: 1,
    borderColor: colors.sun,
    backgroundColor: 'rgba(255,181,71,0.12)',
  },
  zoneTick: {
    position: 'absolute',
    top: 12,
    width: 2,
    height: 6,
    marginLeft: -1,
    backgroundColor: colors.muted,
  },
  knob: {
    position: 'absolute',
    top: -5,
    width: 20,
    height: 20,
    marginLeft: -10,
    borderRadius: 10,
    backgroundColor: colors.moon,
    borderWidth: 3,
    borderColor: '#fff',
  },
  meterLegend: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 14 },
  legend: { color: colors.faint, fontSize: 11, ...type.mono },
  source: { color: colors.muted, fontSize: 12, marginTop: 10 },
  stats: { flexDirection: 'row', marginTop: 12 },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.line, marginVertical: 12 },
  footer: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 16 },
  footerText: { color: colors.muted, fontSize: 13, fontWeight: '600' },
})
