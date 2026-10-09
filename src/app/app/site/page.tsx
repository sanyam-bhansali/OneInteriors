'use client';

/** On site (the owner's v1 screens): every working day, photographed, and a day nobody came, said plainly. */

import Link from 'next/link';
import { CubeIcon, ExampleTag, Frame, Tabs, useBrief } from '@/components/app/ui';
import { useMyProject, type MyProject } from '@/components/app/useMyProject';
import { EXAMPLE, PHOTOS, WEEK } from '@/modules/app/example-project';
import { STAGE_SHORT, dayLabel, timeLabel } from '@/modules/app/project-view';

function ExampleSite() {
  const worked = WEEK.filter((d) => d.state === 'worked' || d.state === 'today').length;
  const sofar = WEEK.filter((d) => d.state !== 'ahead').length;
  return (
    <Frame>
      <ExampleTag />
      <header className="oa-page-head">
        <span className="oa-meta">Every working day</span>
        <h1>On site</h1>
      </header>
      <main className="oa-body">
        <ThreeD />
        <div style={{ borderTop: '1px solid var(--line)', paddingTop: 14 }}>
          <div className="oa-section-head">
            <b style={{ fontSize: 16 }}>This week</b>
            <span style={{ font: '500 13px var(--mono)', color: 'var(--ink-2)' }}>
              {worked} of {sofar} days worked
            </span>
          </div>
          <div className="oa-week mt-3">
            {WEEK.map((d) => (
              <span
                key={d.day}
                className={d.state === 'missed' ? 'miss' : d.state === 'ahead' ? 'off' : ''}
                style={
                  d.state === 'missed' ? { color: 'var(--accent-ink)' } : d.state === 'today' ? { color: 'var(--ink)' } : undefined
                }
              >
                <i />
                {d.day.toUpperCase()}
              </span>
            ))}
          </div>
        </div>

        <div className="oa-section-head">
          <h2>Today, {EXAMPLE.today}</h2>
          <span style={{ font: '500 13px var(--mono)', color: 'var(--ink-2)' }}>5:12 pm</span>
        </div>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="oa-photo-main" src={PHOTOS.living} alt="Living room after today's work" />
        <div className="oa-photo-pair">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={PHOTOS.bedroom1} alt="Bedroom 1" />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={PHOTOS.kitchenCarcass} alt="Kitchen" />
        </div>
        <p style={{ margin: 0, fontSize: 16, lineHeight: 1.5 }}>
          Wardrobe frames fitted in both bedrooms. Kitchen carcass levelled and fixed to the wall.
        </p>
        <div className="flex flex-wrap gap-2">
          <span className="oa-who">Ramesh, carpenter, 9:40 am</span>
          <span className="oa-who">1 helper</span>
        </div>

        <div className="oa-card-dark">
          <p className="oa-meta" style={{ color: '#f08a5d', margin: 0 }}>
            Tue 6 Oct, nobody on site
          </p>
          <p style={{ margin: '10px 0 0', fontSize: 15.5, lineHeight: 1.5, color: 'rgba(255,255,255,.85)' }}>
            The studio says the carpenter was finishing another site. The day is added to the schedule, not to your bill.
          </p>
        </div>
      </main>
      <Tabs />
    </Frame>
  );
}

/** The real project's site updates, newest first: photos, what was done, and who posted it. */
function RealSite({ project }: { project: MyProject }) {
  return (
    <Frame>
      <header className="oa-page-head">
        <span className="oa-meta">Every update from site</span>
        <h1>On site</h1>
      </header>
      <main className="oa-body">
        <ThreeD />
        {project.updates.length === 0 ? (
          <p className="oa-sub" style={{ margin: 0 }}>
            Nothing yet. The first update from {project.studio} appears here, and on your phone, as soon as it is posted.
          </p>
        ) : null}
        {project.updates.map((u) => (
          <section key={u.id} className="flex flex-col gap-3" style={{ borderTop: '1px solid var(--line)', paddingTop: 14 }}>
            <div className="oa-section-head">
              <h2>{dayLabel(u.at)}</h2>
              <span style={{ font: '500 13px var(--mono)', color: 'var(--ink-2)' }}>{timeLabel(u.at)}</span>
            </div>
            {u.photos[0] ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img className="oa-photo-main" src={u.photos[0]} alt="Site photo" />
            ) : null}
            {u.photos.length > 1 ? (
              <div className="oa-photo-pair">
                {u.photos.slice(1, 5).map((src) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img key={src} src={src} alt="Site photo" />
                ))}
              </div>
            ) : null}
            <p style={{ margin: 0, fontSize: 16, lineHeight: 1.5 }}>{u.note}</p>
            <div className="flex flex-wrap gap-2">
              <span className="oa-who">{u.byStudio ? `Posted by ${project.studio}` : 'Posted by One Interiors'}</span>
              {u.stage ? <span className="oa-who">{STAGE_SHORT[u.stage] ?? u.stage}</span> : null}
            </div>
          </section>
        ))}
      </main>
      <Tabs />
    </Frame>
  );
}

export default function AppSite() {
  const mine = useMyProject();
  if (mine.state === 'loading') return <Frame>{null}</Frame>;
  return mine.state === 'real' ? <RealSite project={mine.project} /> : <ExampleSite />;
}

/** 3D sits inside Site (v79), and only for full-home orders: a kitchen-and-wardrobes job has no home to walk through. */
function ThreeD() {
  const [brief] = useBrief();
  if (brief?.scope && brief.scope !== 'FULL_HOME') return null;
  return (
    <Link href="/app/3d" className="oa-card oa-site-3d">
      <span>
        <b>View in 3D</b>
        <small>Your flat, room by room, as the studio builds it</small>
      </span>
      <CubeIcon />
    </Link>
  );
}
