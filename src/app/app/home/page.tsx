'use client';

/** Home, build stage (the owner's v1 screens): where the flat is, the one decision due, and today's photos. */

import Link from 'next/link';
import { AskGeio, Arrow, BellIcon, ExampleTag, Frame, Tabs, useBrief } from '@/components/app/ui';
import { DECISION, EXAMPLE, photo } from '@/modules/app/example-project';

export default function AppHome() {
  const [brief] = useBrief();
  const name = brief?.contactName?.trim() || 'Priya';

  return (
    <Frame>
      <ExampleTag />
      <section className="oa-hero">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/landing/hero.webp" alt="" />
        <div className="flex items-center justify-between">
          <span className="oa-meta" style={{ color: '#fff' }}>
            {EXAMPLE.flat}
          </span>
          <span className="oa-bell" aria-label="Updates">
            <BellIcon />
          </span>
        </div>
        <div className="oa-refresh" role="status">
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" />
          </svg>
          Updated from site just now
        </div>
        <div className="mt-auto pt-10">
          <p className="oa-meta" style={{ color: 'rgba(255,255,255,.85)', margin: 0 }}>
            {EXAMPLE.stage.name}, day {EXAMPLE.stage.day} of {EXAMPLE.stage.of}
          </p>
          <h1
            style={{
              margin: '8px 0 0',
              fontSize: 38,
              fontWeight: 600,
              letterSpacing: '-0.045em',
              lineHeight: 0.98,
            }}
          >
            Your home is coming together, {name}.
          </h1>
          <div className="oa-stages">
            {EXAMPLE.stages.map((s, i) => (
              <span key={s} className={`oa-stage${i < EXAMPLE.stageNow ? ' done' : i === EXAMPLE.stageNow ? ' now' : ''}`}>
                <i />
                {s}
              </span>
            ))}
          </div>
        </div>
      </section>

      <main className="oa-body">
        <div className="oa-card-dark">
          <p className="oa-meta" style={{ color: '#f08a5d', margin: 0 }}>
            Your decision, due {DECISION.due}
          </p>
          <h2
            style={{
              margin: '10px 0 0',
              fontSize: 25,
              fontWeight: 700,
              letterSpacing: '-0.03em',
              lineHeight: 1.1,
            }}
          >
            Choose the {DECISION.title.toLowerCase()}
          </h2>
          <p
            style={{
              margin: '10px 0 16px',
              fontSize: 15,
              lineHeight: 1.5,
              color: 'rgba(255,255,255,.75)',
            }}
          >
            Shutters are cut next week. Choosing late moves carpentry by about 3 days.
          </p>
          <Link href="/app/decision" className="oa-cta" style={{ display: 'inline-flex', width: 'auto', paddingInline: 22 }}>
            Choose a finish <Arrow />
          </Link>
        </div>

        <div className="oa-section-head" style={{ borderBottom: '1px solid var(--line)', paddingBottom: 10 }}>
          <h2>Today on site</h2>
          <span className="oa-meta">{EXAMPLE.today}</span>
        </div>
        <Link href="/app/site" className="oa-thumbs" aria-label="See today on site">
          {[28, 31, 25].map((f) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={f} src={photo(f)} alt="" />
          ))}
        </Link>
      </main>
      <AskGeio from="home" />
      <Tabs />
    </Frame>
  );
}
