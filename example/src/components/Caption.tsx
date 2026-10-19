import { StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { colors, radius, type } from '../theme'

/** Bottom card that says what to look for on a demo screen. */
export function Caption({ title, children }: { title: string; children: React.ReactNode }) {
  const insets = useSafeAreaInsets()
  return (
    <View pointerEvents="box-none" style={[styles.wrap, { bottom: insets.bottom + 12 }]}>
      <View style={styles.card}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.body}>{children}</Text>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 12, right: 12 },
  card: {
    backgroundColor: 'rgba(12,12,16,0.82)',
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.14)',
    padding: 14,
  },
  title: { color: colors.text, fontSize: 15, fontWeight: '700', marginBottom: 4 },
  body: { ...type.small, color: '#C9C9D2' },
})
