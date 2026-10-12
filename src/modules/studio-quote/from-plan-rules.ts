/**
 * Floor plan → first quotation: the rules, pure and tested.
 *
 * The flow (owner, 12 Oct 2026): a salesperson attaches the client's floor
 * plan to the lead; the plan is read once (`floorplan/plan-reads.ts`) and the
 * first quotation is built from it — a DRAFT, linked to the lead, its rooms,
 * kitchen run, bathrooms and false ceilings from the plan — through the same
 * standard build every quotation uses (`configure.ts planQuotation`, Hauspire's
 * first-quote rules). The salesperson opens it, changes what they want and
 * marks it sent; nothing about revisions changes.
 *
 * This file turns a reading into the flat the build takes, and says what
 * happened in words. The database work is in `from-plan.ts`.
 */

import type { FloorPlanReading } from '@/modules/floorplan/reading';
import type { PlanRoomSize } from '@/modules/brief/types';
import { STALE_READ_MS, planReadMessage } from '@/modules/floorplan/plan-cache';
import { isConfigName, type ConfigName, type HomeConfig } from './configure';

/** What is kept on the lead file (`StudioClientFile.reading`) — the shape `planUseFrom` reads. */
export interface StoredFileReading {
  rooms: PlanRoomSize[];
  kitchenRunMm: number | null;
  bathrooms: number;
  hasStudy: boolean;
  areaSource: 'printed' | 'computed' | null;
  bedrooms: number;
  carpetAreaSqft: number | null;
  confidence: 'high' | 'medium' | 'low';
  /** A dry balcony / utility on the plan; null when the plan shows no rooms to tell. */
  dryBalcony: boolean | null;
}

const DRY = /dry|utility|wash/i;

export function fileReadingOf(r: FloorPlanReading): StoredFileReading {
  return {
    rooms: r.rooms.map((x) => ({ name: x.name, code: x.code, widthMm: x.widthMm, depthMm: x.depthMm })),
    kitchenRunMm: r.kitchenRunMm,
    bathrooms: r.bathrooms,
    hasStudy: r.hasStudy,
    areaSource: r.carpetAreaSource,
    bedrooms: r.bedrooms,
    carpetAreaSqft: r.carpetAreaSqft,
    confidence: r.confidence,
    dryBalcony: r.rooms.length === 0 ? null : r.rooms.some((x) => x.code === 'UTILITY' || (x.code === 'BALCONY' && DRY.test(x.name))),
  };
}

/** "3 BHK" from a bedroom count; null when there is none to go on. */
export function configFromBedrooms(bedrooms: number): ConfigName | null {
  if (!Number.isInteger(bedrooms) || bedrooms < 1) return null;
  return `${Math.min(4, bedrooms)} BHK` as ConfigName;
}

/**
 * The flat the build takes, from the plan. The plan's bedroom count decides
 * the size (it is what the plan shows); the lead's BHK is the fallback when
 * the plan shows none. Kitchen run, bathrooms and study come off the plan;
 * the dry balcony when the plan shows one, otherwise the build's own rule.
 * False ceiling and the king bed are on, as in Hauspire's first quote from a
 * plan; both are a tick on the quotation to undo.
 */
export function homeFromReading(r: StoredFileReading, leadConfig: string | null): HomeConfig | null {
  const config = configFromBedrooms(r.bedrooms) ?? (isConfigName(leadConfig) ? leadConfig : null);
  if (!config) return null;
  return {
    config,
    kitchenRunMm: r.kitchenRunMm,
    bathrooms: r.bathrooms > 0 ? r.bathrooms : config === '1 BHK' ? 1 : 2,
    study: r.hasStudy,
    ...(r.dryBalcony === null ? {} : { balcony: r.dryBalcony }),
    usePlan: r.rooms.length > 0,
    falseCeiling: true,
    kingMaster: true,
  };
}

/** The flat from the lead alone — the fallback when the plan could not be read. */
export function homeFromLead(leadConfig: string | null): HomeConfig | null {
  if (!isConfigName(leadConfig)) return null;
  return { config: leadConfig, kitchenRunMm: null, bathrooms: leadConfig === '1 BHK' ? 1 : 2, study: false };
}

/** "3 bedrooms, 2 bathrooms, a study, about 1,150 sq ft" */
export function readingSummary(r: Pick<StoredFileReading, 'bedrooms' | 'bathrooms' | 'hasStudy' | 'carpetAreaSqft' | 'kitchenRunMm'>): string {
  const parts = [
    `${r.bedrooms} bedroom${r.bedrooms === 1 ? '' : 's'}`,
    `${r.bathrooms} bathroom${r.bathrooms === 1 ? '' : 's'}`,
  ];
  if (r.hasStudy) parts.push('a study');
  if (r.kitchenRunMm) parts.push(`kitchen run ${r.kitchenRunMm} mm`);
  if (r.carpetAreaSqft) parts.push(`about ${r.carpetAreaSqft.toLocaleString('en-IN')} sq ft`);
  return parts.join(', ');
}

// ── What the lead page shows for a plan file ──────────────────

export type PlanJobStatus = 'READING' | 'BUILT' | 'READ' | 'FALLBACK' | 'FAILED';

export interface PlanJobView {
  status: PlanJobStatus;
  message: string;
  quoteId: string | null;
  quoteNumber: string | null;
}

/**
 * A stored run as the lead page shows it. A run still "reading" after the
 * stale limit died on the way (the tab closed, the server stopped): it shows
 * as failed, with the button to try again.
 */
export function jobView(
  job: { status: string; message: string | null; quoteId: string | null; startedAt: Date },
  quoteNumber: string | null,
  now: Date,
): PlanJobView {
  const status = (['READING', 'BUILT', 'READ', 'FALLBACK', 'FAILED'] as const).find((s) => s === job.status) ?? 'FAILED';
  if (status === 'READING' && now.getTime() - job.startedAt.getTime() >= STALE_READ_MS) {
    return { status: 'FAILED', message: 'The last read did not finish. Try again.', quoteId: null, quoteNumber: null };
  }
  return {
    status,
    message: job.message ?? (status === 'READING' ? 'Reading the plan and building the first quotation…' : ''),
    quoteId: job.quoteId,
    quoteNumber,
  };
}

/**
 * What a run ended as, in one sentence, for the lead page and the job row.
 * `reason` is the reader's code when the plan was not read.
 */
export function outcomeMessage(o: {
  read: boolean;
  reason?: string | null;
  summary?: string | null;
  built: { number: string; lines: number } | null;
  builtFrom: 'plan' | 'lead' | null;
  readOnlyWhy?: 'has-quote' | 'one-interiors' | 'no-role' | 'asked' | null;
  /** The quotation was made but no size was known to build it. */
  emptyQuote?: { number: string } | null;
}): string {
  const readPart = o.read ? `Read the plan: ${o.summary}.` : planReadMessage(o.reason ?? 'reader-failed');
  if (o.built && o.builtFrom === 'plan') {
    return `${readPart} First quotation ${o.built.number} is built from it (${o.built.lines} lines) — open it, check it and mark it sent.`;
  }
  if (o.built && o.builtFrom === 'lead') {
    return `${readPart} Quotation ${o.built.number} is built from the lead's BHK instead (${o.built.lines} lines).`;
  }
  if (o.emptyQuote) {
    return `${readPart} Quotation ${o.emptyQuote.number} is started; pick the BHK on it and press Build.`;
  }
  if (o.read && o.readOnlyWhy === 'has-quote') {
    return `${readPart} This lead already has a quotation: use "Read rooms" on it, or "Build a quotation from this plan".`;
  }
  if (o.read && o.readOnlyWhy === 'one-interiors') {
    return `${readPart} This client came through One Interiors, so their quotation is the final quote on this page.`;
  }
  if (o.read && (o.readOnlyWhy === 'no-role' || o.readOnlyWhy === 'asked')) {
    return `${readPart} The rooms will fill the next quotation.`;
  }
  return readPart;
}
