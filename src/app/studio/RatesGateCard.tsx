'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { confirmRatesAction } from './products/actions';
import type { State } from './form-state';

/**
 * Where a studio's rates are, and the one thing to do about it.
 *
 * Shown on Quotations (the builder is shut until confirm), on Product master
 * (where the checking happens, so the confirm button lives here) and on the
 * dashboard. The wording comes from `RATES_GATE_COPY` so the three never say
 * different things.
 */
export function RatesGateCard({
  gate,
  title,
  body,
  where,
}: {
  gate: 'WITH_US' | 'TO_CHECK';
  title: string;
  body: string;
  /** 'products' shows the confirm button; anywhere else links to Product master. */
  where: 'products' | 'elsewhere';
}) {
  const [state, confirm, pending] = useActionState<State | null>(confirmRatesAction, null);

  return (
    <div
      className={`s-card mb-6 border-l-[3px] p-5 ${
        gate === 'TO_CHECK' ? '!border-l-[var(--s-good)]' : '!border-l-[var(--s-warn)]'
      }`}
    >
      <p className="m-0 mb-2 text-[14.5px] font-semibold">{title}</p>
      <p className="m-0 max-w-[68ch] text-[14px] leading-relaxed text-[var(--s-ink-2)]">{body}</p>

      {gate === 'TO_CHECK' ? (
        where === 'products' ? (
          <form action={confirm} className="mt-4 flex flex-wrap items-center gap-3">
            <button type="submit" disabled={pending} className="s-btn s-btn-primary">
              {pending ? 'Confirming…' : 'These rates are right — open the builder'}
            </button>
            <span className="text-[13px] text-[var(--s-ink-3)]">
              You can still change any figure afterwards.
            </span>
          </form>
        ) : (
          <Link href="/studio/products" className="s-btn s-btn-primary mt-4 inline-flex">
            Check your rates
          </Link>
        )
      ) : null}

      {state && 'error' in state ? (
        <p role="alert" className="m-0 mt-3 text-[13.5px] text-[var(--s-bad)]">
          {state.error}
        </p>
      ) : null}
    </div>
  );
}
