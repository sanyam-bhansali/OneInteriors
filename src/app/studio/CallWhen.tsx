'use client';

import { useState } from 'react';
import { QUICK_LABELS, istInputs, quickAt, whenLabel, type QuickWhen } from '@/modules/studio-sales/call-schedule';
import { inputClass } from './SalesUi';

export interface CallWhenValue {
  mode: QuickWhen;
  /** IST `YYYY-MM-DD` and `HH:MM`, filled for every mode. */
  day: string;
  time: string;
}

/** The value for a quick choice, now. */
export function callWhen(mode: QuickWhen, now = new Date(), picked?: { day: string; time: string }): CallWhenValue {
  const at = quickAt(mode, now);
  return at ? { mode, ...istInputs(at) } : { mode, day: picked?.day ?? istInputs(now).day, time: picked?.time ?? '' };
}

/**
 * When to call next (AxLeads, 12 Oct 2026): Later today (5:30 pm, or two
 * hours from now after 3:30), Tomorrow (next working day, 3:30 pm — the
 * default), or Pick a date & time. Each button says the time it will set.
 */
export function CallWhen({ value, onChange, label = 'When to call' }: { value: CallWhenValue; onChange: (v: CallWhenValue) => void; label?: string }) {
  const [now] = useState(() => new Date());
  return (
    <fieldset className="m-0 flex flex-col gap-1.5 border-0 p-0">
      <legend className="s-label mb-1.5">{label}</legend>
      <div role="radiogroup" className="flex flex-wrap gap-1.5">
        {(['later-today', 'tomorrow', 'pick'] as const).map((m) => {
          const at = quickAt(m, now);
          const on = value.mode === m;
          return (
            <button
              key={m}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => onChange(callWhen(m, now, { day: value.day, time: value.time }))}
              className={`rounded-full border px-3 py-1 text-[13px] ${on ? 'border-[var(--s-accent)] bg-[var(--s-accent)] text-white' : 'border-[var(--s-rule)] hover:border-[var(--s-ink-3)]'}`}
            >
              {QUICK_LABELS[m]}
              {at ? <span className={on ? 'text-white/80' : 'text-[var(--s-ink-3)]'}> · {whenLabel(at, now).replace(/^(Today|Tomorrow) /, '')}</span> : null}
            </button>
          );
        })}
      </div>
      {value.mode === 'pick' ? (
        <div className="flex flex-wrap items-center gap-1.5">
          <input type="date" aria-label="Day" value={value.day} onChange={(e) => onChange({ ...value, day: e.target.value })} className={`${inputClass} w-auto py-1.5`} />
          <input type="time" aria-label="Time" value={value.time} onChange={(e) => onChange({ ...value, time: e.target.value })} className={`${inputClass} w-auto py-1.5`} />
        </div>
      ) : null}
    </fieldset>
  );
}
