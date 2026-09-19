'use client';

/**
 * What we verified — the proof panel either side of the card.
 *
 * ## What this replaces
 *
 * Reviews. Every directory in this category runs on star ratings, and a star
 * rating is a number a business can buy. This panel is the alternative: a
 * named check, a named verifier, and the date it was done. It is deliberately
 * shaped like a report rather than a badge wall — the reader should feel they
 * are looking at due diligence somebody was paid to do, because they are.
 *
 * ## The one thing that must never happen here
 *
 * Every tick is a `PASS` row in the database. A check nobody has run renders
 * as not run, greyed, with no date. That is not a placeholder to be tidied up
 * later — on a page arguing that we actually rang the past clients, a green
 * tick nobody earned is the product failing at the thing it sells. See
 * `verification-view.ts`.
 *
 * ## Layout
 *
 * Two columns flanking the card on wide screens, stacked beneath it below
 * 1280px, where the margin does not exist. Identity on the left because it is
 * checked first; trading history and the commercial terms on the right.
 */

import { useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import {
  verificationView,
  formatCheckDate,
  type CheckSection,
  type CheckView,
} from '@/modules/studio/verification-view';
import type { VerificationCheck } from '@/modules/studio/types';

/* ── The mark ─────────────────────────────────────────────────────── */

function Mark({ check }: { check: CheckView }) {
  if (check.passed) {
    return (
      <span
        aria-hidden
        className="mt-[2px] flex h-[17px] w-[17px] flex-none items-center justify-center rounded-full text-[10px] font-bold text-white"
        style={{ background: 'var(--sec-ink)' }}
      >
        ✓
      </span>
    );
  }

  /* Failed and expired are shown, not hidden. A studio that failed a check
     and a studio nobody has checked are different facts, and the customer is
     the person who needs to tell them apart. */
  if (check.result === 'FAIL' || check.result === 'EXPIRED') {
    return (
      <span
        aria-hidden
        className="mt-[2px] flex h-[17px] w-[17px] flex-none items-center justify-center rounded-full border text-[10px] font-bold"
        style={{ borderColor: 'var(--acc-ink)', color: 'var(--acc-ink)' }}
      >
        !
      </span>
    );
  }

  return (
    <span
      aria-hidden
      className="mt-[2px] h-[17px] w-[17px] flex-none rounded-full border"
      style={{ borderColor: '#c9c2b6' }}
    />
  );
}

function statusWord(check: CheckView): string {
  if (check.passed) return 'Verified';
  if (check.result === 'FAIL') return 'Did not pass';
  if (check.result === 'EXPIRED') return 'Needs re-checking';
  if (check.result === 'NOT_APPLICABLE') return 'Does not apply';
  return 'Not checked yet';
}

/* ── One check ────────────────────────────────────────────────────── */

function CheckRow({ check }: { check: CheckView }) {
  const [open, setOpen] = useState(false);
  const reduced = useReducedMotion();
  const date = formatCheckDate(check.checkedAt);

  return (
    <li className="border-t border-[var(--line)] first:border-t-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full min-h-11 cursor-pointer items-start gap-2.5 bg-transparent px-0 py-2.5 text-left transition-opacity hover:opacity-70"
        style={{ border: 0, opacity: check.passed ? 1 : 0.72 }}
      >
        <Mark check={check} />
        <span className="min-w-0 flex-1">
          <span className="block text-[12.5px] font-semibold leading-snug text-[var(--ink)]">
            {check.title}
          </span>
          {/* Source and date on the collapsed row, because they are the
              evidence — hiding them behind a press would make this a badge
              wall with a disclosure, which is what it is trying not to be. */}
          <span className="oi-label m-0 mt-1 block">
            {check.source ?? statusWord(check)}
            {date ? ` · ${date}` : ''}
          </span>
        </span>
        <span aria-hidden className="mt-[2px] flex-none text-[11px] text-[var(--ink2)]">
          {open ? '−' : '+'}
        </span>
      </button>

      {open ? (
        <motion.p
          initial={reduced ? false : { opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
          className="m-0 overflow-hidden pb-3 pl-[27px] text-[12px] leading-[1.55] text-[var(--ink2)]"
        >
          {check.detail}
          {!check.passed ? (
            <span className="mt-1.5 block" style={{ color: 'var(--acc-ink)' }}>
              {statusWord(check)}.
            </span>
          ) : null}
        </motion.p>
      ) : null}
    </li>
  );
}

/* ── A section ────────────────────────────────────────────────────── */

function Section({ section }: { section: CheckSection }) {
  return (
    <section className="q-proof">
      <div className="mb-2.5 flex items-baseline justify-between gap-3">
        <h4 className="m-0 text-[12.5px] font-bold uppercase tracking-[0.1em] text-[var(--ink)]">
          {section.title}
        </h4>
        <span className="oi-num text-[11px] text-[var(--ink2)]">
          {section.passed}/{section.checks.length}
        </span>
      </div>
      <p className="m-0 mb-2 text-[11.5px] leading-snug text-[var(--ink2)]">{section.why}</p>
      <ul className="m-0 flex list-none flex-col p-0">
        {section.checks.map((c) => (
          <CheckRow key={c.type} check={c} />
        ))}
      </ul>
    </section>
  );
}

/* ── The meter ────────────────────────────────────────────────────── */

function Meter({ passed, total }: { passed: number; total: number }) {
  return (
    <div className="mb-3">
      <div
        className="flex h-[5px] gap-[3px]"
        role="img"
        aria-label={`${passed} of ${total} checks verified`}
      >
        {Array.from({ length: total }).map((_, i) => (
          <span
            key={i}
            className="flex-1 rounded-full"
            style={{ background: i < passed ? 'var(--sec-ink)' : '#d5cec3' }}
          />
        ))}
      </div>
    </div>
  );
}

/* ── The panel ────────────────────────────────────────────────────── */

export function VerificationPanel({
  checks,
  side,
}: {
  checks: VerificationCheck[];
  /** Which wing. Left carries the heading and the meter. */
  side: 'left' | 'right';
}) {
  const view = verificationView(checks);
  const lastChecked = formatCheckDate(view.lastChecked);

  const sections =
    side === 'left' ? view.sections.slice(0, 1) : view.sections.slice(1);

  return (
    <div className="flex flex-col gap-3">
      {side === 'left' ? (
        <header>
          <p className="oi-eyebrow m-0 mb-1.5">What we verified</p>
          <p className="m-0 mb-2.5 text-[11.5px] leading-snug text-[var(--ink2)]">
            {view.total} independent checks, each with a named source and a date.
          </p>

          <Meter passed={view.passed} total={view.total} />

          <p className="m-0 flex items-baseline gap-1.5">
            <span className="oi-num text-[22px] font-bold leading-none text-[var(--ink)]">
              {view.passed}
            </span>
            <span className="oi-label m-0">of {view.total} verified</span>
          </p>

          {/* The honest lines. A panel that only ever says "all clear" is a
              badge; one that says what is outstanding is a report. */}
          {view.pending > 0 ? (
            <p className="m-0 mt-1.5 text-[11.5px] leading-snug text-[var(--ink2)]">
              {view.pending} not checked yet.
            </p>
          ) : null}
          {view.failed > 0 ? (
            <p className="m-0 mt-1 text-[11.5px] leading-snug" style={{ color: 'var(--acc-ink)' }}>
              {view.failed} did not pass. Tap to see which.
            </p>
          ) : null}
          {lastChecked ? (
            <p className="oi-label m-0 mt-2">Last checked {lastChecked}</p>
          ) : null}
        </header>
      ) : null}

      {sections.map((s) => (
        <Section key={s.id} section={s} />
      ))}

      {side === 'right' ? (
        <p className="m-0 text-[11px] leading-snug text-[var(--ink2)]">
          No studio can pay to change any of this.
        </p>
      ) : null}
    </div>
  );
}
