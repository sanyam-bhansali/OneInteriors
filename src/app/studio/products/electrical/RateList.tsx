'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type { RateRow } from '@/modules/project/electrical-bill';
import { UNIT_WORDS } from '@/modules/project/electrical-rules';
import { saveRateAction, setRateActiveAction } from './actions';

const inr = (paise: number) => `₹${(paise / 100).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
type Result = { ok: true; message: string } | { ok: false; error: string };

export function RateList({ rows, canEdit }: { rows: RateRow[]; canEdit: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [edit, setEdit] = useState<{ id?: string; name: string; unit: string; details: string; rate: string }>({ name: '', unit: 'point', details: '', rate: '' });
  const run = (fn: () => Promise<Result>, after?: () => void) =>
    start(async () => {
      const r = await fn();
      setMsg(r.ok ? { ok: true, text: r.message } : { ok: false, text: r.error });
      if (r.ok) {
        after?.();
        router.refresh();
      }
    });
  return (
    <section className="card flex flex-col gap-2">
      <table className="w-full text-[13.5px]">
        <thead>
          <tr className="muted text-left">
            <th>Item</th>
            <th>Unit</th>
            <th>Rate</th>
            <th>Description</th>
            {canEdit ? <th /> : null}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={5} className="muted">
                No items yet.{canEdit ? ' Add the first below.' : ''}
              </td>
            </tr>
          ) : null}
          {rows.map((r) => (
            <tr key={r.id} style={r.isActive ? undefined : { opacity: 0.5 }}>
              <td>{r.name}</td>
              <td>{r.unit}</td>
              <td className="mono">{inr(r.ratePaise)}</td>
              <td className="muted">{r.details}</td>
              {canEdit ? (
                <td className="whitespace-nowrap">
                  <button
                    type="button"
                    className="btn ghost sm"
                    onClick={() => setEdit({ id: r.id, name: r.name, unit: r.unit, details: r.details ?? '', rate: String(r.ratePaise / 100) })}
                  >
                    Edit
                  </button>
                  <button type="button" className="btn ghost sm" disabled={pending} onClick={() => run(() => setRateActiveAction(r.id, !r.isActive))}>
                    {r.isActive ? 'Hide' : 'Show'}
                  </button>
                </td>
              ) : null}
            </tr>
          ))}
        </tbody>
      </table>
      {canEdit ? (
        <form
          className="flex flex-wrap items-end gap-2 border-t border-[var(--line)] pt-2"
          onSubmit={(e) => {
            e.preventDefault();
            run(() => saveRateAction(edit), () => setEdit({ name: '', unit: 'point', details: '', rate: '' }));
          }}
        >
          <label className="flex flex-col gap-1 text-[13px]">
            Item
            <input className="fld" value={edit.name} maxLength={120} onChange={(e) => setEdit({ ...edit, name: e.target.value })} placeholder="Light point" required />
          </label>
          <label className="flex flex-col gap-1 text-[13px]">
            Unit
            <input className="fld" list="elec-units" value={edit.unit} maxLength={20} onChange={(e) => setEdit({ ...edit, unit: e.target.value })} required />
            <datalist id="elec-units">
              {UNIT_WORDS.map((u) => (
                <option key={u} value={u} />
              ))}
            </datalist>
          </label>
          <label className="flex flex-col gap-1 text-[13px]">
            Rate (₹ per unit)
            <input className="fld" inputMode="decimal" value={edit.rate} onChange={(e) => setEdit({ ...edit, rate: e.target.value })} placeholder="850" required />
          </label>
          <label className="flex min-w-[14rem] flex-1 flex-col gap-1 text-[13px]">
            Description
            <input className="fld" value={edit.details} maxLength={300} onChange={(e) => setEdit({ ...edit, details: e.target.value })} placeholder="1.5 sq mm FR wire in conduit, modular switch and plate" />
          </label>
          <button type="submit" className="btn pri sm" disabled={pending}>
            {edit.id ? 'Save' : 'Add'}
          </button>
          {edit.id ? (
            <button type="button" className="btn ghost sm" onClick={() => setEdit({ name: '', unit: 'point', details: '', rate: '' })}>
              Cancel
            </button>
          ) : null}
        </form>
      ) : null}
      {msg ? (
        <p role="status" className="m-0 text-[13px]" style={{ color: msg.ok ? 'var(--good)' : 'var(--bad)' }}>
          {msg.text}
        </p>
      ) : null}
    </section>
  );
}
