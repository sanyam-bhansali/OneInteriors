'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { RANGE_LABELS, parseRange, rangeToString, type RangePreset } from '@/modules/studio-sales/ist-range';

const PRESETS: RangePreset[] = ['today', '7d', '30d', 'month'];

const input = 'fld sm';

/** Today · 7 days · 30 days · This month · Pick dates — writes `?range=` (India days). */
export function RangePicker({ value }: { value: string }) {
  const router = useRouter();
  const current = parseRange(value);
  const [custom, setCustom] = useState(typeof current === 'object' && current !== null);
  const go = (v: string) => router.push(`/studio/dashboard?range=${encodeURIComponent(v)}`);

  return (
    <div className="hstack">
      <div role="tablist" aria-label="Date range" className="tabs">
        {PRESETS.map((p) => (
          <button
            key={p}
            type="button"
            role="tab"
            aria-selected={!custom && current === p}
            onClick={() => {
              setCustom(false);
              go(p);
            }}
          >
            {p === '7d' ? '7 days' : p === '30d' ? '30 days' : RANGE_LABELS[p]}
          </button>
        ))}
        <button type="button" role="tab" aria-selected={custom} onClick={() => setCustom(true)}>
          Pick dates
        </button>
      </div>
      {custom ? (
        <form
          className="hstack" style={{ gap: 6 }}
          onSubmit={(e) => {
            e.preventDefault();
            const d = new FormData(e.currentTarget);
            const r = parseRange(`${String(d.get('from') ?? '')}..${String(d.get('to') || d.get('from') || '')}`);
            if (r) go(rangeToString(r));
          }}
        >
          <input name="from" type="date" aria-label="From" required defaultValue={typeof current === 'object' && current ? current.from : ''} className={input} />
          <span className="muted sm">to</span>
          <input name="to" type="date" aria-label="To" defaultValue={typeof current === 'object' && current ? current.to : ''} className={input} />
          <button type="submit" className="btn sec sm">
            Show
          </button>
        </form>
      ) : null}
    </div>
  );
}
