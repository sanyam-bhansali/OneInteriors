'use client';

/** Settings, Warranty (months): the project lifecycle's warranty length (owner, 13 Oct 2026). */

import { useState, useTransition } from 'react';
import { saveSnagWindowAction, saveWarrantyAction } from './warranty-actions';

export function WarrantyForm({ months, snagDays, canEdit }: { months: number; snagDays: number; canEdit: boolean }) {
  const [value, setValue] = useState(String(months));
  const [msg, setMsg] = useState<{ ok: boolean; message: string } | null>(null);
  const [pending, start] = useTransition();
  return (
    <section className="card mt-6 flex flex-col gap-3 p-5" aria-label="Warranty">
      <div className="flex flex-col gap-1">
        <h2 className="m-0 text-[17px]">Warranty</h2>
        <p className="m-0 muted text-[14px]">
          How long your warranty runs after the client signs off the handover in the app. During it, the client can raise warranty snags; after it, the project is closed.
        </p>
      </div>
      <label className="flex flex-wrap items-center gap-3">
        <span className="lbl">Warranty (months)</span>
        <input className="fld mono w-[7rem]" inputMode="numeric" value={value} disabled={!canEdit || pending} onChange={(e) => setValue(e.target.value)} />
        {canEdit ? (
          <button
            type="button"
            className="btn pri sm"
            disabled={pending || value === String(months)}
            onClick={() =>
              start(async () => {
                setMsg(await saveWarrantyAction(value));
              })
            }
          >
            Save
          </button>
        ) : (
          <span className="muted sm">Only the owner changes it.</span>
        )}
      </label>
      {msg ? (
        <p role="status" className={`m-0 sm ${msg.ok ? 'good-t' : 'bad-t'}`}>
          {msg.message}
        </p>
      ) : null}
      <SnagWindowField days={snagDays} canEdit={canEdit} />
    </section>
  );
}

/** The snag window (owner, 15 Oct 2026): days the client raises snags in the app after the handover payment. */
function SnagWindowField({ days, canEdit }: { days: number; canEdit: boolean }) {
  const [value, setValue] = useState(String(days));
  const [msg, setMsg] = useState<{ ok: boolean; message: string } | null>(null);
  const [pending, start] = useTransition();
  return (
    <div className="flex flex-col gap-2 border-t border-[var(--fill2)] pt-3">
      <p className="m-0 muted text-[14px]">
        The snag window: once the handover payment is recorded after the project closure, the client can raise snags in the app for this many days. After it, raising closes until the client signs off the handover; during the warranty they raise warranty snags.
      </p>
      <label className="flex flex-wrap items-center gap-3">
        <span className="lbl">Snag window (days)</span>
        <input className="fld mono w-[7rem]" inputMode="numeric" value={value} disabled={!canEdit || pending} onChange={(e) => setValue(e.target.value)} data-testid="snag-window-days" />
        {canEdit ? (
          <button
            type="button"
            className="btn pri sm"
            disabled={pending || value === String(days)}
            onClick={() =>
              start(async () => {
                setMsg(await saveSnagWindowAction(value));
              })
            }
          >
            Save
          </button>
        ) : null}
      </label>
      {msg ? (
        <p role="status" className={`m-0 sm ${msg.ok ? 'good-t' : 'bad-t'}`}>
          {msg.message}
        </p>
      ) : null}
    </div>
  );
}
