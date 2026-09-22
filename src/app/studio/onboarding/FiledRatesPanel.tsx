'use client';

import { ITEM } from '@/modules/quotation/catalogue';
import {
  ANALYSIS_COPY,
  CONFIDENCE_COPY,
  MIN_QUOTATIONS_TO_START,
  isAnalysisState,
  type FiledRateView,
} from '@/modules/quotation/analysis-states';
import { formatINR } from '@/lib/money';

/**
 * What we read out of a studio's own quotations, shown back to them.
 *
 * ## Why this is the answer to "what do you charge"
 *
 * The six per-square-foot boxes that used to be here asked a studio to
 * summarise their entire pricing as six numbers, from memory, in a form. They
 * did it badly — not through carelessness but because nobody prices that way,
 * and the number you give when asked cold is not the number on your last
 * twenty quotations.
 *
 * So the question changed. A studio sends the quotations they have already
 * written, and their rates are derived from what they actually charged. The
 * boxes remain underneath for anybody who would rather type, and for the
 * lines an archive did not cover.
 *
 * ## It never claims more than it has
 *
 * Every rate carries how many quotations it came from, because a studio can
 * file forty of which three mention a mandir — and a rate from three quotes
 * is one designer's mood. `fromQuotations` is per rate for exactly that
 * reason, and the thin ones say so rather than sitting in a table looking as
 * settled as the rest.
 *
 * And nothing here is in force. "Waiting on us" is the honest label: a person
 * checks these against the documents before a customer is priced at them.
 */
export function FiledRatesPanel({
  analysisState,
  rates,
  filesHeld,
}: {
  analysisState: string;
  rates: FiledRateView[];
  filesHeld: number;
}) {
  const state = isAnalysisState(analysisState) ? analysisState : 'NOT_STARTED';
  const copy = ANALYSIS_COPY[state];

  const live = rates.filter((r) => r.state === 'LIVE');
  const pending = rates.filter((r) => r.state === 'PENDING');

  /**
   * Nothing sent, nothing derived — so nothing to say.
   *
   * It reported "Not read yet · 0 files held" to studios who had sent
   * nothing and, on a deployment without storage, had no way to send
   * anything. A status line about work that cannot begin is worse than
   * silence: it implies something is in progress and invites the question
   * "where do I upload?", which is what it got.
   *
   * The panel above this one makes the offer. This one reports on it, and
   * only once there is something to report.
   */
  if (filesHeld === 0 && rates.length === 0) return null;

  return (
    <div className="flex flex-col gap-4">
      <div
        className={`flex flex-wrap items-start justify-between gap-x-6 gap-y-2 rounded-[12px] px-5 py-4 ${
          state === 'READ' || live.length > 0
            ? 'bg-[var(--color-ontrack-soft)]'
            : state === 'FAILED'
              ? 'bg-[var(--color-brass-soft)]'
              : 'bg-[var(--color-paper-2)]'
        }`}
      >
        <div className="min-w-0">
          <p className="m-0 text-[15px] font-semibold text-[var(--color-ink)]">{copy.label}</p>
          <p className="m-0 mt-0.5 max-w-[60ch] text-[13.5px] leading-relaxed text-[var(--color-ink-2)]">
            {copy.detail}
          </p>
        </div>
        <p className="m-0 flex-none font-[family-name:var(--font-mono)] text-[12px] tabular-nums text-[var(--color-ink-2)]">
          {filesHeld} {filesHeld === 1 ? 'file' : 'files'} held
        </p>
      </div>

      {filesHeld > 0 && filesHeld < MIN_QUOTATIONS_TO_START ? (
        /* Said as arithmetic, not as a refusal. Reading starts at twenty and
           a studio who has sent six should know they are six from twenty
           rather than discovering later that nothing happened. */
        <p className="m-0 text-[13.5px] leading-relaxed text-[var(--color-ink-2)]">
          {MIN_QUOTATIONS_TO_START - filesHeld} more and we have enough to work out your rates
          from. Fewer than {MIN_QUOTATIONS_TO_START} and a median is one project rather than how
          you price.
        </p>
      ) : null}

      {pending.length > 0 ? (
        <RateTable
          title={`${pending.length} ${pending.length === 1 ? 'rate' : 'rates'} read from your quotations`}
          note="Waiting on a person here. Nothing is priced at these until somebody has checked them against your documents."
          rows={pending}
        />
      ) : null}

      {live.length > 0 ? (
        <RateTable
          title={`${live.length} ${live.length === 1 ? 'rate' : 'rates'} in force`}
          note="These are what a customer's first quote is built from. Send a newer archive whenever your pricing moves."
          rows={live}
          live
        />
      ) : null}
    </div>
  );
}

function RateTable({
  title,
  note,
  rows,
  live,
}: {
  title: string;
  note: string;
  rows: FiledRateView[];
  live?: boolean;
}) {
  return (
    <div className="rounded-[12px] border border-[var(--color-rule)]">
      <div className="border-b border-[var(--color-rule)] px-5 py-3.5">
        <p className="m-0 text-[14.5px] font-semibold text-[var(--color-ink)]">
          {title}
          {live ? (
            <span className="ml-2 rounded-full bg-[var(--color-ontrack-soft)] px-2.5 py-0.5 text-[11.5px] font-medium text-[var(--color-ontrack)]">
              Live
            </span>
          ) : null}
        </p>
        <p className="m-0 mt-0.5 max-w-[62ch] text-[13px] leading-relaxed text-[var(--color-ink-2)]">
          {note}
        </p>
      </div>

      <ul className="m-0 flex list-none flex-col p-0">
        {rows.map((rate) => {
          const item = ITEM[rate.code];
          return (
            <li
              key={rate.id}
              className="flex flex-wrap items-baseline justify-between gap-x-5 gap-y-1 border-b border-[var(--color-rule-soft)] px-5 py-3 last:border-b-0"
            >
              <span className="min-w-0 flex-1">
                <span className="block text-[14.5px] text-[var(--color-ink)]">
                  {/* A code we have since retired still has to render — the
                      rate was real when it was filed. */}
                  {item?.label ?? rate.code}
                </span>
                {rate.spec ? (
                  /* Their own words for the material, which is the only place
                     two studios visibly differ on something but price. */
                  <span className="block truncate text-[12.5px] text-[var(--color-ink-3)]">
                    {rate.spec}
                  </span>
                ) : null}
              </span>

              <span
                className="flex-none text-[12px] text-[var(--color-ink-3)]"
                title={CONFIDENCE_COPY[rate.confidence]}
              >
                {rate.fromQuotations === 1
                  ? 'from 1 quote'
                  : `from ${rate.fromQuotations} quotes`}
                {rate.confidence === 'thin' ? (
                  <span className="ml-1.5 text-[var(--color-brass)]">· thin</span>
                ) : null}
              </span>

              <span className="flex-none font-[family-name:var(--font-mono)] text-[14px] tabular-nums text-[var(--color-ink)]">
                {formatINR(rate.ratePaise)}
                <span className="ml-1 text-[11.5px] text-[var(--color-ink-3)]">
                  {item ? unitLabel(item.sizing) : ''}
                </span>
              </span>

              {rate.note ? (
                <span className="w-full text-[12.5px] leading-relaxed text-[var(--color-ink-2)]">
                  {rate.note}
                </span>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** Reads off `Sizing`, so a new sizing shows nothing rather than the wrong unit. */
function unitLabel(sizing: string): string {
  if (sizing === 'AREA') return '/sqft of face';
  if (sizing === 'UNIT') return ' each';
  if (sizing === 'PER_SQFT_CARPET') return '/sqft carpet';
  if (sizing === 'PER_BATHROOM') return '/bath';
  return '';
}
