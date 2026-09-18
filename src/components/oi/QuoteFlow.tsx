'use client';

/**
 * Getting a quote: the gate, the ten seconds, and the document.
 *
 * One component because it is one act. Splitting it across routes would mean a
 * customer who lands mid-way — back button, refresh, shared link — arriving at
 * a loading screen with nothing loading, or a floor-plan form for a quote that
 * already exists.
 *
 * ## Why the floor plan is asked for first
 *
 * The kitchen platform run is the only number in the whole quote that
 * genuinely comes from the plan, and it moves the total more than anything
 * else. Without it every kitchen line is priced on the archive median and the
 * band widens from ±10% to ±16%.
 *
 * So the plan is the default path — and there is a way through for anyone who
 * has not got one to hand, because blocking somebody at the most valuable
 * moment of the journey to demand a PDF is how you lose them to the studio
 * down the road who would have guessed a number over the phone.
 */

import { useCallback, useState } from 'react';
import { formatINRCompact } from '@/lib/money';
import { buildFirstQuote, STANDARD_KITCHEN_RUN_MM, type FirstQuote } from '@/modules/quotation/first-quote';
import { filedRatesFor, ratesAreReal } from '@/data/filed-rates';
import type { FloorPlan } from '@/modules/quotation/project-store';
import { Building } from './Building';
import { Sheet, DocRow, Tick, Flag } from './index';

type Phase = 'gate' | 'building' | 'done';

export interface QuoteRequest {
  studioSlug: string;
  studioName: string;
  bhk: number;
  carpetAreaSqft: number;
  bathrooms: number;
}

// ── The gate ────────────────────────────────────────────────────

const input =
  'w-full border border-[var(--line)] bg-[var(--card)] px-3 py-2.5 text-[14px] text-[var(--ink)] placeholder:text-[var(--ink2)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--acc)]';

function Gate({ onReady }: { onReady: (plan: FloorPlan) => void }) {
  const [fileName, setFileName] = useState<string | null>(null);
  const [runMm, setRunMm] = useState('');
  const [noPlan, setNoPlan] = useState(false);

  const typed = Number(runMm);
  const runIsSane = Number.isFinite(typed) && typed >= 1500 && typed <= 9000;

  return (
    <Sheet className="mx-auto max-w-[36rem] p-[clamp(22px,3vw,32px)]">
      <p className="oi-eyebrow m-0 mb-4">Before we price it</p>
      <h2 className="oi-display m-0 mb-3 text-[clamp(1.5rem,1.2rem+1.2vw,2rem)]">
        Send us the floor plan.
      </h2>
      <p className="m-0 mb-6 text-[14.5px] leading-[1.6] text-[var(--ink2)]">
        One number on it decides most of the quote — the length of your kitchen platform. With the
        plan we price your kitchen; without it we price a typical one and say so.
      </p>

      {!noPlan ? (
        <>
          <label className="mb-5 block">
            <span className="oi-label mb-2 block">Floor plan · PDF or photo</span>
            <input
              type="file"
              accept=".pdf,image/*"
              onChange={(e) => setFileName(e.target.files?.[0]?.name ?? null)}
              className={input}
            />
          </label>

          {fileName ? (
            <p className="m-0 mb-5 flex items-center gap-2.5 text-[13.5px]">
              <Tick style={{ color: 'var(--sec)' }} />
              <span>{fileName}</span>
            </p>
          ) : null}

          <div className="flex flex-wrap items-center gap-4">
            <button
              type="button"
              disabled={!fileName}
              onClick={() =>
                onReady({ fileName, kitchenRunMm: null, source: 'floor_plan' })
              }
              className="cursor-pointer px-6 py-3 text-[14.5px] font-medium text-white transition-colors disabled:opacity-40"
              style={{ background: 'var(--acc-btn)' }}
            >
              Build my quote
            </button>
            {/* The way through. Quiet, but never hidden — a gate with no
                visible exit is a gate people leave the site at. */}
            <button
              type="button"
              onClick={() => setNoPlan(true)}
              className="cursor-pointer border-0 bg-transparent p-0 text-[13.5px] text-[var(--ink2)] underline hover:text-[var(--ink)]"
            >
              I haven&rsquo;t got the plan to hand
            </button>
          </div>
        </>
      ) : (
        <>
          <label className="mb-2 block">
            <span className="oi-label mb-2 block">
              How long is your kitchen platform, in mm?
            </span>
            <input
              inputMode="numeric"
              value={runMm}
              onChange={(e) => setRunMm(e.target.value.replace(/\D/g, ''))}
              placeholder="e.g. 3600"
              className={`${input} oi-num`}
            />
          </label>
          <p className="m-0 mb-6 text-[13px] leading-snug text-[var(--ink2)]">
            Measure the run your counter sits on. Most Pune flats are between 3,000 and 5,500mm. A
            rough number is worth more than none.
          </p>

          <div className="flex flex-wrap items-center gap-4">
            <button
              type="button"
              disabled={!runIsSane}
              onClick={() => onReady({ fileName: null, kitchenRunMm: typed, source: 'customer' })}
              className="cursor-pointer px-6 py-3 text-[14.5px] font-medium text-white transition-colors disabled:opacity-40"
              style={{ background: 'var(--acc-btn)' }}
            >
              Build my quote
            </button>
            <button
              type="button"
              onClick={() =>
                onReady({
                  fileName: null,
                  kitchenRunMm: STANDARD_KITCHEN_RUN_MM,
                  source: 'standard',
                })
              }
              className="cursor-pointer border-0 bg-transparent p-0 text-[13.5px] text-[var(--ink2)] underline hover:text-[var(--ink)]"
            >
              Use a standard kitchen instead
            </button>
          </div>

          <p className="m-0 mt-5 border-t border-[var(--line)] pt-4">
            <Flag>A standard kitchen widens the quote from ±10% to ±16%</Flag>
          </p>
        </>
      )}
    </Sheet>
  );
}

// ── The document ────────────────────────────────────────────────

export function QuoteDocument({
  quote,
  studioName,
  plan,
}: {
  quote: FirstQuote;
  studioName: string;
  plan: FloorPlan;
}) {
  const money = (p: number) => formatINRCompact(p);

  return (
    <Sheet className="p-[clamp(20px,3vw,34px)]">
      <div className="mb-7 flex flex-wrap items-end justify-between gap-x-8 gap-y-3 border-b border-[var(--ink)] pb-5">
        <div>
          <p className="oi-eyebrow m-0 mb-2">First quote · generated</p>
          <h2 className="oi-display m-0 text-[clamp(1.4rem,1.15rem+1vw,1.9rem)]">{studioName}</h2>
        </div>
        <div className="text-left sm:text-right">
          <p className="oi-num m-0 text-[26px] leading-none">{money(quote.totalPaise)}</p>
          <p className="oi-num m-0 mt-1.5 text-[10.5px] uppercase tracking-[0.14em] text-[var(--ink2)]">
            {money(quote.lowPaise)}–{money(quote.highPaise)} · ±
            {Math.round(quote.variancePct * 100)}%
          </p>
        </div>
      </div>

      {/* The honesty band. It is the first thing under the total on purpose. */}
      {!ratesAreReal() ? (
        <p className="m-0 mb-6">
          <Flag>
            Pre-launch — priced on archive rates, not this studio&rsquo;s own filed card
          </Flag>
        </p>
      ) : null}

      {quote.rooms.map((room) => (
        <section key={room.room} className="mb-7">
          <div className="mb-1 flex items-baseline justify-between gap-4">
            <h3 className="oi-label m-0">{room.label}</h3>
            <span className="oi-num text-[12.5px] text-[var(--ink2)]">
              {money(room.subtotalPaise)}
            </span>
          </div>

          {room.lines.map((line) => (
            <DocRow
              key={line.code}
              label={line.label}
              quantity={`${line.size} · ${line.quantity.toLocaleString('en-IN')} ${line.unit} · ${money(line.ratePaise)}/${line.unit}`}
              value={money(line.amountPaise)}
              note={line.spec}
            />
          ))}
        </section>
      ))}

      {/* The commercial terms, identical for every studio on the roster. */}
      <div className="mt-8 border-t border-[var(--ink)] pt-2">
        <DocRow label="Modular (factory)" value={money(quote.modularPaise)} />
        <DocRow label="Non-modular (on site)" value={money(quote.nonModularPaise)} />
        <DocRow label="Professional fee · 7%" value={money(quote.professionalFeePaise)} />
        <DocRow
          label="Less discount on modular · 10%"
          value={`−${money(quote.modularDiscountPaise)}`}
          better
        />
        <DocRow label="GST · 18%" value={money(quote.gstPaise)} />
        <DocRow label="Total" value={money(quote.totalPaise)} emphasis />
      </div>

      {quote.notPriced.length > 0 ? (
        <p className="m-0 mt-6 border-t border-[var(--line)] pt-4">
          <Flag>
            {quote.notPriced.length} item
            {quote.notPriced.length === 1 ? '' : 's'} not in this total — this studio has not filed a
            rate for them
          </Flag>
        </p>
      ) : null}

      <div className="mt-7 border-t border-[var(--line)] pt-5">
        <p className="oi-label m-0 mb-3">What this is built on</p>
        <ul className="m-0 flex list-none flex-col gap-2 p-0">
          {quote.assumptions.map((line) => (
            <li key={line} className="text-[13px] leading-[1.55] text-[var(--ink2)]">
              {line}
            </li>
          ))}
          <li className="text-[13px] leading-[1.55] text-[var(--ink2)]">
            {plan.source === 'floor_plan'
              ? `Read from ${plan.fileName ?? 'your floor plan'}.`
              : plan.source === 'customer'
                ? 'Kitchen run as you measured it.'
                : 'No plan and no measurement — a standard kitchen was used.'}
          </li>
        </ul>
      </div>
    </Sheet>
  );
}

// ── The whole act ───────────────────────────────────────────────

export function QuoteFlow({
  request,
  plan,
  onBuilt,
}: {
  request: QuoteRequest;
  /** A plan already given for an earlier studio. Skips the gate. */
  plan: FloorPlan | null;
  onBuilt: (quote: FirstQuote, plan: FloorPlan) => void;
}) {
  const [phase, setPhase] = useState<Phase>(plan ? 'building' : 'gate');
  const [usedPlan, setUsedPlan] = useState<FloorPlan | null>(plan);
  const [quote, setQuote] = useState<FirstQuote | null>(null);

  const start = useCallback((next: FloorPlan) => {
    setUsedPlan(next);
    setPhase('building');
  }, []);

  // Built when the stages finish, not before — the ten seconds are the point.
  const finish = useCallback(() => {
    if (!usedPlan) return;
    const built = buildFirstQuote(
      {
        bhk: request.bhk,
        carpetAreaSqft: request.carpetAreaSqft,
        bathrooms: request.bathrooms,
        kitchenRunMm: usedPlan.kitchenRunMm,
        runSource: usedPlan.source,
      },
      filedRatesFor(request.studioSlug),
    );
    setQuote(built);
    setPhase('done');
    onBuilt(built, usedPlan);
  }, [usedPlan, request, onBuilt]);

  if (phase === 'gate') return <Gate onReady={start} />;
  if (phase === 'building' || !quote || !usedPlan) {
    return <Building studioName={request.studioName} onDone={finish} />;
  }
  return <QuoteDocument quote={quote} studioName={request.studioName} plan={usedPlan} />;
}
