'use client';

import Link from 'next/link';

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

import { QuotePlan, roomAnchor } from './QuotePlan';
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
import { DocRow, Flag } from './index';
import { Mark } from '@/components/brand';
import { Arrow, PillButton, Split } from '@/components/home/parts';
import { advanceIsHigh, phaseAmounts, type PaymentPhase } from '@/modules/studio/payment-phases';
import { useLang, useSiteT } from '@/components/app/i18n';
import { OI_DICT, roomName } from '@/modules/i18n/site/oi';
import { known } from '@/modules/i18n/site/expert';

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

/*
 * The landing's look, carried through (owner, 10 Oct 2026): soft rounded
 * cards with no hairline boxes, one sans with tabular figures for money,
 * small uppercase labels, totals set large and medium-weight like the
 * landing's live price, black pills for the actions. The classes used here
 * are styled under `.cb`; on /match that is FlowShell, and on a studio's page
 * StudioQuotePanel carries `cb cb-part` itself.
 */

/** A small section label — the landing's eyebrow, without its 18px margin. */
function Label({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <p className={`m-0 text-[12px] font-medium uppercase leading-snug tracking-[0.08em] text-[var(--ink-2)] ${className}`}>
      {children}
    </p>
  );
}

/**
 * The landing's dark pill for a label too long for one line on a phone
 * ("Price it now on a standard 2 BHK kitchen"). `.pill` never wraps, so this
 * keeps its fill and shape and lets the words wrap; no rolling label, which
 * only works on one line.
 */
function LongPill({ children, onClick }: { children: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="pill pill-dark"
      style={{ whiteSpace: 'normal', height: 'auto', minHeight: 52, padding: '14px 26px', textAlign: 'left', lineHeight: 1.3, maxWidth: '100%' }}
    >
      <span className="mag-inner">
        <span>{children}</span>
        <Arrow />
      </span>
    </button>
  );
}

// ── The gate ────────────────────────────────────────────────────

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
  const t = useSiteT(OI_DICT);
  const [runMm, setRunMm] = useState('');

  const typed = Number(runMm);
  const runIsSane = Number.isFinite(typed) && typed >= 1500 && typed <= 9000;
  const standardRun = standardKitchenRunMm(bhk);

  return (
    <div className="flow-card mx-auto max-w-[38rem]">
      <p className="eyebrow">{t('gate.eyebrow')}</p>
      <Split className="h-m" text={t('gate.h2')} auto />
      <p className="m-0 mb-7 mt-4 text-[15.5px] leading-[1.6] text-[var(--ink-2)]">
        {t('gate.body', { bhk })}
      </p>

      {/* One press, first. Most people are not standing in their kitchen with
          a tape measure, and the alternative to this button is not a better
          quote — it is no quote and a closed tab. */}
      <LongPill onClick={() => onReady({ fileName: null, kitchenRunMm: standardRun, source: 'standard' })}>
        {t('gate.standard', { bhk })}
      </LongPill>
      <p className="m-0 mt-3 text-[13px] leading-snug text-[var(--ink-2)]">
        {t('gate.standardNote', { mm: standardRun.toLocaleString('en-IN'), bhk })}
      </p>

      <div className="mt-6 rounded-[var(--r-m)] bg-[var(--paper)] p-5">
        <label className="mb-2 block">
          <Label className="mb-3">{t('gate.own')}</Label>
          <input
            inputMode="numeric"
            value={runMm}
            onChange={(e) => setRunMm(e.target.value.replace(/\D/g, ''))}
            placeholder={t('gate.placeholder')}
            className="flow-input"
          />
        </label>
        <p className="m-0 mb-4 text-[13px] leading-snug text-[var(--ink-2)]">
          {t('gate.measureHelp')}
        </p>

        {/* Says what is missing rather than sitting greyed out — a disabled
            button is a puzzle that says no without saying why. */}
        {runIsSane ? (
          <PillButton tone="line" onClick={() => onReady({ fileName: null, kitchenRunMm: typed, source: 'customer' })}>
            {t('gate.build', { mm: typed.toLocaleString('en-IN') })}
          </PillButton>
        ) : runMm ? (
          <p className="m-0 text-[13px] text-[var(--ink-2)]">
            {t('gate.outside')}
          </p>
        ) : null}
      </div>
    </div>
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
  const t = useSiteT(OI_DICT);
  const lang = useLang();
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
    <div className="flow-card">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-x-8 gap-y-5">
        {/* The studio's own name and mark on top — the quote is theirs, priced
            on their rates. Our mark is at the foot, as the platform that
            built it (the owner's format, 29 Sep; studio logos arrive with the
            studio profile, until then their initials). */}
        <div className="flex items-start gap-4">
          <span
            aria-hidden="true"
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[var(--paper)] text-[15px] font-medium text-[var(--ink)]"
          >
            {studioName
              .split(/\s+/)
              .map((w) => w[0])
              .join('')
              .slice(0, 2)
              .toUpperCase()}
          </span>
          <div className="min-w-0">
            <Label className="mb-2">{t('doc.eyebrow')}</Label>
            <h2 className="h-m">{studioName}</h2>
            {preparedFor ? (
              <p className="m-0 mt-2 text-[14px] text-[var(--ink-2)]">{t('doc.preparedFor', { name: preparedFor })}</p>
            ) : null}
          </div>
        </div>
        {/* The total, set like the landing's live price. */}
        <div className="text-left sm:text-right">
          <p className="m-0 whitespace-nowrap text-[clamp(1.9rem,1.2rem+2.4vw,3.1rem)] font-medium leading-none tracking-[-0.04em] tabular-nums">
            {money(quote.totalPaise)}
          </p>
          <p className="m-0 mt-2 text-[13px] tabular-nums text-[var(--ink-2)]">
            {money(quote.lowPaise)}–{money(quote.highPaise)} · ±
            {Math.round(quote.variancePct * 100)}%
          </p>
        </div>
      </div>

      {/* The honesty band. It is the first thing under the total on purpose. */}
      {!ratesAreReal() ? (
        <p className="m-0 mb-6">
          <Flag>
            {t('doc.archive')}
          </Flag>
        </p>
      ) : null}

      {bandLine ? (
        <p className="m-0 mb-7 max-w-[62ch] rounded-[var(--r-m)] bg-[var(--paper)] px-4 py-3 text-[14px] leading-[1.6] text-[var(--ink)]">
          {bandLine}
        </p>
      ) : null}

      <QuotePlan quote={quote} />

      {quote.rooms.map((room) => (
        <section
          key={room.room}
          id={roomAnchor(room.room)}
          className="mb-3 scroll-mt-24 rounded-[var(--r-m)] bg-[var(--paper)] px-[clamp(16px,2.4vw,24px)] pb-2 pt-5"
        >
          {/* The room heading was a 10.5px mono label, the same size as the
              smallest thing on the page. It is a heading; it now reads like
              one. */}
          <div className="mb-1 flex items-baseline justify-between gap-4">
            <h3 className="m-0 text-[19px] font-medium tracking-[-0.02em]">{roomName(lang, room.room, room.label)}</h3>
            <span className="text-[17px] font-medium tabular-nums tracking-[-0.02em]">{money(room.subtotalPaise)}</span>
          </div>

          {room.lines.map((line) => (
            <DocRow
              key={line.code}
              label={line.label}
              // Size and quantity, never the rate: a studio's per-unit rate is not
              // shown on any customer screen (the owner, 30 Sep 2026).
              quantity={line.unit === 'unit' ? line.size : `${line.size}  ·  ${line.quantity.toLocaleString('en-IN')} ${line.unit}`}
              value={money(line.amountPaise)}
              note={
                line.addedFor ? (
                  <>
                    <Spec text={line.spec} onPick={setTerm} />
                    <span className="mt-0.5 block text-[12.5px] text-[var(--accent-ink)]">{line.addedFor}</span>
                  </>
                ) : (
                  <Spec text={line.spec} onPick={setTerm} />
                )
              }
            />
          ))}
        </section>
      ))}

      {/* The commercial terms, identical for every studio on the roster —
          written as a sum, each step signed, so the total can be checked
          by eye (principle 5, docs/UX-PRINCIPLES-PLAN.md; Wise). "Before
          GST" is the total less GST, not a re-addition, so the two can
          never disagree by a rounding paisa. */}
      <div className="mt-8 rounded-[var(--r-m)] bg-[var(--paper)] px-[clamp(16px,2.4vw,24px)] pb-3 pt-5">
        <Label className="mb-1">{t('doc.howMade')}</Label>
        <DocRow label={t('doc.work', { n: quote.lines.length })} value={money(quote.modularPaise + quote.nonModularPaise)} />
        <p className="m-0 -mt-1 mb-1 text-[12.5px] text-[var(--ink-2)]">
          {t('doc.split', { factory: money(quote.modularPaise), site: money(quote.nonModularPaise) })}
        </p>
        <DocRow label={t('doc.fee')} value={money(quote.professionalFeePaise)} />
        <DocRow
          label={t('doc.factoryDiscount')}
          value={`−${money(quote.modularDiscountPaise)}`}
          better
        />
        {quote.curatedDiscountPaise ? (
          <DocRow
            label={t('doc.curatedDiscount', { pct: quote.curatedDiscountPct ?? 0 })}
            value={`−${money(quote.curatedDiscountPaise)}`}
            better
          />
        ) : null}
        <DocRow label={t('doc.beforeGst')} value={money(quote.totalPaise - quote.gstPaise)} />
        <DocRow label={t('doc.gst')} value={money(quote.gstPaise)} />
      </div>
      {/* The sum the rows above add up to — the landing's live-price block:
          black, the figure large and medium-weight. Printed as ink on white,
          because a browser drops backgrounds when it prints. */}
      <div className="mt-2 flex flex-wrap items-end justify-between gap-x-6 gap-y-2 rounded-[var(--r-m)] bg-[var(--ink)] px-[clamp(18px,2.6vw,28px)] py-5 text-white print:bg-transparent print:px-0 print:text-[var(--ink)]">
        <span className="text-[15px] font-medium">{t('doc.total')}</span>
        <span className="whitespace-nowrap text-[clamp(1.9rem,1.2rem+2.4vw,3.1rem)] font-medium leading-none tracking-[-0.04em] tabular-nums">
          {money(quote.totalPaise)}
        </span>
      </div>

      {quote.notPriced.length > 0 ? (
        <p className="m-0 mt-6">
          <Flag>
            {t(quote.notPriced.length === 1 ? 'doc.notPricedOne' : 'doc.notPricedMany', { n: quote.notPriced.length })}
          </Flag>
        </p>
      ) : null}

      <div className="mt-9">
        <Label className="mb-3">{t('doc.builtOn')}</Label>
        <ul className="m-0 flex list-none flex-col gap-2 p-0">
          {quote.assumptions.map((line) => (
            <li key={line} className="text-[14px] leading-[1.6] text-[var(--ink-2)]">
              {line}
            </li>
          ))}
          <li className="text-[14px] leading-[1.6] text-[var(--ink-2)]">
            {runSourceOf(plan) === 'customer'
              ? t('doc.runMeasured')
              : t('doc.runStandard')}
          </li>
        </ul>
      </div>

      {/* When money moves. Each studio's own phases, from its quotations or
          its profile — never a schedule we invented for it. */}
      <div className="mt-9">
        <Label className="mb-2">{t('doc.phases')}</Label>
        {paymentPhases ? (
          <>
            {phaseAmounts(paymentPhases, quote.totalPaise).map((p, i) => (
              <DocRow key={`${p.label}-${i}`} label={`${p.label} · ${p.pct}%`} value={money(p.amountPaise)} />
            ))}
            {advanceIsHigh(paymentPhases) ? (
              <p className="m-0 mt-3 text-[14px] leading-[1.6] text-[var(--ink-2)]">
                {t('doc.advanceHigh', { studio: studioName, pct: paymentPhases[0]!.pct })}
              </p>
            ) : null}
          </>
        ) : (
          <p className="m-0 text-[14px] leading-[1.6] text-[var(--ink-2)]">
            {t('doc.noPhases', { studio: studioName })}
          </p>
        )}
      </div>

      {onMeasured && runSourceOf(plan) === 'standard' ? (
        <MeasureKitchen onMeasured={onMeasured} />
      ) : null}

      <p className="m-0 mt-7 text-[13px] text-[var(--ink-2)] print:hidden">
        {t('doc.underlined')}
      </p>

      {/* Printed too: quotes get forwarded and carried into studio meetings,
          and the PDF is where a customer is most likely to go direct. */}
      <div className="mt-7 rounded-[var(--r-m)] bg-[var(--paper)] p-[clamp(16px,2.4vw,24px)]">
        <p className="m-0 mb-1.5 text-[16px] font-medium tracking-[-0.01em] text-[var(--ink)]">
          {t('doc.keep')}
        </p>
        <p className="m-0 text-[14px] leading-[1.6] text-[var(--ink-2)]">
          {showcase().map((b) => known(lang, `benefit.${b.id}.short`, b.short)).join(' · ')}.{' '}
          <span className="hidden print:inline">
            {t('doc.printCta', { studio: studioName })}
          </span>
        </p>
        {/* On screen it is a link, not an address to type (review, 8 Oct).
            A sentence, so a link rather than a pill — it has to wrap. */}
        <Link
          href="/expert"
          className="mt-3 inline-block text-[15px] font-medium text-[var(--ink)] underline decoration-[var(--accent)] underline-offset-4 print:hidden"
        >
          {t('doc.cta', { studio: studioName })}
        </Link>
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
        <p className="m-0 flex items-center gap-2 text-[13px] text-[var(--ink-2)]">
          <Mark className="h-[14px] w-[14px] text-[var(--ink)]" />
          {t('doc.powered')}
        </p>
        <span className="print:hidden">
          <PillButton tone="line" onClick={() => window.print()}>
            {t('doc.print')}
          </PillButton>
        </span>
      </div>

      <MaterialPanel material={term} onClose={() => setTerm(null)} />
    </div>
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
  const t = useSiteT(OI_DICT);
  const [value, setValue] = useState('');
  const n = Number(value);
  const ok = Number.isFinite(n) && n >= 1500 && n <= 9000;
  return (
    <div className="mt-7 rounded-[var(--r-m)] bg-[var(--paper)] p-[clamp(16px,2.4vw,24px)] print:hidden">
      <Label className="mb-2">{t('measure.label')}</Label>
      <p className="m-0 mb-4 text-[14px] leading-[1.6] text-[var(--ink-2)]">
        {t('measure.body')}
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <span className="w-full max-w-[14rem]">
          <input
            inputMode="numeric"
            value={value}
            onChange={(e) => setValue(e.target.value.replace(/\D/g, ''))}
            placeholder={t('measure.placeholder')}
            className="flow-input"
          />
        </span>
        {ok ? (
          <PillButton onClick={() => onMeasured(Math.round(n))}>{t('measure.reprice')}</PillButton>
        ) : value ? (
          <span className="text-[13px] text-[var(--ink-2)]">{t('measure.range')}</span>
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
