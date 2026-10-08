'use client';

/** 3D home (the owner's v1 screens, full-home orders): the flat as it stands today, or as designed. */

import Link from 'next/link';
import { useState } from 'react';
import { Arrow, AskGeio, ExampleTag, Frame, Tabs } from '@/components/app/ui';
import { IsoFlat, ISO_ROOMS } from '@/components/app/IsoFlat';
import { EXAMPLE, ROOMS_3D, type RoomId } from '@/modules/app/example-project';

const STATUS_COLOUR = { Done: 'var(--ok)', 'In progress': 'var(--accent)', 'Next up': 'var(--ink-2)' } as const;
const DOT = { done: 'var(--ok)', progress: 'var(--accent)', next: '#b9b7b1' } as const;

export default function App3D() {
  const [design, setDesign] = useState(false);
  const [room, setRoom] = useState<RoomId>('kitchen');
  const sel = ROOMS_3D.find((r) => r.id === room)!;
  const studio = EXAMPLE.studio.split(' ')[0];

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
          <button type="button" aria-pressed={!design} onClick={() => setDesign(false)}>
            Today
          </button>
          <button type="button" aria-pressed={design} onClick={() => setDesign(true)}>
            Finished design
          </button>
        </div>

        <div className="oa-iso-card">
          <IsoFlat
            design={design}
            selected={room}
            onSelect={setRoom}
            label={
              design
                ? 'Your finished flat as designed, all five rooms complete'
                : 'Your flat today: bath done, kitchen and both bedrooms in progress with workers, living room next'
            }
          />
          <span className="oa-iso-chip top">
            {design ? null : <i className="live" />}
            {design ? 'Design view: how it will look' : 'Live from site, Thu 5:12 pm'}
          </span>
          {design ? null : <span className="oa-iso-chip bottom">3 people on site today</span>}
        </div>

        <div className="oa-iso-legend">
          <span>
            <i style={{ background: 'var(--ok)' }} />
            Done
          </span>
          <span>
            <i style={{ background: 'var(--accent)' }} />
            In progress
          </span>
          <span>
            <i className="dashed" />
            Next up
          </span>
        </div>

        <div className="oa-chips" role="group" aria-label="Rooms">
          {ROOMS_3D.map((r) => {
            const iso = ISO_ROOMS.find((x) => x.id === r.id)!;
            return (
              <button key={r.id} type="button" className="oa-room" aria-pressed={r.id === room} onClick={() => setRoom(r.id)}>
                <i style={{ background: design ? DOT.done : DOT[iso.today] }} />
                {r.name}
              </button>
            );
          })}
        </div>

        <section key={`${room}-${design}`} className="oa-iso-room">
          <div className="oa-section-head">
            <h2>{sel.name}</h2>
            <span className="oa-meta" style={{ color: design ? 'var(--ok)' : STATUS_COLOUR[sel.status] }}>
              {design ? 'Design' : sel.status}
            </span>
          </div>
          <p>{design ? sel.designNote : sel.note}</p>
          {!design && sel.photo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={sel.photo} alt={`${sel.name} on site today`} />
          ) : null}
          {!design && sel.link ? (
            <Link href={sel.link.href} className="oa-iso-link">
              {sel.link.label} <Arrow />
            </Link>
          ) : null}
        </section>

        <p className="oa-note" style={{ margin: 0 }}>
          Built from {studio}&rsquo;s design for your flat. A room changes only when the studio logs it on site and your
          expert checks the photos. People appear only on days someone was actually there.
        </p>
      </main>
      <AskGeio from="3d" />
      <Tabs />
    </Frame>
  );
}
