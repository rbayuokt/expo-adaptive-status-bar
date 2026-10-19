import { AdaptiveStatusBar, type AdaptiveStatusBarStats } from '@rbayuokt/expo-adaptive-status-bar'
import Constants from 'expo-constants'
import { useLocalSearchParams } from 'expo-router'
import { Image } from 'expo-image'
import { useEffect, useRef, useState } from 'react'
import {
  Platform,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native'
import Animated, {
  interpolateColor,
  scrollTo,
  useAnimatedRef,
  useAnimatedStyle,
  useFrameCallback,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { BackButton } from '../components/BackButton'
import { Button, Label, Segmented } from '../components/ui'
import { useFrameMonitor } from '../lib/frames'
import { getSettings, initSettings, updateSettings } from '../lib/settings'
import { photos } from '../photos'
import { colors, radius, type } from '../theme'

type ScenarioKey = 'dark' | 'light' | 'scroll' | 'animation' | 'gallery' | 'latency'

const SCENARIOS: { key: ScenarioKey; label: string }[] = [
  { key: 'dark', label: 'Static dark photo' },
  { key: 'light', label: 'Static light photo' },
  { key: 'scroll', label: 'Continuous scroll' },
  { key: 'animation', label: 'Animated gradient' },
  { key: 'gallery', label: 'Photo every second' },
  { key: 'latency', label: 'Black / white flips' },
]

type Phase = {
  seconds: number
  frames: number
  janky: number
  worstMs: number
  jsWorstMs: number
  stats: AdaptiveStatusBarStats | null
  latencies: number[]
}

type Result = { key: ScenarioKey; label: string; off: Phase; on: Phase }

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

export default function Benchmark() {
  const insets = useSafeAreaInsets()
  const monitor = useFrameMonitor()
  // adaptivestatusbar://benchmark?autorun=5 starts a run on open, for scripted recordings.
  const { autorun } = useLocalSearchParams<{ autorun?: string }>()
  const [duration, setDuration] = useState<'5' | '10' | '20'>('10')
  const [stage, setStage] = useState<{
    key: ScenarioKey
    phase: 'off' | 'on'
    index: number
  } | null>(null)
  const [results, setResults] = useState<Result[]>([])
  const [flip, setFlip] = useState(false)
  const latency = useRef<{ startedAt: number; expect: 'light' | 'dark' | null; samples: number[] }>(
    {
      startedAt: 0,
      expect: null,
      samples: [],
    }
  )
  const jsWorst = useRef(0)
  const cancelled = useRef(false)

  // Style changes arrive as events, which is what an app would see too.
  useEffect(() => {
    const sub = AdaptiveStatusBar.addListener((e) => {
      const l = latency.current
      if (l.expect && e.source === 'sample' && e.style === l.expect) {
        l.samples.push(performance.now() - l.startedAt)
        l.expect = null
      }
    })
    return () => {
      sub.remove()
      cancelled.current = true
    }
  }, [])

  // JS thread responsiveness: the longest gap between animation frames.
  useEffect(() => {
    if (!stage) return
    let last = performance.now()
    let id = requestAnimationFrame(function tick(now) {
      jsWorst.current = Math.max(jsWorst.current, now - last)
      last = now
      id = requestAnimationFrame(tick)
    })
    return () => cancelAnimationFrame(id)
  }, [stage])

  // Latency scenario: flip black/white and time the sampled switch.
  useEffect(() => {
    if (stage?.key !== 'latency') return
    let next = true
    const id = setInterval(() => {
      latency.current.startedAt = performance.now()
      latency.current.expect = next ? 'dark' : 'light'
      setFlip(next)
      next = !next
    }, 1200)
    return () => clearInterval(id)
  }, [stage])

  const run = async (seconds = Number(duration)) => {
    const hud = getSettings().hud
    updateSettings({ hud: false })
    const out: Result[] = []
    for (const [index, s] of SCENARIOS.entries()) {
      const phases = {} as Record<'off' | 'on', Phase>
      for (const phase of ['off', 'on'] as const) {
        if (cancelled.current) return
        if (phase === 'off') AdaptiveStatusBar.disable()
        else initSettings()
        setFlip(false)
        setStage({ key: s.key, phase, index })
        await sleep(1200) // let the scenario mount and settle
        AdaptiveStatusBar.resetStats()
        monitor.reset()
        jsWorst.current = 0
        latency.current = { startedAt: 0, expect: null, samples: [] }
        await sleep(seconds * 1000)
        const f = monitor.read()
        phases[phase] = {
          seconds,
          frames: f.frames,
          janky: f.janky,
          worstMs: f.worstMs,
          jsWorstMs: jsWorst.current,
          stats: AdaptiveStatusBar.getStats(),
          latencies: latency.current.samples.slice(),
        }
      }
      out.push({ key: s.key, label: s.label, ...phases })
    }
    setStage(null)
    initSettings()
    updateSettings({ hud })
    setResults(out)
  }

  useEffect(() => {
    if (autorun === '5' || autorun === '10' || autorun === '20') {
      setDuration(autorun)
      run(Number(autorun))
    }
  }, [autorun])

  if (stage) {
    return (
      <View style={{ flex: 1, backgroundColor: '#000' }}>
        <Stage scenario={stage.key} flip={flip} />
        <View style={[styles.progress, { bottom: insets.bottom + 16 }]}>
          <Text style={styles.progressText}>
            {stage.index + 1}/{SCENARIOS.length} · {SCENARIOS[stage.index].label} · library{' '}
            {stage.phase}
          </Text>
        </View>
      </View>
    )
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.ink }}>
      <ScrollView
        contentContainerStyle={{
          padding: 20,
          paddingTop: insets.top + 64,
          paddingBottom: insets.bottom + 32,
        }}>
        <Text style={styles.title}>Benchmark</Text>
        <Text style={styles.body}>
          Each scenario runs with the library off, then on. Frame timing is measured on the UI
          thread, JS responsiveness with requestAnimationFrame. Use a Release build on a real
          device, Debug and simulator numbers are not representative.
        </Text>
        <Text style={styles.device}>{deviceLine()}</Text>

        <Label style={{ marginTop: 20 }}>Seconds per phase</Label>
        <Segmented
          value={duration}
          onChange={setDuration}
          options={[
            { value: '5', label: '5 s' },
            { value: '10', label: '10 s' },
            { value: '20', label: '20 s' },
          ]}
        />
        <View style={{ marginTop: 16, gap: 10 }}>
          <Button
            label={`Run ${SCENARIOS.length} scenarios (${((SCENARIOS.length * 2 * (Number(duration) + 1.2)) / 60).toFixed(1)} min)`}
            onPress={() => run()}
          />
          {results.length ? (
            <Button
              label="Share results"
              kind="ghost"
              onPress={() => Share.share({ message: report(results) })}
            />
          ) : null}
        </View>

        {results.map((r) => (
          <ResultCard key={r.key} result={r} />
        ))}
      </ScrollView>
      <BackButton />
    </View>
  )
}

function Stage({ scenario, flip }: { scenario: ScenarioKey; flip: boolean }) {
  switch (scenario) {
    case 'dark':
      return <Image source={photos[0].source} style={StyleSheet.absoluteFill} contentFit="cover" />
    case 'light':
      return <Image source={photos[1].source} style={StyleSheet.absoluteFill} contentFit="cover" />
    case 'scroll':
      return <AutoScroll />
    case 'animation':
      return <Pulse />
    case 'gallery':
      return <Slideshow />
    case 'latency':
      return (
        <View
          style={[StyleSheet.absoluteFill, { backgroundColor: flip ? '#FFFFFF' : '#000000' }]}
        />
      )
  }
}

const BANDS = Array.from(
  { length: 60 },
  (_, i) => ['#101827', '#F4D35E', '#0D3B66', '#FAF0CA', '#EE964B', '#1B1B1E'][i % 6]
)

// Scrolls on the UI thread at a fling-like 1200 pt/s and wraps around.
function AutoScroll() {
  const ref = useAnimatedRef<Animated.ScrollView>()
  const y = useSharedValue(0)
  const { height } = useWindowDimensions()
  const total = BANDS.length * 180 - height
  useFrameCallback(({ timeSincePreviousFrame: dt }) => {
    'worklet'
    y.value = (y.value + ((dt ?? 16) * 1200) / 1000) % total
    scrollTo(ref, 0, y.value, false)
  })
  return (
    <Animated.ScrollView ref={ref} scrollEnabled={false}>
      {BANDS.map((c, i) => (
        <View key={i} style={{ height: 180, backgroundColor: c }} />
      ))}
    </Animated.ScrollView>
  )
}

function Pulse() {
  const t = useSharedValue(0)
  useEffect(() => {
    t.value = withRepeat(withTiming(1, { duration: 1500 }), -1, true)
  }, [t])
  const style = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(t.value, [0, 1], ['#0B1026', '#FDF1DC']),
  }))
  return <Animated.View style={[StyleSheet.absoluteFill, style]} />
}

function Slideshow() {
  const [i, setI] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setI((n) => (n + 1) % 8), 1000)
    return () => clearInterval(id)
  }, [])
  return (
    <Image
      source={photos[i].source}
      style={StyleSheet.absoluteFill}
      contentFit="cover"
      transition={0}
    />
  )
}

function ResultCard({ result: r }: { result: Result }) {
  const s = r.on.stats
  const lat = summarize(r.on.latencies)
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>{r.label}</Text>
      <View style={styles.tableHead}>
        <Text style={[styles.cell, styles.cellLabel]} />
        <Text style={[styles.cell, styles.head]}>Off</Text>
        <Text style={[styles.cell, styles.head]}>On</Text>
      </View>
      <Row label="UI frames slow" off={pct(r.off)} on={pct(r.on)} />
      <Row
        label="Worst UI frame"
        off={`${r.off.worstMs.toFixed(1)} ms`}
        on={`${r.on.worstMs.toFixed(1)} ms`}
      />
      <Row
        label="Worst JS gap"
        off={`${r.off.jsWorstMs.toFixed(0)} ms`}
        on={`${r.on.jsWorstMs.toFixed(0)} ms`}
      />
      <View style={styles.sep} />
      <Row label="Samples / s" on={s ? (s.samples / r.on.seconds).toFixed(2) : '-'} />
      <Row
        label="Capture avg / max"
        on={s ? `${s.captureMsAvg.toFixed(2)} / ${s.captureMsMax.toFixed(1)} ms` : '-'}
      />
      <Row label="Analysis avg" on={s ? `${(s.analysisMsAvg * 1000).toFixed(0)} µs` : '-'} />
      <Row label="Style switches" on={s ? String(s.styleChanges) : '-'} />
      {r.key === 'latency' ? (
        <Row
          label="Switch latency p50 / max"
          on={lat ? `${lat.p50.toFixed(0)} / ${lat.max.toFixed(0)} ms` : 'no events'}
        />
      ) : null}
    </View>
  )
}

function Row({ label, off, on }: { label: string; off?: string; on: string }) {
  return (
    <View style={styles.tableRow}>
      <Text style={[styles.cell, styles.cellLabel]}>{label}</Text>
      <Text style={[styles.cell, styles.value]}>{off ?? ''}</Text>
      <Text style={[styles.cell, styles.value]}>{on}</Text>
    </View>
  )
}

function pct(p: Phase) {
  return p.frames ? `${((p.janky / p.frames) * 100).toFixed(1)}%` : '-'
}

function summarize(values: number[]) {
  if (!values.length) return null
  const sorted = [...values].sort((a, b) => a - b)
  return { p50: sorted[Math.floor(sorted.length / 2)], max: sorted[sorted.length - 1] }
}

function deviceLine() {
  const os = `${Platform.OS} ${Platform.Version}`
  const build = __DEV__ ? 'Debug' : 'Release'
  return `${Constants.deviceName ?? 'device'} · ${os} · ${build} · ${getSettings().performance}`
}

function report(results: Result[]) {
  const lines = [`@rbayuokt/expo-adaptive-status-bar benchmark`, deviceLine(), '']
  for (const r of results) {
    const s = r.on.stats
    const lat = summarize(r.on.latencies)
    lines.push(
      `${r.label}`,
      `  slow UI frames off ${pct(r.off)} on ${pct(r.on)}, worst ${r.off.worstMs.toFixed(1)} / ${r.on.worstMs.toFixed(1)} ms`,
      `  worst JS gap off ${r.off.jsWorstMs.toFixed(0)} on ${r.on.jsWorstMs.toFixed(0)} ms`,
      s
        ? `  ${(s.samples / r.on.seconds).toFixed(2)} samples/s, capture ${s.captureMsAvg.toFixed(2)} avg ${s.captureMsMax.toFixed(1)} max ms, analysis ${(s.analysisMsAvg * 1000).toFixed(0)} us, ${s.styleChanges} switches`
        : '  no stats',
      ...(lat
        ? [
            `  switch latency p50 ${lat.p50.toFixed(0)} ms, max ${lat.max.toFixed(0)} ms (${r.on.latencies.length} flips)`,
          ]
        : []),
      ''
    )
  }
  return lines.join('\n')
}

const styles = StyleSheet.create({
  title: { ...type.display, color: colors.text },
  body: { ...type.body, color: colors.muted, marginTop: 8 },
  device: { ...type.small, color: colors.faint, marginTop: 8, ...type.mono },
  progress: {
    position: 'absolute',
    alignSelf: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(12,12,16,0.85)',
  },
  progressText: { color: colors.text, fontSize: 13, fontWeight: '600', ...type.mono },
  card: { marginTop: 16, padding: 16, borderRadius: radius.md, backgroundColor: colors.surface },
  cardTitle: { color: colors.text, fontSize: 16, fontWeight: '700', marginBottom: 8 },
  tableHead: { flexDirection: 'row', paddingBottom: 4 },
  tableRow: { flexDirection: 'row', paddingVertical: 4 },
  cell: { flex: 1, fontSize: 13 },
  cellLabel: { flex: 1.6, color: colors.muted },
  head: { color: colors.faint, fontWeight: '700', textAlign: 'right' },
  value: { color: colors.text, textAlign: 'right', ...type.mono },
  sep: { height: StyleSheet.hairlineWidth, backgroundColor: colors.line, marginVertical: 6 },
})
