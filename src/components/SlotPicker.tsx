'use client';

import { slotLabel } from '@/modules/consultation/slots';

/** The next ten days, one row per day, each open half-hour a button. */
export function SlotPicker({
  slots,
  value,
  onPick,
}: {
  slots: string[];
  value: string | null;
  onPick: (iso: string) => void;
}) {
  const days = new Map<string, string[]>();
  for (const iso of slots) {
    const { day } = slotLabel(iso);
    days.set(day, [...(days.get(day) ?? []), iso]);
  }
  return (
    <div className="flex flex-col gap-4">
      {[...days.entries()].map(([day, times]) => (
        <div key={day}>
          <p className="oi-label m-0 mb-2">{day}</p>
          <div className="flex flex-wrap gap-2">
            {times.map((iso) => {
              const on = value === iso;
              return (
                <button
                  key={iso}
                  type="button"
                  aria-pressed={on}
                  onClick={() => onPick(iso)}
                  className="oi-num min-h-11 cursor-pointer rounded-full border px-4 py-2 text-[13.5px] transition-colors"
                  style={{
                    borderColor: on ? 'var(--acc)' : 'var(--line)',
                    background: on ? 'var(--acc-wash)' : 'transparent',
                    color: on ? 'var(--acc-ink)' : 'var(--ink)',
                  }}
                >
                  {slotLabel(iso).time}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
