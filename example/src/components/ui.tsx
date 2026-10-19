import * as Haptics from 'expo-haptics'
import { Pressable, StyleSheet, Switch, Text, View, type ViewStyle } from 'react-native'

import { colors, radius, type } from '../theme'

export function Segmented<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T
  options: readonly { value: T; label: string }[]
  onChange: (v: T) => void
}) {
  return (
    <View style={styles.segmented}>
      {options.map((o) => {
        const active = o.value === value
        return (
          <Pressable
            key={o.value}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            onPress={() => {
              if (active) return
              Haptics.selectionAsync()
              onChange(o.value)
            }}
            style={[styles.segment, active && styles.segmentActive]}>
            <Text style={[styles.segmentText, active && styles.segmentTextActive]}>{o.label}</Text>
          </Pressable>
        )
      })}
    </View>
  )
}

export function ToggleRow({
  label,
  hint,
  value,
  onChange,
}: {
  label: string
  hint?: string
  value: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <View style={styles.row}>
      <View style={{ flex: 1 }}>
        <Text style={styles.rowLabel}>{label}</Text>
        {hint ? <Text style={styles.rowHint}>{hint}</Text> : null}
      </View>
      <Switch
        value={value}
        onValueChange={(v) => {
          Haptics.selectionAsync()
          onChange(v)
        }}
        trackColor={{ true: colors.moon, false: colors.raised }}
        thumbColor="#fff"
      />
    </View>
  )
}

export function Label({ children, style }: { children: string; style?: ViewStyle }) {
  return (
    <View style={style}>
      <Text style={styles.label}>{children}</Text>
    </View>
  )
}

export function Stat({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <View style={styles.stat}>
      <Text style={[styles.statValue, tone ? { color: tone } : null]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  )
}

export function Button({
  label,
  onPress,
  kind = 'primary',
  disabled,
}: {
  label: string
  onPress: () => void
  kind?: 'primary' | 'ghost'
  disabled?: boolean
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
        onPress()
      }}
      style={({ pressed }) => [
        styles.button,
        kind === 'ghost' && styles.buttonGhost,
        (pressed || disabled) && { opacity: 0.6 },
      ]}>
      <Text style={[styles.buttonText, kind === 'ghost' && { color: colors.text }]}>{label}</Text>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  segmented: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: radius.sm,
    padding: 3,
  },
  segment: { flex: 1, paddingVertical: 8, borderRadius: 8, alignItems: 'center' },
  segmentActive: { backgroundColor: 'rgba(255,255,255,0.14)' },
  segmentText: { color: colors.muted, fontSize: 13, fontWeight: '600' },
  segmentTextActive: { color: colors.text },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 6 },
  rowLabel: { color: colors.text, fontSize: 15, fontWeight: '600' },
  rowHint: { color: colors.muted, fontSize: 12, marginTop: 2 },
  label: { ...type.caps, color: colors.faint, marginBottom: 8 },
  stat: { flex: 1, minWidth: 72 },
  statValue: { color: colors.text, fontSize: 17, fontWeight: '700', ...type.mono },
  statLabel: { color: colors.muted, fontSize: 11, marginTop: 2 },
  button: {
    backgroundColor: colors.text,
    borderRadius: radius.md,
    paddingVertical: 14,
    alignItems: 'center',
  },
  buttonGhost: { backgroundColor: 'rgba(255,255,255,0.08)' },
  buttonText: { color: colors.ink, fontSize: 15, fontWeight: '700' },
})
