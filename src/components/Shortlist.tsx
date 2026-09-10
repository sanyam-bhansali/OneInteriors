'use client';

/**
 * The shortlist — studios the customer picked out to compare.
 *
 * ## Why this exists
 *
 * `/compare` used to re-price the top four matches automatically. That is a
 * comparison we chose for them, and it wastes the most useful signal the
 * product could collect: **which studios a customer shortlisted, and which they
 * then dropped**. Ranking tells us what our engine thinks; a shortlist tells us
 * what a person thinks, and the gap between those two is the whole training set
 * we will ever get before we have completed projects.
 *
 * ## Why sessionStorage and a URL, not a database column
 *
 * A shortlist is a working set, not a record. It changes several times in one
 * sitting and means nothing a week later, so it does not deserve a schema
 * change — and `/compare` is a server component, so the server has to learn the
 * selection somehow. It learns it from the URL: `/compare?studios=a,b,c`.
 *
 * That has a property worth keeping: a comparison of three named studios is a
 * link, so it survives a refresh, works in a new tab, and can be handed to the
 * share flow without any of them needing to know about this component.
 *
 * The count in the header is a per-browser convenience and is allowed to be
 * wrong after a browser restart. The URL is the thing that is authoritative.
 */

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';

const KEY = 'oi.shortlist.v1';
/** Four columns is the most a comparison table can carry and stay readable. */
export const MAX_SHORTLIST = 4;

/** A custom event, so every mounted control updates when any one of them changes. */
const CHANGED = 'oi:shortlist';

function read(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.sessionStorage.getItem(KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    // Slugs only. Anything else in here came from a different version of this
    // code or from someone editing storage by hand, and neither is worth
    // trusting into a URL.
    return parsed.filter((v): v is string => typeof v === 'string' && /^[a-z0-9-]{1,60}$/.test(v));
  } catch {
    return [];
  }
}

function write(slugs: string[]): void {
  try {
    window.sessionStorage.setItem(KEY, JSON.stringify(slugs));
  } catch {
    /* private mode — the buttons still work, they just forget on reload */
  }
  window.dispatchEvent(new Event(CHANGED));
}

/** Shared state for every shortlist control on the page. */
function useShortlist() {
  const [slugs, setSlugs] = useState<string[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setSlugs(read());
    setReady(true);
    const sync = () => setSlugs(read());
    window.addEventListener(CHANGED, sync);
    return () => window.removeEventListener(CHANGED, sync);
  }, []);

  const toggle = useCallback((slug: string) => {
    const current = read();
    const next = current.includes(slug)
      ? current.filter((s) => s !== slug)
      : [...current, slug].slice(0, MAX_SHORTLIST);
    write(next);
  }, []);

  return { slugs, ready, toggle };
}

export function ShortlistButton({ slug, name }: { slug: string; name: string }) {
  const { slugs, ready, toggle } = useShortlist();

  // Render the inactive label until sessionStorage has been read, so the server
  // markup and the first client render agree.
  const added = ready && slugs.includes(slug);
  const full = ready && slugs.length >= MAX_SHORTLIST && !added;

  return (
    <button
      type="button"
      onClick={() => toggle(slug)}
      disabled={full}
      aria-pressed={added}
      title={full ? `You can compare up to ${MAX_SHORTLIST} studios at once.` : undefined}
      className={`inline-flex items-center gap-2 rounded-full border px-4 py-2.5 text-[14px] transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
        added
          ? 'border-[var(--color-petrol)] bg-[var(--color-petrol-soft)] text-[var(--color-petrol)]'
          : 'border-[var(--color-rule)] bg-[var(--color-paper-2)] text-[var(--color-ink-2)] hover:border-[var(--color-ink-3)]'
      }`}
    >
      <span aria-hidden="true">{added ? '✓' : '+'}</span>
      {added ? 'In your comparison' : 'Add to compare'}
      <span className="sr-only"> — {name}</span>
    </button>
  );
}

/**
 * The running count, and the way through to the comparison.
 *
 * Renders nothing until at least two studios are chosen: comparing one thing
 * with nothing is not a comparison, and a permanently-visible bar reading "0"
 * is furniture.
 */
export function ShortlistBar() {
  const { slugs, ready } = useShortlist();

  if (!ready || slugs.length < 2) return null;

  return (
    <div className="sticky bottom-0 z-20 border-t border-[var(--color-rule)] bg-[var(--color-paper)]/95 backdrop-blur">
      <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-4 px-5 py-3.5 sm:px-6">
        <p className="m-0 text-[14.5px] text-[var(--color-ink-2)]">
          <span className="tabular font-[family-name:var(--font-display)] text-[20px] text-[var(--color-petrol)]">
            {slugs.length}
          </span>{' '}
          studios in your comparison
        </p>
        <Link
          href={`/compare?studios=${slugs.join(',')}`}
          className="rounded-full bg-[var(--color-petrol)] px-5 py-2.5 text-[14px] font-medium text-[var(--color-paper)] no-underline transition-colors hover:bg-[var(--color-petrol-deep)]"
        >
          Compare them side by side →
        </Link>
      </div>
    </div>
  );
}
