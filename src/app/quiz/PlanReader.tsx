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
import { PillButton } from '@/components/home/parts';

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

  /* The landing's pill field, white on the soft card it sits in. */
  const field = 'flow-input !bg-[var(--paper)] !px-4 focus:!border-[var(--ink)]';

  if (brief.planReading && state.kind === 'idle') {
    const p = brief.planReading;
    return (
      <div className="flow-card">
        <p className="m-0 text-[15.5px] leading-relaxed text-[var(--ink)]">
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
          className="mt-3 min-h-10 cursor-pointer border-0 bg-transparent p-0 text-[14px] text-[var(--ink-2)] underline underline-offset-2 hover:text-[var(--ink)]"
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
      <div className="flow-card">
        <p className="eyebrow !mb-3">{t('plan.weRead', { file: state.fileName })}</p>
        {r.needsConfirming.length > 0 ? (
          <ul className="m-0 mb-4 flex list-none flex-col gap-1.5 p-0">
            {r.needsConfirming.map((line) => (
              <li key={line} className="text-[14px] leading-snug text-[var(--accent-ink)]">
                {line}
              </li>
            ))}
          </ul>
        ) : null}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <label className="block text-[13px] text-[var(--ink-2)]">
            {t('plan.bedrooms')}
            <input className={`${field} mt-1 block`} inputMode="numeric" value={bedrooms} onChange={(e) => setBedrooms(e.target.value.replace(/\D/g, ''))} />
          </label>
          <label className="block text-[13px] text-[var(--ink-2)]">
            {t('plan.area')}
            <input className={`${field} mt-1 block`} inputMode="numeric" value={area} onChange={(e) => setArea(e.target.value.replace(/\D/g, ''))} />
          </label>
          <label className="block text-[13px] text-[var(--ink-2)]">
            {t('plan.kitchen')}
            <input className={`${field} mt-1 block`} inputMode="numeric" placeholder={t('plan.unknown')} value={runMm} onChange={(e) => setRunMm(e.target.value.replace(/\D/g, ''))} />
          </label>
          <label className="block text-[13px] text-[var(--ink-2)]">
            {t('plan.bathrooms')}
            <input className={`${field} mt-1 block`} inputMode="numeric" value={baths} onChange={(e) => setBaths(e.target.value.replace(/\D/g, ''))} />
          </label>
        </div>
        {r.hasStudy ? (
          <p className="m-0 mt-3 text-[14px] text-[var(--ink-2)]">{t('plan.study')}</p>
        ) : null}
        <div className="mt-5 flex flex-wrap items-center gap-4">
          {valid ? (
            <PillButton
              size="sm"
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
            >
              {t('use')}
            </PillButton>
          ) : (
            <p className="m-0 text-[14px] text-[var(--ink-2)]">
              {t('plan.check')}
            </p>
          )}
          <button
            type="button"
            onClick={() => setState({ kind: 'idle', error: null })}
            className="min-h-10 cursor-pointer border-0 bg-transparent p-0 text-[14px] text-[var(--ink-2)] underline underline-offset-2 hover:text-[var(--ink)]"
          >
            {t('plan.another')}
          </button>
        </div>
        {brief.society ? (
          <p className="m-0 mt-4 text-[13px] leading-snug text-[var(--ink-2)]">
            {t('plan.helps', { society: brief.society })}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <form action={read} className="flex flex-col gap-3">
      {shared ? (
        <div className="flow-card mb-2">
          <p className="m-0 text-[15.5px] leading-relaxed text-[var(--ink)]">
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
          <PillButton
            size="sm"
            className="mt-4"
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
          >
            {t('plan.useSizes')}
          </PillButton>
          <p className="m-0 mt-3 text-[13px] text-[var(--ink-2)]">{t('plan.orUpload')}</p>
        </div>
      ) : null}
      <input
        type="file"
        name="plan"
        accept="application/pdf,image/png,image/jpeg,image/webp"
        className="w-full max-w-full cursor-pointer rounded-[var(--r-m)] bg-[var(--soft)] p-2 text-[14px] text-[var(--ink-2)] file:mr-3 file:min-h-10 file:cursor-pointer file:rounded-full file:border-0 file:bg-[var(--ink)] file:px-4 file:text-[14px] file:font-medium file:text-white"
      />
      <div className="flex flex-wrap items-center gap-4">
        <PillButton type="submit" size="sm" disabled={state.kind === 'reading'}>
          {state.kind === 'reading' ? t('plan.reading') : t('plan.read')}
        </PillButton>
        <span className="text-[13.5px] text-[var(--ink-2)]">{t('plan.formats')}</span>
      </div>
      {state.kind === 'idle' && state.error ? (
        <p role="alert" className="m-0 text-[14px] text-[var(--accent-ink)]">
          {state.error}
        </p>
      ) : null}
      <p className="m-0 text-[13px] leading-snug text-[var(--ink-2)]">
        {t('plan.privacy')}
      </p>

      {/* Asked only here, and only without a plan: a plan gives the area, so
          nobody who uploads one is asked for it (build queue item 8). */}
      <label className="flow-card mt-4 block">
        <span className="mb-3 block text-[16px] font-medium tracking-[-0.01em] text-[var(--ink)]">
          {t('plan.noPlan')}
        </span>
        <span className="flex items-center gap-2">
          <input
            type="number"
            inputMode="numeric"
            placeholder={String(typicalCarpetSqft(brief.propertyType))}
            value={brief.carpetAreaSqft ?? ''}
            onChange={(e) => update({ carpetAreaSqft: e.target.value ? Number(e.target.value) : null })}
            className="flow-input !w-36 !bg-[var(--paper)] placeholder:text-[var(--ink-3)] focus:!border-[var(--ink)]"
          />
          <span className="text-[15px] text-[var(--ink-2)]">sq ft</span>
        </span>
        <span className="mt-2 block text-[13px] text-[var(--ink-2)]">
          {t('plan.blank')}
        </span>
      </label>
    </form>
  );
}
