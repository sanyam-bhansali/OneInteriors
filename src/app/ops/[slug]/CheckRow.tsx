'use client';

import { useActionState, useState } from 'react';
import { recordCheckAction } from './actions';
import type { CheckResult, CheckType } from '@/modules/studio/types';
import type { RecordResult } from '@/modules/verification/record';

const RESULTS: Array<{ value: CheckResult; label: string; tone: string }> = [
  { value: 'PASS', label: 'Pass', tone: 'text-[var(--color-ontrack)]' },
  { value: 'PENDING', label: 'Pending', tone: 'text-[var(--color-brass)]' },
  { value: 'FAIL', label: 'Fail', tone: 'text-[var(--color-atrisk)]' },
  { value: 'NOT_APPLICABLE', label: 'N/A', tone: 'text-[var(--color-ink-3)]' },
];

const GLYPH: Record<CheckResult, string> = {
  PASS: '●',
  PENDING: '◍',
  FAIL: '✕',
  EXPIRED: '◍',
  NOT_APPLICABLE: '–',
};

const TONE: Record<CheckResult, string> = {
  PASS: 'text-[var(--color-ontrack)]',
  PENDING: 'text-[var(--color-brass)]',
  FAIL: 'text-[var(--color-atrisk)]',
  EXPIRED: 'text-[var(--color-atrisk)]',
  NOT_APPLICABLE: 'text-[var(--color-ink-3)]',
};

export function CheckRow({
  studioId,
  slug,
  type,
  label,
  result,
  source,
  notes,
  checkedAt,
  expired,
  isLast,
}: {
  studioId: string;
  slug: string;
  type: CheckType;
  label: string;
  result: CheckResult;
  source: string | null;
  notes: string | null;
  checkedAt: string | null;
  expired: boolean;
  isLast: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState<RecordResult | null, FormData>(
    async (prev, fd) => {
      const r = await recordCheckAction(prev, fd);
      if (r.ok) setOpen(false);
      return r;
    },
    null,
  );

  const shown: CheckResult = expired ? 'EXPIRED' : result;

  return (
    <li className={isLast ? '' : 'border-b border-[var(--color-rule-soft)]'}>
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-2.5">
        <span className="flex items-center gap-2.5 text-[14px] text-[var(--color-ink)]">
          <span className={`text-[12px] leading-none ${TONE[shown]}`} title={shown}>
            <span aria-hidden="true">{GLYPH[shown]}</span>
            <span className="sr-only">{shown}</span>
          </span>
          {label}
        </span>

        <span className="flex items-center gap-3">
          <span className="font-[family-name:var(--font-mono)] text-[11.5px] text-[var(--color-ink-3)]">
            {source ?? '—'}
            {checkedAt
              ? ` · ${new Date(checkedAt).toLocaleDateString('en-IN', {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                })}`
              : ''}
          </span>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            className="rounded-full border border-[var(--color-rule)] px-3 py-1 font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.1em] text-[var(--color-ink-2)] transition-colors hover:border-[var(--color-petrol)]"
          >
            {open ? 'Cancel' : 'Record'}
          </button>
        </span>
      </div>

      {open ? (
        <form
          action={action}
          className="flex flex-col gap-3 border-t border-[var(--color-rule-soft)] bg-[var(--color-paper-2)] px-4 py-4"
        >
          <input type="hidden" name="studioId" value={studioId} />
          <input type="hidden" name="slug" value={slug} />
          <input type="hidden" name="type" value={type} />

          <fieldset className="m-0 border-0 p-0">
            <legend className="label m-0 mb-2">Result</legend>
            <div className="flex flex-wrap gap-2">
              {RESULTS.map((r) => (
                <label
                  key={r.value}
                  className="flex cursor-pointer items-center gap-2 rounded-full border border-[var(--color-rule)] bg-[var(--color-paper)] px-3.5 py-2 text-[13.5px] has-[:checked]:border-[var(--color-petrol)] has-[:checked]:bg-[var(--color-petrol-soft)]"
                >
                  <input
                    type="radio"
                    name="result"
                    value={r.value}
                    defaultChecked={r.value === result}
                    required
                    className="accent-[var(--color-petrol)]"
                  />
                  <span className={r.tone}>{r.label}</span>
                </label>
              ))}
            </div>
          </fieldset>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
            <div>
              <label htmlFor={`source-${type}`} className="label m-0 mb-1.5 block">
                Source — published
              </label>
              <input
                id={`source-${type}`}
                name="source"
                required
                defaultValue={source ?? ''}
                placeholder="GST portal / Our team / IDfy"
                className="w-full rounded-full border border-[var(--color-rule)] bg-[var(--color-paper)] px-4 py-2 text-[14px]"
              />
            </div>
            <div>
              <label htmlFor={`notes-${type}`} className="label m-0 mb-1.5 block">
                Detail — also published
              </label>
              <input
                id={`notes-${type}`}
                name="notes"
                defaultValue={notes ?? ''}
                placeholder="3 past clients contacted by phone"
                className="w-full rounded-full border border-[var(--color-rule)] bg-[var(--color-paper)] px-4 py-2 text-[14px]"
              />
            </div>
          </div>

          {state && !state.ok ? (
            <p role="alert" className="m-0 text-[13.5px] text-[var(--color-atrisk)]">
              {state.error}
            </p>
          ) : null}

          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={pending}
              className="rounded-full bg-[var(--color-petrol)] px-5 py-2 text-[14px] font-medium text-[var(--color-paper)] disabled:opacity-40"
            >
              {pending ? 'Saving…' : 'Save'}
            </button>
            <span className="text-[12.5px] text-[var(--color-ink-3)]">
              Recorded against your name, and the tier recomputes.
            </span>
          </div>
        </form>
      ) : null}
    </li>
  );
}
