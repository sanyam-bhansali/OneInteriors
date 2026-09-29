'use client';

/**
 * Walk the quote on your floor plan (build queue item 25): a schematic of the
 * flat, each room carrying its subtotal; tap one and the page takes you to
 * that room's lines. A schematic, and labelled as one — the rooms sit where
 * a typical Pune flat puts them, not where their plan does.
 */

import type { FirstQuote } from '@/modules/quotation/first-quote';
import { formatINRCompact } from '@/lib/money';

const AREAS: Record<string, string> = {
  MASTER_BEDROOM: 'master',
  SECOND_BEDROOM: 'second',
  THIRD_BEDROOM: 'third',
  LIVING_DINING: 'living',
  KITCHEN: 'kitchen',
  BATHROOMS: 'bath',
};

export function roomAnchor(room: string): string {
  return `quote-room-${room.toLowerCase()}`;
}

export function QuotePlan({ quote }: { quote: FirstQuote }) {
  const byRoom = new Map(quote.rooms.map((r) => [r.room, r]));
  const whole = quote.rooms.filter((r) => !AREAS[r.room]);
  const cell = (room: string, label: string) => {
    const r = byRoom.get(room as FirstQuote['rooms'][number]['room']);
    return (
      <button
        key={room}
        type="button"
        disabled={!r}
        onClick={() => document.getElementById(roomAnchor(room))?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
        style={{ gridArea: AREAS[room] }}
        className={`flex flex-col justify-between rounded-[6px] border p-2.5 text-left transition-colors ${
          r
            ? 'cursor-pointer border-[var(--ink2)] bg-[var(--card)] hover:border-[var(--acc)] hover:bg-[var(--acc-wash)]'
            : 'cursor-default border-dashed border-[var(--line)] bg-transparent opacity-50'
        }`}
      >
        <span className="text-[12.5px] font-semibold text-[var(--ink)]">{r?.label ?? label}</span>
        <span className="oi-num text-[12px] text-[var(--ink2)]">{r ? formatINRCompact(r.subtotalPaise) : 'Not in this quote'}</span>
      </button>
    );
  };
  return (
    <div className="mb-8 print:hidden">
      <p className="oi-label m-0 mb-2">Your home, room by room — tap a room to see its lines</p>
      <div
        className="grid h-[15rem] gap-1.5"
        style={{
          gridTemplateColumns: '1fr 1fr 1fr',
          gridTemplateRows: '1fr 1fr 1fr',
          gridTemplateAreas: '"master living living" "second living living" "third bath kitchen"',
        }}
      >
        {cell('MASTER_BEDROOM', 'Master bedroom')}
        {cell('SECOND_BEDROOM', 'Second bedroom')}
        {cell('THIRD_BEDROOM', 'Third bedroom')}
        {cell('LIVING_DINING', 'Living & dining')}
        {cell('BATHROOMS', 'Bathrooms')}
        {cell('KITCHEN', 'Kitchen')}
      </div>
      {whole.length > 0 ? (
        <p className="m-0 mt-2 flex flex-wrap gap-x-4 text-[12.5px] text-[var(--ink2)]">
          {whole.map((r) => (
            <button
              key={r.room}
              type="button"
              onClick={() => document.getElementById(roomAnchor(r.room))?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
              className="cursor-pointer border-0 bg-transparent p-0 text-[12.5px] text-[var(--ink2)] underline"
            >
              {r.label} · {formatINRCompact(r.subtotalPaise)}
            </button>
          ))}
        </p>
      ) : null}
      <p className="m-0 mt-1.5 text-[11px] text-[var(--ink2)]">A schematic of a typical layout, not your floor plan.</p>
    </div>
  );
}
