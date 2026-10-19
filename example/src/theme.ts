export const colors = {
  ink: '#0B0B0F',
  surface: '#15151C',
  raised: '#1E1E27',
  line: 'rgba(255,255,255,0.08)',
  text: '#F4F4F6',
  muted: '#9C9CA8',
  faint: '#5E5E6A',
  paper: '#F6F3EE',
  paperInk: '#16130F',
  sun: '#FFB547',
  moon: '#7C8CFF',
  good: '#4ADE80',
  warn: '#FBBF24',
  bad: '#F87171',
}

export const radius = { sm: 10, md: 16, lg: 24, pill: 999 }

export const type = {
  display: { fontSize: 34, fontWeight: '800' as const, letterSpacing: -0.8 },
  title: { fontSize: 22, fontWeight: '700' as const, letterSpacing: -0.4 },
  body: { fontSize: 15, lineHeight: 22 },
  small: { fontSize: 13, lineHeight: 18 },
  caps: {
    fontSize: 11,
    fontWeight: '700' as const,
    letterSpacing: 1.2,
    textTransform: 'uppercase' as const,
  },
  mono: { fontVariant: ['tabular-nums' as const] },
}
