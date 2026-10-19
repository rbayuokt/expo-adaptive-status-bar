import { Image } from 'expo-image'
import { LinearGradient } from 'expo-linear-gradient'
import { ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { BackButton } from '../components/BackButton'
import { photos } from '../photos'
import { colors, type } from '../theme'

const LOREM =
  'Status bar icons are drawn by the system on top of your app. When the content behind them changes, from a night photo to a white page, the icons should follow so the clock and battery stay readable. Scroll slowly through this page and watch them switch exactly as each section passes under the top edge.'

export default function Feed() {
  const { width, height } = useWindowDimensions()
  const insets = useSafeAreaInsets()

  return (
    <View style={{ flex: 1, backgroundColor: colors.paper }}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
        scrollEventThrottle={16}>
        <View style={{ height: height * 0.72 }}>
          <Image source={photos[0].source} style={StyleSheet.absoluteFill} contentFit="cover" />
          <LinearGradient colors={['transparent', 'rgba(0,0,0,0.8)']} style={styles.heroShade}>
            <Text style={styles.kicker}>Field notes</Text>
            <Text style={styles.heroTitle}>A night in the dunes</Text>
          </LinearGradient>
        </View>

        <Article title="Paper white" />

        <View style={[styles.block, { backgroundColor: '#0D3B66' }]}>
          <Text style={[styles.blockTitle, { color: '#FAF0CA' }]}>Deep blue section</Text>
          <Text style={[styles.blockBody, { color: '#C8D6E5' }]}>
            Dark solid color, white icons.
          </Text>
        </View>

        <Image
          source={photos[5].source}
          style={{ width, height: width * 1.1 }}
          contentFit="cover"
        />
        <Article title="Back to the page" />

        <View style={[styles.block, { backgroundColor: '#F4D35E' }]}>
          <Text style={[styles.blockTitle, { color: '#2B2100' }]}>Yellow is light</Text>
          <Text style={[styles.blockBody, { color: '#5C4A00' }]}>
            Saturated but bright, so dark icons. Luminance weighs green and red far above blue.
          </Text>
        </View>
        <View style={[styles.block, { backgroundColor: '#1F3BFF' }]}>
          <Text style={[styles.blockTitle, { color: '#fff' }]}>Pure blue is dark</Text>
          <Text style={[styles.blockBody, { color: '#D8DEFF' }]}>
            A naive RGB average calls this mid grey. Relative luminance knows better.
          </Text>
        </View>

        <LinearGradient
          colors={['#FDE9C9', '#F39C6B', '#3A2A6B', '#0B1026']}
          style={{ height: height * 1.2 }}>
          <View style={styles.gradientLabel}>
            <Text style={[styles.blockTitle, { color: '#3A2A6B' }]}>Slow gradient</Text>
            <Text style={[styles.blockBody, { color: '#5C4A6B' }]}>
              Light to dark over a full screen. Hysteresis keeps the icons from flipping back and
              forth near the middle.
            </Text>
          </View>
        </LinearGradient>

        <Image
          source={photos[9].source}
          style={{ width, height: width * 1.2 }}
          contentFit="cover"
        />
        <Article title="The end" />
      </ScrollView>
      <BackButton />
    </View>
  )
}

function Article({ title }: { title: string }) {
  return (
    <View style={styles.article}>
      <Text style={styles.articleTitle}>{title}</Text>
      <Text style={styles.articleBody}>{LOREM}</Text>
      <Text style={styles.articleBody}>{LOREM}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  heroShade: { position: 'absolute', left: 0, right: 0, bottom: 0, padding: 24, paddingTop: 120 },
  kicker: { ...type.caps, color: colors.sun, marginBottom: 8 },
  heroTitle: { ...type.display, color: '#fff' },
  article: { paddingHorizontal: 24, paddingVertical: 40, backgroundColor: colors.paper },
  articleTitle: { ...type.title, color: colors.paperInk, marginBottom: 12 },
  articleBody: { fontSize: 17, lineHeight: 27, color: '#3D372F', marginBottom: 16 },
  block: { paddingHorizontal: 24, paddingVertical: 140 },
  blockTitle: { ...type.title },
  blockBody: { ...type.body, marginTop: 6 },
  gradientLabel: { padding: 24, paddingTop: 80 },
})
