'use client';

/** Settings, Warranty (months): the project lifecycle's warranty length (owner, 13 Oct 2026). */

import { useState, useTransition } from 'react';
import { saveWarrantyAction } from './warranty-actions';

export function WarrantyForm({ months, canEdit }: { months: number; canEdit: boolean }) {
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
    </section>
  );
}
