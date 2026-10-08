/**
 * The brand, as the website defines it (src/app/globals.css). Copied rather
 * than imported because CSS variables mean nothing to React Native; change
 * one, change the other.
 */
export const color = {
  paper: '#fdf9f2',
  paper2: '#f8f0e3',
  paper3: '#f1e5d2',
  ink: '#262019',
  ink2: '#574d42',
  ink3: '#8a7d6e',
  rule: '#e5d9c6',
  petrolDeep: '#0f3538',
  petrol: '#1a6068',
  petrolSoft: '#dceceb',
  terracotta: '#b85f3c',
  terracottaSoft: '#f8e3d8',
  brass: '#8d6412',
  atrisk: '#98371f',
  atriskSoft: '#f9e0d6',
} as const;

export const font = {
  display: 'InstrumentSerif_400Regular',
  sans: 'InstrumentSans_400Regular',
  sansMedium: 'InstrumentSans_500Medium',
  sansBold: 'InstrumentSans_600SemiBold',
} as const;

export const space = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32, xxl: 48 } as const;
export const radius = { sm: 8, md: 14, pill: 999 } as const;
