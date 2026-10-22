import 'server-only';

/**
 * The studio's sales settings (Studio OS Phase 1): its payment stages
 * (Settings, Payment stages — owner) and its own lead source names
 * (Settings, Lead sources — owner and PM), and "New leads go to" (owner,
 * 22 Oct 2026; lead-routing.ts): who gets a lead that arrives by itself, for
 * the studio and per lead door. Scoped by the member's studio.
 */

import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { currentMember } from '@/modules/studio/access';
import { can } from '@/modules/studio/roles';
import { leadStudioId } from '@/modules/studio/lead-scope';
import { cleanStages, templateOrDefault, readStages, type PaymentStage } from './payment-template';
import { canHeadTeam, canTakeLeads, checkOverride, checkRouting, describeRouting, readRouting, type RoutingMember, type StudioRouting } from './lead-routing';
import type { StudioRoleName } from '@/modules/studio/roles';
import { opensFullSoftware, planOf } from '@/modules/studio/software-plan';
import { displayName } from '@/modules/studio-practice/team';

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
  if (!member || !can(member, 'lead.settings')) return { ok: false, error: 'Your role does not include lead settings. Ask your studio owner.' };
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
  if (!member || !can(member, 'lead.settings')) return { ok: false, error: 'Your role does not include lead settings. Ask your studio owner.' };
  if (typeof id !== 'string') return { ok: false, error: 'That source is not yours.' };
  const { count } = await prisma.studioLeadSource.deleteMany({ where: { id, studioId: member.studioId } });
  return count > 0 ? { ok: true } : { ok: false, error: 'That source is not yours.' };
}

// ── New leads go to (owner, 22 Oct 2026) ───────────────────────

export interface RoutingPerson {
  id: string;
  name: string;
  role: StudioRoleName;
  /** Active and on a role that works leads in this plan. */
  canTake: boolean;
  /** Can have a team pool new leads land in (TEAM): an active salesperson (sales roles, owner 22 Oct 2026). */
  canHead: boolean;
}

export interface LeadRoutingScreen {
  canManage: boolean;
  routing: StudioRouting;
  /** What the rule does now, in one sentence. */
  summary: string;
  /** Everyone who could be picked, and anyone already picked who now cannot take leads. */
  people: RoutingPerson[];
}

async function routingTeam(studioId: string): Promise<{ members: RoutingMember[]; fullSoftware: boolean }> {
  const [studio, rows] = await Promise.all([
    prisma.studio.findUnique({ where: { id: studioId }, select: { softwarePlan: true, fullSoftware: true } }),
    prisma.studioMember.findMany({
      where: { studioId },
      orderBy: { createdAt: 'asc' },
      select: { id: true, role: true, status: true, user: { select: { name: true, email: true } } },
    }),
  ]);
  return {
    fullSoftware: opensFullSoftware(planOf(studio)),
    members: rows.map((m) => ({ id: m.id, role: m.role, status: m.status, name: displayName(m.user?.name ?? null, m.user?.email ?? null) })),
  };
}

/**
 * Settings → Lead sources, "New leads go to". The owner, project managers
 * and anyone whose sales role has lead settings (`lead.settings`; it was
 * `lead.import` until sales roles, owner 22 Oct 2026) see and change it.
 */
export async function myLeadRouting(): Promise<LeadRoutingScreen | null> {
  const member = await currentMember();
  if (!member) return null;
  const canManage = can(member, 'lead.settings');
  try {
    const studio = await prisma.studio.findUnique({
      where: { id: member.studioId },
      select: { leadRouteMode: true, leadRouteMemberId: true, leadRouteTurnIds: true },
    });
    const routing = readRouting(studio);
    if (!canManage) return { canManage, routing, summary: '', people: [] };
    const { members, fullSoftware } = await routingTeam(member.studioId);
    const picked = new Set([routing.personId, ...routing.turnIds].filter(Boolean));
    const people = members
      .map((m) => ({ id: m.id, name: m.name, role: m.role, canTake: canTakeLeads(m, fullSoftware), canHead: canHeadTeam(m) }))
      .filter((p) => p.canTake || p.canHead || picked.has(p.id));
    return { canManage, routing, summary: describeRouting(routing, members, fullSoftware), people };
  } catch (error) {
    console.error('[settings] lead routing failed', error instanceof Error ? error.message : 'unknown');
    return null;
  }
}

export async function saveLeadRouting(input: { mode: unknown; personId?: unknown; turnIds?: unknown }): Promise<SettingsResult> {
  const member = await currentMember();
  if (!member || !can(member, 'lead.settings')) return { ok: false, error: 'Your role does not include deciding where new leads go. Ask your studio owner.' };
  const { members, fullSoftware } = await routingTeam(member.studioId);
  const checked = checkRouting(input, members, fullSoftware);
  if (!checked.ok) return checked;
  const r = checked.routing;
  await prisma.studio.update({
    where: { id: member.studioId },
    data: { leadRouteMode: r.mode, leadRouteMemberId: r.personId, leadRouteTurnIds: r.turnIds },
  });
  return { ok: true };
}

/** One door's override ("" follows the studio). Scoped by the member's studio. */
export async function saveConnectionRouting(connectionId: unknown, input: { mode: unknown; personId?: unknown }): Promise<SettingsResult> {
  const member = await currentMember();
  if (!member || !can(member, 'lead.settings')) return { ok: false, error: 'Your role does not include deciding where new leads go. Ask your studio owner.' };
  if (typeof connectionId !== 'string') return { ok: false, error: 'That connection is not yours.' };
  const { members, fullSoftware } = await routingTeam(member.studioId);
  const checked = checkOverride(input, members, fullSoftware);
  if (!checked.ok) return checked;
  const { count } = await prisma.studioLeadConnection.updateMany({
    where: { id: connectionId, studioId: member.studioId },
    data: { routeMode: checked.mode, routeMemberId: checked.personId },
  });
  return count > 0 ? { ok: true } : { ok: false, error: 'That connection is not yours.' };
}
