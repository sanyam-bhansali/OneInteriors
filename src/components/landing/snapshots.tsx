/**
 * The five product snapshots on the how-it-works spine.
 *
 * ## Why these are drawn rather than screenshotted
 *
 * The locked structure says "real software views, not generic infographics",
 * and these are built from the same tokens and the same numbers the product
 * uses — the per-sq-ft bands from `tiers.ts`, the fifteen checks, nine
 * questions, the material specs that appear on a real quotation line. A
 * screenshot would go stale the first time a padding changed and would be
 * illegible at this size; an infographic would be a picture of an idea rather
 * than the thing.
 *
 * ## The rule each one has to obey
 *
 * Every figure, quantity, spec and score is mono. Every sentence is sans.
 * Sage marks verification and better spec. Terracotta appears on exactly one
 * thing per snapshot, and only where the customer would act or where something
 * needs attention.
 *
 * ## One worked example, all the way through
 *
 * The five are a single story and the numbers have to survive it: a 2 BHK in
 * Baner briefs at ₹14.4–25.6 L, matches Teakline at 92, is quoted ₹18.4 L on
 * four lines, and is compared against Chitra's ₹17.15 L — where the ₹1.25 L
 * gap turns out to be 16mm MDF against 18mm BWP. That last fact is the whole
 * product in one sentence, so every figure above it exists to set it up. If
 * you change one, change the chain.
 *
 * Studio names are invented — Teakline Studio, Chitra & Co., Maya Workshop —
 * and must stay that way. A real partner's name beside an invented figure is a
 * claim about a real business that we made up.
 */

import { SpecRow, Tick } from './parts';
import { CHECK_COUNT } from './checks';

/**
 * `compact` is for the walkthrough frame further down the page.
 *
 * The same snapshots appear twice — once on the pinned how-it-works spine,
 * where the reader is held on one step and has time, and once in the
 * walkthrough, where they are tapping through five in a row. The second one
 * needs less: fewer rows, and none of the explanatory sentences the spine
 * uses to make its argument, because the walkthrough makes that argument in
 * the copy beside the frame.
 *
 * A prop rather than a second set of components. Two copies of QuizSnap would
 * be two places for the ₹ figures and the roster count to drift apart, and
 * those numbers appearing twice with different values on one page is exactly
 * the failure this site is selling against.
 */
export interface SnapProps {
  compact?: boolean;
}

const card = 'oi-glass-inner bg-[var(--card)] border border-[var(--line)]';

function SnapHead({ title, note }: { title: string; note?: string }) {
  return (
    <div className="mb-3 flex items-baseline justify-between gap-3">
      <p className="oi-label m-0">{title}</p>
      {note ? <p className="oi-label m-0 !text-[var(--sec-ink)]">{note}</p> : null}
    </div>
  );
}

/** 01 — the brief filling in, with the roster narrowing live beside it. */
export function QuizSnap({ compact = false }: SnapProps = {}) {
  // Eight facts, not five. The point of this screen is that nine questions
  // capture more than a form usually does — household and "ruled out" are the
  // two nobody else asks, and they are what make a match defensible.
  const all = [
    ['Home', '2 BHK · BANER'],
    ['Scope', 'FULL HOME'],
    ['Budget', '₹14.4 L – ₹25.6 L'],
    ['Household', '2 ADULTS, 1 ELDERLY'],
    ['Leaning', 'WARM MODERN, ART DECO'],
    ['Ruled out', 'INDUSTRIAL'],
    ['Priority', 'MATERIAL QUALITY'],
    ['Working style', 'THROUGH IT TOGETHER'],
  ];
  const answered = compact ? all.slice(0, 4) : all;

  return (
    <div className={`${card} p-4`}>
      <SnapHead title="Your brief so far" note="9 of 9 · nearly done" />

      <div className="mb-3">
        {answered.map(([k, v]) => (
          <SpecRow key={k} label={k!} value={v!} />
        ))}
      </div>

      {/* The counter is the point of this screen. It moves while you answer,
          which is what makes nine questions feel like progress rather than a
          form. Six, not fourteen — by the ninth answer the brief has narrowed
          the roster, and a number that never moved would prove nothing. */}
      <div className="flex items-center justify-between gap-3 border-t border-[var(--line)] pt-3">
        <span className="text-[13px] text-[var(--ink2)]">studios still match</span>
        <span className="oi-num text-[22px] leading-none" style={{ color: 'var(--sec-ink)' }}>
          6
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
export function MatchSnap({ compact = false }: SnapProps = {}) {
  // `cleared` counts against CHECK_COUNT rather than a literal. The design
  // this came from said "12/12", which was true when there were twelve
  // checks — printing it now would have this card contradict the trust
  // section a screen below it.
  const rows = [
    { studio: 'Teakline Studio', score: 92, reason: 'Warm Modern · 9 Baner flats this year', cleared: CHECK_COUNT },
    { studio: 'Chitra & Co.', score: 87, reason: 'Art Deco detailing · in-house carpentry', cleared: CHECK_COUNT },
    { studio: 'Maya Workshop', score: 80, reason: 'Material-led · elderly-friendly plans', cleared: CHECK_COUNT - 1 },
  ];

  return (
    <div className={`${card} p-4`}>
      <SnapHead title="Who fits your brief" note={`3 of 14 · 2 BHK · Baner`} />

      <ul className="m-0 flex list-none flex-col gap-2.5 p-0">
        {rows.map((r) => (
          <li key={r.studio} className="flex items-center gap-3">
            <Ring score={r.score} />
            <div className="min-w-0 flex-1">
              <p className="m-0 truncate text-[13.5px] font-medium">{r.studio}</p>
              <p className="m-0 truncate text-[12px] text-[var(--ink2)]">{r.reason}</p>
            </div>
            <span
              className="oi-num flex-none text-[9.5px] uppercase tracking-[0.12em]"
              style={{ color: r.cleared === CHECK_COUNT ? 'var(--sec-ink)' : 'var(--ink2)' }}
            >
              {r.cleared}/{CHECK_COUNT}
            </span>
          </li>
        ))}
      </ul>

      {compact ? null : (
        <p className="m-0 mt-3 border-t border-[var(--line)] pt-3 text-[12.5px] leading-snug text-[var(--ink2)]">
          Nobody can pay to sit higher on this list. A subscription buys how often a studio is
          shown, never where it lands for you.
        </p>
      )}
    </div>
  );
}

/**
 * 03 — the first quote.
 *
 * Note the framing: generated, not requested. Nothing is asked of a studio and
 * nobody is phoned, and this snapshot is where that is demonstrated rather
 * than asserted — which is why the elapsed time is on the chrome and the
 * sentence sits above the lines rather than under them.
 */
export function QuoteSnap({ compact = false }: SnapProps = {}) {
  const all = [
    ['Wardrobes', '84 SQ FT · 18MM BWP · MATT LAMINATE', '4,20,000'],
    ['Kitchen', 'L-SHAPE 11 FT · QUARTZ COUNTER', '3,85,000'],
    ['Beds & seating', '2 BEDS · 1 SOFA · FABRIC GRADE B', '3,60,000'],
    ['Ceiling + lighting', '420 SQ FT · 26 FIXTURES', '2,10,000'],
  ];
  const lines = compact ? all.slice(0, 3) : all;

  return (
    <div className={`${card} p-4`}>
      <SnapHead title="Quote · generated in 3.2 s" note="Every line has a quantity" />

      {/* Never trimmed, compact or not. "No studio was asked and nobody was
          phoned" is the single sentence this whole snapshot exists to say. */}
      <p className="m-0 mb-3 text-[12.5px] leading-snug text-[var(--ink2)]">
        Nobody was phoned. Our system priced your brief off Teakline Studio&rsquo;s own filed rate
        card and wrote this quote line by line.
      </p>

      <div className="mb-3">
        {lines.map(([item, qty, amount]) => (
          <div
            key={item}
            className="flex flex-wrap items-baseline justify-between gap-x-3 border-b border-[var(--line)] py-2 last:border-b-0"
          >
            <span className="min-w-0 flex-1 truncate text-[13px]">{item}</span>
            <span className="oi-num flex-none text-[12.5px]">{amount}</span>
            <span className="oi-num w-full text-[10px] uppercase tracking-[0.12em] text-[var(--ink2)]">
              {qty}
            </span>
          </div>
        ))}
      </div>

      <div className="flex items-baseline justify-between gap-3 border-t border-[var(--ink)] pt-3">
        <span className="oi-label m-0">Total · GST incl.</span>
        <span className="oi-num text-[17px]">₹18.4 L</span>
      </div>
      <p className="m-0 mt-1.5 text-[12px] text-[var(--ink2)]">Labour &amp; install included</p>
    </div>
  );
}

/** 04 — quotes side by side AND the materials behind them. */
export function CompareSnap({ compact = false }: SnapProps = {}) {
  const lines = [
    ['Wardrobes', '4.20 L', '3.65 L'],
    ['Kitchen core', '3.85 L', '5.10 L'],
  ];

  // Teakline is cheaper on the wardrobe and dearer on the kitchen, and the
  // materials row underneath says why in both directions. A comparison where
  // one studio simply wins everything teaches the reader nothing.
  const materials: [string, string, string, 'a' | 'b'][] = [
    ['Carcass', '16MM MDF', '18MM BWP', 'b'],
    ['Shutter finish', 'MATT LAMINATE', 'ACRYLIC', 'b'],
    ['Hinges & channels', 'LOCAL', 'BRANDED · 10 YR', 'b'],
  ];

  return (
    <div className={`${card} p-4`}>
      <SnapHead title="Same lines, side by side" note="2 quotes" />

      <div className="mb-1 grid grid-cols-[1fr_auto_auto] gap-x-3">
        <span className="oi-label m-0">Line</span>
        <span className="oi-label m-0 text-right">Teakline</span>
        <span className="oi-label m-0 text-right">Chitra &amp; Co.</span>
      </div>

      <div className="mb-4 grid grid-cols-[1fr_auto_auto] gap-x-3">
        {lines.map(([label, a, b]) => (
          <div key={label} className="contents">
            <span className="border-b border-[var(--line)] py-2 text-[13px]">{label}</span>
            <span className="oi-num border-b border-[var(--line)] py-2 text-right text-[12.5px]">
              {a}
            </span>
            <span className="oi-num border-b border-[var(--line)] py-2 text-right text-[12.5px]">
              {b}
            </span>
          </div>
        ))}
      </div>

      <p className="oi-label m-0 mb-1">And the materials behind them</p>
      <div className="grid grid-cols-[1fr_auto_auto] gap-x-3">
        {materials.map(([label, a, b, better]) => (
          <div key={label} className="contents">
            <span className="border-b border-[var(--line)] py-2 text-[13px] text-[var(--ink2)]">
              {label}
            </span>
            <span
              className="oi-num border-b border-[var(--line)] py-2 text-right text-[10.5px] uppercase tracking-[0.1em]"
              style={better === 'a' ? { color: 'var(--sec-ink)' } : undefined}
            >
              {a}
            </span>
            <span
              className="oi-num border-b border-[var(--line)] py-2 text-right text-[10.5px] uppercase tracking-[0.1em]"
              style={better === 'b' ? { color: 'var(--sec-ink)' } : undefined}
            >
              {b}
            </span>
          </div>
        ))}
      </div>

      {compact ? null : (
        <>
          <p className="oi-label m-0 mt-3.5 mb-1">Why the ₹1.25 L gap</p>
          <p className="m-0 text-[12.5px] leading-snug text-[var(--ink2)]">
            Chitra quoted the kitchen on 18mm BWP ply. Teakline used 16mm MDF. Same drawing,
            different carcass.
          </p>
        </>
      )}
    </div>
  );
}

/** 05 — the architect, and what they have signed off so far. */
export function ExpertSnap({ compact = false }: SnapProps = {}) {
  const all = [
    ['Brief read back to you', 'signed off'],
    ['Shortlist and studio checks', 'signed off'],
    ['Quote read line by line', 'today'],
    ['Material samples signed off', ''],
    ['Site visits and handover', ''],
  ];
  const steps = compact ? all.slice(0, 4) : all;

  return (
    <div className={`${card} p-4`}>
      <SnapHead title="Your architect · assigned to you" note="He verifies every step" />

      <div className="mb-3 flex items-center gap-3">
        <div className="h-11 w-11 flex-none rounded-full bg-[var(--bg)]" />
        <div className="min-w-0">
          <p className="m-0 text-[14px] font-medium">Nikhil Bhave</p>
          <p className="m-0 text-[12px] leading-snug text-[var(--ink2)]">
            Stays with you from brief to handover. Paid by us, never by a studio.
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
                  style={{ color: now ? 'var(--acc-ink)' : 'var(--ink2)' }}
                >
                  {state}
                </span>
              ) : null}
            </li>
          );
        })}
      </ul>

      {/* The advice, in his words. It is the proof that "your architect" is a
          person who reads the quotation rather than a support inbox — and it
          names the exact line and the exact board, because that is what the
          advice actually sounds like when somebody is on your side. */}
      {compact ? null : (
        <blockquote className="m-0 mt-3.5 border-t border-[var(--line)] pt-3.5">
          <p className="oi-display m-0 text-[15px] leading-snug">
            &ldquo;I&rsquo;d ask Teakline to re-quote the kitchen on 18mm BWP before you sign
            anything.&rdquo;
          </p>
        </blockquote>
      )}
    </div>
  );
}

export const SNAPSHOTS: ((props?: SnapProps) => React.JSX.Element)[] = [
  QuizSnap,
  MatchSnap,
  QuoteSnap,
  CompareSnap,
  ExpertSnap,
];
