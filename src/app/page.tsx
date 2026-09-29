import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import { HomeV3 } from '@/components/landing-v3/HomeV3';
import { currentOffer } from '@/modules/consultation/offer-store';
import '@/components/landing-v3/landing-v3.css';

export const metadata: Metadata = {
  title: 'One Interiors — verified interior studios in Pune',
  description:
    'A four-minute brief about your flat. Verified studios matched to your answers, every quote priced in seconds on their own rates, and a 30-minute call with our architect.',
};

/**
 * The home page — the owner's v3 layout of 30 Sep 2026 (components/landing-v3).
 *
 * Its fonts and colours are the home page's own for now (the owner's call);
 * the brief, matches and quotes keep the site's look. "Find", never
 * "request": the first quote is generated from the studio's own rates, and no
 * studio is asked for it.
 */

const geist = Geist({ subsets: ['latin'], variable: '--font-geist', display: 'swap' });
const geistMono = Geist_Mono({ subsets: ['latin'], variable: '--font-geist-mono', weight: ['400', '500'], display: 'swap' });

/** Hourly, so the expert-call offer's count stays true without making the page dynamic. */
export const revalidate = 3600;

export default async function HomePage() {
  const offer = await currentOffer();
  return (
    <div className={`${geist.variable} ${geistMono.variable}`}>
      <HomeV3 offer={offer} />
    </div>
  );
}
