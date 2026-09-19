'use client';

/**
 * What we checked, as the page's payoff.
 *
 * ## Why this is the biggest thing on the profile
 *
 * `/match` shows six ticks beside a card and says "+7 more on their profile".
 * This is where that promise is kept, so it cannot be a two-column text list
 * at the bottom of the page — it has to be the thing the reader came down
 * here for.
 *
 * The verification file is the only asset this company has that a competitor
 * cannot buy from a KYC vendor. Rendering it as body copy was underselling
 * the one thing that is genuinely ours.
 *
 * ## Three groups, not two
 *
 * `TIER_CHECKS` splits into LISTED and VERIFIED because that is how tiers are
 * computed. It is not how a homeowner reads. VERIFIED holds ten checks that
 * answer two quite different questions — *is this a real trading business?*
 * and *what happens to me if it goes wrong?* — so the commercial three are
 * pulled out as their own group.
 *
 * The split is presentational only. Tiers are still computed from
 * `TIER_CHECKS`, untouched, and the total printed in the heading is still the
 * real count of both tiers rather than the number of rows that happen to
 * render.
 *
 * ## The ticks count in
 *
 * Per docs/DESIGN-LANGUAGE.md §1.1 — they were checked one at a time, and
 * arriving one at a time says so. Once, on first scroll into view, and then
 * they stay: this is a document being read, not a drawer being opened, and
 * a column of evidence that retracts while you are reading it would be
 * infuriating rather than alive.
 *
 * That is the one place this screen departs from the match card, and the
 * reason is the difference between a list you skim and a file you read.
 */

import { useEffect, useRef, useState } from 'react';
import { useReducedMotion } from 'framer-motion';
import { Tick } from '@/components/oi/Surfaces';
import {
  CHECK_LABELS,
  CHECK_MEANINGS,
  TIER_CHECKS,
  type CheckResult,
  type CheckType,
  type VerificationCheck,
} from '@/modules/studio/types';

/** The three the customer is protected by, rather than reassured about. */
const COMMERCIAL: CheckType[] = ['RATE_CARD_FILED', 'WARRANTY_TERMS', 'LABOUR_INSURANCE'];

const GROUPS: { title: string; blurb: string; types: CheckType[] }[] = [
  {
    title: 'Who they are',
    blurb: 'That the business and the people behind it are real, and findable.',
    types: TIER_CHECKS.LISTED,
  },
  {
    title: 'How they trade',
    blurb: 'That it is a working business with a history, not a dormant registration.',
    types: TIER_CHECKS.VERIFIED.filter((t) => !COMMERCIAL.includes(t)),
  },
  {
    title: 'What protects you',
    blurb: 'What you hold after handover, and who covers the people in your home.',
    types: COMMERCIAL,
  },
];

/**
 * Not every check is a tick.
 *
 * A pending check renders as pending and a failed one as failed, in shape as
 * well as colour. Suppressing the ones that did not pass would turn a file
 * into a badge, which is the thing this page exists to argue against.
 */
function Glyph({ result }: { result: CheckResult }) {
  if (result === 'PASS') return <Tick />;

  const map: Record<Exclude<CheckResult, 'PASS'>, { glyph: string; colour: string; label: string }> =
    {
      PENDING: { glyph: '◍', colour: 'var(--color-brass)', label: 'In progress' },
      EXPIRED: { glyph: '◍', colour: 'var(--color-brass)', label: 'Expired, re-checking' },
      FAIL: { glyph: '✕', colour: 'var(--color-atrisk)', label: 'Failed' },
      NOT_APPLICABLE: { glyph: '–', colour: 'var(--ink2)', label: 'Not applicable' },
    };
  const { glyph, colour, label } = map[result];

  return (
    <span
      className="inline-flex h-[15px] w-[15px] flex-none items-center justify-center text-[13px] leading-none"
      style={{ color: colour }}
    >
      <span aria-hidden>{glyph}</span>
      <span className="sr-only">{label}</span>
    </span>
  );
}

function Row({ check, i, on }: { check: VerificationCheck; i: number; on: boolean }) {
  const date = check.checkedAt
    ? new Date(check.checkedAt).toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })
    : null;

  /* The provenance line. A tick with no source and no date is a badge, and a
     badge is what every directory in this category already has. */
  const provenance =
    check.result === 'PENDING'
      ? (check.detail ?? 'In progress')
      : check.result === 'NOT_APPLICABLE'
        ? (check.detail ?? 'Not applicable')
        : [check.source, date].filter(Boolean).join(' · ');

  return (
    <li
      className="oi-check"
      data-on={on ? 'yes' : 'no'}
      style={{ '--i': i } as React.CSSProperties}
    >
      <Glyph result={check.result} />
      <div className="min-w-0">
        <p className="m-0 text-[14px] font-semibold leading-snug text-[var(--ink)]">
          {CHECK_LABELS[check.type]}
        </p>

        {/* Only when it passed. "We walked through finished homes they built"
            printed beside a PENDING check is a straightforward lie. */}
        {check.result === 'PASS' ? (
          <p className="m-0 mt-1 max-w-[44ch] text-[13px] leading-snug text-[var(--ink2)]">
            {CHECK_MEANINGS[check.type]}
          </p>
        ) : null}

        {provenance ? <p className="oi-label m-0 mt-1.5">{provenance}</p> : null}
      </div>
    </li>
  );
}

export function Verified({ checks, tier }: { checks: VerificationCheck[]; tier: string }) {
  const reduced = useReducedMotion();
  const host = useRef<HTMLDivElement | null>(null);
  const [on, setOn] = useState(false);

  useEffect(() => {
    if (reduced || typeof window === 'undefined' || !('IntersectionObserver' in window)) {
      setOn(true);
      return;
    }
    const node = host.current;
    if (!node) return;

    // Latches. See the file header: a file being read, not a drawer.
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setOn(true);
          io.disconnect();
        }
      },
      { rootMargin: '0px 0px -12% 0px', threshold: 0 },
    );
    io.observe(node);
    return () => io.disconnect();
  }, [reduced]);

  const by = new Map(checks.map((c) => [c.type, c]));

  /* Position within the whole section, not within a column, so the ticks read
     as one run down the page rather than three columns racing. */
  let n = 0;

  return (
    <div ref={host} className="grid gap-x-10 gap-y-9 md:grid-cols-3">
      {GROUPS.map((group) => {
        const rows = group.types.map((t) => by.get(t)).filter((c): c is VerificationCheck => !!c);
        if (rows.length === 0) return null;

        return (
          <section key={group.title}>
            <h3 className="oi-eyebrow m-0">{group.title}</h3>
            <p className="m-0 mt-2 max-w-[34ch] text-[13px] leading-snug text-[var(--ink2)]">
              {group.blurb}
            </p>
            <ul className="m-0 mt-5 flex list-none flex-col gap-4 border-t border-[var(--line)] p-0 pt-5">
              {rows.map((c) => (
                <Row key={c.type} check={c} i={n++} on={on} />
              ))}
            </ul>
          </section>
        );
      })}

      <p className="oi-label m-0 md:col-span-3">
        Tier: {tier.toLowerCase()} · every check above is re-run, not taken once
      </p>
    </div>
  );
}
