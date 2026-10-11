'use client';

/** On site (the owner's v1 screens): every working day, photographed, and a day nobody came, said plainly. */

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { openedUpdateAction } from '../engage/actions';
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

/** The real project's site feed, newest first: the daily site log (photos with their sentences, who was on site, nobody-on-site days, corrections beside the day), the older notes, and working days with no update. */
function RealSite({ project }: { project: MyProject }) {
  const days = project.siteLogs ?? [];
  const missed = project.siteMissedDays ?? [];
  const logged = new Set(days.map((d) => d.day));
  type Item = { key: string; day: string; at: number } & ({ kind: 'day'; d: SiteDay } | { kind: 'note'; u: MyProject['updates'][number] } | { kind: 'missed' });
  const items: Item[] = [
    ...days.map((d) => ({ key: `d-${d.id}`, day: d.day, at: Date.parse(d.postedAt), kind: 'day' as const, d })),
    ...project.updates.map((u) => ({ key: `u-${u.id}`, day: istDay(u.at), at: Date.parse(u.at), kind: 'note' as const, u })),
    ...missed.filter((m) => !logged.has(m)).map((m) => ({ key: `m-${m}`, day: m, at: Date.parse(`${m}T12:00:00Z`), kind: 'missed' as const })),
  ].sort((a, b) => (a.day === b.day ? b.at - a.at : a.day < b.day ? 1 : -1));
  const today = istDay(new Date().toISOString());
  const photos = days.some((d) => d.photos.length) || project.updates.some((u) => u.photos.length);
  return (
    <Frame>
      <header className="oa-page-head">
        <span className="oa-meta">Every working day</span>
        <h1>On site</h1>
      </header>
      <main className="oa-body">
        <ThreeD />
        {photos ? <Story /> : null}
        <EarnToday />
        {items.length === 0 ? (
          <p className="oa-sub" style={{ margin: 0 }}>
            Nothing yet. The first update from {project.studio} appears here, and on your phone, as soon as it is posted.
          </p>
        ) : null}
        {items.map((it) =>
          it.kind === 'missed' ? (
            <div key={it.key} className="oa-card-dark">
              <p className="oa-meta" style={{ color: '#f08a5d', margin: 0 }}>
                {it.day === today ? 'No update from the studio today' : `${dayLabel(`${it.day}T12:00:00Z`)}, no update posted`}
              </p>
              <p style={{ margin: '10px 0 0', fontSize: 15.5, lineHeight: 1.5, color: 'rgba(255,255,255,.85)' }}>
                {project.studio} posted no photos for this working day.
              </p>
            </div>
          ) : it.kind === 'note' ? (
            <section key={it.key} className="flex flex-col gap-3" style={{ borderTop: '1px solid var(--line)', paddingTop: 14 }}>
              <div className="oa-section-head">
                <h2>{dayLabel(it.u.at)}</h2>
                <span style={{ font: '500 13px var(--mono)', color: 'var(--ink-2)' }}>{timeLabel(it.u.at)}</span>
              </div>
              {it.u.photos[0] ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img className="oa-photo-main" src={it.u.photos[0]} alt="Site photo" />
              ) : null}
              {it.u.photos.length > 1 ? (
                <div className="oa-photo-pair">
                  {it.u.photos.slice(1, 5).map((src) => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img key={src} src={src} alt="Site photo" />
                  ))}
                </div>
              ) : null}
              <p style={{ margin: 0, fontSize: 16, lineHeight: 1.5 }}>{it.u.note}</p>
              <div className="flex flex-wrap gap-2">
                <span className="oa-who">{it.u.byStudio ? `Posted by ${project.studio}` : 'Posted by One Interiors'}</span>
                {it.u.stage ? <span className="oa-who">{STAGE_SHORT[it.u.stage] ?? it.u.stage}</span> : null}
              </div>
            </section>
          ) : (
            <SiteDayView key={it.key} d={it.d} studio={project.studio} today={today} />
          ),
        )}
      </main>
      <Tabs />
    </Frame>
  );
}

type SiteDay = NonNullable<MyProject['siteLogs']>[number];
type SiteEntry = SiteDay['corrections'][number];

const istDay = (iso: string) => new Date(Date.parse(iso) + 330 * 60_000).toISOString().slice(0, 10);

/** One day from the site log: a nobody day says why; an update shows each photo with its own sentence. */
function SiteDayView({ d, studio, today }: { d: SiteDay; studio: string; today: string }) {
  const title = d.day === today ? `Today, ${dayLabel(d.postedAt)}` : dayLabel(d.postedAt);
  if (d.kind === 'nobody') {
    return (
      <div className="oa-card-dark">
        <p className="oa-meta" style={{ color: '#f08a5d', margin: 0 }}>
          {title}, nobody on site
        </p>
        <p style={{ margin: '10px 0 0', fontSize: 15.5, lineHeight: 1.5, color: 'rgba(255,255,255,.85)' }}>
          {d.reasonText ? `${studio} says: ${d.reasonText.toLowerCase()}.` : `${studio} says nobody was on site.`}{' '}
          {d.countsAgainstStudio === false ? 'This day is not counted as the studio’s delay.' : 'This day counts in the project’s running delay.'}
        </p>
        {d.corrections.map((c) => (
          <EntryView key={c.id} e={c} label={`Added at ${timeLabel(c.postedAt)}`} dark />
        ))}
      </div>
    );
  }
  return (
    <section className="flex flex-col gap-3" style={{ borderTop: '1px solid var(--line)', paddingTop: 14 }}>
      <div className="oa-section-head">
        <h2>{title}</h2>
        <span style={{ font: '500 13px var(--mono)', color: 'var(--ink-2)' }}>{timeLabel(d.postedAt)}</span>
      </div>
      <EntryView e={d} />
      {d.corrections.map((c) => (
        <EntryView key={c.id} e={c} label={`Added at ${timeLabel(c.postedAt)}`} />
      ))}
      <div className="flex flex-wrap gap-2">
        <span className="oa-who">Posted by {studio}</span>
      </div>
    </section>
  );
}

/** A post's content: each photo with its own sentence, the extra sentence, who was there, what got done. */
function EntryView({ e, label, dark = false }: { e: SiteEntry; label?: string; dark?: boolean }) {
  const ink = dark ? '#fff' : undefined;
  return (
    <div
      className="flex flex-col gap-3"
      style={label ? { borderLeft: `2px solid ${dark ? '#f08a5d' : 'var(--line)'}`, paddingLeft: 12, marginTop: dark ? 12 : 0 } : undefined}
    >
      {label ? (
        <span className="oa-meta" style={{ margin: 0, color: dark ? 'rgba(255,255,255,.7)' : undefined }}>
          {label}
        </span>
      ) : null}
      {e.reasonText ? <p style={{ margin: 0, color: ink }}>Nobody on site: {e.reasonText.toLowerCase()}.</p> : null}
      {e.photos.map((p, i) => (
        <figure key={i} style={{ margin: 0 }} className="flex flex-col gap-2">
          {p.url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img className="oa-photo-main" src={p.url} alt={p.text ?? 'Site photo'} />
          ) : null}
          {p.text ? <figcaption style={{ fontSize: 16, lineHeight: 1.5, color: ink }}>{p.text}</figcaption> : null}
          {p.fromGallery ? (
            <span className="oa-who" style={{ alignSelf: 'flex-start' }}>
              From gallery
            </span>
          ) : null}
        </figure>
      ))}
      {e.text ? <p style={{ margin: 0, fontSize: 16, lineHeight: 1.5, color: ink }}>{e.text}</p> : null}
      {e.crew.length ? (
        <div className="flex flex-wrap gap-2">
          {e.crew.map((c, i) => (
            <span key={i} className="oa-who">
              {c.name}, {c.role.toLowerCase()}
              {c.arrivedAt ? `, ${timeLabel(c.arrivedAt)}` : ''}
            </span>
          ))}
        </div>
      ) : null}
      {e.done.length ? (
        <p style={{ margin: 0, fontSize: 14.5, color: dark ? 'rgba(255,255,255,.8)' : 'var(--ink-2)' }}>
          Done: {e.done.map((x) => `${x.label} (${x.room})`).join(', ')}
        </p>
      ) : null}
    </div>
  );
}

export default function AppSite() {
  const mine = useMyProject();
  if (mine.state === 'loading') return <Frame>{null}</Frame>;
  return mine.state === 'real' ? <RealSite project={mine.project} /> : <ExampleSite />;
}

/** Your home's story: every site photo as one film (v79). */
function Story() {
  return (
    <Link href="/app/story" className="oa-card oa-site-3d">
      <span>
        <b>Your home&rsquo;s story</b>
        <small>Every site photo, played as one film</small>
      </span>
      <span aria-hidden>▶</span>
    </Link>
  );
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

/** Opening today's update earns the day's coins (Home Coins rules); says so once. */
function EarnToday() {
  const [earned, setEarned] = useState(0);
  useEffect(() => {
    void openedUpdateAction().then((r) => setEarned(r.earned));
  }, []);
  return earned ? <p className="oa-toast">+{earned} Home Coins for today&rsquo;s update</p> : null;
}
