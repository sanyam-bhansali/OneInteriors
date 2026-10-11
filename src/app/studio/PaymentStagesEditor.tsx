'use client';

/**
 * Editing payment stages (Studio OS Phase 1): the studio's template in
 * Settings, and the sales final's own copy on a quotation. One row per
 * stage — its name, what the client gets, a fixed amount or a percent — with
 * the total of the percentages and, when there is a contract figure, each
 * stage in rupees, so the studio sees exactly what the client will be asked
 * for. The checks are the same pure ones the server runs.
 */

import { formatINR } from '@/lib/money';
import { checkStages, scheduleAmounts, type PaymentStage } from '@/modules/studio-sales/payment-template';
import { inputClass, quietClass } from './SalesUi';

export function PaymentStagesEditor({
  stages,
  onChange,
  totalPaise,
}: {
  stages: PaymentStage[];
  onChange: (next: PaymentStage[]) => void;
  /** The contract, for the rupee preview. */
  totalPaise?: number | null;
}) {
  const set = (i: number, patch: Partial<PaymentStage>) => onChange(stages.map((s, j) => (j === i ? { ...s, ...patch } : s)));
  const remove = (i: number) => onChange(stages.filter((_, j) => j !== i));
  const move = (i: number, by: number) => {
    const j = i + by;
    if (j < 0 || j >= stages.length) return;
    const next = [...stages];
    [next[i], next[j]] = [next[j]!, next[i]!];
    onChange(next);
  };
  const pctTotal = stages.filter((s) => s.kind === 'PCT').reduce((n, s) => n + (s.pct ?? 0), 0);
  const problem = checkStages(stages);
  const amounts = totalPaise && totalPaise > 0 && !problem ? scheduleAmounts(stages, totalPaise) : null;

  return (
    <div className="flex flex-col gap-2.5">
      <ol className="m-0 flex list-none flex-col gap-2.5 p-0">
        {stages.map((s, i) => (
          <li key={i} className="rounded-[10px] bg-[var(--s-surface-2)] p-3">
            <div className="flex flex-wrap items-end gap-2">
              <span className="s-num mb-2 w-5 text-[12.5px] text-[var(--s-ink-3)]">{i + 1}.</span>
              <label className="flex min-w-[10rem] flex-1 flex-col gap-1">
                <span className="s-label">Stage</span>
                <input value={s.label} onChange={(e) => set(i, { label: e.target.value })} className={inputClass} />
              </label>
              <label className="flex flex-col gap-1">
                <span className="s-label">How much</span>
                <select
                  value={s.kind}
                  onChange={(e) =>
                    set(i, e.target.value === 'FIXED' ? { kind: 'FIXED', amountPaise: s.amountPaise ?? 2_500_000, pct: undefined } : { kind: 'PCT', pct: s.pct ?? 5, amountPaise: undefined })
                  }
                  className={`${inputClass} w-auto`}
                >
                  <option value="PCT">A percent</option>
                  <option value="FIXED">A fixed amount</option>
                </select>
              </label>
              {s.kind === 'FIXED' ? (
                <label className="flex flex-col gap-1">
                  <span className="s-label">₹</span>
                  <input
                    inputMode="numeric"
                    value={s.amountPaise ? String(Math.round(s.amountPaise / 100)) : ''}
                    onChange={(e) => {
                      const n = Number(e.target.value.replace(/[^\d]/g, ''));
                      set(i, { amountPaise: Number.isFinite(n) ? n * 100 : 0 });
                    }}
                    className={`${inputClass} s-num w-[8rem] text-right`}
                  />
                </label>
              ) : (
                <label className="flex flex-col gap-1">
                  <span className="s-label">%</span>
                  <input
                    inputMode="decimal"
                    value={s.pct ?? ''}
                    onChange={(e) => {
                      const n = Number(e.target.value);
                      set(i, { pct: Number.isFinite(n) ? n : 0 });
                    }}
                    className={`${inputClass} s-num w-[5.5rem] text-right`}
                  />
                </label>
              )}
              {amounts?.ok ? <span className="s-num mb-2 text-[13px] font-semibold">{formatINR(amounts.stages[i]!.amountPaise)}</span> : null}
            </div>
            <div className="mt-2 flex flex-wrap items-end gap-2 pl-7">
              <label className="flex min-w-[12rem] flex-1 flex-col gap-1">
                <span className="s-label">What the client gets in this stage</span>
                <input value={s.note} onChange={(e) => set(i, { note: e.target.value })} className={inputClass} />
              </label>
              {i === 0 ? (
                <label className="flex flex-col gap-1">
                  <span className="s-label">Refundable for (days)</span>
                  <input
                    inputMode="numeric"
                    value={s.refundDays ?? ''}
                    onChange={(e) => {
                      const v = e.target.value.replace(/[^\d]/g, '');
                      set(i, { refundDays: v === '' ? null : Number(v) });
                    }}
                    className={`${inputClass} s-num w-[5.5rem] text-right`}
                  />
                </label>
              ) : null}
              <div className="mb-1 flex gap-1 text-[12.5px]">
                <button type="button" onClick={() => move(i, -1)} disabled={i === 0} className="px-1.5 text-[var(--s-ink-3)] disabled:opacity-30" aria-label="Move up">
                  ↑
                </button>
                <button type="button" onClick={() => move(i, 1)} disabled={i === stages.length - 1} className="px-1.5 text-[var(--s-ink-3)] disabled:opacity-30" aria-label="Move down">
                  ↓
                </button>
                <button type="button" onClick={() => remove(i)} disabled={stages.length <= 1} className="px-1.5 text-[var(--s-ink-3)] hover:text-[var(--s-bad)] disabled:opacity-30">
                  Remove
                </button>
              </div>
            </div>
          </li>
        ))}
      </ol>
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" onClick={() => onChange([...stages, { label: '', note: '', kind: 'PCT', pct: 0 }])} disabled={stages.length >= 10} className={quietClass}>
          + Add a stage
        </button>
        <span className={`text-[13px] ${Math.round(pctTotal * 100) === 10_000 ? 'text-[var(--s-good)]' : 'text-[var(--s-ink-2)]'}`}>
          Percentages add up to {Math.round(pctTotal * 100) / 100}% {Math.round(pctTotal * 100) === 10_000 ? '— good' : '(they must make 100%)'}
        </span>
      </div>
      <p className="m-0 text-[12.5px] leading-relaxed text-[var(--s-ink-3)]">
        Fixed amounts (like the booking advance) come off the contract first; the percentages are of what is left. The first stage is what is paid to book.
      </p>
      {problem ? (
        <p role="alert" className="m-0 text-[13px] text-[var(--s-bad)]">
          {problem}
        </p>
      ) : amounts && !amounts.ok ? (
        <p role="alert" className="m-0 text-[13px] text-[var(--s-bad)]">
          {amounts.error}
        </p>
      ) : null}
    </div>
  );
}
