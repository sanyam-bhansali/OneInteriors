'use client';

import { useState, useTransition } from 'react';
import { ROOM_CATEGORIES } from '@/modules/studio-quote/starter-catalogue';
import { UNIT_LABELS, WORK_CODE_LABELS, type QuoteUnitName, type WorkCodeName } from '@/modules/studio-quote/pricing';
import type { ProductRules } from '@/modules/studio-quote/configure';
import type { ProductRow } from '@/modules/studio-quote/store';
import { toggleActiveAction, updateProductAction } from './actions';

const input =
  'rounded-[8px] border border-[var(--s-rule)] bg-[var(--s-surface)] px-3 py-2 text-[14px] text-[var(--s-ink)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--s-accent)]';
const quiet =
  'rounded-[8px] border border-[var(--s-rule)] px-3.5 py-2 text-[13.5px] font-medium hover:border-[var(--s-ink-3)] disabled:opacity-40';
const primary =
  'rounded-[8px] bg-[var(--s-accent)] px-4 py-2 text-[13.5px] font-medium text-white hover:bg-[var(--s-accent-deep)] disabled:opacity-40';

const whole = (t: string): number | null => {
  const v = Number(t.trim());
  return t.trim() === '' || !Number.isFinite(v) || v <= 0 ? null : Math.round(v);
};

/**
 * Everything about a product beyond its rate: what it is called, how it is
 * measured, what it includes, which rooms it goes in, its usual size, and how
 * the standard build treats it. Saving changes the product list only — lines
 * already on a quotation keep what they were.
 */
export function ProductEditor({ product, onClose }: { product: ProductRow; onClose: () => void }) {
  const r = product.rules ?? {};
  const [name, setName] = useState(product.name);
  const [code, setCode] = useState<WorkCodeName>(product.code);
  const [unit, setUnit] = useState<QuoteUnitName>(product.unit);
  const [details, setDetails] = useState(product.details ?? '');
  const [rooms, setRooms] = useState<string[]>(product.rooms);
  const [w, setW] = useState(product.defaultWidthMm ? String(product.defaultWidthMm) : '');
  const [h, setH] = useState(product.defaultHeightMm ? String(product.defaultHeightMm) : '');
  const [qty, setQty] = useState(product.defaultQty ? String(product.defaultQty) : '');
  const [bhk, setBhk] = useState(r.bhk?.match(/\d/)?.[0] ?? '');
  const [perBath, setPerBath] = useState(!!r.perBath);
  const [perBed, setPerBed] = useState(!!r.perBed);
  const [balcony, setBalcony] = useState(!!r.balcony);
  const [useRun, setUseRun] = useState(!!r.useRun);
  const [amount, setAmount] = useState(String(r.sqft ?? r.rft ?? ''));
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function save() {
    setError(null);
    const rules: ProductRules = {};
    if (bhk) rules.bhk = `${bhk}BHK`;
    if (perBath) rules.perBath = true;
    if (perBed) rules.perBed = true;
    if (balcony) rules.balcony = true;
    if (useRun && unit === 'AREA') rules.useRun = true;
    const n = Number(amount);
    if (unit === 'SQFT' && n > 0) rules.sqft = n;
    if (unit === 'RFT' && n > 0) rules.rft = n;

    start(async () => {
      const result = await updateProductAction(product.id, {
        name,
        code,
        unit,
        details: details || null,
        rooms,
        defaultWidthMm: unit === 'AREA' ? whole(w) : null,
        defaultHeightMm: unit === 'AREA' ? whole(h) : null,
        defaultQty: unit === 'UNIT' ? whole(qty) : null,
        rules: Object.keys(rules).length > 0 ? rules : null,
      });
      if (result && 'ok' in result && !result.ok) setError(result.error);
      else onClose();
    });
  }

  function toggleActive() {
    start(async () => {
      const result = await toggleActiveAction(product.id, !product.isActive);
      if (result && 'ok' in result && !result.ok) setError(result.error);
      else onClose();
    });
  }

  return (
    <div className="mt-3 flex w-full flex-col gap-4 rounded-[10px] bg-[var(--s-surface-2)] p-4">
      <div className="flex flex-wrap gap-4">
        <label className="flex flex-col gap-1.5">
          <span className="s-label">Name</span>
          <input value={name} onChange={(e) => setName(e.target.value)} className={`${input} w-[18rem]`} />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="s-label">Measured by</span>
          <select value={unit} onChange={(e) => setUnit(e.target.value as QuoteUnitName)} className={input}>
            {(Object.keys(UNIT_LABELS) as QuoteUnitName[]).map((u) => (
              <option key={u} value={u}>
                {UNIT_LABELS[u]}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="s-label">Work</span>
          <select value={code} onChange={(e) => setCode(e.target.value as WorkCodeName)} className={input}>
            {(Object.keys(WORK_CODE_LABELS) as WorkCodeName[]).map((c) => (
              <option key={c} value={c}>
                {WORK_CODE_LABELS[c]}
              </option>
            ))}
          </select>
        </label>
      </div>

      <fieldset className="m-0 border-0 p-0">
        <legend className="s-label mb-2 p-0">Rooms it belongs in</legend>
        <div className="flex flex-wrap gap-2">
          {ROOM_CATEGORIES.map((room) => {
            const on = rooms.includes(room);
            return (
              <button
                key={room}
                type="button"
                aria-pressed={on}
                onClick={() => setRooms(on ? rooms.filter((x) => x !== room) : [...rooms, room])}
                className={`rounded-full border px-3 py-1.5 text-[13px] ${
                  on
                    ? 'border-[var(--s-accent)] bg-[var(--s-accent-wash)] text-[var(--s-ink)]'
                    : 'border-[var(--s-rule)] text-[var(--s-ink-2)]'
                }`}
              >
                {room}
              </button>
            );
          })}
        </div>
      </fieldset>

      <div className="flex flex-wrap items-end gap-4">
        {unit === 'AREA' ? (
          <>
            <label className="flex flex-col gap-1.5">
              <span className="s-label">Usual width mm</span>
              <input value={w} onChange={(e) => setW(e.target.value)} inputMode="numeric" className={`${input} s-num w-[7rem] text-right`} />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="s-label">Usual height mm</span>
              <input value={h} onChange={(e) => setH(e.target.value)} inputMode="numeric" className={`${input} s-num w-[7rem] text-right`} />
            </label>
          </>
        ) : unit === 'UNIT' ? (
          <label className="flex flex-col gap-1.5">
            <span className="s-label">Usual quantity</span>
            <input value={qty} onChange={(e) => setQty(e.target.value)} inputMode="numeric" className={`${input} s-num w-[6rem] text-right`} />
          </label>
        ) : (
          <label className="flex flex-col gap-1.5">
            <span className="s-label">Usual {unit === 'SQFT' ? 'sq ft' : 'running ft'}</span>
            <input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" className={`${input} s-num w-[6rem] text-right`} />
          </label>
        )}
        <label className="flex flex-col gap-1.5">
          <span className="s-label">Only for a</span>
          <select value={bhk} onChange={(e) => setBhk(e.target.value)} className={input}>
            <option value="">Any size of flat</option>
            {['1', '2', '3', '4'].map((b) => (
              <option key={b} value={b}>
                {b} BHK
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="flex flex-wrap gap-x-5 gap-y-2 text-[13.5px]">
        <Tick on={perBath} set={setPerBath}>One per bathroom</Tick>
        <Tick on={perBed} set={setPerBed}>One per bedroom</Tick>
        <Tick on={balcony} set={setBalcony}>Only with a dry balcony</Tick>
        {unit === 'AREA' ? <Tick on={useRun} set={setUseRun}>Width is the kitchen run</Tick> : null}
      </div>

      <label className="flex flex-col gap-1.5">
        <span className="s-label">What it includes</span>
        <textarea value={details} onChange={(e) => setDetails(e.target.value)} rows={2} className={input} />
      </label>

      <div className="flex flex-wrap items-center gap-3">
        <button type="button" disabled={pending} onClick={save} className={primary}>
          {pending ? 'Saving…' : 'Save'}
        </button>
        <button type="button" onClick={onClose} className={quiet}>
          Cancel
        </button>
        <button type="button" disabled={pending} onClick={toggleActive} className={`${quiet} ml-auto`}>
          {product.isActive ? 'Switch off — stop offering it' : 'Switch back on'}
        </button>
        {error ? <span className="w-full text-[13px] text-[var(--s-bad)]">{error}</span> : null}
      </div>
    </div>
  );
}

function Tick({ on, set, children }: { on: boolean; set: (v: boolean) => void; children: React.ReactNode }) {
  return (
    <label className="flex cursor-pointer items-center gap-2">
      <input type="checkbox" checked={on} onChange={(e) => set(e.target.checked)} className="h-[15px] w-[15px] accent-[var(--s-accent)]" />
      {children}
    </label>
  );
}
