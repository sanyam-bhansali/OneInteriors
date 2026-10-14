'use client';

import { useState, useTransition } from 'react';
import { ROOM_CATEGORIES } from '@/modules/studio-quote/starter-catalogue';
import { UNIT_LABELS, WORK_CODE_LABELS, type QuoteUnitName, type WorkCodeName } from '@/modules/studio-quote/pricing';
import type { ProductRules } from '@/modules/studio-quote/configure';
import type { ProductRow } from '@/modules/studio-quote/store';
import { toggleActiveAction, updateProductAction } from './actions';

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
    <div className="peditor">
      <div className="prow">
        <label className="pfield">
          <span className="lbl">Name</span>
          <input value={name} onChange={(e) => setName(e.target.value)} className="fld" style={{ width: '18rem', maxWidth: '100%' }} />
        </label>
        <label className="pfield">
          <span className="lbl">Measured by</span>
          <select value={unit} onChange={(e) => setUnit(e.target.value as QuoteUnitName)} className="fld">
            {(Object.keys(UNIT_LABELS) as QuoteUnitName[]).map((u) => (
              <option key={u} value={u}>
                {UNIT_LABELS[u]}
              </option>
            ))}
          </select>
        </label>
        <label className="pfield">
          <span className="lbl">Work</span>
          <select value={code} onChange={(e) => setCode(e.target.value as WorkCodeName)} className="fld">
            {(Object.keys(WORK_CODE_LABELS) as WorkCodeName[]).map((c) => (
              <option key={c} value={c}>
                {WORK_CODE_LABELS[c]}
              </option>
            ))}
          </select>
        </label>
      </div>

      <fieldset className="pset">
        <legend className="lbl">Rooms it belongs in</legend>
        <div className="hstack" style={{ gap: 8 }}>
          {ROOM_CATEGORIES.map((room) => {
            const on = rooms.includes(room);
            return (
              <button
                key={room}
                type="button"
                aria-pressed={on}
                onClick={() => setRooms(on ? rooms.filter((x) => x !== room) : [...rooms, room])}
                className="ppick"
              >
                {room}
              </button>
            );
          })}
        </div>
      </fieldset>

      <div className="prow">
        {unit === 'AREA' ? (
          <>
            <label className="pfield">
              <span className="lbl">Usual width mm</span>
              <input value={w} onChange={(e) => setW(e.target.value)} inputMode="numeric" className="fld pnum" style={{ width: '7rem' }} />
            </label>
            <label className="pfield">
              <span className="lbl">Usual height mm</span>
              <input value={h} onChange={(e) => setH(e.target.value)} inputMode="numeric" className="fld pnum" style={{ width: '7rem' }} />
            </label>
          </>
        ) : unit === 'UNIT' ? (
          <label className="pfield">
            <span className="lbl">Usual quantity</span>
            <input value={qty} onChange={(e) => setQty(e.target.value)} inputMode="numeric" className="fld pnum" style={{ width: '6rem' }} />
          </label>
        ) : (
          <label className="pfield">
            <span className="lbl">Usual {unit === 'SQFT' ? 'sq ft' : 'running ft'}</span>
            <input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" className="fld pnum" style={{ width: '6rem' }} />
          </label>
        )}
        <label className="pfield">
          <span className="lbl">Only for a</span>
          <select value={bhk} onChange={(e) => setBhk(e.target.value)} className="fld">
            <option value="">Any size of flat</option>
            {['1', '2', '3', '4'].map((b) => (
              <option key={b} value={b}>
                {b} BHK
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="hstack" style={{ gap: '8px 20px' }}>
        <Tick on={perBath} set={setPerBath}>One per bathroom</Tick>
        <Tick on={perBed} set={setPerBed}>One per bedroom</Tick>
        <Tick on={balcony} set={setBalcony}>Only with a dry balcony</Tick>
        {unit === 'AREA' ? <Tick on={useRun} set={setUseRun}>Width is the kitchen run</Tick> : null}
      </div>

      <label className="pfield">
        <span className="lbl">What it includes</span>
        <textarea value={details} onChange={(e) => setDetails(e.target.value)} rows={2} className="fld" />
      </label>

      <div className="hstack">
        <button type="button" disabled={pending} onClick={save} className="btn pri sm">
          {pending ? 'Saving…' : 'Save'}
        </button>
        <button type="button" onClick={onClose} className="btn ghost sm">
          Cancel
        </button>
        <button type="button" disabled={pending} onClick={toggleActive} className="btn sec sm" style={{ marginLeft: 'auto' }}>
          {product.isActive ? 'Switch off — stop offering it' : 'Switch back on'}
        </button>
        {error ? <span className="perr" style={{ width: '100%' }}>{error}</span> : null}
      </div>
    </div>
  );
}

function Tick({ on, set, children }: { on: boolean; set: (v: boolean) => void; children: React.ReactNode }) {
  return (
    <label className="pcheck">
      <input type="checkbox" checked={on} onChange={(e) => set(e.target.checked)} />
      {children}
    </label>
  );
}
