import Ionicons from '@expo/vector-icons/Ionicons'
import { router } from 'expo-router'
import { Pressable, StyleSheet } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

// Translucent dark disc, readable on any background without depending on the status bar.
export function BackButton() {
  const insets = useSafeAreaInsets()
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Back"
      hitSlop={12}
      onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
      style={({ pressed }) => [
        styles.button,
        { top: insets.top + 8 },
        pressed && { opacity: 0.7 },
      ]}>
      <Ionicons name="chevron-back" size={22} color="#fff" />
    </Pressable>
  )
}

const styles = StyleSheet.create({
  button: {
    position: 'absolute',
    left: 16,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
})
