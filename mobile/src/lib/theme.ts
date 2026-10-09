/**
 * The owner's v1 screens (the design file, 8 Oct 2026), as the web app's
 * `.oa` tokens set them (src/components/app/app.css). Copied rather than
 * imported because CSS variables mean nothing to React Native; change one,
 * change the other.
 */
export const color = {
  bg: '#f1f0ec',
  surface: '#fbfaf8',
  white: '#ffffff',
  ink: '#0e0e0d',
  ink2: '#5a5853',
  ink3: '#8c8a84',
  line: '#d4d3ce',
  accent: '#ba5329',
  accentInk: '#a6461f',
  accentWarm: '#e07a4e',
  accentWash: '#f6e3d9',
  gold: '#f2c98a',
  dark: '#0e0e0d',
  onDark: '#f1f0ec',
  onDark2: '#b5b3ad',
  ok: '#2f6b45',
} as const;

export const font = {
  sans: 'Geist_400Regular',
  sansMedium: 'Geist_500Medium',
  sansSemi: 'Geist_600SemiBold',
  sansBold: 'Geist_700Bold',
  mono: 'GeistMono_400Regular',
  monoMedium: 'GeistMono_500Medium',
} as const;

export const space = { xs: 4, sm: 8, md: 16, lg: 22, xl: 32, xxl: 48 } as const;
export const radius = { sm: 12, md: 18, lg: 22, pill: 999 } as const;

/** The design's two curves: a glide that settles, and a small spring. */
export const motion = {
  glide: { duration: 800 },
  stagger: 60,
} as const;
