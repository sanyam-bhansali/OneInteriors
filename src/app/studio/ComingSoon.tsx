import Link from 'next/link';
import { COMING_SOON, type StudioFeature } from '@/modules/studio/features';
import { PageHead, PageBody } from './StudioShell';

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
export function ComingSoon({ feature }: { feature: keyof typeof COMING_SOON }) {
  const copy = COMING_SOON[feature];

  return (
    <>
      <PageHead title={copy.title} sub="Not in this release." />
      <PageBody>
        <div className="max-w-[46rem] rounded-[14px] border border-[var(--s-rule)] bg-[var(--s-surface)] p-7">
          <p className="label m-0 mb-3">What it will do</p>
          <p className="m-0 mb-5 text-[15.5px] leading-relaxed text-[var(--s-ink)]">{copy.what}</p>

          {copy.meanwhile ? (
            <p className="m-0 mb-6 border-l-2 border-[var(--s-rule)] pl-4 text-[14.5px] leading-relaxed text-[var(--s-ink-2)]">
              {copy.meanwhile}
            </p>
          ) : null}

          <div className="flex flex-wrap items-center gap-3 border-t border-[var(--s-rule)] pt-6">
            <Link
              href="/studio/clients"
              className="inline-flex min-h-11 items-center rounded-[10px] bg-[var(--s-ink)] px-5 text-[14.5px] font-medium text-[var(--s-surface)] no-underline"
            >
              Go to your leads
            </Link>
            <Link
              href="/studio"
              className="inline-flex min-h-11 items-center rounded-[10px] border border-[var(--s-rule)] px-5 text-[14.5px] font-medium text-[var(--s-ink)] no-underline"
            >
              Dashboard
            </Link>
          </div>
        </div>
      </PageBody>
    </>
  );
}

/** The one place a gated route decides. Keeps every page file to one line. */
export function gate(feature: StudioFeature): boolean {
  return feature === 'leads' || feature === 'quotations' || feature === 'products' || feature === 'settings';
}
