import type { IconStyle } from './types'

/**
 * Most recent wins. Screens push an entry on mount and drop it on unmount, so going back to a
 * screen that is still mounted brings its entry back on top.
 */
export class StyleStack {
  private entries: { key: object; style: IconStyle }[] = []

  constructor(private onChange: (style: IconStyle | null) => void) {}

  get current(): IconStyle | null {
    return this.entries[this.entries.length - 1]?.style ?? null
  }

  set(key: object, style: IconStyle | null) {
    const before = this.current
    this.entries = this.entries.filter((e) => e.key !== key)
    if (style) this.entries.push({ key, style })
    if (this.current !== before) this.onChange(this.current)
  }
}
