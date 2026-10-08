import type { Metadata } from 'next';
import { HomeCB } from '@/components/home/HomeCB';
import { currentOffer } from '@/modules/consultation/offer-store';
import '@/components/home/home-cb.css';

export const metadata: Metadata = {
  title: 'One Interiors — verified interior studios in Pune',
  description:
    'A four-minute brief about your flat. Verified studios matched to your answers, every quote priced in seconds on their own rates, and a 30-minute call with our architect.',
};

/**
 * The home page — v4 (components/home), the customer side in the manner of
 * cuberto.com at the owner's request of 8 Oct 2026. The v3 layout it replaced
 * is in components/landing-v3 and git history. "Find", never
 * "request": the first quote is generated from the studio's own rates, and no
 * studio is asked for it.
 */

/** Hourly, so the expert-call offer's count stays true without making the page dynamic. */
export const revalidate = 3600;

export default async function HomePage() {
  const offer = await currentOffer();
  return (
    <HomeCB offer={offer} />
  );
}
