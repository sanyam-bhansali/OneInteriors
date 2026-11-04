import { Easing } from 'react-native';

/**
 * The light look, before Home (owner's mobile app handoff, 1 Nov 2026:
 * UI_UX_DESIGN_SYSTEM.md "paper / ink / terracotta"): the opening, sign-in
 * and the choosing journey.
 */
export const light = {
  ink: '#0B0B0B',
  ink2: '#5F5F5F',
  ink3: '#8D8D8D',
  paper: '#FFFFFF',
  soft: '#F3F3F1',
  soft2: '#EBEBE8',
  line: '#E6E6E3',
  /** The 1px ring of a secondary button. */
  ring: 'rgba(11,11,11,.22)',
  accent: '#BA5329',
  accentInk: '#A6461F',
  accentWarm: '#E07A4E',
  gold: '#F2C98A',
  ok: '#2F6B42',
  /** The amber of "Overall · n days late". */
  late: '#C98A2B',
  mint: '#DFF1EA',
  lilac: '#EBE9FB',
  sand: '#F4ECDF',
  peach: '#FBE6DC',
  onDark: '#F1F0EC',
  onDark2: '#B5B3AD',
  /** An unchosen tab on the bottom bar. */
  tabIdle: '#A9A7A1',
  bg: '#FFFFFF',
  surface: '#F3F3F1',
  white: '#FFFFFF',
  dark: '#0B0B0B',
  accentWash: '#FBE6DC',
  /** The bottom bar. */
  bar: '#0B0B0B',
  /** Text on a filled accent button. */
  onAccent: '#FFFFFF',
} as const;

/**
 * The warm dark look, from Home on (the owner's handoff, decided 1 Nov 2026,
 * from design-references/home-inspiration-warm-dark.png). Same names as the
 * light look, so every screen after sign-in turns at once: `ink` is the
 * cream text, `paper` the page, `soft` a raised card. A surface filled with
 * `ink` is the design's cream card, so its text (`onDark`) is the dark brown.
 */
export const color = {
  ink: '#F6EEE6',
  ink2: '#BFAF9F',
  ink3: '#8F7F70',
  paper: '#16110D',
  soft: '#2A211A',
  soft2: '#2E231B',
  line: 'rgba(255,236,214,.1)',
  ring: 'rgba(255,236,214,.22)',
  accent: '#E8823F',
  accentInk: '#F7B07A',
  accentWarm: '#F08A4B',
  gold: '#F2C98A',
  ok: '#8FD3A4',
  late: '#F7B07A',
  mint: '#1F2B22',
  lilac: '#262236',
  sand: '#2E231B',
  peach: '#3A261B',
  onDark: '#2A1E16',
  onDark2: '#7A6656',
  tabIdle: '#8F7F70',
  bg: '#16110D',
  surface: '#2A211A',
  white: '#FFFFFF',
  dark: '#16110D',
  accentWash: '#3A261B',
  bar: '#1E1712',
  onAccent: '#FFFFFF',
} as const;

/** The design's warm dark extras: cream cards, the glass tile, the ring and button gradients. */
export const warm = {
  cream: ['#FBF4EC', '#F1E4D6'] as const,
  creamText: '#2A1E16',
  creamMuted: '#7A6656',
  creamIcon: '#F6D6BC',
  glass: ['rgba(255,236,214,.09)', 'rgba(255,236,214,.03)'] as const,
  glassRing: 'rgba(255,236,214,.1)',
  ring: ['#F7A35C', '#E8703A'] as const,
  button: ['#E8823F', '#C8622E'] as const,
  buttonDeep: ['#B85C2C', '#8E4220'] as const,
  green: '#8FD3A4',
  greenFill: '#3E9B63',
  orange: '#F7B07A',
  lilac: '#C3B8F7',
  peach: '#F4A47C',
} as const;

/** The four tints of a stat tile. */
export type Tint = 'mint' | 'lilac' | 'sand' | 'peach';

export const font = {
  sans: 'Geist_400Regular',
  sansMedium: 'Geist_500Medium',
  sansSemi: 'Geist_600SemiBold',
  sansBold: 'Geist_700Bold',
  mono: 'GeistMono_400Regular',
  monoMedium: 'GeistMono_500Medium',
} as const;

/** The type scale. Nothing anywhere is set below 13 px: parents use this app. */
export const type = {
  min: 13,
  eyebrow: { fontFamily: font.sansMedium, fontSize: 13, letterSpacing: 13 * 0.07, textTransform: 'uppercase', color: '#BFAF9F' },
  headline: { fontFamily: font.sansMedium, fontSize: 40, lineHeight: 40, letterSpacing: 40 * -0.045, color: '#F6EEE6' },
  section: { fontFamily: font.sansMedium, fontSize: 21, lineHeight: 25, letterSpacing: 21 * -0.02, color: '#F6EEE6' },
  body: { fontFamily: font.sans, fontSize: 15.5, lineHeight: 23, color: '#F6EEE6' },
} as const;

/** Side padding is 20 on every screen. */
export const space = { xs: 4, sm: 8, md: 16, lg: 20, xl: 32, xxl: 48 } as const;
export const radius = { sm: 12, md: 20, lg: 24, panel: 32, pill: 999 } as const;

/** The design's two curves: a glide that settles, and a spring that overshoots a little. */
export const motion = {
  glide: Easing.bezier(0.22, 1, 0.36, 1),
  spring: Easing.bezier(0.34, 1.56, 0.64, 1),
  rise: 800,
  stagger: 60,
  press: 0.965,
} as const;
