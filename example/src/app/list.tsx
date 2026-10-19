import { FlatList, StyleSheet, Text, View } from 'react-native'

import { BackButton } from '../components/BackButton'
import { Caption } from '../components/Caption'
import { type } from '../theme'

const PALETTE = [
  '#101827',
  '#F4D35E',
  '#0D3B66',
  '#FAF0CA',
  '#EE964B',
  '#1B1B1E',
  '#E9F5DB',
  '#6A0572',
]

type Row = { key: string; color: string; height: number; dark: boolean }

function luminanceOf(hex: string) {
  const n = parseInt(hex.slice(1), 16)
  const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const s = v / 255
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]
}

// Deterministic so every run scrolls through the same content.
const rows: Row[] = Array.from({ length: 2000 }, (_, i) => {
  const color = PALETTE[(i * 7 + (i >> 3)) % PALETTE.length]
  return {
    key: String(i),
    color,
    height: 48 + ((i * 37) % 5) * 28,
    dark: luminanceOf(color) < 0.18,
  }
})

export default function List() {
  return (
    <View style={{ flex: 1, backgroundColor: '#000' }}>
      <FlatList
        data={rows}
        windowSize={7}
        initialNumToRender={20}
        renderItem={({ item }) => (
          <View style={[styles.row, { backgroundColor: item.color, height: item.height }]}>
            <Text
              style={[
                styles.label,
                { color: item.dark ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.6)' },
              ]}>
              Row {item.key}
            </Text>
          </View>
        )}
      />
      <BackButton />
      <Caption title="Fling it">
        Rows change color every few dozen points. Sampling speeds up while the list moves and goes
        quiet when it stops. Watch samples/s in the overlay.
      </Caption>
    </View>
  )
}

const styles = StyleSheet.create({
  row: { justifyContent: 'center', paddingHorizontal: 72 },
  label: { ...type.small, fontWeight: '600', ...type.mono },
})
