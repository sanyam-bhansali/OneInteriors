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

import { useEffect, useState } from 'react';
import type { FloorPlanReading } from '@/modules/floorplan/reading';
import type { Brief, PropertyType } from '@/modules/brief/types';
import { readFloorPlanAction, societyPlanAction } from './actions';
import type { LibraryReading } from '@/modules/floorplan/society-library';
import { typicalCarpetSqft } from '@/modules/brief/steps';
import { useLang, useSiteT } from '@/components/app/i18n';
import { QUIZ_DICT, fillParts, quizServerText } from '@/modules/i18n/site/quiz';

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
  const t = useSiteT(QUIZ_DICT);
  const lang = useLang();
  const [bedrooms, setBedrooms] = useState('');
  const [area, setArea] = useState('');
  const [runMm, setRunMm] = useState('');
  const [baths, setBaths] = useState('');
  /* Homes in their building that have shared a plan (society-library.ts) —
     offered before the upload, because using it is one tap. */
  const [shared, setShared] = useState<LibraryReading | null>(null);
  useEffect(() => {
    if (!brief.society || !brief.propertyType || brief.planReading) return;
    let live = true;
    societyPlanAction(brief.society, brief.propertyType)
      .then((r) => live && setShared(r))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [brief.society, brief.propertyType, brief.planReading]);

  async function read(form: FormData) {
    setState({ kind: 'reading' });
    const result = await readFloorPlanAction(form).catch(() => null);
    if (!result || !result.ok) {
      setState({ kind: 'idle', error: quizServerText(lang, result?.error) ?? t('plan.errDefault') });
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
          {p.areaSource === 'society'
            ? t('plan.usingSociety', { society: brief.society ?? t('plan.yourBuilding') })
            : brief.floorPlanName
              ? t('plan.usingYoursNamed', { file: brief.floorPlanName })
              : t('plan.usingYours')}
          {brief.carpetAreaSqft ? `${brief.carpetAreaSqft.toLocaleString('en-IN')} sq ft, ` : ''}
          {t(p.bathrooms === 1 ? 'plan.bath1' : 'plan.bathN', { n: p.bathrooms })}
          {p.kitchenRunMm ? `, ${t('plan.kitchenRun', { mm: p.kitchenRunMm.toLocaleString('en-IN') })}` : ''}.
        </p>
        <button
          type="button"
          onClick={() => update({ planReading: null })}
          className="mt-3 cursor-pointer border-0 bg-transparent p-0 text-[13.5px] text-[var(--ink2)] underline"
        >
          {t('plan.different')}
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
        <p className="oi-label m-0 mb-3">{t('plan.weRead', { file: state.fileName })}</p>
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
            {t('plan.bedrooms')}
            <input className={`${field} mt-1 block`} inputMode="numeric" value={bedrooms} onChange={(e) => setBedrooms(e.target.value.replace(/\D/g, ''))} />
          </label>
          <label className="block text-[13px] text-[var(--ink2)]">
            {t('plan.area')}
            <input className={`${field} mt-1 block`} inputMode="numeric" value={area} onChange={(e) => setArea(e.target.value.replace(/\D/g, ''))} />
          </label>
          <label className="block text-[13px] text-[var(--ink2)]">
            {t('plan.kitchen')}
            <input className={`${field} mt-1 block`} inputMode="numeric" placeholder={t('plan.unknown')} value={runMm} onChange={(e) => setRunMm(e.target.value.replace(/\D/g, ''))} />
          </label>
          <label className="block text-[13px] text-[var(--ink2)]">
            {t('plan.bathrooms')}
            <input className={`${field} mt-1 block`} inputMode="numeric" value={baths} onChange={(e) => setBaths(e.target.value.replace(/\D/g, ''))} />
          </label>
        </div>
        {r.hasStudy ? (
          <p className="m-0 mt-3 text-[13px] text-[var(--ink2)]">{t('plan.study')}</p>
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
              {t('use')}
            </button>
          ) : (
            <p className="m-0 text-[13.5px] text-[var(--ink2)]">
              {t('plan.check')}
            </p>
          )}
          <button
            type="button"
            onClick={() => setState({ kind: 'idle', error: null })}
            className="cursor-pointer border-0 bg-transparent p-0 text-[13.5px] text-[var(--ink2)] underline"
          >
            {t('plan.another')}
          </button>
        </div>
        {brief.society ? (
          <p className="m-0 mt-4 text-[12.5px] leading-snug text-[var(--ink2)]">
            {t('plan.helps', { society: brief.society })}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <form action={read} className="flex flex-col gap-3">
      {shared ? (
        <div className="mb-2 rounded-[14px] border border-[var(--acc)] bg-[var(--card)] p-5">
          <p className="m-0 text-[15px] leading-relaxed text-[var(--ink)]">
            {fillParts(t('plan.shared', { homes: shared.homes }), {
              society: brief.society,
              sizes: [
                shared.carpetAreaSqft ? `${shared.carpetAreaSqft.toLocaleString('en-IN')} sq ft` : null,
                t(shared.bathrooms === 1 ? 'plan.bath1' : 'plan.bathN', { n: shared.bathrooms }),
                shared.kitchenRunMm ? t('plan.kitchenRun', { mm: shared.kitchenRunMm.toLocaleString('en-IN') }) : null,
              ]
                .filter(Boolean)
                .join(', '),
            })}
          </p>
          <button
            type="button"
            onClick={() =>
              update({
                ...(shared.carpetAreaSqft ? { carpetAreaSqft: shared.carpetAreaSqft } : {}),
                planReading: {
                  kitchenRunMm: shared.kitchenRunMm,
                  bathrooms: shared.bathrooms,
                  hasStudy: false,
                  areaSource: 'society',
                },
              })
            }
            className="mt-3 cursor-pointer px-5 py-2.5 text-[14.5px] font-medium text-white"
            style={{ background: 'var(--acc-btn)' }}
          >
            {t('plan.useSizes')}
          </button>
          <p className="m-0 mt-2 text-[12.5px] text-[var(--ink2)]">{t('plan.orUpload')}</p>
        </div>
      ) : null}
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
          {state.kind === 'reading' ? t('plan.reading') : t('plan.read')}
        </button>
        <span className="text-[13px] text-[var(--ink2)]">{t('plan.formats')}</span>
      </div>
      {state.kind === 'idle' && state.error ? (
        <p role="alert" className="m-0 text-[13.5px] text-[var(--acc-ink)]">
          {state.error}
        </p>
      ) : null}
      <p className="m-0 text-[12.5px] leading-snug text-[var(--ink2)]">
        {t('plan.privacy')}
      </p>

      {/* Asked only here, and only without a plan: a plan gives the area, so
          nobody who uploads one is asked for it (build queue item 8). */}
      <label className="mt-4 block border-t border-[var(--line)] pt-4">
        <span className="mb-2 block text-[14px] text-[var(--ink)]">
          {t('plan.noPlan')}
        </span>
        <span className="flex items-center gap-2">
          <input
            type="number"
            inputMode="numeric"
            placeholder={String(typicalCarpetSqft(brief.propertyType))}
            value={brief.carpetAreaSqft ?? ''}
            onChange={(e) => update({ carpetAreaSqft: e.target.value ? Number(e.target.value) : null })}
            className="oi-num w-32 rounded-full border border-[var(--line)] bg-[var(--card)] px-4 py-2.5 text-[15px] text-[var(--ink)] placeholder:text-[var(--ink2)]"
          />
          <span className="text-[14px] text-[var(--ink2)]">sq ft</span>
        </span>
        <span className="mt-1.5 block text-[12.5px] text-[var(--ink2)]">
          {t('plan.blank')}
        </span>
      </label>
    </form>
  );
}
