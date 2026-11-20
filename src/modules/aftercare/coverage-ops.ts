import 'server-only';

/**
 * Ops edits what the warranty covers (/ops/warranty-rules; owner, 20 Nov
 * 2026: "the coverage rules will mature over time"). One Interiors' default
 * list only: the rows with no studio, which every studio without rows of its
 * own uses. A rule is switched off, never deleted, so a past claim's area
 * still has its name. Every write checks the OPS role itself.
 */

import { prisma } from '@/lib/prisma';
import { requireRole } from '@/modules/auth/session';
import { checkRuleInput } from './rules';

export type OpsRuleResult = { ok: true; message: string } | { ok: false; error: string };

export interface OpsRule {
  id: string;
  key: string;
  label: string;
  examples: string;
  covered: boolean;
  serviceCategory: string | null;
  sortOrder: number;
  clientNote: string | null;
  active: boolean;
  claims: number;
}

export async function defaultCoverageRules(): Promise<OpsRule[]> {
  const rows = await prisma.warrantyCoverageRule.findMany({
    where: { studioId: null },
    orderBy: [{ active: 'desc' }, { sortOrder: 'asc' }, { key: 'asc' }],
    select: { id: true, key: true, label: true, examples: true, covered: true, serviceCategory: true, sortOrder: true, clientNote: true, active: true },
  });
  const counts = await prisma.warrantyClaim.groupBy({ by: ['ruleKey'], _count: { _all: true } });
  const byKey = new Map(counts.map((c) => [c.ruleKey, c._count._all]));
  return rows.map((r) => ({ ...r, claims: byKey.get(r.key) ?? 0 }));
}

/** Save one default rule (by id) or add a new one (no id). The key is fixed once a rule exists. */
export async function saveCoverageRule(id: string | null, raw: Record<string, unknown>): Promise<OpsRuleResult> {
  await requireRole('OPS');
  const checked = checkRuleInput(raw);
  if (!checked.ok) return checked;
  const v = checked.value;
  if (id) {
    const row = await prisma.warrantyCoverageRule.findFirst({ where: { id: id.slice(0, 64), studioId: null }, select: { id: true, key: true } });
    if (!row) return { ok: false, error: 'That rule is gone.' };
    await prisma.warrantyCoverageRule.update({
      where: { id: row.id },
      data: { label: v.label, examples: v.examples, covered: v.covered, serviceCategory: v.serviceCategory, sortOrder: v.sortOrder, clientNote: v.clientNote, active: v.active },
    });
    return { ok: true, message: `Saved ${row.key}. New claims are checked against it from now on.` };
  }
  const taken = await prisma.warrantyCoverageRule.findFirst({ where: { studioId: null, key: v.key }, select: { id: true } });
  if (taken) return { ok: false, error: `${v.key} is already a rule. Edit that one.` };
  await prisma.warrantyCoverageRule.create({ data: { ...v, studioId: null } });
  return { ok: true, message: `Added ${v.key}.` };
}
