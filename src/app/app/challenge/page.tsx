'use client';

/**
 * Spot the mistake (v79 design): this week's real site photo. Tap where the
 * mistake is; right or wrong, the answer and what to check in your own home
 * appear. One answer a week, +50 coins when right.
 */

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { Frame, Head, Tabs } from '@/components/app/ui';
import { COINS } from '@/modules/engagement/coin-rules';
import { answerChallengeAction, challengeAction } from '../engage/actions';

type State = Awaited<ReturnType<typeof challengeAction>> | null;

export default function AppChallenge() {
  const [s, setS] = useState<State>(null);
  const [result, setResult] = useState<{ hit: boolean; earned: number } | null>(null);
  const [tap, setTap] = useState<{ x: number; y: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const img = useRef<HTMLImageElement>(null);

  const load = () => void challengeAction().then(setS);
  useEffect(load, []);

  const c = s?.ok ? s.challenge : null;

  const onTap = async (e: React.MouseEvent<HTMLButtonElement>) => {
    if (!c || c.answered || result) return;
    const box = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - box.left) / box.width;
    const y = (e.clientY - box.top) / box.height;
    setTap({ x, y });
    const r = await answerChallengeAction(c.id, x, y);
    if (!r.ok) return setError(r.error);
    setResult({ hit: r.hit, earned: r.earned });
    load();
  };

  const a = c?.answered ?? null;

  return (
    <Frame>
      <Head back="/app/home" meta={c ? `Week of ${c.weekLabel}` : 'Weekly challenge'} />
      <main className="oa-body">
        <h1 className="oa-title">Spot the mistake</h1>
        {s && !s.ok ? <p className="oa-sub">{s.error}</p> : null}
        {s?.ok && !c ? <p className="oa-sub">This week&rsquo;s photo is not up yet. A new one comes every Monday.</p> : null}
        {c ? (
          <>
            <p className="oa-sub">
              This is a real photo from a Pune site. Something here needs fixing before handover. Tap it.
            </p>
            {result ? (
              <p className="oa-toast">{result.hit ? `Found it! +${result.earned || COINS.CHALLENGE.coins} coins` : 'Not quite. Here it is.'}</p>
            ) : null}
            <button type="button" className="oa-spot" onClick={(e) => void onTap(e)} disabled={Boolean(a)} aria-label="The site photo. Tap where the mistake is.">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img ref={img} src={c.photo} alt="A site photo with one mistake in it" />
              {tap ? <i className="tap" style={{ left: `${tap.x * 100}%`, top: `${tap.y * 100}%` }} /> : null}
              {a ? (
                <i
                  className="ring"
                  style={{ left: `${a.x * 100}%`, top: `${a.y * 100}%`, width: `${a.radius * 200}%`, aspectRatio: '1' }}
                />
              ) : null}
            </button>
            {a ? (
              <section className="oa-card">
                <b style={{ fontSize: 17 }}>{a.answer}</b>
                <p style={{ margin: '8px 0 0', fontSize: 15, lineHeight: 1.55 }}>{a.explain}</p>
                <Link href="/app/geio" className="oa-inline-link" style={{ display: 'inline-block', marginTop: 10 }}>
                  Ask GEIO more
                </Link>
              </section>
            ) : null}
            <p className="oa-note">
              {c.found.toLocaleString('en-IN')} {c.found === 1 ? 'person' : 'people'} found it this week. Next challenge on Monday.
            </p>
            {error ? <p className="oa-note" style={{ color: 'var(--accent-ink)' }}>{error}</p> : null}
          </>
        ) : null}
      </main>
      <Tabs />
    </Frame>
  );
}
