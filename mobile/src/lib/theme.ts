import { Easing } from 'react-native';

/**
 * The app's tokens, to the 10 Oct restyle that matches the website's
 * customer side (docs/app-handover/DESIGN-SPEC.md, from
 * src/components/home/home-cb.css): a white canvas, ink for whatever is
 * chosen, soft rounded cards, terracotta only as a dot, a tick or a press
 * fill. Copied rather than imported because CSS variables mean nothing to
 * React Native; change one, change the other.
 */
export const color = {
  ink: '#0B0B0B',
  ink2: '#5F5F5F',
  ink3: '#8D8D8D',
  paper: '#FFFFFF',
  soft: '#F3F3F1',
  soft2: '#EBEBE8',
  line: '#E6E6E3',
  /** The 1px ring of a secondary button. */
  ring: 'rgba(11,11,11,.22)',
  accent: '#C1582E',
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
  /** An unchosen tab on the ink bottom bar. */
  tabIdle: '#A9A7A1',

  // The names the screens already use, kept on the new values.
  bg: '#FFFFFF',
  surface: '#F3F3F1',
  white: '#FFFFFF',
  dark: '#0B0B0B',
  accentWash: '#FBE6DC',
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
  eyebrow: { fontFamily: font.sansMedium, fontSize: 13, letterSpacing: 13 * 0.07, textTransform: 'uppercase', color: '#5F5F5F' },
  headline: { fontFamily: font.sansMedium, fontSize: 40, lineHeight: 40, letterSpacing: 40 * -0.045, color: '#0B0B0B' },
  section: { fontFamily: font.sansMedium, fontSize: 21, lineHeight: 25, letterSpacing: 21 * -0.02, color: '#0B0B0B' },
  body: { fontFamily: font.sans, fontSize: 15.5, lineHeight: 23, color: '#0B0B0B' },
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
