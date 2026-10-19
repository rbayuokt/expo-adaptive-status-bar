import { useStatusBarHint } from '@rbayuokt/expo-adaptive-status-bar'
import { useIsFocused } from 'expo-router'
import { useVideoPlayer, VideoView } from 'expo-video'
import { useState } from 'react'
import { Platform, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { BackButton } from '../components/BackButton'
import { Label, Segmented, ToggleRow } from '../components/ui'
import { colors, radius, type } from '../theme'

const SOURCE =
  'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4'

export default function Video() {
  const insets = useSafeAreaInsets()
  const focused = useIsFocused()
  const [surface, setSurface] = useState<'surfaceView' | 'textureView'>('surfaceView')
  const [hint, setHint] = useState(false)
  const player = useVideoPlayer(SOURCE, (p) => {
    p.loop = true
    p.muted = true
    p.play()
  })
  useStatusBarHint(hint && focused ? 'light' : null)

  return (
    <View style={{ flex: 1, backgroundColor: '#000' }}>
      <VideoView
        key={surface}
        player={player}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
        nativeControls={false}
        surfaceType={surface}
      />
      <BackButton />
      <View style={[styles.panel, { bottom: insets.bottom + 12 }]}>
        <Text style={styles.title}>Video is the hard case</Text>
        <Text style={styles.body}>
          {Platform.OS === 'android'
            ? 'A SurfaceView is its own window layer, so PixelCopy of the app window sees a hole there. Switch to TextureView and the frames become part of the window and get sampled.'
            : "Video plays in a layer the app can't render itself, so iOS sampling sees black here. Declare the tone with a hint instead."}
        </Text>
        {Platform.OS === 'android' ? (
          <>
            <Label>Surface</Label>
            <Segmented
              value={surface}
              onChange={setSurface}
              options={[
                { value: 'surfaceView', label: 'SurfaceView' },
                { value: 'textureView', label: 'TextureView' },
              ]}
            />
          </>
        ) : null}
        <ToggleRow
          label="Hint: dark video"
          hint="useStatusBarHint('light'), hybrid mode only"
          value={hint}
          onChange={setHint}
        />
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  panel: {
    position: 'absolute',
    left: 12,
    right: 12,
    padding: 16,
    gap: 8,
    borderRadius: radius.md,
    backgroundColor: 'rgba(12,12,16,0.85)',
  },
  title: { color: colors.text, fontSize: 15, fontWeight: '700' },
  body: { ...type.small, color: '#C9C9D2' },
})
