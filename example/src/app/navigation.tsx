import { router } from 'expo-router'
import { useRef, useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { BackButton } from '../components/BackButton'
import { Button, ToggleRow } from '../components/ui'
import { colors, radius, type } from '../theme'

export default function Navigation() {
  const insets = useSafeAreaInsets()
  const [hinted, setHinted] = useState(false)
  const [running, setRunning] = useState(false)
  const timer = useRef<ReturnType<typeof setInterval> | null>(null)

  const rapid = () => {
    setRunning(true)
    let n = 0
    timer.current = setInterval(() => {
      n += 1
      if (n > 12) {
        clearInterval(timer.current!)
        router.dismissTo('/navigation')
        setRunning(false)
        return
      }
      router.push({
        pathname: '/tone/[tone]',
        params: { tone: n % 2 ? 'dark' : 'light', hint: hinted ? '1' : '' },
      })
    }, 450)
  }

  return (
    <View style={[styles.root, { paddingTop: insets.top + 64, paddingBottom: insets.bottom + 20 }]}>
      <BackButton />
      <Text style={styles.kicker}>Expo Router stack</Text>
      <Text style={styles.title}>Screens come and go</Text>
      <Text style={styles.body}>
        Pushing a screen slides new content under the status bar. The native stack animation draws
        frames, frames wake the sampler, and the style follows the screen that ends up on top. Going
        back works the same way, nothing to clean up per screen.
      </Text>

      <View style={styles.card}>
        <ToggleRow
          label="Use screen hints"
          hint="Each screen declares its tone with useStatusBarHint, so hybrid mode skips sampling"
          value={hinted}
          onChange={setHinted}
        />
      </View>

      <View style={{ gap: 10, marginTop: 'auto' }}>
        <Button
          label="Push a dark screen"
          onPress={() =>
            router.push({
              pathname: '/tone/[tone]',
              params: { tone: 'dark', hint: hinted ? '1' : '' },
            })
          }
        />
        <Button
          label="Push a light screen"
          kind="ghost"
          onPress={() =>
            router.push({
              pathname: '/tone/[tone]',
              params: { tone: 'light', hint: hinted ? '1' : '' },
            })
          }
        />
        <Button
          label={running ? 'Running...' : 'Rapid: 12 pushes, then back'}
          kind="ghost"
          disabled={running}
          onPress={rapid}
        />
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.paper, paddingHorizontal: 20 },
  kicker: { ...type.caps, color: '#8A6D3B', marginBottom: 8 },
  title: { ...type.display, color: colors.paperInk },
  body: { ...type.body, color: '#5B5248', marginTop: 10 },
  card: { marginTop: 20, padding: 14, borderRadius: radius.md, backgroundColor: colors.ink },
})
