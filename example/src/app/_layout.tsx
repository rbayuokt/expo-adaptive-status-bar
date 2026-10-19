import { Stack } from 'expo-router'
import { View } from 'react-native'
import { SafeAreaProvider } from 'react-native-safe-area-context'

import { Hud } from '../components/Hud'
import { initSettings } from '../lib/settings'
import { colors } from '../theme'

// The whole integration: one call at startup. No screen below sets a status bar style.
initSettings()

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <View style={{ flex: 1, backgroundColor: colors.ink }}>
        <Stack
          screenOptions={{
            headerShown: false,
            animation: 'slide_from_right',
            contentStyle: { backgroundColor: colors.ink },
          }}
        />
        <Hud />
      </View>
    </SafeAreaProvider>
  )
}
