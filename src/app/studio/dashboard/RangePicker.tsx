'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { RANGE_LABELS, parseRange, rangeToString, type RangePreset } from '@/modules/studio-sales/ist-range';

const PRESETS: RangePreset[] = ['today', '7d', '30d', 'month'];

const input =
  'rounded-[8px] border border-[var(--s-rule)] bg-[var(--s-surface)] px-2.5 py-1.5 text-[13.5px] text-[var(--s-ink)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--s-accent)]';

/** Today · 7 days · 30 days · This month · Pick dates — writes `?range=` (India days). */
export function RangePicker({ value }: { value: string }) {
  const router = useRouter();
  const current = parseRange(value);
  const [custom, setCustom] = useState(typeof current === 'object' && current !== null);
  const go = (v: string) => router.push(`/studio/dashboard?range=${encodeURIComponent(v)}`);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div role="group" aria-label="Date range" className="flex overflow-hidden rounded-[8px] border border-[var(--s-rule)] text-[13px] font-medium">
        {PRESETS.map((p) => (
          <button
            key={p}
            type="button"
            aria-pressed={!custom && current === p}
            onClick={() => {
              setCustom(false);
              go(p);
            }}
            className={`px-3 py-1.5 ${!custom && current === p ? 'bg-[var(--s-accent)] text-white' : 'hover:bg-[var(--s-rail-active)]'}`}
          >
            {p === '7d' ? '7 days' : p === '30d' ? '30 days' : RANGE_LABELS[p]}
          </button>
        ))}
        <button type="button" aria-pressed={custom} onClick={() => setCustom(true)} className={`px-3 py-1.5 ${custom ? 'bg-[var(--s-accent)] text-white' : 'hover:bg-[var(--s-rail-active)]'}`}>
          Pick dates
        </button>
      </div>
      {custom ? (
        <form
          className="flex items-center gap-1.5"
          onSubmit={(e) => {
            e.preventDefault();
            const d = new FormData(e.currentTarget);
            const r = parseRange(`${String(d.get('from') ?? '')}..${String(d.get('to') || d.get('from') || '')}`);
            if (r) go(rangeToString(r));
          }}
        >
          <input name="from" type="date" aria-label="From" required defaultValue={typeof current === 'object' && current ? current.from : ''} className={input} />
          <span className="text-[13px] text-[var(--s-ink-3)]">to</span>
          <input name="to" type="date" aria-label="To" defaultValue={typeof current === 'object' && current ? current.to : ''} className={input} />
          <button type="submit" className="rounded-[8px] border border-[var(--s-rule)] px-3 py-1.5 text-[13px] font-medium hover:border-[var(--s-ink-3)]">
            Show
          </button>
        </form>
      ) : null}
    </div>
  );
}
