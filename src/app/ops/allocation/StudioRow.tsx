'use client';

/**
 * One studio's allocation controls.
 *
 * ## What is deliberately absent
 *
 * There is no "boost", no "priority", no drag handle to reorder studios. The
 * only controls here change how OFTEN a studio is shown — pause it, or record
 * what it can take on. Order within a customer's results is computed from fit
 * by `score.ts`, which cannot see any field on this screen except `pausedAt`,
 * and that one can only ever remove a studio.
 *
 * If that feels like a missing feature, the thing being asked for is either a
 * higher volume cap (which is this screen) or a better-fitting studio (which is
 * the matching engine). It is never a thumb on the scale for one customer's
 * results, because the day that exists the verification tiers stop meaning
 * anything.
 */

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { TierBadge, Pill } from '@/components/ui';
import { capacityAction, pauseAction, resumeAction } from './actions';
import type { VerificationTier } from '@/modules/studio/types';

export interface AllocationRow {
  id: string;
  slug: string;
  tradeName: string;
  tier: VerificationTier;
  status: string;
  pausedAt: string | null;
  pausedReason: string | null;
  pauseCause: 'MANUAL' | 'AT_CAPACITY' | 'PAYMENT_DUE' | null;
  capacityPerMonth: number | null;
  hasRates: boolean;
  /** Times this studio has appeared in a customer's matches, last 30 days. */
  shown: number;
}

export function StudioRow({ row }: { row: AllocationRow }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [asking, setAsking] = useState(false);
  const [capacity, setCapacityValue] = useState(
    row.capacityPerMonth === null ? '' : String(row.capacityPerMonth),
  );

  const paused = row.pausedAt !== null;

  function run(fn: () => Promise<{ ok: true } | { ok: false; error: string }>) {
    setError(null);
    startTransition(async () => {
      const result = await fn();
      if (!result.ok) setError(result.error);
      else setAsking(false);
    });
  }

  return (
    <tr className="border-b border-[var(--color-rule-soft)] align-top last:border-b-0">
      <td className="px-4 py-4">
        <Link
          href={`/ops/${row.slug}`}
          className="font-bold text-[var(--color-ink)] no-underline hover:text-[var(--color-petrol)]"
        >
          {row.tradeName}
        </Link>
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
          <TierBadge tier={row.tier} />
          {row.status !== 'ACTIVE' ? <Pill tone="atrisk">{row.status}</Pill> : null}
          {!row.hasRates ? <Pill tone="atrisk">No rate card</Pill> : null}
        </div>
        {paused ? (
          <p className="m-0 mt-2 max-w-[38ch] text-[12.5px] leading-snug text-[var(--color-atrisk)]">
            {/* Naming who lifts it is the useful half. Ops should not have to
                remember which pauses undo themselves. */}
            {row.pauseCause === 'AT_CAPACITY'
              ? 'Paused — at capacity. Lifts on its own next month.'
              : row.pauseCause === 'PAYMENT_DUE'
                ? 'Paused — payment past due. Lifts when the invoice clears.'
                : `Paused — ${row.pausedReason ?? 'no reason recorded'}`}
          </p>
        ) : null}
      </td>

      {/* Volume actually delivered. The number a studio paying a subscription
          is entitled to see, and the one that predicts churn. */}
      <td className="px-4 py-4 text-right">
        <span className="tabular font-[family-name:var(--font-display)] text-[22px] leading-none text-[var(--color-ink)]">
          {row.shown}
        </span>
        <p className="m-0 mt-1 text-[11.5px] text-[var(--color-ink-3)]">last 30 days</p>
      </td>

      <td className="px-4 py-4">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const trimmed = capacity.trim();
            run(() => capacityAction(row.id, trimmed === '' ? null : Number(trimmed)));
          }}
          className="flex items-center gap-2"
        >
          <input
            type="number"
            min={0}
            max={60}
            value={capacity}
            onChange={(e) => setCapacityValue(e.target.value)}
            aria-label={`Projects a month ${row.tradeName} can take`}
            placeholder="—"
            className="tabular w-20 rounded-[8px] border border-[var(--color-rule)] bg-[var(--color-paper)] px-3 py-2 text-[14px] text-[var(--color-ink)]"
          />
          <button
            type="submit"
            disabled={pending}
            className="rounded-[8px] border border-[var(--color-rule)] px-3 py-2 text-[13px] text-[var(--color-ink-2)] hover:border-[var(--color-ink-3)] disabled:opacity-40"
          >
            Save
          </button>
        </form>
      </td>

      <td className="px-4 py-4">
        {paused ? (
          <button
            type="button"
            disabled={pending}
            onClick={() => run(() => resumeAction(row.id))}
            className="rounded-full bg-[var(--color-petrol)] px-4 py-2 text-[13.5px] text-[var(--color-paper)] disabled:opacity-40"
          >
            {pending ? 'Working…' : 'Put back in rotation'}
          </button>
        ) : asking ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              run(() => pauseAction(row.id, reason));
            }}
            className="flex max-w-[22rem] flex-col gap-2"
          >
            <input
              autoFocus
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Why? They will be told."
              aria-label={`Reason for pausing ${row.tradeName}`}
              className="rounded-[8px] border border-[var(--color-rule)] bg-[var(--color-paper)] px-3 py-2 text-[14px] text-[var(--color-ink)]"
            />
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={pending}
                className="rounded-full bg-[var(--color-atrisk)] px-4 py-2 text-[13.5px] text-white disabled:opacity-40"
              >
                {pending ? 'Working…' : 'Pause'}
              </button>
              <button
                type="button"
                onClick={() => { setAsking(false); setError(null); }}
                className="text-[13.5px] text-[var(--color-ink-3)] underline underline-offset-4"
              >
                Cancel
              </button>
            </div>
          </form>
        ) : (
          <button
            type="button"
            onClick={() => setAsking(true)}
            className="rounded-full border border-[var(--color-rule)] px-4 py-2 text-[13.5px] text-[var(--color-ink-2)] hover:border-[var(--color-ink-3)]"
          >
            Take out of rotation
          </button>
        )}

        {error ? (
          <p className="m-0 mt-2 max-w-[26ch] text-[12.5px] leading-snug text-[var(--color-atrisk)]">
            {error}
          </p>
        ) : null}
      </td>
    </tr>
  );
}
