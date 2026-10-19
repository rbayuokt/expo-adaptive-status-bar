import { useStatusBarHint } from '@rbayuokt/expo-adaptive-status-bar'
import { router, useIsFocused, useLocalSearchParams } from 'expo-router'
import { StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { BackButton } from '../../components/BackButton'
import { Button } from '../../components/ui'
import { type } from '../../theme'

export default function Tone() {
  const { tone, hint } = useLocalSearchParams<{ tone: 'dark' | 'light'; hint?: string }>()
  const insets = useSafeAreaInsets()
  const focused = useIsFocused()
  const dark = tone === 'dark'
  // Only the focused screen speaks for the status bar. Screens below stay mounted in the stack.
  useStatusBarHint(hint && focused ? (dark ? 'light' : 'dark') : null)

  return (
    <View
      style={[
        styles.root,
        {
          backgroundColor: dark ? '#111118' : '#FFFFFF',
          paddingTop: insets.top + 64,
          paddingBottom: insets.bottom + 20,
        },
      ]}>
      <BackButton />
      <Text style={[styles.title, { color: dark ? '#fff' : '#111' }]}>
        {dark ? 'Dark screen' : 'Light screen'}
      </Text>
      <Text style={[styles.body, { color: dark ? '#A0A0AE' : '#555' }]}>
        {hint ? 'Declared with useStatusBarHint, sampling is paused.' : 'Detected by sampling.'}
      </Text>
      <View style={{ gap: 10, marginTop: 'auto' }}>
        <Button
          label={`Push a ${dark ? 'light' : 'dark'} screen`}
          onPress={() =>
            router.push({
              pathname: '/tone/[tone]',
              params: { tone: dark ? 'light' : 'dark', hint },
            })
          }
        />
        <Button
          label="Back to start"
          kind="ghost"
          onPress={() => router.dismissTo('/navigation')}
        />
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, paddingHorizontal: 20 },
  title: { ...type.display },
  body: { ...type.body, marginTop: 8 },
})
