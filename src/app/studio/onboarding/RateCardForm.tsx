'use client';

import { useActionState } from 'react';
import { RATE_CATEGORIES, CATEGORY, CORE_CATEGORIES } from '@/modules/quotation/categories';
import { saveRatesAction, type StepState } from './actions';
import { SaveBar } from './fields';

const INITIAL: StepState = { status: 'idle' };

export function RateCardForm({ values }: { values: Record<string, number | null> }) {
  const [state, action, pending] = useActionState(saveRatesAction, INITIAL);
  const err = state.errors ?? {};

  return (
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
              <RateField key={c} category={c} value={values[c] ?? null} error={err[c]} />
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
              <RateField key={c} category={c} value={values[c] ?? null} error={err[c]} />
            ))}
          </div>
        </div>

        <SaveBar pending={pending} saved={state.status === 'saved'} formError={err.form} label="Save rates" />
      </form>
    </div>
  );
}

function RateField({
  category,
  value,
  error,
}: {
  category: string;
  value: number | null;
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
          defaultValue={value ?? undefined}
          placeholder="—"
          aria-invalid={Boolean(error)}
          className="w-40 rounded-full border border-[var(--color-rule)] bg-[var(--color-paper-2)] px-5 py-2.5 text-[15px] tabular-nums text-[var(--color-ink)]"
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
