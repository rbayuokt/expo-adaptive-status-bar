import { Image } from 'expo-image'
import { LinearGradient } from 'expo-linear-gradient'
import { useState } from 'react'
import { FlatList, StyleSheet, Text, useWindowDimensions, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { BackButton } from '../components/BackButton'
import { photos } from '../photos'
import { colors, radius, type } from '../theme'

const TONE = { dark: 'Dark top', light: 'Light top', split: 'Split top' }

export default function Gallery() {
  const { width, height } = useWindowDimensions()
  const insets = useSafeAreaInsets()
  const [index, setIndex] = useState(0)

  return (
    <View style={styles.root}>
      <FlatList
        data={photos}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        keyExtractor={(p) => p.title}
        getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
        onMomentumScrollEnd={(e) => setIndex(Math.round(e.nativeEvent.contentOffset.x / width))}
        renderItem={({ item }) => (
          <View style={{ width, height }}>
            <Image
              source={item.source}
              style={StyleSheet.absoluteFill}
              contentFit="cover"
              transition={0}
            />
            <LinearGradient
              colors={['transparent', 'rgba(0,0,0,0.75)']}
              style={[styles.shade, { paddingBottom: insets.bottom + 28 }]}>
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{TONE[item.tone]}</Text>
              </View>
              <Text style={styles.title}>{item.title}</Text>
              <Text style={styles.credit}>Photo by {item.credit} on Unsplash</Text>
            </LinearGradient>
          </View>
        )}
      />
      <View style={[styles.dots, { bottom: insets.bottom + 10 }]} pointerEvents="none">
        {photos.map((p, i) => (
          <View key={p.title} style={[styles.dot, i === index && styles.dotActive]} />
        ))}
      </View>
      <BackButton />
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  shade: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 20,
    paddingTop: 80,
  },
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(255,255,255,0.18)',
    marginBottom: 10,
  },
  badgeText: { ...type.caps, color: '#fff', fontSize: 10 },
  title: { ...type.title, color: '#fff' },
  credit: { ...type.small, color: 'rgba(255,255,255,0.7)', marginTop: 4 },
  dots: {
    position: 'absolute',
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
  },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.35)' },
  dotActive: { width: 18, backgroundColor: colors.text },
})
