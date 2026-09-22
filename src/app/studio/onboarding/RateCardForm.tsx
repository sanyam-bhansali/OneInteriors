'use client';

import { useActionState, useState } from 'react';
import { RATE_CATEGORIES, CATEGORY, CORE_CATEGORIES } from '@/modules/quotation/categories';
import { saveRatesAction, type StepState } from './actions';
import { SaveBar } from './fields';
import { QuotePreview } from './QuotePreview';

const INITIAL: StepState = { status: 'idle' };

/**
 * The six numbers that make a quote.
 *
 * ## Why this survived a redesign that asked for it to be deleted
 *
 * The brief for this step said to remove the per-square-foot rates
 * completely, as internal costing that does not belong in onboarding. They
 * are not internal costing. `generate.ts` calls `rateCardFor(studioId)` and
 * prices the customer's actual work with them; a studio whose rates do not
 * cover the job is skipped from the comparison with a reason. These six
 * numbers are the entire mechanism by which a first quote arrives in three
 * seconds without anybody being phoned, which is the product.
 *
 * So the page changed and the table stayed. Positioning — what you sell and
 * where you sit — now comes first, because that is what the studio thinks
 * they are being asked and it is quick. This follows, framed as what it
 * actually is rather than as a cost sheet.
 *
 * ## It is collapsed once it is filled in
 *
 * Six numbers somebody has already entered do not need to be the tallest
 * thing on the screen every time they come back to change their price level.
 * Open while anything is missing, shut when it is done, and openable either
 * way — never hidden, because a studio must always be able to see what we
 * will quote on their behalf.
 */
export function RateCardForm({ values }: { values: Record<string, number | null> }) {
  const [state, action, pending] = useActionState(saveRatesAction, INITIAL);
  const err = state.errors ?? {};

  /**
   * The rates, held here so the preview can price them as they are typed.
   *
   * Controlled only because something watches them. Every other input in this
   * flow stays uncontrolled for the reason ProfileForm gives — a render
   * between the keystroke and the character is a cost with no return — and
   * here there is a return: the quote beside the form moves.
   */
  const [rupees, setRupees] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      RATE_CATEGORIES.map((c) => [c, values[c] != null ? String(values[c]) : '']),
    ),
  );

  const missingCore = CORE_CATEGORIES.filter((c) => values[c] == null).length;

  return (
    <details open={missingCore > 0} className="oi-sec rounded-[16px] border border-[var(--color-rule)] bg-[var(--color-paper)]">
      <summary className="flex cursor-pointer flex-wrap items-center justify-between gap-3 px-6 py-5">
        <span className="min-w-0">
          <span className="block text-[15.5px] font-semibold text-[var(--color-ink)]">
            What we quote on your behalf
          </span>
          <span className="block text-[13.5px] leading-relaxed text-[var(--color-ink-2)]">
            Six rates. They are what turns a customer&rsquo;s brief into a figure in about three
            seconds, without anybody phoning you.
          </span>
        </span>
        <span
          className={`flex-none rounded-full px-3 py-1 text-[12.5px] font-medium ${
            missingCore === 0
              ? 'bg-[var(--color-ontrack-soft)] text-[var(--color-ontrack)]'
              : 'bg-[var(--color-brass-soft)] text-[var(--color-brass)]'
          }`}
        >
          {missingCore === 0 ? 'All six in' : `${missingCore} still needed`}
        </span>
      </summary>

    <div className="grid gap-6 px-6 pb-6 xl:grid-cols-[minmax(0,1fr)_18rem] xl:gap-8">
      <div className="flex flex-col gap-8">
      <div className="rounded-[12px] border border-[var(--color-rule)] bg-[var(--color-paper-3)] p-6">
        <p className="label m-0 mb-2">Read this first</p>
        <p className="m-0 mb-3 max-w-[62ch] text-[14.5px] leading-relaxed text-[var(--color-ink-2)]">
          <strong>Your rates are private.</strong> No customer sees them, no other studio sees
          them, and we never publish them. What a customer sees is a total, built from your
          numbers and our estimate of how much work their home needs.
        </p>
        <p className="m-0 mb-3 max-w-[62ch] text-[14.5px] leading-relaxed text-[var(--color-ink-2)]">
          <strong>We do not set your prices.</strong> Nothing here is pre-filled, there is no
          suggested figure, and we will never nudge you toward one. Every rate on this page is
          yours.
        </p>
        <p className="m-0 max-w-[62ch] text-[14.5px] leading-relaxed text-[var(--color-ink-2)]">
          Quote your normal all-in rate, the one you would give a client directly. A quote that
          undercuts your real pricing to win a match is a project you will resent and a variance
          we will publish.
        </p>
      </div>

      <form action={action} className="flex flex-col gap-7">
        <div>
          <p className="h3 mb-1">Needed to quote</p>
          <p className="m-0 mb-5 max-w-[56ch] text-[14px] leading-relaxed text-[var(--color-ink-3)]">
            All six. Without them we cannot produce a quote for you, and a studio a customer
            cannot get a quote from does not appear in their results.
          </p>
          <div className="flex flex-col gap-5">
            {CORE_CATEGORIES.map((c) => (
              <RateField
                key={c}
                category={c}
                value={rupees[c] ?? ''}
                onChange={(v) => setRupees((prev) => ({ ...prev, [c]: v }))}
                error={err[c]}
              />
            ))}
          </div>
        </div>

        <div className="border-t border-[var(--color-rule)] pt-7">
          <p className="h3 mb-1">Only when the job needs it</p>
          <p className="m-0 mb-5 max-w-[56ch] text-[14px] leading-relaxed text-[var(--color-ink-3)]">
            Leave any of these blank if you do not do that work. A blank rate means the line is
            excluded from your quote and the customer is told it was excluded — it never silently
            reads as free.
          </p>
          <div className="flex flex-col gap-5">
            {RATE_CATEGORIES.filter((c) => !CATEGORY[c].core).map((c) => (
              <RateField
                key={c}
                category={c}
                value={rupees[c] ?? ''}
                onChange={(v) => setRupees((prev) => ({ ...prev, [c]: v }))}
                error={err[c]}
              />
            ))}
          </div>
        </div>

        <SaveBar pending={pending} saved={state.status === 'saved'} formError={err.form} label="Save and continue" />
      </form>
      </div>

      {/* Beside the boxes, not below them. The whole value is watching a
          number move while you change the one that moves it. */}
      <div className="xl:sticky xl:top-8 xl:self-start">
        <QuotePreview rupees={rupees} />
      </div>
    </div>
    </details>
  );
}

function RateField({
  category,
  value,
  onChange,
  error,
}: {
  category: string;
  value: string;
  onChange: (v: string) => void;
  error?: string;
}) {
  const definition = CATEGORY[category as keyof typeof CATEGORY];
  const isPercent = definition.unit === 'percent';

  const suffix = isPercent
    ? '%'
    : definition.unit === 'lumpsum'
      ? 'total'
      : `per ${definition.unit}`;

  return (
    <div>
      <label htmlFor={category} className="label m-0 mb-1.5 block">
        {definition.label}
      </label>
      <p className="m-0 mb-2 max-w-[54ch] text-[13.5px] leading-snug text-[var(--color-ink-3)]">
        {definition.hint}
      </p>
      <div className="flex items-center gap-3">
        <span className="font-[family-name:var(--font-mono)] text-[15px] text-[var(--color-ink-3)]">
          {isPercent ? '' : '₹'}
        </span>
        <input
          id={category}
          name={category}
          type="number"
          step={isPercent ? '0.25' : '1'}
          min="0"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="—"
          aria-invalid={Boolean(error)}
          className="oi-input w-40 rounded-full border border-[var(--color-rule)] px-5 py-2.5 text-[15px] tabular-nums text-[var(--color-ink)]"
        />
        <span className="text-[14px] text-[var(--color-ink-3)]">{suffix}</span>
      </div>
      {error ? (
        <p role="alert" className="m-0 mt-1.5 text-[13.5px] text-[var(--color-atrisk)]">
          {error}
        </p>
      ) : null}
    </div>
  );
}
