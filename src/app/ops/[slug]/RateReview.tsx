'use client';

import { useActionState, useState } from 'react';
import { approveRatesAction, rejectRateAction, type RateDecision } from './actions';
// Values AND types from the pure module, never from the `server-only` store —
// see tests/server-only-boundary.test.ts for what that costs.
import {
  CONFIDENCE_COPY,
  MIN_QUOTATIONS_TO_START,
  type FiledRateView,
} from '@/modules/quotation/analysis-states';
import { ITEM } from '@/modules/quotation/catalogue';
import { formatINR } from '@/lib/money';

/**
 * The rates a machine read out of a studio's quotations, before anybody is
 * priced at them.
 *
 * ## Why this screen exists at all
 *
 * Because the alternative is a model reading a smudged PDF and a homeowner
 * being quoted the result. Everything upstream of here is careful — amounts
 * outside a believable band are discarded, subtotals are refused, every rate
 * carries its sample size — and none of that is a substitute for somebody
 * opening the documents and looking. Nothing reaches a customer on the
 * strength of an extraction.
 *
 * ## What it is built to make easy
 *
 * One judgement: does this number look like what that studio charges? So the
 * thin rates are marked, sorted to the top, and carry the count that makes
 * them thin. A screen that showed twenty identical-looking rows would get one
 * glance and a click, which is the same as not having a review at all.
 *
 * ## Approve is all-or-nothing, refuse is one at a time
 *
 * The comparison screen puts studios side by side on identical lines, so a
 * studio priced half from this archive and half from one eighteen months ago
 * is being compared on a blend nobody chose. Refuse the bad ones first, then
 * approve what is left — `approveRates` carries the full reasoning.
 */
export function RateReview({
  archiveId,
  rates,
  quotationsRead,
}: {
  archiveId: string;
  rates: FiledRateView[];
  quotationsRead: number | null;
}) {
  const [state, action, pending] = useActionState<RateDecision | null, FormData>(
    approveRatesAction,
    null,
  );

  if (rates.length === 0) return null;

  /* Thin first. The whole point of the screen is the rates that need a
     second look, and they are the ones that would be scrolled past. */
  const order = { thin: 0, fair: 1, solid: 2 } as const;
  const sorted = [...rates].sort(
    (a, b) => order[a.confidence] - order[b.confidence] || a.code.localeCompare(b.code),
  );
  const thin = rates.filter((r) => r.confidence === 'thin').length;
  const shortArchive = quotationsRead !== null && quotationsRead < MIN_QUOTATIONS_TO_START;

  return (
    <div className="rounded-[12px] border border-[var(--color-rule)] bg-[var(--color-paper)] p-5">
      <div className="mb-4">
        <p className="label m-0 mb-1">Derived rates — not live</p>
        <p className="m-0 max-w-[68ch] text-[13.5px] leading-relaxed text-[var(--color-ink-2)]">
          {rates.length} {rates.length === 1 ? 'rate' : 'rates'} read out of{' '}
          {quotationsRead ?? 'an unknown number of'}{' '}
          {quotationsRead === 1 ? 'quotation' : 'quotations'}. Open the files above and check them
          before approving — once these are live, every first quote we produce for this studio is
          built from them.
        </p>
      </div>

      {thin > 0 ? (
        <p className="m-0 mb-3 rounded-[10px] border border-[var(--color-brass)]/35 bg-[var(--color-brass-soft)] px-4 py-2.5 text-[13.5px] leading-relaxed text-[var(--color-ink)]">
          {thin === 1 ? 'One rate rests' : `${thin} rates rest`} on fewer than five quotations, and{' '}
          {thin === 1 ? 'is' : 'are'} listed first. A median from that few is one designer&rsquo;s
          mood rather than how the studio prices.
        </p>
      ) : null}

      {shortArchive ? (
        <p className="m-0 mb-3 text-[13px] leading-relaxed text-[var(--color-ink-2)]">
          This archive is {quotationsRead} quotations, under the {MIN_QUOTATIONS_TO_START} we
          normally want. Worth approving only if you have read most of them.
        </p>
      ) : null}

      <ul className="m-0 mb-4 flex list-none flex-col p-0">
        {sorted.map((rate) => (
          <RateRow key={rate.id} rate={rate} />
        ))}
      </ul>

      <form action={action} className="border-t border-[var(--color-rule)] pt-4">
        <input type="hidden" name="archiveId" value={archiveId} />
        <div className="flex flex-wrap items-center gap-4">
          <button
            type="submit"
            disabled={pending}
            className="inline-flex items-center justify-center rounded-full bg-[var(--color-petrol)] px-6 py-2.5 text-[14px] font-medium text-[var(--color-paper)] transition-colors hover:bg-[var(--color-petrol-deep)] disabled:cursor-not-allowed disabled:opacity-40"
          >
            {pending ? 'Putting them live…' : `Approve all ${rates.length} and go live`}
          </button>
          <span className="text-[13px] text-[var(--color-ink-3)]">
            Refuse any bad ones above first — this approves what is left.
          </span>
        </div>

        {state ? (
          <p
            role="alert"
            className={`m-0 mt-3 text-[13.5px] ${
              state.ok ? 'text-[var(--color-ontrack)]' : 'text-[var(--color-atrisk)]'
            }`}
          >
            {state.ok ? state.message : state.error}
          </p>
        ) : null}
      </form>
    </div>
  );
}

function RateRow({ rate }: { rate: FiledRateView }) {
  const [state, action, pending] = useActionState<RateDecision | null, FormData>(
    rejectRateAction,
    null,
  );
  const [refusing, setRefusing] = useState(false);
  const item = ITEM[rate.code];

  /* A refused row stays on screen with its reason rather than vanishing.
     Ops needs to see what they have already dealt with before approving the
     remainder, and a list that shrinks under you is a list you lose your
     place in. */
  const refused = state?.ok === true;

  return (
    <li
      className={`flex flex-wrap items-baseline gap-x-4 gap-y-1 border-b border-[var(--color-rule-soft)] py-2.5 last:border-b-0 ${
        refused ? 'opacity-50' : ''
      }`}
    >
      <span className="min-w-0 flex-1">
        <span className="block text-[14px] text-[var(--color-ink)]">
          {item?.label ?? rate.code}
          {refused ? <span className="ml-2 text-[12px] text-[var(--color-atrisk)]">refused</span> : null}
        </span>
        {rate.spec ? (
          <span className="block truncate text-[12px] text-[var(--color-ink-3)]">{rate.spec}</span>
        ) : null}
      </span>

      <span
        className={`flex-none text-[12px] ${
          rate.confidence === 'thin' ? 'text-[var(--color-brass)]' : 'text-[var(--color-ink-3)]'
        }`}
        title={CONFIDENCE_COPY[rate.confidence]}
      >
        {rate.fromQuotations === 1 ? 'from 1 quote' : `from ${rate.fromQuotations} quotes`}
      </span>

      <span className="flex-none font-[family-name:var(--font-mono)] text-[14px] tabular-nums text-[var(--color-ink)]">
        {formatINR(rate.ratePaise)}
        <span className="ml-1 text-[11px] text-[var(--color-ink-3)]">
          {item ? unitLabel(item.sizing) : ''}
        </span>
      </span>

      {refused ? null : refusing ? (
        <form action={action} className="flex w-full flex-wrap items-center gap-2 pt-1.5">
          <input type="hidden" name="rateId" value={rate.id} />
          <input
            name="note"
            placeholder="Why — the studio reads this"
            autoFocus
            className="min-w-[18rem] flex-1 rounded-full border border-[var(--color-rule)] bg-[var(--color-paper-2)] px-4 py-1.5 text-[13px]"
          />
          <button
            type="submit"
            disabled={pending}
            className="rounded-full bg-[var(--color-atrisk)] px-4 py-1.5 text-[12.5px] font-medium text-white disabled:opacity-40"
          >
            {pending ? 'Refusing…' : 'Refuse'}
          </button>
          <button
            type="button"
            onClick={() => setRefusing(false)}
            className="text-[12.5px] text-[var(--color-ink-3)] underline underline-offset-2"
          >
            Cancel
          </button>
          {state && !state.ok ? (
            <span role="alert" className="w-full text-[12.5px] text-[var(--color-atrisk)]">
              {state.error}
            </span>
          ) : null}
        </form>
      ) : (
        <button
          type="button"
          onClick={() => setRefusing(true)}
          className="flex-none text-[12.5px] text-[var(--color-ink-3)] underline underline-offset-2 hover:text-[var(--color-atrisk)]"
        >
          Refuse
        </button>
      )}
    </li>
  );
}

function unitLabel(sizing: string): string {
  if (sizing === 'AREA') return '/sqft of face';
  if (sizing === 'UNIT') return ' each';
  if (sizing === 'PER_SQFT_CARPET') return '/sqft carpet';
  if (sizing === 'PER_BATHROOM') return '/bath';
  return '';
}
