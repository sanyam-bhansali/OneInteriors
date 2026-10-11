import 'server-only';

/**
 * The studio's sales settings (Studio OS Phase 1): its payment stages
 * (Settings, Payment stages — owner) and its own lead source names
 * (Settings, Lead sources — owner and PM). Scoped by the member's studio.
 */

import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { currentMember } from '@/modules/studio/access';
import { can } from '@/modules/studio/roles';
import { leadStudioId } from '@/modules/studio/lead-scope';
import { cleanStages, templateOrDefault, readStages, type PaymentStage } from './payment-template';

export type SettingsResult = { ok: true } | { ok: false; error: string };

/** The studio's payment stages, and whether they are its own or Hauspire's default. */
export async function myPaymentTemplate(): Promise<{ stages: PaymentStage[]; isDefault: boolean } | null> {
  const studioId = await leadStudioId();
  if (!studioId) return null;
  const row = await prisma.studio.findUnique({ where: { id: studioId }, select: { paymentTemplate: true } });
  return { stages: templateOrDefault(row?.paymentTemplate), isDefault: readStages(row?.paymentTemplate) === null };
}

export async function savePaymentTemplate(stages: PaymentStage[]): Promise<SettingsResult> {
  const member = await currentMember();
  if (!member || !can(member, 'payments.template')) return { ok: false, error: 'Only the studio owner sets the payment stages.' };
  if (!Array.isArray(stages)) return { ok: false, error: 'Something went wrong. Reload and try again.' };
  const cleaned = cleanStages(
    stages.map((s) => ({
      label: String(s?.label ?? ''),
      note: String(s?.note ?? ''),
      kind: s?.kind === 'FIXED' ? 'FIXED' : 'PCT',
      ...(typeof s?.amountPaise === 'number' ? { amountPaise: s.amountPaise } : {}),
      ...(typeof s?.pct === 'number' ? { pct: s.pct } : {}),
      ...(typeof s?.refundDays === 'number' ? { refundDays: s.refundDays } : {}),
    })),
  );
  if (!cleaned.ok) return cleaned;
  await prisma.studio.update({ where: { id: member.studioId }, data: { paymentTemplate: cleaned.stages as unknown as Prisma.InputJsonValue } });
  return { ok: true };
}

export interface LeadSourceRow {
  id: string;
  name: string;
  leads: number;
}

/** The studio's own source names, for every lead form and filter. */
export async function myLeadSources(): Promise<LeadSourceRow[]> {
  const studioId = await leadStudioId();
  if (!studioId) return [];
  try {
    const rows = await prisma.studioLeadSource.findMany({
      where: { studioId },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, _count: { select: { clients: true } } },
    });
    return rows.map((r) => ({ id: r.id, name: r.name, leads: r._count.clients }));
  } catch {
    return [];
  }
}

export async function addLeadSource(name: unknown): Promise<SettingsResult> {
  const member = await currentMember();
  if (!member || !can(member, 'lead.import')) return { ok: false, error: 'Only the owner or a project manager adds sources.' };
  const clean = typeof name === 'string' ? name.trim().replace(/\s+/g, ' ').slice(0, 40) : '';
  if (clean.length < 2) return { ok: false, error: 'Name the source, like "Housing.com".' };
  const count = await prisma.studioLeadSource.count({ where: { studioId: member.studioId } });
  if (count >= 30) return { ok: false, error: 'Thirty sources is the most. Remove one you no longer use.' };
  try {
    await prisma.studioLeadSource.create({ data: { studioId: member.studioId, name: clean } });
    return { ok: true };
  } catch {
    return { ok: false, error: 'You already have a source with that name.' };
  }
}

/** Remove a name. Its leads become plain "Other"; nothing else changes. */
export async function removeLeadSource(id: unknown): Promise<SettingsResult> {
  const member = await currentMember();
  if (!member || !can(member, 'lead.import')) return { ok: false, error: 'Only the owner or a project manager removes sources.' };
  if (typeof id !== 'string') return { ok: false, error: 'That source is not yours.' };
  const { count } = await prisma.studioLeadSource.deleteMany({ where: { id, studioId: member.studioId } });
  return count > 0 ? { ok: true } : { ok: false, error: 'That source is not yours.' };
}
