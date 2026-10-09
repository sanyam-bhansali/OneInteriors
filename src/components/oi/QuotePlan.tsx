'use client';

/**
 * Walk the quote on your floor plan (build queue item 25): a schematic of the
 * flat, each room carrying its subtotal; tap one and the page takes you to
 * that room's lines. A schematic, and labelled as one — the rooms sit where
 * a typical Pune flat puts them, not where their plan does.
 */

import type { FirstQuote } from '@/modules/quotation/first-quote';
import { formatINRCompact } from '@/lib/money';
import { useLang, useSiteT } from '@/components/app/i18n';
import { OI_DICT, roomName } from '@/modules/i18n/site/oi';
import { ROOM_TX, lbl } from '@/modules/i18n/site/labels';

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
  const t = useSiteT(OI_DICT);
  const lang = useLang();
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
        <span className="text-[12.5px] font-semibold text-[var(--ink)]">{r ? roomName(lang, r.room, r.label) : label}</span>
        <span className="oi-num text-[12px] text-[var(--ink2)]">{r ? formatINRCompact(r.subtotalPaise) : t('plan.notIn')}</span>
      </button>
    );
  };
  return (
    <div className="mb-8 print:hidden">
      <p className="oi-label m-0 mb-2">{t('plan.label')}</p>
      <div
        className="grid h-[15rem] gap-1.5"
        style={{
          gridTemplateColumns: '1fr 1fr 1fr',
          gridTemplateRows: '1fr 1fr 1fr',
          gridTemplateAreas: '"master living living" "second living living" "third bath kitchen"',
        }}
      >
        {cell('MASTER_BEDROOM', lbl(lang, ROOM_TX, 'MASTER_BEDROOM'))}
        {cell('SECOND_BEDROOM', lbl(lang, ROOM_TX, 'SECOND_BEDROOM'))}
        {cell('THIRD_BEDROOM', lbl(lang, ROOM_TX, 'THIRD_BEDROOM'))}
        {cell('LIVING_DINING', lbl(lang, ROOM_TX, 'LIVING_DINING'))}
        {cell('BATHROOMS', lbl(lang, ROOM_TX, 'BATHROOMS'))}
        {cell('KITCHEN', lbl(lang, ROOM_TX, 'KITCHEN'))}
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
              {roomName(lang, r.room, r.label)} · {formatINRCompact(r.subtotalPaise)}
            </button>
          ))}
        </p>
      ) : null}
      <p className="m-0 mt-1.5 text-[11px] text-[var(--ink2)]">{t('plan.schematic')}</p>
    </div>
  );
}
