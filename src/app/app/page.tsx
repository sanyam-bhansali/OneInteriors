'use client';

/**
 * 0 Opening and 1 Welcome (the owner's v1 screens).
 *
 * The opening is the empty room lighting up — the 33 frames the home page's
 * "how it works" already uses — with the logotype arriving as the lights
 * come on. Once a session, then straight to the welcome.
 */

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Logotype } from '@/components/brand';
import { Frame, Foot, Cta } from '@/components/app/ui';
import { VERIFIED_STUDIOS } from '@/lib/claims';

const FRAMES = 33;
const frame = (i: number) => `/landing/seq/f${String(i).padStart(2, '0')}.webp`;
const SEEN = 'oa.opened';

export default function AppStart() {
  const [phase, setPhase] = useState<'film' | 'lit' | 'done'>('film');
  const [i, setI] = useState(0);

  useEffect(() => {
    let seen = false;
    try {
      seen = sessionStorage.getItem(SEEN) === '1';
      sessionStorage.setItem(SEEN, '1');
    } catch {
      /* storage blocked: play it */
    }
    if (seen || matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setPhase('done');
      return;
    }
    // Warm the frames, then play them.
    for (let f = 0; f < FRAMES; f++) new Image().src = frame(f);
    let f = 0;
    const tick = setInterval(() => {
      f += 1;
      setI(Math.min(f, FRAMES - 1));
      if (f === 18) setPhase('lit');
      if (f >= FRAMES + 12) {
        clearInterval(tick);
        setPhase('done');
      }
    }, 70);
    return () => clearInterval(tick);
  }, []);

  return (
    <Frame dark>
      <div
        className={`oa-opening${phase === 'lit' ? ' lit' : ''}${phase === 'done' ? ' gone' : ''}`}
        aria-hidden
        onClick={() => setPhase('done')}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={frame(i)} alt="" />
        <Logotype className="mark h-auto w-[120px]" />
      </div>

      <section className="oa-welcome" aria-label="Welcome">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/landing/hero.webp" alt="" />
        <Logotype className="logo" />
        <div className="copy">
          <p className="oa-meta" style={{ color: 'rgba(255,255,255,.85)', margin: 0 }}>
            <span className="oa-dot" />
            Pune, {VERIFIED_STUDIOS} verified studios
          </p>
          <h1>Find the right interior designer for your home.</h1>
          <p>Seven questions, three studios matched to your flat, and a quote you can read line by line.</p>
        </div>
        <Foot>
          <Cta href="/app/name">Find your designer</Cta>
          <Link href="/sign-in?next=/app/home" className="oa-link" style={{ color: '#fff' }}>
            I already have an account
          </Link>
        </Foot>
      </section>
    </Frame>
  );
}
