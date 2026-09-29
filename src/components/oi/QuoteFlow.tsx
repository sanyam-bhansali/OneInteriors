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

import { showcase } from '@/modules/portal/benefits';
import { useCallback, useState } from 'react';
import { formatINRCompact } from '@/lib/money';
import {
  buildFirstQuote,
  runSourceOf,
  standardKitchenRunMm,
  type FirstQuote,
} from '@/modules/quotation/first-quote';
import { filedRatesFor, ratesAreReal } from '@/data/filed-rates';
import type { StudioRates } from '@/modules/quotation/catalogue';
import type { ScopeSelection } from '@/modules/quotation/scope';
import type { Material } from '@/modules/materials/glossary';
import type { FloorPlan } from '@/modules/quotation/project-store';
import { Building, stagesFor } from './Building';
import { Spec, MaterialPanel } from './Material';
import { Sheet, DocRow, Flag } from './index';
import { Mark } from '@/components/brand';
import { advanceIsHigh, phaseAmounts, type PaymentPhase } from '@/modules/studio/payment-phases';

type Phase = 'gate' | 'building' | 'done';

export interface QuoteRequest {
  studioSlug: string;
  studioName: string;
  bhk: number;
  carpetAreaSqft: number;
  /** The typical area for their configuration, not a figure they gave. */
  carpetAreaAssumed?: boolean;
  bathrooms: number;
  /** What the quote covers. See modules/quotation/scope.ts. */
  scope?: ScopeSelection;
  /** The kitchen from their confirmed floor plan, which skips the gate. */
  plan?: FloorPlan | null;
}

// ── The gate ────────────────────────────────────────────────────

const input =
  'w-full border border-[var(--line)] bg-[var(--card)] px-3 py-2.5 text-[14px] text-[var(--ink)] placeholder:text-[var(--ink2)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--acc)]';

/**
 * The gate.
 *
 * ## Why there is no floor-plan upload here, for now
 *
 * There was one: "Send us the floor plan", a file input, and a "Build my
 * quote" button that promised ±10%. Nothing read the file. Its name was
 * recorded, the kitchen was priced on the standard run anyway, and the
 * document then said "Kitchen priced on a platform run read from your floor
 * plan" — a measurement nobody took, printed on the one page whose whole
 * claim is that it says what it assumed.
 *
 * Reading a plan properly — Claude reads it, the customer confirms what was
 * read — is Phase 2 of `docs/CUSTOMER-JOURNEY-PLAN.md`, and it moves into the
 * brief so it sizes every studio's quote at once. Until then the gate offers
 * only what is true: a kitchen they measured (±12%) or a standard one (±16%).
 *
 * The standard run is sized to their configuration — see
 * `standardKitchenRunMm`. A 1 BHK and a 4 BHK do not have the same kitchen,
 * and quoting them as if they did was the largest avoidable error in the
 * whole build.
 */
function Gate({ onReady, bhk }: { onReady: (plan: FloorPlan) => void; bhk: number }) {
  const [runMm, setRunMm] = useState('');

  const typed = Number(runMm);
  const runIsSane = Number.isFinite(typed) && typed >= 1500 && typed <= 9000;
  const standardRun = standardKitchenRunMm(bhk);

  return (
    <Sheet className="mx-auto max-w-[36rem] p-[clamp(22px,3vw,32px)]">
      <p className="oi-eyebrow m-0 mb-4">Before we price it</p>
      <h2 className="oi-display m-0 mb-3 text-[clamp(1.5rem,1.2rem+1.2vw,2rem)]">
        One number decides most of the quote.
      </h2>
      <p className="m-0 mb-6 text-[14.5px] leading-[1.6] text-[var(--ink2)]">
        The length of your kitchen platform. Measure it and we price your kitchen; skip it and we
        price a typical one for a {bhk} BHK, and say so on the quote.
      </p>

      {/* One press, first. Most people are not standing in their kitchen with
          a tape measure, and the alternative to this button is not a better
          quote — it is no quote and a closed tab. */}
      <button
        type="button"
        onClick={() => onReady({ fileName: null, kitchenRunMm: standardRun, source: 'standard' })}
        className="cursor-pointer px-6 py-3 text-[14.5px] font-medium text-white transition-colors"
        style={{ background: 'var(--acc-btn)' }}
      >
        Price it now on a standard {bhk} BHK kitchen
      </button>
      <p className="m-0 mt-2.5 text-[12.5px] leading-snug text-[var(--ink2)]">
        A {standardRun.toLocaleString('en-IN')}mm platform, which is what a {bhk} BHK usually has.
        Every other size in the quote is standard anyway. The range is ±16%, and the document says
        so.
      </p>

      <div className="mt-7 border-t border-[var(--line)] pt-5">
        <label className="mb-2 block">
          <span className="oi-label mb-2 block">Or tell us your kitchen platform, in mm</span>
          <input
            inputMode="numeric"
            value={runMm}
            onChange={(e) => setRunMm(e.target.value.replace(/\D/g, ''))}
            placeholder="e.g. 3600"
            className={`${input} oi-num`}
          />
        </label>
        <p className="m-0 mb-4 text-[13px] leading-snug text-[var(--ink2)]">
          Measure the run your counter sits on. Most Pune flats are between 3,000 and 5,500mm. A
          rough number is worth more than none, and it narrows the range to ±12%.
        </p>

        {/* Says what is missing rather than sitting greyed out — a disabled
            button is a puzzle that says no without saying why. */}
        {runIsSane ? (
          <button
            type="button"
            onClick={() => onReady({ fileName: null, kitchenRunMm: typed, source: 'customer' })}
            className="cursor-pointer border border-[var(--ink)] bg-transparent px-5 py-2.5 text-[14px] font-medium text-[var(--ink)]"
          >
            Build it on {typed.toLocaleString('en-IN')}mm
          </button>
        ) : runMm ? (
          <p className="m-0 text-[13px] text-[var(--ink2)]">
            That is outside 1,500–9,000mm — check the number, or use the standard kitchen above.
          </p>
        ) : null}
      </div>
    </Sheet>
  );
}

// ── The document ────────────────────────────────────────────────

export function QuoteDocument({
  quote,
  studioName,
  plan,
  preparedFor = null,
  onMeasured,
  paymentPhases = null,
  bandLine = null,
}: {
  quote: FirstQuote;
  studioName: string;
  plan: FloorPlan;
  /** "Sanyam · 3 BHK · Kharadi · Full home" — printed under the studio's name. */
  preparedFor?: string | null;
  /** The studio's own schedule; null until they file one. */
  paymentPhases?: PaymentPhase[] | null;
  /** "Inside your Premium range…" — where this total lands against the band they chose. */
  bandLine?: string | null;
  /**
   * Offered when the kitchen is the standard one: measure it here and every
   * studio is re-priced on it at once (±16% → ±12%).
   */
  onMeasured?: (runMm: number) => void;
}) {
  const money = (p: number) => formatINRCompact(p);

  /**
   * The document's own glossary.
   *
   * A quotation whose material column cannot be read is the thing this
   * product exists to replace. Every spec here is tappable, and the same
   * panel answers on the comparison screen — so a term learned in one place
   * is the same term, worded the same way, in the other.
   */
  const [term, setTerm] = useState<Material | null>(null);

  return (
    <Sheet className="p-[clamp(20px,3vw,34px)]">
      <div className="mb-7 flex flex-wrap items-end justify-between gap-x-8 gap-y-3 border-b border-[var(--ink)] pb-5">
        {/* The studio's own name and mark on top — the quote is theirs, priced
            on their rates. Our mark is at the foot, as the platform that
            built it (the owner's format, 29 Sep; studio logos arrive with the
            studio profile, until then their initials). */}
        <div className="flex items-start gap-4">
          <span
            aria-hidden="true"
            className="oi-num flex h-12 w-12 shrink-0 items-center justify-center rounded-[10px] bg-[var(--acc-wash)] text-[15px] text-[var(--acc-ink)]"
          >
            {studioName
              .split(/\s+/)
              .map((w) => w[0])
              .join('')
              .slice(0, 2)
              .toUpperCase()}
          </span>
          <div>
            <p className="oi-eyebrow m-0 mb-2">First quote · generated</p>
            <h2 className="oi-display m-0 text-[clamp(1.4rem,1.15rem+1vw,1.9rem)]">{studioName}</h2>
            {preparedFor ? (
              <p className="m-0 mt-1.5 text-[13.5px] text-[var(--ink2)]">Prepared for {preparedFor}</p>
            ) : null}
          </div>
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

      {bandLine ? <p className="m-0 mb-6 text-[13.5px] leading-[1.6] text-[var(--ink2)]">{bandLine}</p> : null}

      {quote.rooms.map((room) => (
        <section key={room.room} className="mb-7">
          {/* The room heading was a 10.5px mono label, the same size as the
              smallest thing on the page. It is a heading; it now reads like
              one. */}
          <div className="mb-2 flex items-baseline justify-between gap-4 border-b border-[var(--ink)] pb-2">
            <h3 className="oi-display m-0 text-[17px]">{room.label}</h3>
            <span className="oi-num text-[14px]">{money(room.subtotalPaise)}</span>
          </div>

          {room.lines.map((line) => (
            <DocRow
              key={line.code}
              label={line.label}
              quantity={`${line.size}  ·  ${line.quantity.toLocaleString('en-IN')} ${line.unit} at ${money(line.ratePaise)} per ${line.unit}`}
              value={money(line.amountPaise)}
              note={<Spec text={line.spec} onPick={setTerm} />}
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
        {quote.curatedDiscountPaise ? (
          <DocRow
            label={`One Interiors discount · ${quote.curatedDiscountPct}%`}
            value={`−${money(quote.curatedDiscountPaise)}`}
            better
          />
        ) : null}
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
            <li key={line} className="text-[13.5px] leading-[1.6] text-[var(--ink2)]">
              {line}
            </li>
          ))}
          <li className="text-[13px] leading-[1.55] text-[var(--ink2)]">
            {runSourceOf(plan) === 'customer'
              ? 'Kitchen run as you measured it.'
              : 'No measurement — a standard kitchen was used.'}
          </li>
        </ul>
      </div>

      {/* When money moves. Each studio's own phases, from its quotations or
          its profile — never a schedule we invented for it. */}
      <div className="mt-7 border-t border-[var(--line)] pt-5">
        <p className="oi-label m-0 mb-2">Payment phases</p>
        {paymentPhases ? (
          <>
            {phaseAmounts(paymentPhases, quote.totalPaise).map((p, i) => (
              <DocRow key={`${p.label}-${i}`} label={`${p.label} · ${p.pct}%`} value={money(p.amountPaise)} />
            ))}
            {advanceIsHigh(paymentPhases) ? (
              <p className="m-0 mt-3 text-[13px] leading-[1.6] text-[var(--ink2)]">
                {studioName} asks {paymentPhases[0]!.pct}% at booking — more than most Pune studios.
                Worth asking what it covers before you pay it.
              </p>
            ) : null}
          </>
        ) : (
          <p className="m-0 text-[13.5px] leading-[1.6] text-[var(--ink2)]">
            {studioName} has not filed its payment schedule with us yet. Our expert confirms it with
            them before you meet — and how much is paid before anything is installed is worth asking.
          </p>
        )}
      </div>

      {onMeasured && runSourceOf(plan) === 'standard' ? (
        <MeasureKitchen onMeasured={onMeasured} />
      ) : null}

      <p className="oi-label m-0 mt-6 border-t border-[var(--line)] pt-4 print:hidden">
        Underlined materials open an explanation — what it is, and what the cheaper version costs
      </p>

      {/* Printed too: quotes get forwarded and carried into studio meetings,
          and the PDF is where a customer is most likely to go direct. */}
      <div className="mt-6 border-t border-[var(--line)] pt-4">
        <p className="m-0 mb-1.5 text-[13.5px] font-semibold text-[var(--ink)]">
          Book this quote through One Interiors to keep:
        </p>
        <p className="m-0 text-[13px] leading-[1.6] text-[var(--ink2)]">
          {showcase().map((b) => b.short).join(' · ')}. Start with your expert call at
          oneinteriors.in/expert — {studioName} is introduced to you through us.
        </p>
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-4 border-t border-[var(--ink)] pt-4">
        <p className="m-0 flex items-center gap-2 text-[12.5px] text-[var(--ink2)]">
          <Mark className="h-[14px] w-[14px] text-[var(--ink)]" />
          Powered by One Interiors
        </p>
        <button
          type="button"
          onClick={() => window.print()}
          className="cursor-pointer border border-[var(--line)] bg-transparent px-4 py-2 text-[13px] text-[var(--ink)] print:hidden"
        >
          Print or save as PDF
        </button>
      </div>

      <MaterialPanel material={term} onClose={() => setTerm(null)} />
    </Sheet>
  );
}

/**
 * Measure the kitchen, and every studio is re-priced on it.
 *
 * Offered on a quote priced on the standard kitchen: the platform run is the
 * number that moves a quote most, and a measured one takes the band from ±16%
 * to ±12% for every studio at once.
 */
function MeasureKitchen({ onMeasured }: { onMeasured: (runMm: number) => void }) {
  const [value, setValue] = useState('');
  const n = Number(value);
  const ok = Number.isFinite(n) && n >= 1500 && n <= 9000;
  return (
    <div className="mt-7 border-t border-[var(--line)] pt-5 print:hidden">
      <p className="oi-label m-0 mb-2">Tighten this quote</p>
      <p className="m-0 mb-3 text-[13.5px] leading-[1.6] text-[var(--ink2)]">
        Measure your kitchen platform and every studio is re-priced on it — the range narrows from
        ±16% to ±12%.
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <input
          inputMode="numeric"
          value={value}
          onChange={(e) => setValue(e.target.value.replace(/\D/g, ''))}
          placeholder="Platform length, mm"
          className={`${input} oi-num w-48`}
        />
        {ok ? (
          <button
            type="button"
            onClick={() => onMeasured(Math.round(n))}
            className="cursor-pointer px-4 py-2.5 text-[14px] font-medium text-white"
            style={{ background: 'var(--acc-btn)' }}
          >
            Re-price every studio
          </button>
        ) : value ? (
          <span className="text-[13px] text-[var(--ink2)]">Between 1,500 and 9,000 mm.</span>
        ) : null}
      </div>
    </div>
  );
}

// ── The whole act ───────────────────────────────────────────────

export function QuoteFlow({
  request,
  plan,
  onBuilt,
  seenQuestions,
  onAsked,
  filedRates,
}: {
  request: QuoteRequest;
  /**
   * This studio's rates, resolved on the server.
   *
   * Optional, and the fallback below is load-bearing rather than defensive:
   * most of the roster has not filed an archive, and this component also runs
   * on a journey restored from browser storage where no server pass happened.
   */
  filedRates?: StudioRates;
  /** A plan already given for an earlier studio. Skips the gate. */
  plan: FloorPlan | null;
  onBuilt: (quote: FirstQuote, plan: FloorPlan) => void;
  /** Questions already put to this customer, so a fourth build is a fourth question. */
  seenQuestions?: readonly string[];
  onAsked?: (questionId: string) => void;
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
        carpetAreaAssumed: request.carpetAreaAssumed,
        bathrooms: request.bathrooms,
        scope: request.scope,
        kitchenRunMm: usedPlan.kitchenRunMm,
        runSource: runSourceOf(usedPlan),
      },
      /* The studio's own filed rates when the server resolved them, and the
         placeholder table otherwise. The fallback is not defensive tidiness:
         most of the roster has not filed an archive yet, and this component
         also runs on a journey restored from storage where no server pass
         happened. See `resolve-rates.ts` for why the two coexist. */
      filedRates ?? filedRatesFor(request.studioSlug),
    );
    setQuote(built);
    setPhase('done');
    onBuilt(built, usedPlan);
  }, [usedPlan, request, onBuilt, filedRates]);

  if (phase === 'gate') return <Gate onReady={start} bhk={request.bhk} />;
  if (phase === 'building' || !quote || !usedPlan) {
    return (
      <Building
        studioName={request.studioName}
        stages={stagesFor({
          bhk: request.bhk,
          measured: usedPlan !== null && runSourceOf(usedPlan) === 'customer',
          ratesAreReal: ratesAreReal(),
        })}
        onDone={finish}
        seenQuestions={seenQuestions}
        onAsked={onAsked}
      />
    );
  }
  return <QuoteDocument quote={quote} studioName={request.studioName} plan={usedPlan} />;
}
