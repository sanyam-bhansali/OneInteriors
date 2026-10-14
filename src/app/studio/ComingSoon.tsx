import Link from 'next/link';
import { COMING_SOON, type StudioFeature } from '@/modules/studio/features';
import { PILOT_SOON, type PilotArea } from '@/modules/studio/pilot';
import './office-ui.css';

/**
 * What a gated route renders instead of the real screen.
 *
 * ## Why the route blocks rather than the sidebar hiding it
 *
 * A "soon" pill beside a link that still works is a sign on an unlocked door.
 * Bookmarks, typed URLs and links in old support emails all walk straight past
 * a sidebar. During a pilot the worst outcome is a studio finding an
 * unfinished screen and grading the whole product on it, so the route itself
 * says no.
 *
 * ## Why each one says something different
 *
 * "Coming soon" alone tells nobody whether to wait for this or go and find
 * another tool. Each feature says what it will do and, where it is true, what
 * covers the gap in the meantime — the calendar one is the important case,
 * because a studio needs to know that meetings are still being arranged and
 * are simply not on this screen yet.
 *
 * Nothing here is an apology. The feature is not late; it is not in the pilot.
 */
export function ComingSoon(props: { feature: keyof typeof COMING_SOON } | { area: PilotArea }) {
  /* `area`: closed for this studio by the pilot switch (studio/pilot.ts), not for everyone. */
  const copy = 'area' in props ? PILOT_SOON[props.area] : COMING_SOON[props.feature];
  const pilot = 'area' in props;

  return (
    <main className="content ox-page">
      <div className="phead">
        <div>
          <h1>{copy.title}</h1>
          <p className="muted">{pilot ? 'Coming soon to your studio.' : 'Not in this release.'}</p>
        </div>
      </div>
      <section className="card" style={{ maxWidth: '46rem' }}>
        <span className="eyebrow">What it will do</span>
        <p style={{ margin: 0, fontSize: 15.5, lineHeight: 1.5 }}>{copy.what}</p>
        {copy.meanwhile ? (
          <div className="empty">
            <span className="muted" style={{ fontSize: 14.5, lineHeight: 1.5 }}>
              {copy.meanwhile}
            </span>
          </div>
        ) : null}
        <div className="hstack">
          <Link href="/studio/clients" className="btn pri">
            Go to your leads
          </Link>
          <Link href="/studio/home" className="btn sec">
            Home
          </Link>
        </div>
      </section>
    </main>
  );
}

/** The one place a gated route decides. Keeps every page file to one line. */
export function gate(feature: StudioFeature): boolean {
  return feature === 'leads' || feature === 'quotations' || feature === 'products' || feature === 'settings';
}
