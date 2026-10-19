import { StyleStack } from '../StyleStack'
import { toNativeConfig } from '../config'

describe('toNativeConfig', () => {
  it('fills defaults', () => {
    expect(toNativeConfig({})).toMatchObject({
      strategy: 'hybrid',
      performance: 'balanced',
      hysteresis: true,
      animation: true,
    })
  })

  it('flattens custom thresholds', () => {
    const c = toNativeConfig({ hysteresis: { darkThreshold: 0.4, lightThreshold: 0.6 } })
    expect(c).toMatchObject({ hysteresis: true, darkThreshold: 0.4, lightThreshold: 0.6 })
  })

  it('turns hysteresis off', () => {
    expect(toNativeConfig({ hysteresis: false }).hysteresis).toBe(false)
  })

  it('passes the iOS capture method', () => {
    expect(toNativeConfig({ ios: { captureMethod: 'hierarchy' } }).iosCaptureMethod).toBe(
      'hierarchy'
    )
  })

  it.each([
    [{ strategy: 'magic' }],
    [{ performance: 'turbo' }],
    [{ samplingInterval: 5 }],
    [{ samplingInterval: Number.NaN }],
    [{ samplingInterval: 200, maxInterval: 100 }],
    [{ idleInterval: 50 }],
    [{ maxInterval: 1000, quietInterval: 500 }],
    [{ confirmSamples: 0 }],
    [{ confirmSamples: 1.5 }],
    [{ hysteresis: { darkThreshold: 0.7, lightThreshold: 0.3 } }],
    [{ hysteresis: { darkThreshold: -0.1, lightThreshold: 0.5 } }],
    [{ fallbackStyle: 'blue' }],
    [{ ios: { captureMethod: 'screen' } }],
  ])('rejects %j', (bad) => {
    expect(() => toNativeConfig(bad as never)).toThrow(RangeError)
  })

  it('allows idleInterval 0 to turn the fallback off', () => {
    expect(toNativeConfig({ idleInterval: 0 }).idleInterval).toBe(0)
  })
})

describe('StyleStack', () => {
  it('most recent entry wins and unmount restores the previous', () => {
    const seen: (string | null)[] = []
    const s = new StyleStack((v) => seen.push(v))
    const a = {}
    const b = {}
    s.set(a, 'dark')
    s.set(b, 'light')
    expect(s.current).toBe('light')
    s.set(b, null)
    expect(s.current).toBe('dark')
    s.set(a, null)
    expect(s.current).toBeNull()
    expect(seen).toEqual(['dark', 'light', 'dark', null])
  })

  it('updating an entry moves it to the top', () => {
    const s = new StyleStack(() => {})
    const a = {}
    const b = {}
    s.set(a, 'dark')
    s.set(b, 'light')
    s.set(a, 'light')
    s.set(b, 'dark')
    expect(s.current).toBe('dark')
  })

  it('does not notify when the effective style stays the same', () => {
    const fn = jest.fn()
    const s = new StyleStack(fn)
    const a = {}
    const b = {}
    s.set(a, 'dark')
    s.set(b, 'dark')
    s.set(b, null)
    expect(fn).toHaveBeenCalledTimes(1)
  })
})
