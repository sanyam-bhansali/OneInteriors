'use client';

import { useState, useTransition } from 'react';
import { approveDraftRunAction, rejectDraftAction, setDraftRateAction } from './actions';

export interface DraftRowView {
  id: string;
  name: string;
  code: 'MODULAR' | 'ONSITE';
  unit: 'AREA' | 'SQFT' | 'RFT' | 'UNIT';
  details: string | null;
  ratePaise: number;
  rooms: string[];
  inStandardBuild: boolean;
  fromQuotations: number;
  /** What the studio's product master has under this name now, in paise. */
  current: number | null;
}

const UNIT: Record<DraftRowView['unit'], string> = {
  AREA: '/ sq ft (W×H)',
  SQFT: '/ sq ft',
  RFT: '/ running ft',
  UNIT: '/ unit',
};

const inr = (paise: number) => `₹${Math.round(paise / 100).toLocaleString('en-IN')}`;

/**
 * The product master read from a studio's quotations, waiting for ops.
 *
 * Written by the owner's local read (`/read-quotations`), never by the web
 * app. Ops can correct a figure or drop a line, then approves the run in one
 * go — which writes it into the studio's product master and asks the studio
 * to check it (product-drafts.ts). A line read from very few quotations is
 * marked, so a guess does not pass as a rate.
 */
export function DraftReview({
  studioId,
  slug,
  runId,
  readAt,
  rows,
}: {
  studioId: string;
  slug: string;
  runId: string;
  readAt: string;
  rows: DraftRowView[];
}) {
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const [dropped, setDropped] = useState<Set<string>>(new Set());
  const live = rows.filter((r) => !dropped.has(r.id));
  const thin = live.filter((r) => r.fromQuotations < 8).length;

  const approve = () =>
    start(async () => {
      const r = await approveDraftRunAction(studioId, slug, runId);
      setMessage(r.ok ? { ok: true, text: r.message } : { ok: false, text: r.error });
    });

  return (
    <div className="rounded-md border border-[var(--color-rule)] p-4">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <p className="m-0 text-[14px] font-semibold">
          {live.length} products read from their quotations
        </p>
        <p className="m-0 text-[12px] text-[var(--color-ink-3)]">
          Read {new Date(readAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
          {thin > 0 ? ` · ${thin} from fewer than 8 quotations` : ''}
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-[13px]">
          <thead>
            <tr className="text-left text-[11.5px] uppercase tracking-[0.08em] text-[var(--color-ink-3)]">
              <th className="py-2 pr-3 font-medium">Product</th>
              <th className="py-2 pr-3 font-medium">Work</th>
              <th className="py-2 pr-3 font-medium">Rate</th>
              <th className="py-2 pr-3 font-medium">Now</th>
              <th className="py-2 pr-3 font-medium">Seen in</th>
              <th className="py-2 font-medium" />
            </tr>
          </thead>
          <tbody>
            {rows.map((r) =>
              dropped.has(r.id) ? null : (
                <DraftLine key={r.id} row={r} onDropped={() => setDropped((s) => new Set(s).add(r.id))} />
              ),
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={approve}
          disabled={pending || live.length === 0}
          className="rounded-full bg-[var(--color-petrol)] px-5 py-2 text-[13.5px] font-medium text-[var(--color-paper)] disabled:opacity-40"
        >
          {pending ? 'Approving…' : `Approve all ${live.length} into their product master`}
        </button>
        <span className="text-[12.5px] text-[var(--color-ink-3)]">
          The studio is then asked to check them; their builder opens when they confirm.
        </span>
      </div>
      {message ? (
        <p role="status" className={`m-0 mt-3 text-[13px] ${message.ok ? 'text-[var(--color-ontrack)]' : 'text-[var(--color-atrisk)]'}`}>
          {message.text}
        </p>
      ) : null}
    </div>
  );
}

function DraftLine({ row, onDropped }: { row: DraftRowView; onDropped: () => void }) {
  const [rupees, setRupees] = useState(String(Math.round(row.ratePaise / 100)));
  const [saved, setSaved] = useState<string | null>(null);
  const [, start] = useTransition();

  const save = () =>
    start(async () => {
      const value = Number(rupees.replace(/[^\d.]/g, ''));
      const r = await setDraftRateAction(row.id, value);
      setSaved(r.ok ? 'saved' : r.error);
    });

  const drop = () =>
    start(async () => {
      const r = await rejectDraftAction(row.id, '');
      if (r.ok) onDropped();
      else setSaved(r.error);
    });

  return (
    <tr className="border-t border-[var(--color-rule)] align-top">
      <td className="py-2 pr-3">
        <span className="font-medium">{row.name}</span>
        {row.inStandardBuild ? (
          <span className="ml-2 rounded-full bg-[var(--color-paper-3)] px-2 py-0.5 text-[10.5px]">standard</span>
        ) : null}
        {row.details ? <span className="mt-0.5 block text-[12px] text-[var(--color-ink-3)]">{row.details}</span> : null}
        {row.rooms.length ? <span className="block text-[11.5px] text-[var(--color-ink-3)]">{row.rooms.join(' · ')}</span> : null}
      </td>
      <td className="py-2 pr-3 whitespace-nowrap">{row.code === 'MODULAR' ? 'Modular' : 'On site'}</td>
      <td className="py-2 pr-3 whitespace-nowrap">
        ₹
        <input
          value={rupees}
          onChange={(e) => {
            setRupees(e.target.value);
            setSaved(null);
          }}
          onBlur={save}
          inputMode="decimal"
          aria-label={`Rate for ${row.name}`}
          className="w-24 border-b border-[var(--color-rule)] bg-transparent px-1 tabular-nums"
        />
        <span className="text-[11.5px] text-[var(--color-ink-3)]"> {UNIT[row.unit]}</span>
        {saved && saved !== 'saved' ? <span className="block text-[11.5px] text-[var(--color-atrisk)]">{saved}</span> : null}
      </td>
      <td className="py-2 pr-3 whitespace-nowrap text-[var(--color-ink-3)]">{row.current !== null ? inr(row.current) : 'new'}</td>
      <td className={`py-2 pr-3 whitespace-nowrap ${row.fromQuotations < 8 ? 'text-[var(--color-brass)]' : ''}`}>
        {row.fromQuotations} quotes
      </td>
      <td className="py-2 text-right">
        <button type="button" onClick={drop} className="text-[12px] text-[var(--color-ink-3)] underline underline-offset-2 hover:text-[var(--color-atrisk)]">
          Drop
        </button>
      </td>
    </tr>
  );
}
