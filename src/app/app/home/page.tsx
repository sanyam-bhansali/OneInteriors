'use client';

/**
 * Home (the owner's v1 screens). A real project shows format C, one thing at
 * a time (OneThingHome.tsx, chosen 1 Nov 2026); with none, the labelled
 * example's build-stage home: where the flat is, the decision due, today's
 * photos.
 */

import Link from 'next/link';
import { Arrow, BellIcon, ExampleTag, Frame, Tabs, useBrief } from '@/components/app/ui';
import { useMyProject } from '@/components/app/useMyProject';
import { DECISION, EXAMPLE, PHOTOS, TODAY } from '@/modules/app/example-project';
import { useEffect, useState } from 'react';
import { openedUpdateAction, walletAction } from '../engage/actions';
import { OneThingHome } from './OneThingHome';

interface HomeData {
  label: string;
  hero: string | null;
  refreshed: string | null;
  stageLine: string;
  /** The design's one delay message: the stage's status and the overall status, kept apart. */
  status: { stage: string | null; overall: string; late: boolean };
  stages: { label: string; state: 'done' | 'now' | 'next' }[];
  decision: { id: string | null; due: string; title: string; why: string } | null;
  today: { label: string; photos: { src: string; alt: string }[]; note: string | null };
}

const EXAMPLE_HOME: HomeData = {
  label: EXAMPLE.flat,
  hero: PHOTOS.homeHero,
  refreshed: 'Updated from site just now',
  stageLine: `${EXAMPLE.stage.name}, day ${EXAMPLE.stage.day} of ${EXAMPLE.stage.of}`,
  status: { stage: `${EXAMPLE.stage.name} · on track`, overall: `Overall · ${EXAMPLE.runningLateDays} days late`, late: true },
  stages: EXAMPLE.stages.map((s, i) => ({ label: s, state: i < EXAMPLE.stageNow ? 'done' : i === EXAMPLE.stageNow ? 'now' : 'next' })),
  decision: {
    id: null,
    due: DECISION.due,
    title: `Choose the ${DECISION.title.toLowerCase()}`,
    why: 'Shutters are cut next week. Choosing late moves carpentry by about 3 days.',
  },
  today: { label: EXAMPLE.today, photos: TODAY, note: null },
};

export default function AppHome() {
  const [brief] = useBrief();
  const mine = useMyProject();
  const coins = useCoins(mine.state === 'real');
  if (mine.state === 'loading') return <Frame>{null}</Frame>;
  /* A real project: format C, one thing at a time (the owner's pick, 1 Nov 2026). The example keeps the build-stage home. */
  if (mine.state === 'real') return <OneThingHome project={mine.project} />;
  const name = brief?.contactName?.trim() || 'Priya';
  const h = EXAMPLE_HOME;

  return (
    <Frame>
      <ExampleTag />
      <section className="oa-hero">
        {h.hero ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={h.hero} alt="Your home, from the latest site update" />
        ) : null}
        <div className="flex items-center justify-between">
          <span className="oa-meta" style={{ color: '#fff' }}>
            {h.label}
          </span>
          <span className="flex items-center gap-2">
            {coins !== null ? (
              <Link href="/app/coins" className="oa-coin-chip" aria-label={`${coins} Home Coins`}>
                <i aria-hidden />
                {coins.toLocaleString('en-IN')}
              </Link>
            ) : null}
            <Link href="/app/notifications" className="oa-bell" aria-label="Notifications">
              <BellIcon />
            </Link>
          </span>
        </div>
        {h.refreshed ? (
          <div className="oa-refresh" role="status">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" />
            </svg>
            {h.refreshed}
          </div>
        ) : null}
        <div className="mt-auto pt-10">
          <p className="oa-status">
            {h.status.stage ? <span>{h.status.stage}</span> : null}
            <span className={h.status.late ? 'late' : ''}>{h.status.overall}</span>
          </p>
          <h1 style={{ margin: '8px 0 0', fontSize: 40, fontWeight: 600, letterSpacing: '-0.045em', lineHeight: 0.98 }}>
            Your home is coming together{name ? `, ${name}` : ''}.
          </h1>
          <div className="oa-stages" style={{ gridTemplateColumns: `repeat(${h.stages.length}, 1fr)` }}>
            {h.stages.map((s) => (
              <span key={s.label} className={`oa-stage${s.state === 'done' ? ' done' : s.state === 'now' ? ' now' : ''}`}>
                <i />
                {s.label}
              </span>
            ))}
          </div>
        </div>
      </section>

      <main className="oa-body">
        {h.decision ? (
          <div className="oa-card-dark">
            <p className="oa-meta" style={{ color: '#f08a5d', margin: 0 }}>
              Your decision, due {h.decision.due}
            </p>
            <h2 style={{ margin: '10px 0 0', fontSize: 25, fontWeight: 700, letterSpacing: '-0.03em', lineHeight: 1.1 }}>
              {h.decision.title}
            </h2>
            <p style={{ margin: '10px 0 16px', fontSize: 15, lineHeight: 1.5, color: 'rgba(255,255,255,.75)' }}>{h.decision.why}</p>
            <Link
              href={h.decision.id ? `/app/decision?id=${h.decision.id}` : '/app/decision'}
              className="oa-cta"
              style={{ display: 'inline-flex', width: 'auto', paddingInline: 22 }}
            >
              Choose a finish <Arrow />
            </Link>
          </div>
        ) : null}

        <div className="oa-section-head" style={{ borderBottom: '1px solid var(--line)', paddingBottom: 10 }}>
          <h2>Today on site</h2>
          <span className="oa-meta">{h.today.label}</span>
        </div>
        {h.today.photos.length ? (
          <Link href="/app/site" className="oa-thumbs" aria-label="See the site updates">
            {h.today.photos.map((p) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={p.src} src={p.src} alt={p.alt} />
            ))}
          </Link>
        ) : null}
        {h.today.note ? <p style={{ margin: 0, fontSize: 15.5, lineHeight: 1.5 }}>{h.today.note}</p> : null}
        <Link href="/app/challenge" className="oa-card oa-home-card">
          <span className="oa-label" style={{ margin: 0 }}>
            This week&rsquo;s challenge
          </span>
          <b>Spot the mistake</b>
          <span className="oa-note">A real site photo. Find what needs fixing, win 50 coins.</span>
        </Link>
        <Link href="/app/homes" className="oa-card oa-home-card">
          <span className="oa-label" style={{ margin: 0 }}>
            Home of the month
          </span>
          <b>See real One Interiors homes</b>
        </Link>
        <Link href="/app/refer" className="oa-card oa-home-card">
          <span className="oa-label" style={{ margin: 0 }}>
            Refer and earn
          </span>
          <b>Give 5,000 coins, get 5,000</b>
          <span className="oa-note">When a friend or neighbour signs. Three flats in your society earn everyone a bonus.</span>
        </Link>
      </main>
      <Tabs />
    </Frame>
  );
}

/** The coin balance for the header chip, settled on the way; and today's update earns its coins. */
function useCoins(real: boolean): number | null {
  const [n, setN] = useState<number | null>(null);
  useEffect(() => {
    if (!real) return;
    let live = true;
    void openedUpdateAction()
      .then(() => walletAction())
      .then((r) => live && r.ok && setN(r.wallet.balance));
    return () => {
      live = false;
    };
  }, [real]);
  return n;
}
