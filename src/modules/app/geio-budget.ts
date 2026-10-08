import 'server-only';

/**
 * GEIO's monthly spending cap.
 *
 * Spend is kept in the shared rate-limit table (`rate_limit_hits`), one row
 * per 10 paise spent, in one bucket, over a rolling 30 days — so the cap
 * holds across every running instance and needs no table of its own. Rows
 * older than the window are pruned on each check, as the rate limiter does.
 *
 * Over the cap, GEIO stops calling the model and the screen falls back to
 * its written answers (photos go to the expert). A database that cannot be
 * reached counts as over the cap: this guards money, so it fails closed,
 * unlike the form limiter. A build with no database at all (local, or
 * SAMPLE_DATA_ONLY previews) keeps the count in memory, per instance — a
 * weaker cap, which is why the API key should also carry a spend limit in
 * the Anthropic console.
 */

import { prisma } from '@/lib/prisma';
import { hasDatabase } from '@/lib/env';

const BUCKET = 'geio:spend';
const UNIT_PAISE = 10;
const WINDOW_MS = 30 * 86_400_000;
const DEFAULT_BUDGET_INR = 1500;
/** No single answer writes more rows than this, whatever the usage says. */
const MAX_UNITS_PER_ANSWER = 500;

let memory: { at: number; units: number }[] = [];

export function monthlyBudgetPaise(): number {
  const raw = Number(process.env.GEIO_MONTHLY_BUDGET_INR);
  const inr = Number.isFinite(raw) && raw >= 0 ? raw : DEFAULT_BUDGET_INR;
  return Math.round(inr * 100);
}

/** Spend in the last 30 days, in paise; null when the database cannot say. */
async function spentPaise(): Promise<number | null> {
  const cutoff = new Date(Date.now() - WINDOW_MS);
  if (!hasDatabase()) {
    memory = memory.filter((m) => m.at >= cutoff.getTime());
    return memory.reduce((n, m) => n + m.units, 0) * UNIT_PAISE;
  }
  try {
    await prisma.rateLimitHit.deleteMany({ where: { bucket: BUCKET, createdAt: { lt: cutoff } } });
    return (await prisma.rateLimitHit.count({ where: { bucket: BUCKET } })) * UNIT_PAISE;
  } catch (error) {
    console.error('[geio] spend unreadable, treating as over the cap', error instanceof Error ? error.name : 'unknown');
    return null;
  }
}

export async function withinBudget(): Promise<boolean> {
  const spent = await spentPaise();
  if (spent === null) return false;
  const ok = spent < monthlyBudgetPaise();
  if (!ok) console.warn('[geio] monthly budget reached; answering from the written preview');
  return ok;
}

export async function recordSpend(paise: number): Promise<void> {
  const units = Math.min(MAX_UNITS_PER_ANSWER, Math.max(1, Math.ceil(paise / UNIT_PAISE)));
  if (!hasDatabase()) {
    memory.push({ at: Date.now(), units });
    return;
  }
  try {
    await prisma.rateLimitHit.createMany({ data: Array.from({ length: units }, () => ({ bucket: BUCKET })) });
  } catch (error) {
    console.error('[geio] spend not recorded', error instanceof Error ? error.name : 'unknown');
  }
}
