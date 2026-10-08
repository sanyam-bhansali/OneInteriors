'use client';

/**
 * Home, build stage (the owner's v1 screens): where the flat is, the one
 * decision due, and today's photos. The customer's real project when they
 * have one (useMyProject); the labelled example otherwise.
 */

import Link from 'next/link';
import { AskGeio, Arrow, BellIcon, ExampleTag, Frame, Tabs, useBrief } from '@/components/app/ui';
import { useMyProject, type MyProject } from '@/components/app/useMyProject';
import { DECISION, EXAMPLE, PHOTOS, TODAY } from '@/modules/app/example-project';
import { STAGE_SHORT, currentStage, dayLabel, dayOf, pickDecision, timeLabel } from '@/modules/app/project-view';

interface HomeData {
  label: string;
  hero: string | null;
  refreshed: string | null;
  stageLine: string;
  stages: { label: string; state: 'done' | 'now' | 'next' }[];
  decision: { id: string | null; due: string; title: string; why: string } | null;
  today: { label: string; photos: { src: string; alt: string }[]; note: string | null };
}

const EXAMPLE_HOME: HomeData = {
  label: EXAMPLE.flat,
  hero: PHOTOS.homeHero,
  refreshed: 'Updated from site just now',
  stageLine: `${EXAMPLE.stage.name}, day ${EXAMPLE.stage.day} of ${EXAMPLE.stage.of}`,
  stages: EXAMPLE.stages.map((s, i) => ({ label: s, state: i < EXAMPLE.stageNow ? 'done' : i === EXAMPLE.stageNow ? 'now' : 'next' })),
  decision: {
    id: null,
    due: DECISION.due,
    title: `Choose the ${DECISION.title.toLowerCase()}`,
    why: 'Shutters are cut next week. Choosing late moves carpentry by about 3 days.',
  },
  today: { label: EXAMPLE.today, photos: TODAY, note: null },
};

function realHome(p: MyProject): HomeData {
  const latest = p.updates[0] ?? null;
  const { stage } = currentStage(p.stages);
  const { day, of } = dayOf(p.startOn, p.stages);
  const d = pickDecision(p.decisions, null);
  const open = d && (d.state === 'open' || d.state === 'due-soon') ? d : null;
  return {
    label: `With ${p.studio}`,
    hero: latest?.photos[0] ?? null,
    refreshed: latest ? `Updated from site ${dayLabel(latest.at)}, ${timeLabel(latest.at)}` : null,
    stageLine: stage ? `${STAGE_SHORT[stage.key] ?? stage.label}, day ${day} of ${of}` : 'Handed over',
    stages: p.stages.map((s) => ({
      label: STAGE_SHORT[s.key] ?? s.label,
      state: s.state === 'done' ? 'done' : s.state === 'now' ? 'now' : 'next',
    })),
    decision: open ? { id: open.id, due: dayLabel(open.dueOn), title: open.title, why: open.why } : null,
    today: {
      label: latest ? dayLabel(latest.at) : '',
      photos: (latest?.photos ?? []).slice(0, 3).map((src, i) => ({ src, alt: `Site photo ${i + 1}` })),
      note: latest?.note ?? null,
    },
  };
}

export default function AppHome() {
  const [brief] = useBrief();
  const mine = useMyProject();
  if (mine.state === 'loading') return <Frame>{null}</Frame>;
  const real = mine.state === 'real';
  const name = brief?.contactName?.trim() || (real ? '' : 'Priya');
  const h = real ? realHome(mine.project) : EXAMPLE_HOME;

  return (
    <Frame>
      {real ? null : <ExampleTag />}
      <section className="oa-hero">
        {h.hero ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={h.hero} alt="Your home, from the latest site update" />
        ) : null}
        <div className="flex items-center justify-between">
          <span className="oa-meta" style={{ color: '#fff' }}>
            {h.label}
          </span>
          <span className="oa-bell" aria-label="Updates">
            <BellIcon />
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
          <p className="oa-meta" style={{ color: 'rgba(255,255,255,.85)', margin: 0 }}>
            {h.stageLine}
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
              {real ? 'Decide' : 'Choose a finish'} <Arrow />
            </Link>
          </div>
        ) : null}

        <div className="oa-section-head" style={{ borderBottom: '1px solid var(--line)', paddingBottom: 10 }}>
          <h2>{real ? 'Latest from site' : 'Today on site'}</h2>
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
        {real && !mine.project.updates.length ? (
          <p className="oa-note">The first update from site will appear here, and on your phone, as soon as the studio posts it.</p>
        ) : null}
      </main>
      <AskGeio from="home" />
      <Tabs />
    </Frame>
  );
}
