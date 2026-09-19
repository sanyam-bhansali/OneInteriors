'use client';

/**
 * One studio, as a glass card.
 *
 * ## Layout — vertical
 *
 * One column, read top to bottom: the mark, the percentage, the name, what
 * they are, then the facts that decide a shortlist, then the written read,
 * then everything else behind one press.
 *
 * It was a wide three-across row first — score, identity, mark — which at
 * full container width made a banner rather than a card, and put the name
 * (the thing you are actually choosing between) in the middle of a horizontal
 * scan instead of at the top of a vertical one. The list is width-capped so
 * the card stays portrait at every screen size.
 *
 * ## The mark is a monogram, and that is a placeholder
 *
 * `Studio` has no logo column in the schema — there is `StudioBranding`, but
 * that is the studio's own white-label for documents it sends its clients,
 * not a marketplace listing asset. So the right-hand slot is initials on a
 * tinted panel. It looks deliberate rather than broken, and when a `logoPath`
 * lands on Studio this is the one component that changes.
 *
 * ## Why the percentage carries a second line
 *
 * A bare "82%" implies we measured six things and scored them. Often we
 * measured four, because the brief did not answer the rest. The small line
 * under the figure says which, for the same reason every other number in this
 * product carries its source: a score whose basis is hidden is the kind of
 * figure this whole product exists to argue against.
 */

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { motion, useReducedMotion } from 'framer-motion';
import { formatINRCompact } from '@/lib/money';
import { briefKey, type StoredRead } from '@/modules/quotation/project-store';
import { explainAction } from './actions';
import type { Explanation } from '@/modules/matching/explain';
import { ProjectWings } from './ProjectWings';
import { VerificationPanel } from './VerificationPanel';
import type { Focus } from './useScrollFocus';
import type { Studio } from '@/modules/studio/types';
import type { MatchResult } from '@/modules/matching/score';
import type { Brief } from '@/modules/brief/types';

/** Two letters from the trade name. "Chitra & Co." → CC, "Teakline" → TE. */
function monogram(name: string): string {
  const words = name
    .replace(/[^A-Za-z\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
  if (words.length === 0) return '··';
  if (words.length === 1) return words[0]!.slice(0, 2).toUpperCase();
  return (words[0]![0]! + words[1]![0]!).toUpperCase();
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="oi-num m-0 text-[15px] leading-none text-[var(--ink)]">{value}</p>
      <p className="oi-label m-0 mt-1.5 truncate">{label}</p>
    </div>
  );
}

export function StudioCard({
  studio,
  match,
  brief,
  rank,
  focus,
  quotedTotalPaise,
  inCompare,
  cachedRead,
  onQuote,
  onToggleCompare,
  onRead,
  cardRef,
}: {
  studio: Studio;
  match: MatchResult;
  brief: Brief;
  rank: number;
  focus: Focus;
  quotedTotalPaise: number | null;
  inCompare: boolean;
  cachedRead: StoredRead | undefined;
  onQuote: () => void;
  onToggleCompare: () => void;
  onRead: (studioId: string, read: StoredRead) => void;
  cardRef: (el: HTMLLIElement | null) => void;
}) {
  const reduced = useReducedMotion();
  const [open, setOpen] = useState(false);

  const key = briefKey(brief);
  const fresh = cachedRead?.briefKey === key ? cachedRead : undefined;
  const [read, setRead] = useState<Explanation | null>(
    fresh ? { text: fresh.text, source: fresh.source } : null,
  );

  /**
   * The written read arrives per card, so the page fills in rather than
   * waiting on the slowest call. Skipped entirely when one already exists for
   * this brief — six cards is six paid calls, and without the cache every
   * return to this page spends them again.
   */
  useEffect(() => {
    if (fresh) return;
    let live = true;
    explainAction(brief, studio.id)
      .then((r) => {
        if (!live || !r.text) return;
        setRead(r);
        onRead(studio.id, { text: r.text, source: r.source, briefKey: key });
      })
      .catch(() => {
        /* The card is complete without it. */
      });
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fresh, studio.id, key]);

  const pct = Math.round(match.score);

  const tags = useMemo(() => {
    const out: string[] = [];
    if (studio.localities.length > 0) out.push(studio.localities.slice(0, 2).join(' · '));
    if (studio.yearsActive) out.push(`${studio.yearsActive} yrs`);
    if (studio.teamSize) out.push(`Team of ${studio.teamSize}`);
    return out;
  }, [studio.localities, studio.yearsActive, studio.teamSize]);

  return (
    /* Two elements, and the split is load-bearing.
       Framer Motion writes `transform` as an inline style, which beats any
       class rule — so an entrance animation and the CSS scroll-zoom on the
       same element means the entrance silently wins and the card never
       zooms. The <li> owns the one-off entrance; the glass panel inside it
       owns the scale, the lift and the depth-of-field, in CSS, for good. */
    <motion.li
      ref={cardRef}
      className="q-wings list-none"
      initial={reduced ? false : { opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: reduced ? 0 : Math.min(rank, 5) * 0.06, ease: [0.16, 1, 0.3, 1] }}
    >
      {/* ── The proof, either side ──
          These wings held the studio's portfolio, sliding out on hover. The
          work is now inside the card's "More", and the flanks carry the
          verification record instead — because proof that only appears when
          you happen to point at something is proof most readers never see,
          and this is the part that removes doubt before anybody thinks to
          ask a question. Not hover-gated; see .q-wing-proof. */}
      <aside className="q-wing q-wing-proof q-wing-l" aria-label={`What we verified about ${studio.tradeName}`}>
        <VerificationPanel checks={studio.checks} side="left" />
      </aside>
      <aside className="q-wing q-wing-proof q-wing-r" aria-hidden>
        <VerificationPanel checks={studio.checks} side="right" />
      </aside>

      <div data-focus={focus} className="q-glass p-[clamp(20px,2.6vw,28px)]">
      {/* ── Vertical stack: mark, score, name, what they are ──
          Everything reads top to bottom in one column. The mark and the
          percentage share the first line only because they are both single
          objects rather than text — nothing after them competes for a row. */}
      <div className="flex items-center justify-between gap-4">
        {/* Monogram, not a logo — Studio has no logo column. */}
        <div
          aria-hidden
          className="q-mark flex h-[56px] w-[56px] flex-none items-center justify-center"
        >
          <span className="oi-num text-[17px] font-bold tracking-wide text-[var(--ink)]">
            {monogram(studio.tradeName)}
          </span>
        </div>
        <span className="oi-label m-0 whitespace-nowrap">
          {match.factorsScored} of {match.factorsTotal} factors
        </span>
      </div>

      <p className="oi-num m-0 mt-5 text-[clamp(2.6rem,2rem+2.6vw,3.6rem)] font-bold leading-none tracking-tight text-[var(--ink)]">
        {pct}
        <span className="text-[0.42em] align-super">%</span>
      </p>

      <h3 className="oi-display q-h2 m-0 mt-3 text-[var(--ink)]">{studio.tradeName}</h3>

      <p className="q-small m-0 mt-2 text-[var(--ink2)]">
        {studio.about || `Interior studio in ${studio.city}.`}
      </p>

      {tags.length > 0 ? <p className="oi-label m-0 mt-3">{tags.join('  ·  ')}</p> : null}

      {/* ── The facts that decide a shortlist ── */}
      <div className="mt-5 grid grid-cols-2 gap-x-5 gap-y-4 border-t border-[var(--line)] pt-5 sm:grid-cols-3">
        <Fact
          label={quotedTotalPaise !== null ? 'Your quote' : 'Not priced yet'}
          value={quotedTotalPaise !== null ? formatINRCompact(quotedTotalPaise) : '—'}
        />
        <Fact
          label="Projects delivered"
          value={studio.completedProjects > 0 ? String(studio.completedProjects) : '—'}
        />
        <Fact
          label={studio.avgVarianceDays === null ? 'Days over — unmeasured' : 'Days over promise'}
          value={studio.avgVarianceDays === null ? '—' : `+${studio.avgVarianceDays}`}
        />
      </div>

      {/* ── The read ── */}
      <div className="mt-5 border-t border-[var(--line)] pt-4">
        <p className="oi-eyebrow m-0 mb-2">Why this one fits you</p>
        {read ? (
          <p className="q-small m-0 max-w-[62ch] text-[var(--ink)]">{read.text}</p>
        ) : (
          <p className="q-small m-0 text-[var(--ink2)]">Reading your brief against their work…</p>
        )}
      </div>

      {/* ── Actions ── */}
      <div className="mt-5 flex flex-wrap items-center gap-2.5">
        {quotedTotalPaise === null ? (
          <button
            type="button"
            onClick={onQuote}
            className="q-cta min-h-11 cursor-pointer border-0 px-5 py-2.5 text-[14px]"
          >
            Get a quote
          </button>
        ) : (
          <button
            type="button"
            onClick={onToggleCompare}
            aria-pressed={inCompare}
            className="min-h-11 cursor-pointer rounded-full border px-5 py-2.5 text-[14px] font-semibold transition-colors"
            style={{
              borderColor: inCompare ? 'var(--acc)' : 'var(--line)',
              background: inCompare ? 'var(--acc-wash)' : 'rgba(252,252,250,.7)',
              color: inCompare ? 'var(--acc-ink)' : 'var(--ink)',
            }}
          >
            {inCompare ? 'In compare' : 'Add to compare'}
          </button>
        )}

        <Link
          href={`/studios/${studio.slug}`}
          className="min-h-11 rounded-full border border-[var(--line)] px-5 py-2.5 text-[14px] font-semibold text-[var(--ink)] no-underline transition-colors hover:border-[var(--ink2)]"
          style={{ background: 'rgba(252,252,250,.55)' }}
        >
          Their work
        </Link>

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="ml-auto inline-flex min-h-11 cursor-pointer items-center border-0 bg-transparent px-2 text-[13.5px] font-semibold text-[var(--ink2)] underline hover:text-[var(--ink)]"
        >
          {open ? 'Less' : 'More'}
        </button>
      </div>

      {/* Below the flanking breakpoint there is no margin to live in, so the
          same panel becomes a band under the card rather than disappearing.
          Proof is not a wide-screen luxury. */}
      <div className="q-proof-stack">
        <VerificationPanel checks={studio.checks} side="left" />
        <VerificationPanel checks={studio.checks} side="right" />
      </div>

      {open ? (
        <motion.div
          initial={reduced ? false : { opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
          className="overflow-hidden"
        >
          <div className="mt-5 border-t border-[var(--line)] pt-4">
            <p className="oi-eyebrow m-0 mb-3">What the score is made of</p>
            <ul className="m-0 flex list-none flex-col gap-2 p-0">
              {match.reasoning.map((line) => (
                <li key={line} className="q-small text-[var(--ink2)]">
                  {line}
                </li>
              ))}
            </ul>
            {studio.portfolio.length > 0 ? (
              <div className="mt-5 border-t border-[var(--line)] pt-4">
                <p className="oi-eyebrow m-0 mb-3">Work they have delivered</p>
                <ProjectWings projects={studio.portfolio} studioName={studio.tradeName} inline />
              </div>
            ) : null}

            {quotedTotalPaise !== null ? (
              <button
                type="button"
                onClick={onQuote}
                className="mt-4 cursor-pointer border-0 bg-transparent p-0 text-[13.5px] font-semibold text-[var(--ink2)] underline hover:text-[var(--ink)]"
              >
                See the quote in full
              </button>
            ) : null}
          </div>
        </motion.div>
      ) : null}
      </div>
    </motion.li>
  );
}
