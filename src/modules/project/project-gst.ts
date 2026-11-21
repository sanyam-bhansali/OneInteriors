/**
 * GST on part of the project (owner, 21 Nov 2026: "18% GST on 30% of project
 * … one tickbox if GST applicable or not, and the GST value is split into
 * stages later [than] the design advance"; set on the project's Payments tab).
 * Pure; tested in tests/project-gst.test.ts.
 *
 * - The GST is 18% of the given percentage of the project's value (the
 *   stages before GST), to the rupee.
 * - It is added to the stages after the design advance (design closure,
 *   procurement, dispatch, handover), shared by their percentages; the
 *   booking and the design advance carry none.
 * - What was added is kept on the project (`gstPaise`), so it can be taken
 *   off exactly (the same split again) before the value changes: a new
 *   percentage, the tick removed, or the Design Final re-splitting the stages.
 */

import { splitAcross } from '@/lib/money';
import { pctOfRupees } from '@/modules/studio-quote/pricing';

export const PROJECT_GST_BPS = 1800;
export const GST_PCT_MIN = 1;
export const GST_PCT_MAX = 100;

export interface GstStage {
  label: string;
  pct: number | null;
  amountPaise: number;
}

/** Whole percent of the project the GST is on, 1–100; or why not. */
export function checkGstPct(raw: unknown): { ok: true; pct: number } | { ok: false; error: string } {
  const n = typeof raw === 'number' ? raw : typeof raw === 'string' ? Number(raw.trim().replace(/%$/, '')) : NaN;
  if (!Number.isInteger(n) || n < GST_PCT_MIN || n > GST_PCT_MAX) return { ok: false, error: `GST on what share of the project? A whole percent from ${GST_PCT_MIN} to ${GST_PCT_MAX}.` };
  return { ok: true, pct: n };
}

/** 18% of `pct`% of the value, to the rupee. */
export function gstOn(valuePaise: number, pct: number): number {
  if (valuePaise <= 0 || pct <= 0) return 0;
  return pctOfRupees(Math.round((valuePaise * pct) / 100), PROJECT_GST_BPS);
}

/**
 * The stages that carry the GST: those with a percentage after the first one
 * (the design advance). A plan with one percentage stage or none: every stage
 * after the first two.
 */
export function gstStageIndexes(stages: readonly Pick<GstStage, 'pct'>[]): number[] {
  const withPct = stages.map((s, i) => (s.pct !== null && s.pct > 0 ? i : -1)).filter((i) => i >= 0);
  if (withPct.length >= 2) return withPct.slice(1);
  return stages.map((_, i) => i).filter((i) => i >= 2);
}

/** Each stage's share of `gstPaise` (zero where none), shared by the later stages' percentages (equally when they have none). */
export function gstSplit(stages: readonly Pick<GstStage, 'pct'>[], gstPaise: number): number[] {
  const out = stages.map(() => 0);
  const at = gstStageIndexes(stages);
  if (gstPaise <= 0 || at.length === 0) return out;
  const weights = at.map((i) => (stages[i]!.pct !== null && stages[i]!.pct! > 0 ? stages[i]!.pct! : 1));
  const parts = splitAcross(gstPaise, weights);
  at.forEach((i, k) => (out[i] = parts[k]!));
  return out;
}

const withSplit = (stages: readonly GstStage[], gstPaise: number, sign: 1 | -1): GstStage[] => {
  const parts = gstSplit(stages, gstPaise);
  return stages.map((s, i) => ({ ...s, amountPaise: s.amountPaise + sign * parts[i]! }));
};

/** The stages without the GST added earlier. */
export const withoutGst = (stages: readonly GstStage[], gstPaise: number): GstStage[] => withSplit(stages, gstPaise, -1);

/** The stages with `gstPaise` added to the later stages. */
export const withGst = (stages: readonly GstStage[], gstPaise: number): GstStage[] => withSplit(stages, gstPaise, 1);

/**
 * The project's stages and total for a GST setting: the GST added before is
 * taken off, then (when `pct` is set) 18% of `pct`% of the value is added
 * again. `pct` null = no GST.
 */
export function regst(stages: readonly GstStage[], oldGstPaise: number, pct: number | null): { stages: GstStage[]; gstPaise: number; valuePaise: number; totalPaise: number } {
  const base = withoutGst(stages, oldGstPaise);
  const valuePaise = base.reduce((a, s) => a + s.amountPaise, 0);
  const gstPaise = pct === null ? 0 : gstOn(valuePaise, pct);
  const next = withGst(base, gstPaise);
  return { stages: next, gstPaise, valuePaise, totalPaise: valuePaise + gstPaise };
}

/**
 * The Design Final re-splitting the stages (studio-design/restage.ts) on a project with GST: the GST comes off
 * first, the stages are re-split on the Design Final, then 18% of the same % of the new value goes back on the
 * later stages. `restage` is the re-split, given the stages without GST.
 */
export function restageKeepingGst(
  stages: readonly GstStage[],
  oldGstPaise: number,
  pct: number | null,
  restage: (base: GstStage[]) => { ok: true; stages: GstStage[]; changed: boolean } | { ok: false; error: string },
): { ok: true; stages: GstStage[]; changed: boolean; gstPaise: number; totalPaise: number } | { ok: false; error: string } {
  const r = restage(withoutGst(stages, oldGstPaise));
  if (!r.ok) return r;
  const value = r.stages.reduce((a, s) => a + s.amountPaise, 0);
  const gstPaise = pct === null ? 0 : gstOn(value, pct);
  const next = withGst(r.stages, gstPaise);
  const changed = gstPaise !== oldGstPaise || next.some((s, i) => s.amountPaise !== stages[i]?.amountPaise);
  return { ok: true, stages: next, changed, gstPaise, totalPaise: value + gstPaise };
}
