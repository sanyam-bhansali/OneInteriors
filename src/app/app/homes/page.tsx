'use client';

/**
 * One Interiors Homes (v79 design): real homes finished through One
 * Interiors, posted by their owners after handover, with Home of the month.
 *
 * There are none yet: the first homes are still being built. So this page
 * says that, and how a home gets here, instead of showing invented families,
 * budgets or photos. Posting opens once the first handover happens.
 */

import Link from 'next/link';
import { Frame, Head, Tabs } from '@/components/app/ui';

export default function AppHomes() {
  return (
    <Frame>
      <Head back="/app/home" meta="Real homes, real budgets" />
      <main className="oa-body">
        <h1 className="oa-title">One Interiors Homes</h1>
        <p className="oa-sub">
          Homes finished through One Interiors, posted by the families who live in them: the studio, the budget, the weeks it took,
          and the photos.
        </p>
        <section className="oa-card-dark">
          <span className="oa-label" style={{ margin: 0, color: '#f2c98a' }}>
            Home of the month
          </span>
          <b style={{ display: 'block', marginTop: 8, fontSize: 22, letterSpacing: '-0.03em' }}>The first homes are still being built.</b>
          <p style={{ margin: '10px 0 0', fontSize: 14.5, lineHeight: 1.5, color: '#b5b3ad' }}>
            They appear here after handover, only when their families choose to post them.
          </p>
        </section>
        <section className="oa-card">
          <b style={{ fontSize: 16 }}>Your home could be next</b>
          <p className="oa-note" style={{ marginTop: 6 }}>
            After handover, post your home here. Each month&rsquo;s chosen home wins its family 5,000 Home Coins and a family
            photoshoot in the new home.
          </p>
        </section>
        <Link href="/app/dream" className="oa-share-row" style={{ textDecoration: 'none' }}>
          <span>
            <b>Start your dream board</b>
            <small>Save the photos you love, for your designer</small>
          </span>
          <span className="go" aria-hidden>
            →
          </span>
        </Link>
      </main>
      <Tabs />
    </Frame>
  );
}
