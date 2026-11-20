'use client';

/**
 * Settings, Service visits (owner, 20 Nov 2026; docs/studio-os/AFTERCARE.md):
 * the fixed visiting charge per kind of work, and how many visits one 2-hour
 * slot takes. A client books a visit only by paying its charge; a kind with
 * no charge cannot be booked.
 */

import { useState, useTransition } from 'react';
import { saveServiceChargesAction } from './service-actions';

const CATEGORIES: { key: string; label: string }[] = [
  { key: 'CARPENTRY', label: 'Carpentry' },
  { key: 'PAINTING', label: 'Painting' },
  { key: 'ELECTRICAL', label: 'Electrical' },
  { key: 'WALLPAPER', label: 'Wallpaper' },
  { key: 'PLUMBING', label: 'Plumbing' },
  { key: 'CIVIL', label: 'False ceiling and tiles' },
  { key: 'OTHER', label: 'Something else' },
];

export function ServiceChargesForm({ charges, visits, canEdit }: { charges: Record<string, string>; visits: number; canEdit: boolean }) {
  const [values, setValues] = useState<Record<string, string>>(charges);
  const [slot, setSlot] = useState(String(visits));
  const [msg, setMsg] = useState<{ ok: boolean; message: string } | null>(null);
  const [pending, start] = useTransition();
  return (
    <section className="card mt-6 flex flex-col gap-3 p-5" aria-label="Service visits">
      <div className="flex flex-col gap-1">
        <h2 className="m-0 text-[17px]">Service visits</h2>
        <p className="m-0 muted text-[14px]">
          After the handover, a client books a service visit by paying its visiting charge in the app, then picks a 2-hour slot from 5 days ahead. Leave a kind blank and clients cannot book it. A fully paid client&rsquo;s first visit within 30 days of the handover is free; they see your charge struck out.
        </p>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        {CATEGORIES.map((c) => (
          <label key={c.key} className="flex items-center justify-between gap-3">
            <span className="lbl">{c.label} (₹)</span>
            <input
              className="fld mono w-[8rem]"
              inputMode="numeric"
              value={values[c.key] ?? ''}
              disabled={!canEdit || pending}
              onChange={(e) => setValues({ ...values, [c.key]: e.target.value })}
              data-testid={`service-charge-${c.key}`}
            />
          </label>
        ))}
      </div>
      <label className="flex flex-wrap items-center gap-3">
        <span className="lbl">Visits per slot</span>
        <input className="fld mono w-[7rem]" inputMode="numeric" value={slot} disabled={!canEdit || pending} onChange={(e) => setSlot(e.target.value)} />
      </label>
      {canEdit ? (
        <div>
          <button
            type="button"
            className="btn pri sm"
            disabled={pending}
            onClick={() =>
              start(async () => {
                setMsg(await saveServiceChargesAction(values, slot));
              })
            }
          >
            Save
          </button>
        </div>
      ) : (
        <span className="muted sm">Only the owner changes them.</span>
      )}
      {msg ? (
        <p role="status" className={`m-0 sm ${msg.ok ? 'good-t' : 'bad-t'}`}>
          {msg.message}
        </p>
      ) : null}
    </section>
  );
}
