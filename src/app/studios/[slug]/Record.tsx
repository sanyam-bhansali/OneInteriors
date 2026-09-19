'use client';

/**
 * The delivery record, counted up.
 *
 * ## Why these count and the quote does not
 *
 * Per docs/DESIGN-LANGUAGE.md §1.1, a number that arrives says it was
 * computed. These four are computed — from milestone approvals we watched,
 * not from anything the studio told us — so the count is a true statement
 * about their provenance rather than an animation.
 *
 * A figure we do not have does NOT count up. It renders as "—" with a label
 * saying which measurement is missing, because a zero that animates to zero
 * reads as a measured zero, and "no disputes upheld" and "we have never
 * measured disputes" are opposite facts.
 *
 * ## The bad number keeps the same treatment as the good ones
 *
 * Variance and disputes are shown at the same size, in the same face, in the
 * same row as completed projects. A studio that runs late says so here in the
 * same voice it says everything else. Tone colours the value; it does not
 * shrink it.
 */

import { CountUp } from '@/components/oi/CountUp';

type Tone = 'plain' | 'good' | 'bad';

function Cell({
  label,
  value,
  suffix,
  prefix,
  tone = 'plain',
  empty,
  i,
}: {
  label: string;
  /** Null means unmeasured, and renders as such — never as zero. */
  value: number | null;
  suffix?: string;
  prefix?: string;
  tone?: Tone;
  /** What to say when there is no figure. Says which thing is missing. */
  empty: string;
  i: number;
}) {
  const colour =
    tone === 'good' ? 'var(--sec-ink)' : tone === 'bad' ? 'var(--color-atrisk)' : 'var(--ink)';

  return (
    <div className="min-w-0">
      {value === null ? (
        <p className="oi-num m-0 text-[clamp(1.6rem,1.2rem+1.2vw,2.2rem)] font-bold leading-none text-[var(--ink2)]">
          —
        </p>
      ) : (
        <p
          className="oi-num m-0 text-[clamp(1.6rem,1.2rem+1.2vw,2.2rem)] font-bold leading-none"
          style={{ color: colour }}
        >
          {prefix}
          <CountUp to={value} label={label} duration={0.9 + i * 0.1} />
          {suffix ? <span className="text-[0.5em] align-baseline"> {suffix}</span> : null}
        </p>
      )}
      <p className="oi-label m-0 mt-2.5">{value === null ? empty : label}</p>
    </div>
  );
}

export function Record({
  completedProjects,
  avgVarianceDays,
  upheldDisputes,
  specComplianceRate,
}: {
  completedProjects: number;
  avgVarianceDays: number | null;
  upheldDisputes: number;
  specComplianceRate: number | null;
}) {
  const delivered = completedProjects > 0;

  return (
    <div className="grid grid-cols-2 gap-x-6 gap-y-8 sm:grid-cols-4">
      <Cell
        i={0}
        label="Completed with us"
        value={delivered ? completedProjects : null}
        empty="None completed yet"
      />

      <Cell
        i={1}
        label="Days over the promised date"
        value={avgVarianceDays === null ? null : Math.round(avgVarianceDays)}
        prefix={avgVarianceDays !== null && avgVarianceDays > 0 ? '+' : ''}
        tone={avgVarianceDays === null ? 'plain' : avgVarianceDays <= 10 ? 'good' : 'bad'}
        empty="Lateness — unmeasured"
      />

      {/* Gated on a completed project, because disputes are counted against
          delivered work. Zero disputes over zero projects is not a record. */}
      <Cell
        i={2}
        label="Disputes upheld against them"
        value={delivered ? upheldDisputes : null}
        tone={delivered && upheldDisputes > 0 ? 'bad' : delivered ? 'good' : 'plain'}
        empty="Disputes — nothing to count"
      />

      <Cell
        i={3}
        label="Materials matched the quote"
        value={specComplianceRate === null ? null : Math.round(specComplianceRate * 100)}
        suffix="%"
        empty="Spec compliance — unmeasured"
      />
    </div>
  );
}
