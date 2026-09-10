import type { Metadata, Viewport } from 'next';
import { Instrument_Serif, Public_Sans, IBM_Plex_Mono } from 'next/font/google';
import { siteUrl } from '@/lib/site';
import { RosterGateBanner } from '@/components/RosterGateBanner';
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
    'Find a verified interior studio in Pune, matched to your home, your budget and how you like to work. We set the milestone plan and verify every stage against photographs from your site.',
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
    // The font variables MUST be on <html>, not <body>.
    //
    // `--font-display` is declared inside @theme, which Tailwind emits on
    // :root. Its value references `--font-display-loaded`. A custom property's
    // value is resolved where it is DECLARED, so with the next/font classes on
    // <body> the inner var() is undefined at :root, the whole declaration
    // becomes invalid at computed-value time, and every element using
    // var(--font-display) silently inherits the body sans instead.
    //
    // The symptom is that the serif simply never appears and nothing errors.
    <html lang="en-IN" className={`${display.variable} ${sans.variable} ${mono.variable}`}>
      <body>
        {/* The verification-gate warning lives HERE, not in SiteHeader.
            It was in SiteHeader, and it silently vanished on /match — the one
            page it exists for. SiteHeader is rendered from inside MatchClient,
            which is a client component, so everything it touches gets compiled
            into the browser bundle. `showUnverifiedStudios()` reads
            DEV_SHOW_UNVERIFIED_STUDIOS, which is deliberately not
            NEXT_PUBLIC_, so in the browser it read `undefined` and the banner
            rendered nothing.

            The root layout is a server component and always will be, so the
            warning appears exactly once on every page regardless of how the
            page below it renders. A safety banner that only shows on the safe
            pages is worse than no banner: it teaches you to trust its
            absence. */}
        <RosterGateBanner />
        {children}
      </body>
    </html>
  );
}
