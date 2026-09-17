/**
 * The five product snapshots on the how-it-works spine.
 *
 * ## Why these are drawn rather than screenshotted
 *
 * The locked structure says "real software views, not generic infographics",
 * and these are built from the same tokens and the same numbers the product
 * uses — the ₹5.95 L–₹27.2 L band, the twelve checks, nine questions, the
 * material specs that appear on a real quotation line. A screenshot would go
 * stale the first time a padding changed and would be illegible at this size;
 * an infographic would be a picture of an idea rather than the thing.
 *
 * ## The rule each one has to obey
 *
 * Every figure, quantity, spec and score is mono. Every sentence is sans.
 * Sage marks verification and better spec. Terracotta appears on exactly one
 * thing per snapshot, and only where the customer would act or where something
 * needs attention.
 *
 * Studio names are invented — Teakline Studio, Chitra & Co., Maya Workshop —
 * and must stay that way. A real partner's name beside an invented figure is a
 * claim about a real business that we made up.
 */

import { SpecRow, Tick } from './parts';

const card = 'oi-glass-inner bg-[var(--card)] border border-[var(--line)]';

function SnapHead({ title, note }: { title: string; note?: string }) {
  return (
    <div className="mb-3 flex items-baseline justify-between gap-3">
      <p className="oi-label m-0">{title}</p>
      {note ? <p className="oi-label m-0 !text-[var(--sec)]">{note}</p> : null}
    </div>
  );
}

/** 01 — the brief filling in, with the roster narrowing live beside it. */
export function QuizSnap() {
  const answered = [
    ['Property', '2 BHK'],
    ['Carpet area', '1,180 SQ FT'],
    ['Locality', 'KOTHRUD'],
    ['Possession', 'MAR 2027'],
    ['Scope', 'FULL HOME'],
  ];

  return (
    <div className={`${card} p-4`}>
      <SnapHead title="Your brief so far" note="Question 5 of 9" />

      <div className="mb-3">
        {answered.map(([k, v]) => (
          <SpecRow key={k} label={k!} value={v!} />
        ))}
      </div>

      {/* The counter is the point of this screen. It moves while you answer,
          which is what makes nine questions feel like progress rather than a
          form. */}
      <div className="flex items-center justify-between gap-3 border-t border-[var(--line)] pt-3">
        <span className="text-[13px] text-[var(--ink2)]">still match your brief</span>
        <span className="oi-num text-[22px] leading-none" style={{ color: 'var(--sec)' }}>
          14
        </span>
      </div>
    </div>
  );
}

function Ring({ score }: { score: number }) {
  const r = 15;
  const c = 2 * Math.PI * r;
  return (
    <svg width="38" height="38" viewBox="0 0 38 38" aria-hidden="true" className="flex-none">
      <circle cx="19" cy="19" r={r} fill="none" stroke="var(--line)" strokeWidth="3" />
      <circle
        cx="19"
        cy="19"
        r={r}
        fill="none"
        stroke="var(--sec)"
        strokeWidth="3"
        strokeLinecap="round"
        strokeDasharray={`${(score / 100) * c} ${c}`}
        transform="rotate(-90 19 19)"
      />
      <text
        x="19"
        y="22.5"
        textAnchor="middle"
        className="oi-num"
        fontSize="11"
        fill="var(--ink)"
      >
        {score}
      </text>
    </svg>
  );
}

/** 02 — who fits, and why, with the thing nobody else will print on it. */
export function MatchSnap() {
  const rows = [
    { studio: 'Teakline Studio', score: 94, reason: 'Kotah stone on three finished sites' },
    { studio: 'Chitra & Co.', score: 88, reason: 'Six 2 BHKs in Kothrud, on your band' },
    { studio: 'Maya Workshop', score: 81, reason: 'Matched on 4 of 6 — new to us' },
  ];

  return (
    <div className={`${card} p-4`}>
      <SnapHead title="Who fits" note="3 of 14 shown" />

      <ul className="m-0 flex list-none flex-col gap-2.5 p-0">
        {rows.map((r) => (
          <li key={r.studio} className="flex items-center gap-3">
            <div className="h-10 w-10 flex-none overflow-hidden rounded-[6px] bg-[var(--bg)]" />
            <Ring score={r.score} />
            <div className="min-w-0">
              <p className="m-0 truncate text-[13.5px] font-medium">{r.studio}</p>
              <p className="m-0 truncate text-[12px] text-[var(--ink2)]">{r.reason}</p>
            </div>
          </li>
        ))}
      </ul>

      <p className="m-0 mt-3 border-t border-[var(--line)] pt-3 text-[12.5px] leading-snug text-[var(--ink2)]">
        Nobody can pay to sit higher. A subscription buys how often a studio is shown, never
        where it lands for you.
      </p>
    </div>
  );
}

/**
 * 03 — the first quote.
 *
 * Note the framing: "priced from Teakline's filed rate card · 3.1s". Nothing
 * is requested and nobody is phoned, and this snapshot is where that is
 * demonstrated rather than asserted.
 */
export function QuoteSnap() {
  const lines = [
    ['Kitchen base units', '14.2 SQ FT', '₹1,84,600'],
    ['Wardrobe — master', '48.0 SQ FT', '₹2,11,200'],
    ['TV unit & storage', '32.5 SQ FT', '₹1,46,250'],
    ['False ceiling — living', '210 SQ FT', '₹52,500'],
  ];

  return (
    <div className={`${card} p-4`}>
      <SnapHead title="Your first quote" note="Priced in 3.1s" />

      <p className="m-0 mb-3 text-[12.5px] leading-snug text-[var(--ink2)]">
        Priced from Teakline Studio&rsquo;s own filed rate card. No studio was asked and nobody
        was phoned.
      </p>

      <div className="mb-3">
        {lines.map(([item, qty, amount]) => (
          <div
            key={item}
            className="flex items-baseline justify-between gap-3 border-b border-[var(--line)] py-2 last:border-b-0"
          >
            <span className="min-w-0 flex-1 truncate text-[13px]">{item}</span>
            <span className="oi-num flex-none text-[11px] text-[var(--ink2)]">{qty}</span>
            <span className="oi-num flex-none text-[12.5px]">{amount}</span>
          </div>
        ))}
      </div>

      <div className="flex items-baseline justify-between gap-3 border-t border-[var(--ink)] pt-3">
        <span className="oi-label m-0">Range for your flat</span>
        <span className="oi-num text-[15px]">₹16.4 L–₹19.8 L</span>
      </div>

      {/* The attention flag — terracotta, and the only terracotta here. */}
      <p className="m-0 mt-2 text-[12px]" style={{ color: 'var(--acc)' }}>
        ±11% · a floor plan would tighten this most
      </p>
    </div>
  );
}

/** 04 — quotes side by side AND the materials behind them. */
export function CompareSnap() {
  return (
    <div className={`${card} p-4`}>
      <SnapHead title="Side by side" note="Materials, not adjectives" />

      <div className="mb-3 grid grid-cols-2 gap-3">
        {[
          { studio: 'Teakline Studio', cost: '₹18.4 L' },
          { studio: 'Chitra & Co.', cost: '₹17.15 L' },
        ].map((s) => (
          <div key={s.studio}>
            <p className="m-0 truncate text-[12.5px] text-[var(--ink2)]">{s.studio}</p>
            <p className="oi-num m-0 text-[17px]">{s.cost}</p>
          </div>
        ))}
      </div>

      {/* The whole argument of the product, in four rows: the cheaper quote is
          cheaper because the board is thinner, and you can only see that if
          somebody prints the spec. */}
      <div className="grid grid-cols-2 gap-x-3">
        {[
          ['Carcass', '18MM BWP', true],
          ['Carcass', '16MM MDF', false],
          ['Shutter', 'VENEER', true],
          ['Shutter', 'LAMINATE', false],
          ['Hardware', 'BRANDED 10YR', true],
          ['Hardware', 'STANDARD 2YR', false],
        ].map(([label, value, better], i) => (
          <div key={i} className="min-w-0">
            <SpecRow label={label as string} value={value as string} better={better as boolean} />
          </div>
        ))}
      </div>

      <p className="m-0 mt-3 text-[12.5px] leading-snug text-[var(--ink2)]">
        ₹1.25 L apart, and the difference is board thickness.
      </p>
    </div>
  );
}

/** 05 — the architect, and what they have signed off so far. */
export function ExpertSnap() {
  const steps = [
    ['Brief read back to you', 'signed off'],
    ['Shortlist and studio checks', 'signed off'],
    ['Quote read line by line', 'today'],
    ['Material samples signed off', ''],
    ['Site visits and handover', ''],
  ];

  return (
    <div className={`${card} p-4`}>
      <SnapHead title="Your architect" note="Assigned to you" />

      <div className="mb-3 flex items-center gap-3">
        <div className="h-11 w-11 flex-none rounded-full bg-[var(--bg)]" />
        <div className="min-w-0">
          <p className="m-0 text-[14px] font-medium">Nikhil Bhave</p>
          <p className="m-0 text-[12px] leading-snug text-[var(--ink2)]">
            Brief to handover. Paid by us, never by a studio.
          </p>
        </div>
      </div>

      <ul className="m-0 flex list-none flex-col gap-2 border-t border-[var(--line)] p-0 pt-3">
        {steps.map(([label, state]) => {
          const done = state === 'signed off';
          const now = state === 'today';
          return (
            <li key={label} className="flex items-center gap-2.5">
              {done ? (
                <Tick className="text-[var(--sec)]" />
              ) : (
                <span
                  aria-hidden
                  className="h-[15px] w-[15px] flex-none rounded-full border"
                  style={{
                    borderColor: now ? 'var(--acc)' : 'var(--line)',
                    background: now ? 'var(--acc)' : 'transparent',
                  }}
                />
              )}
              <span
                className={`flex-1 truncate text-[13px] ${state ? '' : 'text-[var(--ink2)]'}`}
              >
                {label}
              </span>
              {state ? (
                <span
                  className="oi-num flex-none text-[10px] uppercase tracking-[0.12em]"
                  style={{ color: now ? 'var(--acc)' : 'var(--ink2)' }}
                >
                  {state}
                </span>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export const SNAPSHOTS = [QuizSnap, MatchSnap, QuoteSnap, CompareSnap, ExpertSnap];
