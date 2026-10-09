'use client';

/**
 * Refer and the society circle (v79 design): give 5,000, get 5,000 when a
 * friend signs; three flats in one society signing earns every family in it
 * a bonus. Friends are shown by first name only, and the circle by count —
 * never which flats or who, because neighbours did not agree to be listed.
 */

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Frame, Head, Tabs } from '@/components/app/ui';
import { COINS } from '@/modules/engagement/coin-rules';
import { referAction } from '../engage/actions';

type State = Awaited<ReturnType<typeof referAction>> | null;

export default function AppRefer() {
  const [s, setS] = useState<State>(null);
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    void referAction().then(setS);
  }, []);
  const r = s?.ok ? s.refer : null;
  const link = r?.code ? `${typeof location === 'undefined' ? '' : location.origin}/r/${r.code}` : null;
  const give = COINS.REFERRAL_SIGNED.coins.toLocaleString('en-IN');

  return (
    <Frame>
      <Head back="/app/me" />
      <main className="oa-body">
        <p className="oa-label" style={{ margin: 0 }}>
          Refer a friend or neighbour
        </p>
        <h1 className="oa-title">
          Give {give}. Get {give}.
        </h1>
        <p className="oa-sub">When someone you invite signs with a studio, you both get {give} Home Coins.</p>
        {s && !s.ok ? (
          <>
            <p className="oa-sub">{s.error}</p>
            {s.signIn ? (
              <Link href="/sign-in?next=/app/refer" className="oa-cta">
                Sign in
              </Link>
            ) : null}
          </>
        ) : null}

        {r?.society ? (
          <section className="oa-card-dark">
            <span className="oa-label" style={{ margin: 0, color: '#f2c98a' }}>
              {r.society.name} circle
            </span>
            <b style={{ display: 'block', marginTop: 6, fontSize: 24, letterSpacing: '-0.03em' }}>
              {Math.min(r.society.signed, r.society.of)} of {r.society.of} flats
            </b>
            <div className="oa-circle" aria-hidden>
              {Array.from({ length: r.society.of }, (_, i) => (
                <i key={i} className={i < r.society!.signed ? 'on' : ''} />
              ))}
            </div>
            <p style={{ margin: '10px 0 0', fontSize: 14.5, lineHeight: 1.5, color: '#b5b3ad' }}>
              When {r.society.of} flats in your society sign, every family in the circle gets a {COINS.SOCIETY_CIRCLE.coins.toLocaleString('en-IN')}-coin bonus.
            </p>
          </section>
        ) : null}

        {link ? (
          <section className="oa-card" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <span className="oa-label" style={{ margin: 0 }}>
              Your invite code
            </span>
            <b className="mono" style={{ fontSize: 24, letterSpacing: '0.04em' }}>
              {r!.code}
            </b>
            <button
              type="button"
              className="oa-inline-link"
              style={{ alignSelf: 'flex-start' }}
              onClick={() => {
                void navigator.clipboard?.writeText(link).then(() => setCopied(true));
              }}
            >
              {copied ? 'Link copied' : 'Copy the link'}
            </button>
          </section>
        ) : null}

        {r && r.invites.length ? (
          <section>
            <p className="oa-label">Your invites</p>
            <div className="oa-list">
              {r.invites.map((f, i) => (
                <div key={i} className="oa-row" style={{ cursor: 'default' }}>
                  <span className="oa-row-title" style={{ fontSize: 16 }}>
                    {f.name}
                  </span>
                  <span className="oa-row-price">{f.signed ? `+${give}` : 'Not signed yet'}</span>
                </div>
              ))}
            </div>
          </section>
        ) : null}
      </main>
      {link ? (
        <div className="oa-foot">
          <a
            className="oa-cta"
            href={`https://wa.me/?text=${encodeURIComponent(`We are doing our home through One Interiors: verified studios, quotes you can read line by line, and an expert who is paid by nobody but them. Start your brief here and we both get ${give} Home Coins when you sign: ${link}`)}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            Invite on WhatsApp
          </a>
        </div>
      ) : null}
      <Tabs />
    </Frame>
  );
}
