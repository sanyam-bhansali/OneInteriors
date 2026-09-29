'use client';

/**
 * "Have your floor plan?" — upload it, see what we read, confirm or correct.
 *
 * AI proposes, the customer confirms (LEARNINGS-FROM-QUOTATION-APP §1.1). The
 * reading is never used until they press "Use these", and every number on it
 * is editable first. What they confirm sizes every studio's quote at once —
 * the kitchen platform run is the number that moves a quote most, and a real
 * one narrows the range to ±10%.
 */

import { useState } from 'react';
import type { FloorPlanReading } from '@/modules/floorplan/reading';
import type { Brief, PropertyType } from '@/modules/brief/types';
import { readFloorPlanAction } from './actions';

const BHK_FOR: Record<number, PropertyType> = { 1: 'BHK_1', 2: 'BHK_2', 3: 'BHK_3' };
const typeFor = (bedrooms: number): PropertyType =>
  bedrooms >= 4 ? 'BHK_4_PLUS' : (BHK_FOR[Math.max(1, bedrooms)] ?? 'BHK_2');

type State =
  | { kind: 'idle'; error: string | null }
  | { kind: 'reading' }
  | { kind: 'read'; reading: FloorPlanReading; fileName: string };

export function PlanReader({
  brief,
  update,
}: {
  brief: Brief;
  update: (patch: Partial<Brief>) => void;
}) {
  const [state, setState] = useState<State>({ kind: 'idle', error: null });
  const [bedrooms, setBedrooms] = useState('');
  const [area, setArea] = useState('');
  const [runMm, setRunMm] = useState('');
  const [baths, setBaths] = useState('');

  async function read(form: FormData) {
    setState({ kind: 'reading' });
    const result = await readFloorPlanAction(form).catch(() => null);
    if (!result || !result.ok) {
      setState({ kind: 'idle', error: result?.error ?? 'We could not read that plan just now. Skip this and we will price a standard kitchen.' });
      return;
    }
    const r = result.reading;
    setBedrooms(String(r.bedrooms || ''));
    setArea(r.carpetAreaSqft ? String(r.carpetAreaSqft) : '');
    setRunMm(r.kitchenRunMm ? String(r.kitchenRunMm) : '');
    setBaths(String(r.bathrooms || ''));
    setState({ kind: 'read', reading: r, fileName: result.fileName });
  }

  const field =
    'oi-num w-28 rounded-full border border-[var(--line)] bg-[var(--card)] px-4 py-2.5 text-[15px] text-[var(--ink)]';

  if (brief.planReading && state.kind === 'idle') {
    const p = brief.planReading;
    return (
      <div className="rounded-[14px] border border-[var(--line)] bg-[var(--card)] p-5">
        <p className="m-0 text-[15px] leading-relaxed text-[var(--ink)]">
          Using your plan{brief.floorPlanName ? ` (${brief.floorPlanName})` : ''}:{' '}
          {brief.carpetAreaSqft ? `${brief.carpetAreaSqft.toLocaleString('en-IN')} sq ft, ` : ''}
          {p.bathrooms} bathroom{p.bathrooms === 1 ? '' : 's'}
          {p.kitchenRunMm ? `, kitchen platform ${p.kitchenRunMm.toLocaleString('en-IN')} mm` : ''}.
        </p>
        <button
          type="button"
          onClick={() => update({ planReading: null })}
          className="mt-3 cursor-pointer border-0 bg-transparent p-0 text-[13.5px] text-[var(--ink2)] underline"
        >
          Use a different plan
        </button>
      </div>
    );
  }

  if (state.kind === 'read') {
    const r = state.reading;
    const n = (v: string) => (v.trim() ? Number(v) : NaN);
    const beds = n(bedrooms);
    const sqft = n(area);
    const run = n(runMm);
    const bath = n(baths);
    const valid =
      Number.isInteger(beds) && beds >= 1 && beds <= 6 &&
      Number.isFinite(sqft) && sqft >= 150 && sqft <= 20000 &&
      Number.isInteger(bath) && bath >= 1 && bath <= 6 &&
      (!runMm.trim() || (Number.isFinite(run) && run >= 1500 && run <= 9000));
    const edited =
      String(r.carpetAreaSqft ?? '') !== area.trim();

    return (
      <div className="rounded-[14px] border border-[var(--acc)] bg-[var(--card)] p-5">
        <p className="oi-label m-0 mb-3">We read {state.fileName} — is this right?</p>
        {r.needsConfirming.length > 0 ? (
          <ul className="m-0 mb-4 flex list-none flex-col gap-1.5 p-0">
            {r.needsConfirming.map((line) => (
              <li key={line} className="text-[13.5px] leading-snug text-[var(--acc-ink)]">
                {line}
              </li>
            ))}
          </ul>
        ) : null}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <label className="block text-[13px] text-[var(--ink2)]">
            Bedrooms
            <input className={`${field} mt-1 block`} inputMode="numeric" value={bedrooms} onChange={(e) => setBedrooms(e.target.value.replace(/\D/g, ''))} />
          </label>
          <label className="block text-[13px] text-[var(--ink2)]">
            Carpet area, sq ft
            <input className={`${field} mt-1 block`} inputMode="numeric" value={area} onChange={(e) => setArea(e.target.value.replace(/\D/g, ''))} />
          </label>
          <label className="block text-[13px] text-[var(--ink2)]">
            Kitchen platform, mm
            <input className={`${field} mt-1 block`} inputMode="numeric" placeholder="unknown" value={runMm} onChange={(e) => setRunMm(e.target.value.replace(/\D/g, ''))} />
          </label>
          <label className="block text-[13px] text-[var(--ink2)]">
            Bathrooms
            <input className={`${field} mt-1 block`} inputMode="numeric" value={baths} onChange={(e) => setBaths(e.target.value.replace(/\D/g, ''))} />
          </label>
        </div>
        {r.hasStudy ? (
          <p className="m-0 mt-3 text-[13px] text-[var(--ink2)]">There is a study as well — counted as a study, not a bedroom.</p>
        ) : null}
        <div className="mt-5 flex flex-wrap items-center gap-4">
          {valid ? (
            <button
              type="button"
              onClick={() => {
                update({
                  propertyType: typeFor(beds),
                  carpetAreaSqft: Math.round(sqft),
                  planReading: {
                    kitchenRunMm: runMm.trim() ? Math.round(run) : null,
                    bathrooms: bath,
                    hasStudy: r.hasStudy,
                    areaSource: edited ? 'customer' : r.carpetAreaSource,
                  },
                });
                setState({ kind: 'idle', error: null });
              }}
              className="cursor-pointer px-5 py-2.5 text-[14.5px] font-medium text-white"
              style={{ background: 'var(--acc-btn)' }}
            >
              Use these
            </button>
          ) : (
            <p className="m-0 text-[13.5px] text-[var(--ink2)]">
              Check the numbers — bedrooms and bathrooms 1–6, area 150–20,000 sq ft, kitchen 1,500–9,000 mm.
            </p>
          )}
          <button
            type="button"
            onClick={() => setState({ kind: 'idle', error: null })}
            className="cursor-pointer border-0 bg-transparent p-0 text-[13.5px] text-[var(--ink2)] underline"
          >
            Try another file
          </button>
        </div>
      </div>
    );
  }

  return (
    <form action={read} className="flex flex-col gap-3">
      <input
        type="file"
        name="plan"
        accept="application/pdf,image/png,image/jpeg,image/webp"
        className="w-full border border-[var(--line)] bg-[var(--card)] px-3 py-2.5 text-[14px] text-[var(--ink)]"
      />
      <div className="flex flex-wrap items-center gap-4">
        <button
          type="submit"
          disabled={state.kind === 'reading'}
          className="cursor-pointer px-5 py-2.5 text-[14.5px] font-medium text-white disabled:opacity-60"
          style={{ background: 'var(--acc-btn)' }}
        >
          {state.kind === 'reading' ? 'Reading your plan…' : 'Read my plan'}
        </button>
        <span className="text-[13px] text-[var(--ink2)]">PDF or photo, up to 4 MB</span>
      </div>
      {state.kind === 'idle' && state.error ? (
        <p role="alert" className="m-0 text-[13.5px] text-[var(--acc-ink)]">
          {state.error}
        </p>
      ) : null}
      <p className="m-0 text-[12.5px] leading-snug text-[var(--ink2)]">
        We read it with an AI service to size your quote, and keep it privately. A studio sees it
        only when you choose that studio.
      </p>
    </form>
  );
}
