'use client';

import { useState, useTransition } from 'react';
import { saveRuleAction } from './actions';

const CATEGORIES: { key: string; label: string }[] = [
  { key: 'CARPENTRY', label: 'Carpentry' },
  { key: 'PAINTING', label: 'Painting' },
  { key: 'ELECTRICAL', label: 'Electrical' },
  { key: 'WALLPAPER', label: 'Wallpaper' },
  { key: 'PLUMBING', label: 'Plumbing' },
  { key: 'CIVIL', label: 'False ceiling and tiles' },
  { key: 'OTHER', label: 'Something else' },
];

export interface RuleFields {
  key: string;
  label: string;
  examples: string;
  covered: boolean;
  serviceCategory: string;
  sortOrder: string;
  clientNote: string;
  active: boolean;
}

const EMPTY: RuleFields = { key: '', label: '', examples: '', covered: false, serviceCategory: 'CARPENTRY', sortOrder: '200', clientNote: '', active: true };

/** One coverage rule, editable; with no id, a new one. */
export function RuleForm({ id, initial, claims }: { id: string | null; initial?: RuleFields; claims?: number }) {
  const [f, setF] = useState<RuleFields>(initial ?? EMPTY);
  const [msg, setMsg] = useState<{ ok: boolean; message: string } | null>(null);
  const [pending, go] = useTransition();
  const set = <K extends keyof RuleFields>(k: K, v: RuleFields[K]) => setF({ ...f, [k]: v });
  const field = 'w-full rounded-[10px] border border-[var(--color-rule)] bg-transparent px-3 py-2 text-[14px]';

  return (
    <form
      className={`flex flex-col gap-2 rounded-[14px] border border-[var(--color-rule)] p-4 ${f.active ? '' : 'opacity-60'}`}
      onSubmit={(e) => {
        e.preventDefault();
        go(async () => {
          const r = await saveRuleAction(id, { ...f });
          setMsg(r);
          if (r.ok && !id) setF(EMPTY);
        });
      }}
    >
      <div className="flex flex-wrap items-center gap-3">
        {id ? <b className="font-mono text-[13px]">{f.key}</b> : <input className={`${field} max-w-[16rem] font-mono`} placeholder="KEY_LIKE_THIS" value={f.key} onChange={(e) => set('key', e.target.value)} aria-label="Key" />}
        <label className="flex items-center gap-1.5 text-[13px]">
          <input type="checkbox" checked={f.covered} onChange={(e) => set('covered', e.target.checked)} /> Covered by the warranty
        </label>
        <label className="flex items-center gap-1.5 text-[13px]">
          <input type="checkbox" checked={f.active} onChange={(e) => set('active', e.target.checked)} /> In use
        </label>
        {claims !== undefined ? <span className="text-[12px] text-[var(--color-ink-3)]">{claims} claim{claims === 1 ? '' : 's'}</span> : null}
      </div>
      <input className={field} placeholder="What the client reads, e.g. Hinges, channels and drawer slides" value={f.label} onChange={(e) => set('label', e.target.value)} aria-label="Label" />
      <textarea className={field} rows={2} placeholder="What it looks like, for the photo reader: examples separated by commas" value={f.examples} onChange={(e) => set('examples', e.target.value)} aria-label="Examples" />
      {!f.covered ? (
        <div className="flex flex-wrap items-center gap-2">
          <label className="text-[13px]">
            Book instead{' '}
            <select className="rounded-[10px] border border-[var(--color-rule)] bg-transparent px-2 py-1.5" value={f.serviceCategory} onChange={(e) => set('serviceCategory', e.target.value)}>
              {CATEGORIES.map((c) => (
                <option key={c.key} value={c.key}>
                  {c.label}
                </option>
              ))}
            </select>
          </label>
          <input className={`${field} min-w-[16rem] flex-1`} placeholder="Extra line for the client (optional)" value={f.clientNote} onChange={(e) => set('clientNote', e.target.value)} aria-label="Line for the client" />
        </div>
      ) : null}
      <div className="flex flex-wrap items-center gap-3">
        <label className="text-[13px]">
          Order <input className="w-[5rem] rounded-[10px] border border-[var(--color-rule)] bg-transparent px-2 py-1.5" inputMode="numeric" value={f.sortOrder} onChange={(e) => set('sortOrder', e.target.value)} />
        </label>
        <button type="submit" className="rounded-full bg-[var(--color-ink)] px-4 py-2 text-[13px] text-white disabled:opacity-50" disabled={pending}>
          {id ? 'Save' : 'Add rule'}
        </button>
        {msg ? (
          <span role="status" className={`text-[13px] ${msg.ok ? 'text-[var(--color-ontrack)]' : 'text-[var(--color-atrisk)]'}`}>
            {msg.message}
          </span>
        ) : null}
      </div>
    </form>
  );
}
