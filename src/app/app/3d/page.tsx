'use client';

/** 3D home (the owner's v1 screens, full-home orders): the flat as it stands today, or as designed. */

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useState } from 'react';
import { AskGeio, ExampleTag, Frame, Tabs, useBrief } from '@/components/app/ui';
import { DECISION, EXAMPLE, ROOMS_3D, photo } from '@/modules/app/example-project';

const Flat3D = dynamic(() => import('@/components/oi/Flat3D').then((m) => m.Flat3D), {
  ssr: false,
  loading: () => <p className="oa-note p-5">Drawing the flat…</p>,
});

const STATE = { done: 'Done', now: 'In progress', next: 'Next up' } as const;

export default function App3D() {
  const [brief] = useBrief();
  const [view, setView] = useState<'today' | 'finished'>('today');
  const [room, setRoom] = useState(ROOMS_3D.findIndex((r) => r.key === 'KITCHEN'));
  const r = ROOMS_3D[room]!;
  const built = view === 'finished' ? null : ROOMS_3D.filter((x) => x.state !== 'next').map((x) => x.key);

  return (
    <Frame>
      <ExampleTag />
      <header className="oa-page-head">
        <span className="oa-sample" style={{ background: 'var(--accent)', color: '#fff' }}>
          Full-home orders only
        </span>
        <h1>Your home in 3D</h1>
      </header>
      <main className="oa-body">
        <div className="oa-seg" role="group" aria-label="View" style={{ alignSelf: 'flex-start' }}>
          <button type="button" aria-pressed={view === 'today'} onClick={() => setView('today')}>
            Today
          </button>
          <button type="button" aria-pressed={view === 'finished'} onClick={() => setView('finished')}>
            Finished design
          </button>
        </div>
        <div className="oa-stage3d">
          <Flat3D
            key={view}
            bedrooms={2}
            carpetAreaSqft={850}
            style={brief?.styleLikes?.[0] ?? null}
            inScope={built}
            className="h-full w-full cursor-grab"
            label={view === 'today' ? `${EXAMPLE.flat} as it stands today` : `${EXAMPLE.flat} as designed`}
          />
        </div>
        <div className="flex gap-4" style={{ font: '500 11.5px var(--mono)', color: 'var(--ink-2)' }}>
          <span>
            <span className="oa-room-dot done" />
            Done
          </span>
          <span>
            <span className="oa-room-dot now" />
            In progress
          </span>
          <span>
            <span className="oa-room-dot" />
            Next up
          </span>
        </div>
        <div className="oa-chips">
          {ROOMS_3D.map((x, i) => (
            <button
              key={x.key}
              type="button"
              className="oa-chip"
              aria-pressed={i === room}
              onClick={() => setRoom(i)}
              style={i === room ? { background: 'transparent', color: 'var(--accent-ink)', borderColor: 'var(--accent)' } : undefined}
            >
              <span className={`oa-room-dot ${x.state}`} aria-hidden />
              {x.label}
            </button>
          ))}
        </div>
        <div style={{ borderTop: '1px solid var(--line)', paddingTop: 16 }}>
          <div className="oa-section-head">
            <h2>{r.label}</h2>
            <span className="oa-meta" style={{ color: r.state === 'now' ? 'var(--accent-ink)' : undefined }}>
              {STATE[r.state]}
            </span>
          </div>
          <p style={{ margin: '8px 0 0', fontSize: 15.5, lineHeight: 1.5 }}>{r.note}</p>
          {r.state !== 'next' ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img className="oa-photo-main mt-3" src={photo(r.key === 'KITCHEN' ? 30 : 27)} alt={`${r.label} on site today`} />
          ) : null}
          {r.key === 'KITCHEN' ? (
            <Link href="/app/decision" className="oa-meta mt-4 inline-block" style={{ color: 'var(--accent-ink)' }}>
              Choose the {DECISION.title.toLowerCase().replace('kitchen ', '')} →
            </Link>
          ) : null}
        </div>
        <p className="oa-note" style={{ margin: 0 }}>
          Built from {EXAMPLE.studio.split(' ')[0]}&rsquo;s design for your flat. A room changes only when the studio logs it
          on site and your expert checks the photos.
        </p>
      </main>
      <AskGeio from="3d" />
      <Tabs />
    </Frame>
  );
}
