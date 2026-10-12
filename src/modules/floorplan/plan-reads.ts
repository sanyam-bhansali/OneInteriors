import 'server-only';

/**
 * Read a floor plan once: the cache, the claim, the cap, then the call.
 *
 * The decisions are in `plan-cache.ts` (pure, tested); this file is the
 * database around `read.ts readFloorPlan`. Callers have already checked who
 * is asking — this takes a studio id from them and never from a browser.
 * Nothing about the plan is logged: errors are a short reason code.
 */

import { createHash } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { canReadPlans, readFloorPlan } from './read';
import { checkPlanFile, decideRead, istDayStart, type StoredRead } from './plan-cache';
import type { FloorPlanReading } from './reading';

export type PlanReadResult =
  | { ok: true; reading: FloorPlanReading; cached: boolean }
  | { ok: false; reason: string };

export function contentHash(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex');
}

/** Reads this studio has started since India midnight. */
async function readsToday(studioId: string, now: Date): Promise<number> {
  return prisma.studioPlanReading.count({ where: { studioId, lastAttemptAt: { gte: istDayStart(now) } } });
}

function asReading(value: unknown): FloorPlanReading | null {
  if (!value || typeof value !== 'object') return null;
  const r = value as FloorPlanReading;
  return Array.isArray(r.rooms) && typeof r.bathrooms === 'number' ? r : null;
}

/**
 * The reading for these bytes: stored if this studio has read them before,
 * read now if not (and allowed). `bytes` are the file as stored.
 */
export async function readPlanOnce(studioId: string, bytes: Uint8Array, contentType: string): Promise<PlanReadResult> {
  if (!canReadPlans()) return { ok: false, reason: 'not-configured' };
  const type = contentType.split(';')[0]!.trim().toLowerCase();
  const check = checkPlanFile(type, bytes.byteLength);
  if (!check.ok) return { ok: false, reason: check.reason };

  const hash = contentHash(bytes);
  const now = new Date();
  const key = { studioId_contentHash: { studioId, contentHash: hash } };

  const row = await prisma.studioPlanReading.findUnique({
    where: key,
    select: { id: true, status: true, reason: true, attempts: true, lastAttemptAt: true, reading: true },
  });
  const stored: StoredRead | null = row
    ? { status: row.status as StoredRead['status'], reason: row.reason, attempts: row.attempts, lastAttemptAt: row.lastAttemptAt }
    : null;

  const decision = decideRead(stored, now, await readsToday(studioId, now));
  if (decision.kind === 'use') {
    const reading = asReading(row?.reading);
    if (reading) return { ok: true, reading, cached: true };
    return { ok: false, reason: 'unreadable' };
  }
  if (decision.kind === 'busy') return { ok: false, reason: 'busy' };
  if (decision.kind === 'refuse') return { ok: false, reason: decision.reason };

  /* Claim the file before paying for it. Two presses at once: the second
     create hits the unique index (or the guarded update matches nothing) and
     waits rather than reading again. */
  try {
    if (!row) {
      await prisma.studioPlanReading.create({ data: { studioId, contentHash: hash, status: 'READING', attempts: 1, lastAttemptAt: now } });
    } else {
      const { count } = await prisma.studioPlanReading.updateMany({
        where: { id: row.id, attempts: row.attempts, lastAttemptAt: row.lastAttemptAt },
        data: { status: 'READING', attempts: { increment: 1 }, lastAttemptAt: now, reason: null },
      });
      if (count === 0) return { ok: false, reason: 'busy' };
    }
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') return { ok: false, reason: 'busy' };
    console.error('[floorplan] claim failed', error instanceof Error ? error.name : 'unknown');
    return { ok: false, reason: 'reader-failed' };
  }

  const result = await readFloorPlan(Buffer.from(bytes).toString('base64'), type);
  if (result.ok) {
    await prisma.studioPlanReading.update({
      where: key,
      data: { status: 'READ', reason: null, reading: result.reading as unknown as Prisma.InputJsonValue },
    });
    return { ok: true, reading: result.reading, cached: false };
  }
  await prisma.studioPlanReading.update({ where: key, data: { status: 'FAILED', reason: result.reason.slice(0, 40) } });
  return { ok: false, reason: result.reason };
}
