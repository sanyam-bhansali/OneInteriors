'use client';

import { useState, useTransition } from 'react';
import { addCrewAction, setCrewActiveAction } from './actions';

const ROLES = ['Carpenter', 'Helper', 'Electrician', 'Plumber', 'Painter', 'Mason'];
const input = 'fld';

export function AddCrew() {
  const [name, setName] = useState('');
  const [role, setRole] = useState('Carpenter');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <form
      className="card flex flex-col gap-3 p-4"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const r = await addCrewAction({ name, role, phone });
          if (r.ok) {
            setName('');
            setPhone('');
            setError(null);
          } else setError(r.error);
        });
      }}
    >
      <h2 className="m-0 text-[15px] font-semibold">Add someone</h2>
      <label className="flex flex-col gap-1 text-[13px] muted">
        Name
        <input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} required className={input} />
      </label>
      <label className="flex flex-col gap-1 text-[13px] muted">
        Work
        <input value={role} onChange={(e) => setRole(e.target.value)} maxLength={40} list="crew-roles" required className={input} />
        <datalist id="crew-roles">
          {ROLES.map((r) => (
            <option key={r} value={r} />
          ))}
        </datalist>
      </label>
      <label className="flex flex-col gap-1 text-[13px] muted">
        Mobile (optional, only your team sees it)
        <input value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" maxLength={16} className={input} />
      </label>
      {error ? <p className="m-0 text-[13px] bad-t">{error}</p> : null}
      <button type="submit" disabled={pending} className="min-h-[40px] rounded-[8px] bg-[var(--s-accent)] text-[14px] font-semibold text-white disabled:opacity-50">
        {pending ? 'Adding…' : 'Add to crew'}
      </button>
    </form>
  );
}

export function CrewToggle({ id, active }: { id: string; active: boolean }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <span className="inline-flex flex-col items-end gap-1">
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const r = await setCrewActiveAction(id, !active);
            setError(r.ok ? null : r.error);
          })
        }
        className="min-h-[34px] rounded-[8px] border border-[var(--s-rule)] px-3 text-[13px] disabled:opacity-50"
      >
        {active ? 'Switch off' : 'Switch back on'}
      </button>
      {error ? <span className="text-[12px] bad-t">{error}</span> : null}
    </span>
  );
}
