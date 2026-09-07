import type { Metadata, Viewport } from 'next';
import { Instrument_Serif, Public_Sans, IBM_Plex_Mono } from 'next/font/google';
import { siteUrl } from '@/lib/site';
import './globals.css';

const display = Instrument_Serif({
  weight: '400',
  subsets: ['latin'],
  variable: '--font-display-loaded',
  display: 'swap',
});

const sans = Public_Sans({
  subsets: ['latin'],
  variable: '--font-sans-loaded',
  display: 'swap',
});

const mono = IBM_Plex_Mono({
  weight: ['400', '500', '600'],
  subsets: ['latin'],
  variable: '--font-mono-loaded',
  display: 'swap',
});

export const metadata: Metadata = {
  title: {
    default: 'One Interiors — verified interior studios in Pune',
    template: '%s · One Interiors',
  },
  description:
    'Find a verified interior studio in Pune, matched to your home, your budget and how you like to work. Your money stays in escrow until each stage is approved.',
  // See src/lib/site.ts — an unset NEXT_PUBLIC_* arrives as '' on Vercel, and
  // `?? fallback` does not catch that. Do not inline this back.
  metadataBase: siteUrl(),
  openGraph: {
    type: 'website',
    locale: 'en_IN',
    siteName: 'One Interiors',
  },
  robots: {
    // Flip to true once the brand name and pricing are settled.
    index: false,
    follow: false,
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover', // safe-area insets for the wrapped app
  // Single value: the product is light-only by design (see globals.css).
  themeColor: '#fdf9f2',
  colorScheme: 'light',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-IN">
      <body className={`${display.variable} ${sans.variable} ${mono.variable}`}>{children}</body>
    </html>
  );
}
