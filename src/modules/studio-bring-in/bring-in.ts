import 'server-only';

/**
 * "Add an existing project" (owner, 15 and 20 Oct 2026;
 * docs/studio-os/BRING-IN-PROJECTS.md): Hauspire's team brings each running
 * project onto the platform — its client, its quotation (imported from the
 * Hauspire quotation app or built in our builder), where it is now, the money
 * already received, the team and the client's invite.
 *
 * Max studios only (`project.bringIn`: owner, PM, designer). "Bring it in"
 * writes everything in ONE transaction through the existing modules, so the
 * project is exactly a booked one: the quotation and its sales final
 * (revisions), the project, plan and invite (project/own-project.ts
 * `writeOwnProject` → portal/plan-write.ts), the phase (project/lifecycle.ts
 * `applyPhaseEvent`), the payments (rows read as 'earlier' by
 * payment-ledger.ts), the designer and team rows (as design-flow.ts and
 * Settings → Team write them) and the lead's timeline.
 *
 * Inside the transaction nothing uses another connection (the test database
 * has one): who is acting is looked up before it, as booking.ts does.
 */

import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { fromDb, toDb } from '@/lib/money';
import { currentMember, ACCESS_ERRORS, type StudioMemberRef } from '@/modules/studio/access';
import { can, needsAssignment } from '@/modules/studio/roles';
import { actingMember } from '@/modules/studio/lead-scope';
import { record } from '@/modules/studio-practice/events';
import { normalisePhone as leadPhone } from '@/modules/studio-practice/csv';
import { readPhases } from '@/modules/studio/payment-phases';
import { snapshotOf } from '@/modules/studio-sales/revisions';
import { nextRevisionNumber, readRevisionLines, readRevisionTotals, revisionLabel, sameLinesAs } from '@/modules/studio-sales/revision-rules';
import { cleanStages, readStages, scheduleAmounts, templateOrDefault, type PaymentStage } from '@/modules/studio-sales/payment-template';
import { PLAN_TX } from '@/modules/portal/plan-write';
import { templateStages } from '@/modules/portal/quote-to-plan';
import { designPlanInput } from '@/modules/studio-design/plan-input';
import { recordEvent, type ProjectActor } from '@/modules/project/events';
import { applyPhaseEvent } from '@/modules/project/lifecycle';
import { lockProject, mirror } from '@/modules/project/payments-flow';
import { syncDoneStages } from '@/modules/project/stage-settle';
import { dayToDb, istDay } from '@/modules/project/working-days';
import {
  accountRefusal,
  checkCustomer,
  ownQuoteRefusal,
  parseTotalDays,
  propertyTypeFrom,
} from '@/modules/project/own-project-rules';
import { defaultDays, freshCode, joinLink, readOwnQuote, Refused, sendOwnInvite, writeOwnProject } from '@/modules/project/own-project';
import { PLAN_KINDS, type PlanKind } from '@/modules/portal/tracker';
import { importKey, mapQuote, notInMaster, type MappedQuote, type SourceMatch } from './hauspire-map';
import { importOpenFor, NOT_CONNECTED, readHauspire, searchHauspire } from './hauspire-source';
import {
  anchorDays,
  BEFORE_JOINING,
  broughtInLine,
  checkPayments,
  doneSteps,
  isBringInPhase,
  shiftedStart,
  stepChoices,
  type BringInPhase,
  type PaymentInput,
  type StepChoice,
} from './rules';

type Tx = Prisma.TransactionClient;

const str = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().replace(/\s+/g, ' ').slice(0, max) : '');

async function bringInMember(): Promise<{ ok: true; member: StudioMemberRef } | { ok: false; error: string }> {
  const member = await currentMember();
  if (!member) return { ok: false, error: ACCESS_ERRORS.signIn };
  if (!can(member, 'project.bringIn')) return { ok: false, error: 'Bringing in a running project is for the owner, a project manager or a designer, on the Max plan.' };
  return { ok: true, member };
}

// ── What the flow opens with ─────────────────────────────────

export interface TeamPick {
  id: string;
  name: string;
  role: 'OWNER' | 'PM' | 'DESIGNER' | 'SUPERVISOR';
}

export interface BringInContext {
  /** The person may build a quotation in our builder (quote.write). */
  canBuild: boolean;
  /** The Hauspire quotation app is connected for this studio. */
  canImport: boolean;
  notConnected: string;
  designers: TeamPick[];
  pms: TeamPick[];
  supervisors: TeamPick[];
  me: { id: string; role: string };
  today: string;
}

export async function bringInContext(now = new Date()): Promise<BringInContext | null> {
  const m = await bringInMember();
  if (!m.ok) return null;
  const { member } = m;
  const [studio, team] = await Promise.all([
    prisma.studio.findUnique({ where: { id: member.studioId }, select: { slug: true } }),
    prisma.studioMember.findMany({
      where: { studioId: member.studioId, status: 'ACTIVE', role: { in: ['OWNER', 'PM', 'DESIGNER', 'SUPERVISOR'] } },
      orderBy: { createdAt: 'asc' },
      select: { id: true, role: true, user: { select: { name: true, phone: true } } },
    }),
  ]);
  const pick = (t: (typeof team)[number]): TeamPick => ({ id: t.id, name: t.user.name?.trim() || t.user.phone || 'Team member', role: t.role as TeamPick['role'] });
  return {
    canBuild: can(member, 'quote.write', { assigned: true }),
    canImport: importOpenFor(studio?.slug),
    notConnected: NOT_CONNECTED,
    designers: team.filter((t) => ['DESIGNER', 'PM', 'OWNER'].includes(t.role)).map(pick),
    pms: team.filter((t) => t.role === 'PM').map(pick),
    supervisors: team.filter((t) => t.role === 'SUPERVISOR').map(pick),
    me: { id: member.id, role: member.role },
    today: istDay(now),
  };
}

// ── a. The client ────────────────────────────────────────────

export interface LeadPick {
  id: string;
  name: string;
  phone: string | null;
  society: string | null;
  locality: string | null;
  config: string | null;
}

/** Leads that can be brought in: the studio's own, not One Interiors', not booked, not in the bin. */
const BRINGABLE: Prisma.StudioClientWhereInput = {
  deletedAt: null,
  isDemo: false,
  introductionId: null,
  bookedIntroductionId: null,
  source: { not: 'ONE_INTERIORS' },
};

const LEAD_SELECT = { id: true, name: true, phone: true, society: true, locality: true, config: true } as const;

export async function findLeads(raw: unknown): Promise<LeadPick[]> {
  const m = await bringInMember();
  if (!m.ok) return [];
  const q = typeof raw === 'string' ? raw.trim().slice(0, 60) : '';
  if (q.length < 2) return [];
  const digits = q.replace(/\D/g, '');
  return prisma.studioClient.findMany({
    where: {
      studioId: m.member.studioId,
      ...BRINGABLE,
      OR: [{ name: { contains: q, mode: 'insensitive' } }, ...(digits.length >= 4 ? [{ phone: { contains: digits } }] : [])],
    },
    orderBy: { updatedAt: 'desc' },
    take: 8,
    select: LEAD_SELECT,
  });
}

/** The duplicate check on mobile, like the lead form: the studio's lead on this number, binned ones included. */
export async function leadOnMobile(raw: unknown): Promise<{ ok: true; match: (LeadPick & { usable: boolean; why: string | null }) | null } | { ok: false; error: string }> {
  const m = await bringInMember();
  if (!m.ok) return m;
  const digits = typeof raw === 'string' ? leadPhone(raw) : null;
  if (!digits || digits.length !== 10) return { ok: false, error: 'A 10-digit mobile number, please.' };
  const row = await prisma.studioClient.findFirst({
    where: { studioId: m.member.studioId, phone: digits, isDemo: false },
    orderBy: { deletedAt: 'asc' },
    select: { ...LEAD_SELECT, deletedAt: true, introductionId: true, bookedIntroductionId: true, source: true },
  });
  if (!row) return { ok: true, match: null };
  const why = row.deletedAt
    ? 'This lead is in the bin. Restore it from Leads first.'
    : row.introductionId || row.source === 'ONE_INTERIORS'
      ? 'One Interiors introduced this client: their project starts when they sign in the app.'
      : row.bookedIntroductionId
        ? 'This client already has a project with you.'
        : null;
  return { ok: true, match: { id: row.id, name: row.name, phone: row.phone, society: row.society, locality: row.locality, config: row.config, usable: why === null, why } };
}

/**
 * The builder path needs the lead saved first (a quotation is written for a
 * lead). Only for someone who may write quotations; checked like the lead
 * form (the mobile not already on the board).
 */
export async function saveLeadForBuilder(input: { name: unknown; phone: unknown; email?: unknown; society?: unknown; locality?: unknown; config?: unknown }): Promise<{ ok: true; leadId: string } | { ok: false; error: string }> {
  const m = await bringInMember();
  if (!m.ok) return m;
  if (!can(m.member, 'quote.write', { assigned: true })) return { ok: false, error: 'Ask your owner or a project manager to build the quotation.' };
  const studioId = m.member.studioId;
  const name = str(input.name, 80);
  const phone = typeof input.phone === 'string' ? leadPhone(input.phone) : null;
  if (name.length < 2) return { ok: false, error: 'The client’s name, please.' };
  if (!phone || phone.length !== 10) return { ok: false, error: 'The client’s 10-digit mobile number, please.' };
  if (await prisma.studioClient.findFirst({ where: { studioId, phone, isDemo: false }, select: { id: true } })) {
    return { ok: false, error: 'A lead with this mobile number is already on your board. Pick that lead instead.' };
  }
  const stage = await prisma.studioStage.findFirst({ where: { studioId }, orderBy: [{ isIntake: 'desc' }, { sortOrder: 'asc' }], select: { id: true } });
  if (!stage) return { ok: false, error: 'Your pipeline has no columns. Settings → Pipeline.' };
  const by = await actingMember();
  const row = await prisma.studioClient.create({
    data: {
      studioId,
      stageId: stage.id,
      name,
      phone,
      email: str(input.email, 120) || null,
      society: str(input.society, 120) || null,
      locality: str(input.locality, 80) || null,
      config: str(input.config, 20) || null,
      source: 'OTHER',
      sourceNote: 'Brought in as a running project',
    },
    select: { id: true },
  });
  await record({ by, studioId, clientId: row.id, kind: 'CREATED', summary: 'Added while bringing in a running project', meta: { bringIn: true } });
  return { ok: true, leadId: row.id };
}

// ── b. The quotation ─────────────────────────────────────────

export async function searchSource(raw: unknown): Promise<{ ok: true; matches: SourceMatch[] } | { ok: false; error: string }> {
  const m = await bringInMember();
  if (!m.ok) return m;
  const slug = (await prisma.studio.findUnique({ where: { id: m.member.studioId }, select: { slug: true } }))?.slug ?? '';
  const r = await searchHauspire(slug, raw);
  return r.ok ? { ok: true, matches: r.value } : r;
}

export interface SourcePreview {
  sourceId: string;
  quote: MappedQuote;
  /** Indexes of lines whose product is not in the studio's product master. */
  notInMaster: number[];
  design: { number: string; totalPaise: number; lines: number } | null;
  /** Already imported: our quotation's number. */
  alreadyImported: string | null;
}

async function readSource(studioId: string, sourceId: unknown) {
  const slug = (await prisma.studio.findUnique({ where: { id: studioId }, select: { slug: true } }))?.slug ?? '';
  return readHauspire(slug, sourceId);
}

export async function previewSource(sourceId: unknown): Promise<{ ok: true; preview: SourcePreview } | { ok: false; error: string }> {
  const m = await bringInMember();
  if (!m.ok) return m;
  const r = await readSource(m.member.studioId, sourceId);
  if (!r.ok) return r;
  const quote = mapQuote(r.value.sales);
  const [products, existing] = await Promise.all([
    prisma.studioProduct.findMany({ where: { studioId: m.member.studioId }, select: { name: true } }),
    prisma.studioQuote.findFirst({ where: { studioId: m.member.studioId, importedFrom: importKey(r.value.sales.id) }, select: { number: true } }),
  ]);
  const design = r.value.design ? mapQuote(r.value.design) : null;
  return {
    ok: true,
    preview: {
      sourceId: r.value.sales.id,
      quote,
      notInMaster: [...notInMaster(quote.lines, products.map((p) => p.name))],
      design: design ? { number: design.number, totalPaise: design.totals.totalPaise, lines: design.lines.length } : null,
      alreadyImported: existing?.number ?? null,
    },
  };
}

export interface OurQuotePick {
  id: string;
  number: string;
  status: string;
  totalPaise: number;
  salesFinal: string | null;
  lines: number;
}

/** The lead's quotations in our builder that a project can start from. */
export async function ourQuotesFor(leadId: unknown): Promise<OurQuotePick[]> {
  const m = await bringInMember();
  if (!m.ok || typeof leadId !== 'string') return [];
  const studioId = m.member.studioId;
  const rows = await prisma.studioQuote.findMany({
    where: { studioId, clientId: leadId.slice(0, 64), stage: 'SALES', introductionId: null, briefId: null, status: { in: ['DRAFT', 'ISSUED', 'ACCEPTED'] } },
    orderBy: { updatedAt: 'desc' },
    take: 20,
    select: { id: true, number: true, status: true, ...QUOTE_FOR_SNAPSHOT, salesFinalRevision: { select: { n: true, lines: true, totals: true, totalPaise: true } }, salesFinalSchedule: true },
  });
  const started = await prisma.homeProject.findMany({ where: { signedQuoteId: { in: rows.map((r) => r.id) }, cancelledAt: null }, select: { signedQuoteId: true } });
  const taken = new Set(started.map((s) => s.signedQuoteId));
  return rows
    .filter((r) => !taken.has(r.id) && r.lines.length > 0)
    .map((r) => {
      const facts = finalFacts(r);
      return { id: r.id, number: r.number, status: r.status, totalPaise: facts.contractPaise, salesFinal: facts.usable ? revisionLabel(r.salesFinalRevision!.n) : null, lines: r.lines.length };
    });
}

const QUOTE_FOR_SNAPSHOT = {
  studioId: true,
  feeBps: true,
  discountBps: true,
  onSpotPaise: true,
  onSpotLabel: true,
  bookingAdvancePaise: true,
  gstBps: true,
  phases: true,
  studio: { select: { paymentPhases: true, paymentTemplate: true } },
  lines: {
    orderBy: { sortOrder: 'asc' as const },
    select: { room: true, product: true, code: true, unit: true, details: true, widthMm: true, heightMm: true, qtyMilli: true, ratePaise: true, amountPaise: true, note: true },
  },
} satisfies Prisma.StudioQuoteSelect;

type SnapshotQuote = Prisma.StudioQuoteGetPayload<{ select: typeof QUOTE_FOR_SNAPSHOT & { id: true } }> & {
  salesFinalRevision: { n: number; lines: Prisma.JsonValue; totals: Prisma.JsonValue; totalPaise: bigint } | null;
  salesFinalSchedule: Prisma.JsonValue;
};

/** Whether the quotation's sales final stands (marked, unchanged since), its total and stages; else the quotation as it is with the studio's stages. */
function finalFacts(q: SnapshotQuote): { usable: boolean; contractPaise: number; schedule: PaymentStage[] } {
  const snap = snapshotOf(q);
  const f = q.salesFinalRevision;
  const usable = f !== null && sameLinesAs(readRevisionLines(f.lines), snap.lines) && readRevisionTotals(f.totals).totalPaise === snap.totals.totalPaise;
  const schedule = (usable ? readStages(q.salesFinalSchedule) : null) ?? templateOrDefault(q.studio.paymentTemplate);
  return { usable, contractPaise: usable ? fromDb(f!.totalPaise) : snap.totals.totalPaise, schedule };
}

// ── c, d. Where it is now, and the payment stages ─────────────

export interface PlanPreview {
  totalPaise: number;
  stages: { label: string; amountPaise: number }[];
  choices: { DESIGN: StepChoice[]; EXECUTION: StepChoice[] };
  defaultDays: number;
}

/** The pick lists and stage amounts for a quotation total, from the studio's own steps and stages. */
export async function planPreview(input: { quote: QuoteChoice; config?: unknown }, now = new Date()): Promise<{ ok: true; preview: PlanPreview } | { ok: false; error: string }> {
  const m = await bringInMember();
  if (!m.ok) return m;
  return planPreviewAs(m.member, input, now);
}

/** `planPreview` for a member found another way (scripts/bring-in-hauspire-projects.ts); the caller has checked `project.bringIn`. */
export async function planPreviewAs(member: StudioMemberRef, input: { quote: QuoteChoice; config?: unknown }, now = new Date()): Promise<{ ok: true; preview: PlanPreview } | { ok: false; error: string }> {
  const m = { member };
  const resolved = await resolveQuote(m.member.studioId, input.quote);
  if (!resolved.ok) return resolved;
  const amounts = scheduleAmounts(resolved.schedule, resolved.contractPaise);
  if (!amounts.ok) return amounts;
  const days = resolved.defaultDays;
  const design = await designPlanInput(m.member.studioId, { propertyType: propertyTypeFrom(typeof input.config === 'string' ? input.config : resolved.config) });
  const stages = templateStages(dayToDb(istDay(now)), days, { ...design, payments: amounts.stages });
  return {
    ok: true,
    preview: {
      totalPaise: resolved.contractPaise,
      stages: amounts.stages.map((s) => ({ label: s.label, amountPaise: s.amountPaise })),
      choices: { DESIGN: stepChoices(stages, 'DESIGN'), EXECUTION: stepChoices(stages, 'EXECUTION') },
      defaultDays: days,
    },
  };
}

export type QuoteChoice = { kind: 'import'; sourceId: string } | { kind: 'ours'; quoteId: string };

type Resolved =
  | {
      ok: true;
      kind: 'import';
      mapped: MappedQuote;
      design: MappedQuote | null;
      contractPaise: number;
      schedule: PaymentStage[];
      defaultDays: number;
      config: string | null;
    }
  | { ok: true; kind: 'ours'; quoteId: string; contractPaise: number; schedule: PaymentStage[]; defaultDays: number; config: string | null }
  | { ok: false; error: string };

async function studioDefaults(studioId: string) {
  return prisma.studio.findUnique({
    where: { id: studioId },
    select: { paymentTemplate: true, paymentPhases: true, matchingProfile: true, tradeName: true, branding: { select: { welcomeNote: true, terms: true, bookingAdvancePaise: true } } },
  });
}

const daysFor = (matchingProfile: unknown) => defaultDays({ studio: { matchingProfile } } as unknown as Parameters<typeof defaultDays>[0]);

async function resolveQuote(studioId: string, choice: QuoteChoice): Promise<Resolved> {
  const studio = await studioDefaults(studioId);
  if (!studio) return { ok: false, error: 'Your studio was not found.' };
  if (choice?.kind === 'import') {
    const r = await readSource(studioId, choice.sourceId);
    if (!r.ok) return r;
    const mapped = mapQuote(r.value.sales);
    if (mapped.lines.length === 0 || mapped.totals.totalPaise <= 0) return { ok: false, error: 'That quotation has no lines to bring in.' };
    return {
      ok: true,
      kind: 'import',
      mapped,
      design: r.value.design ? mapQuote(r.value.design) : null,
      contractPaise: mapped.totals.totalPaise,
      schedule: templateOrDefault(studio.paymentTemplate),
      defaultDays: daysFor(studio.matchingProfile),
      config: mapped.bhk,
    };
  }
  if (choice?.kind === 'ours') {
    const q = await prisma.studioQuote.findFirst({
      where: { id: String(choice.quoteId ?? '').slice(0, 64), studioId, stage: 'SALES' },
      select: { id: true, config: true, ...QUOTE_FOR_SNAPSHOT, salesFinalRevision: { select: { n: true, lines: true, totals: true, totalPaise: true } }, salesFinalSchedule: true },
    });
    if (!q) return { ok: false, error: 'That quotation is not one of yours.' };
    if (q.lines.length === 0) return { ok: false, error: 'That quotation has no lines yet. Finish it in the builder first.' };
    const f = finalFacts(q);
    return { ok: true, kind: 'ours', quoteId: q.id, contractPaise: f.contractPaise, schedule: f.schedule, defaultDays: daysFor(studio.matchingProfile), config: q.config };
  }
  return { ok: false, error: 'Pick or import the quotation first.' };
}

// ── Bring it in ──────────────────────────────────────────────

export interface BringInInput {
  lead: { id: string } | { name: unknown; phone: unknown; email?: unknown; society?: unknown; locality?: unknown; config?: unknown };
  quote: QuoteChoice;
  /** The total the person confirmed matches what the client signed, paise. */
  confirmedTotalPaise: unknown;
  phase: unknown;
  /** The last step done (`stage:item` from the pick list), or null. */
  lastStep: unknown;
  /** SNAGS / WARRANTY: the handover day ('YYYY-MM-DD'); today when left out. */
  handoverOn?: unknown;
  totalDays?: unknown;
  payments: PaymentInput[];
  team: { designerId?: unknown; pmId?: unknown; supervisorId?: unknown };
  inviteNow: unknown;
}

export type BringInResult = { ok: true; projectId: string; invitedBy: string[]; inviteLink: string } | { ok: false; error: string };


export async function bringIn(input: BringInInput, now = new Date()): Promise<BringInResult> {
  const m = await bringInMember();
  if (!m.ok) return m;
  return bringInAs(m.member, await actingMember(), input, now);
}

/**
 * `bringIn` for a member found another way: the owner's sheet of running
 * projects (scripts/bring-in-hauspire-projects.ts, 30 Oct 2026). The caller
 * has checked `project.bringIn`; `by` names them on the timelines; `tx`
 * may give the transaction longer.
 */
export async function bringInAs(
  member: StudioMemberRef,
  by: { id: string; name: string } | null,
  input: BringInInput,
  now = new Date(),
  /** A longer transaction for a script on a slow connection (31 Oct 2026: three of 25 passed the 30 s); the page keeps PLAN_TX. */
  tx: { maxWait: number; timeout: number } = PLAN_TX,
): Promise<BringInResult> {
  const studioId = member.studioId;
  const today = istDay(now);

  if (!isBringInPhase(input.phase)) return { ok: false, error: 'Say where the project is now: design, execution, snags or warranty.' };
  const phase: BringInPhase = input.phase;
  const handoverOn = typeof input.handoverOn === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(input.handoverOn) ? input.handoverOn : today;
  if (handoverOn > today || handoverOn < '2020-01-01') return { ok: false, error: 'The handover day cannot be in the future.' };

  // The lead: theirs, or a new one checked like the lead form.
  let lead: { id: string; name: string; phone: string | null; society: string | null; locality: string | null; config: string | null; stageId: string } | null = null;
  let newLead: { name: string; phone: string; email: string | null; society: string | null; locality: string | null; config: string | null } | null = null;
  if ('id' in input.lead) {
    const row = await prisma.studioClient.findFirst({ where: { id: String(input.lead.id).slice(0, 64), studioId, ...BRINGABLE }, select: { ...LEAD_SELECT, stageId: true } });
    if (!row) return { ok: false, error: 'That lead cannot be brought in: it is not yours, is One Interiors’, already has a project, or is in the bin.' };
    lead = row;
  } else {
    const name = str(input.lead.name, 80);
    const phone = typeof input.lead.phone === 'string' ? leadPhone(input.lead.phone) : null;
    if (name.length < 2) return { ok: false, error: 'The client’s name, please.' };
    if (!phone || phone.length !== 10) return { ok: false, error: 'The client’s 10-digit mobile number, please.' };
    const dup = await prisma.studioClient.findFirst({ where: { studioId, phone, isDemo: false }, select: { id: true } });
    if (dup) return { ok: false, error: 'A lead with this mobile number is already on your board. Pick that lead instead.' };
    newLead = { name, phone, email: str(input.lead.email, 120) || null, society: str(input.lead.society, 120) || null, locality: str(input.lead.locality, 80) || null, config: str(input.lead.config, 20) || null };
  }
  const client = lead ?? newLead!;
  const customer = checkCustomer({ name: client.name, phone: client.phone ?? '', email: newLead?.email ?? undefined });
  if (!customer.ok) return customer;

  // The quotation and its stages.
  const resolved = await resolveQuote(studioId, input.quote);
  if (!resolved.ok) return resolved;
  if (Number(input.confirmedTotalPaise) !== resolved.contractPaise) {
    return { ok: false, error: 'The quotation’s total changed since you confirmed it. Check it again.' };
  }
  const amounts = scheduleAmounts(resolved.schedule, resolved.contractPaise);
  if (!amounts.ok) return amounts;
  const cleaned = cleanStages(resolved.schedule);
  if (!cleaned.ok) return cleaned;
  const payments = checkPayments(input.payments ?? [], amounts.stages, today);
  if (!payments.ok) return payments;
  const totalDays = parseTotalDays(input.totalDays, resolved.defaultDays);
  if (totalDays === null) return { ok: false, error: 'Handover between 7 days and two years from the start, please.' };

  // Where it is now, and the dates from today.
  const config = client.config ?? resolved.config;
  const design = await designPlanInput(studioId, { propertyType: propertyTypeFrom(config) });
  const planStages = (start: string) => templateStages(dayToDb(start), totalDays, { ...design, payments: amounts.stages });
  const draft = planStages(today);
  const done = doneSteps(draft, phase, input.lastStep);
  if (!done.ok) return done;
  const anchor = anchorDays(draft, done.done, today, handoverOn);
  if (!anchor.ok) return anchor;
  const startDay = shiftedStart(today, anchor.days);

  // The team.
  const team = await teamPicks(studioId, input.team);
  if (!team.ok) return team;

  // The customer's account, checked before the transaction like starting a project.
  const existing = await prisma.user.findUnique({ where: { phone: customer.value.phone }, select: { id: true, role: true, deletedAt: true, name: true, email: true } });
  const refused = accountRefusal(existing);
  if (refused) return { ok: false, error: refused };
  const emailTaken = customer.value.email ? (await prisma.user.findUnique({ where: { email: customer.value.email }, select: { id: true } })) !== null : false;
  const studio = await studioDefaults(studioId);
  if (!studio) return { ok: false, error: 'Your studio was not found.' };
  const won = await prisma.studioStage.findFirst({ where: { studioId, kind: 'WON' }, orderBy: { sortOrder: 'asc' }, select: { id: true, name: true } });
  const intake = won ?? (await prisma.studioStage.findFirst({ where: { studioId }, orderBy: [{ isIntake: 'desc' }, { sortOrder: 'asc' }], select: { id: true, name: true } }));
  if (!intake) return { ok: false, error: 'Your pipeline has no columns. Settings → Pipeline.' };

  const code = freshCode();
  const sourceNumber = resolved.kind === 'import' ? resolved.mapped.number : null;
  const line = broughtInLine(sourceNumber);
  const actor: ProjectActor = { type: 'STUDIO', id: member.userId };
  const handoverAt = dayToDb(handoverOn);

  try {
    const out = await prisma.$transaction(async (tx) => {
      // 1. The lead.
      const leadId =
        lead?.id ??
        (
          await tx.studioClient.create({
            data: {
              studioId,
              stageId: intake.id,
              name: newLead!.name,
              phone: newLead!.phone,
              email: newLead!.email,
              society: newLead!.society,
              locality: newLead!.locality,
              config: newLead!.config,
              source: 'OTHER',
              sourceNote: 'Brought in as a running project',
            },
            select: { id: true },
          })
        ).id;
      if (!lead) {
        await record({ db: tx, by, studioId, clientId: leadId, kind: 'CREATED', summary: 'Added while bringing in a running project', meta: { bringIn: true } });
      }

      // 2. The quotation, its revision and its sales final.
      const quoteId =
        resolved.kind === 'import'
          ? await importQuote(tx, { studioId, leadId, client, mapped: resolved.mapped, design: resolved.design, studio, now, byId: by?.id ?? null, by })
          : resolved.quoteId;
      if (resolved.kind === 'ours') {
        const own = await tx.studioQuote.findFirst({ where: { id: quoteId, studioId }, select: { clientId: true } });
        if (own?.clientId !== leadId) throw new Refused('That quotation is for another lead. Pick this client’s quotation.');
      }
      await ensureSalesFinal(tx, { studioId, quoteId, schedule: cleaned.stages, contractPaise: resolved.contractPaise, now, by });

      // 3. The project, exactly as a booked one.
      const q = await readOwnQuote(tx, studioId, quoteId);
      if (!q) throw new Refused('That quotation is not one of yours.');
      const alreadyStarted = (await tx.homeProject.findFirst({ where: { signedQuoteId: q.id }, select: { id: true } })) !== null;
      const refusal = ownQuoteRefusal({ status: q.status, introductionId: q.introductionId, briefId: q.briefId, client: q.client, lineCount: q.lines.length, totalPaise: resolved.contractPaise, alreadyStarted });
      if (refusal) throw new Refused(refusal);

      return writeOwnProject(tx, {
        member,
        q,
        customer: customer.value,
        existing,
        emailTaken,
        startOn: dayToDb(startDay),
        totalDays,
        contractPaise: resolved.contractPaise,
        stages: amounts.stages.map((s) => ({ label: s.label, pct: null, amountPaise: s.amountPaise })),
        signedAt: now,
        code,
        design,
        onCreated: async (db, project) => {
          // 4. Where it is now: the steps done before joining, the stages they finish.
          const stages = await db.homeProjectStage.findMany({
            where: { projectId: project.id },
            orderBy: { sortOrder: 'asc' },
            select: { id: true, kind: true, items: { orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }], select: { id: true, plannedOn: true } } },
          });
          if (stages.length !== draft.length || stages.some((s, i) => s.items.length !== draft[i]!.items.length)) {
            throw new Refused('The plan did not come out as expected. Nothing was brought in; try again.');
          }
          const todayDb = dayToDb(today);
          for (const [si, s] of stages.entries()) {
            const doneHere = done.done[si]!;
            let last: Date | null = null;
            for (const [ii, it] of s.items.entries()) {
              if (!doneHere.items.has(ii)) continue;
              const at = it.plannedOn && it.plannedOn < todayDb ? it.plannedOn : todayDb;
              if (!last || at > last) last = at;
              await db.homeChecklistItem.update({
                where: { id: it.id },
                data: { doneAt: at, doneById: member.userId, doneSource: 'BEFORE_JOINING', ...(s.kind === 'DESIGN' ? { doneNote: BEFORE_JOINING } : {}) },
              });
            }
            if (doneHere.complete) {
              await db.homeProjectStage.update({ where: { id: s.id }, data: { actualEnd: last ?? todayDb } });
              if ((PLAN_KINDS as readonly string[]).includes(s.kind)) await syncDoneStages(db, project.id, s.kind as PlanKind, true);
            }
          }

          // 5. The phase, through the lifecycle's own moves.
          if (phase !== 'DESIGN') {
            await db.homeProject.update({
              where: { id: project.id },
              data: { designClosedAt: now, ...(resolved.kind === 'import' && resolved.design ? { designFinalQuoteId: await designFinalId(db, studioId, quoteId) } : {}) },
            });
            await applyPhaseEvent(db, project.id, { kind: 'design.signed_off' }, actor, now);
          }
          if (phase === 'SNAGS' || phase === 'WARRANTY') {
            await applyPhaseEvent(db, project.id, { kind: 'handover.provisional' }, actor, handoverAt);
            await applyPhaseEvent(db, project.id, { kind: 'closure.fixed' }, actor, handoverAt);
          }
          if (phase === 'WARRANTY') await applyPhaseEvent(db, project.id, { kind: 'handover.signed', openSnags: 0 }, actor, handoverAt);

          // 6. Payments already received: 'earlier', counted as paid.
          await lockProject(db, project.id);
          for (const p of payments.value) {
            const row = await db.homeProjectPayment.create({
              data: {
                projectId: project.id,
                stageIndex: p.stageIndex,
                amountPaise: toDb(p.amountPaise),
                receivedOn: dayToDb(p.receivedOn),
                mode: p.mode,
                note: p.note ? `Received before joining One Interiors · ${p.note}` : 'Received before joining One Interiors',
                recordedById: member.userId,
                beforeJoining: true,
              },
              select: { id: true },
            });
            await recordEvent(db, { projectId: project.id, type: 'payment.recorded', actor, refId: row.id, payload: { stageIndex: p.stageIndex, amountPaise: p.amountPaise, mode: p.mode, beforeJoining: true } });
          }
          await mirror(db, project.id);

          // 7. The team.
          if (team.designer) {
            await db.homeProject.update({ where: { id: project.id }, data: { designerId: team.designer.id } });
            await recordEvent(db, { projectId: project.id, type: 'designer.assigned', actor, refId: team.designer.id, payload: { bringIn: true } });
          }
          const rows = [team.designer, team.pm, team.supervisor].filter((t): t is { id: string; role: string } => t !== null && needsAssignment(t.role as never));
          if (rows.length) await db.studioProjectMember.createMany({ data: rows.map((t) => ({ homeProjectId: project.id, memberId: t.id })), skipDuplicates: true });

          // 8. The record: the project, the lead, the audit.
          await db.homeProject.update({ where: { id: project.id }, data: { broughtInAt: now, broughtInFrom: sourceNumber } });
          await recordEvent(db, { projectId: project.id, type: 'project.brought_in', actor, refId: quoteId, payload: { phase, steps: done.done.reduce((n, s) => n + s.items.size, 0), payments: payments.value.length, imported: resolved.kind === 'import' } });
          await db.studioClient.updateMany({
            where: { id: leadId, studioId },
            data: { bookedIntroductionId: project.introductionId, bookedAt: now, preBookingStageId: lead?.stageId ?? null, ...(won ? { stageId: won.id, lostReason: null } : {}) },
          });
          await record({ db, by, studioId, clientId: leadId, kind: 'BOOKED', summary: `${line}.${won && lead?.stageId !== won.id ? ` Moved to ${won.name}.` : ''}`, meta: { quoteId, projectId: project.id, introductionId: project.introductionId, bringIn: true, phase } });
          await db.auditLog.create({
            data: { actorId: member.userId, action: 'project.brought_in', entityType: 'HomeProject', entityId: project.id, after: { quoteId, phase, source: sourceNumber ? 'hauspire' : 'builder', payments: payments.value.length } },
          });
        },
      });
    }, tx);

    let invitedBy: string[] = [];
    const invite = await prisma.homeProjectInvite.findUnique({ where: { code }, select: { phone: true, email: true, name: true } });
    if (input.inviteNow === true && invite) {
      const sent = await sendOwnInvite({ projectId: out.projectId, code, phone: invite.phone, email: invite.email, name: invite.name, studio: studio.tradeName });
      invitedBy = sent.sentVia;
    }
    return { ok: true, projectId: out.projectId, invitedBy, inviteLink: joinLink(code) };
  } catch (error) {
    if (error instanceof Refused) return { ok: false, error: error.reason };
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return { ok: false, error: 'This project or quotation was already brought in. Open it from Projects.' };
    }
    console.error('[bring-in] failed', error instanceof Error ? error.name : 'unknown');
    return { ok: false, error: 'That did not go through. Nothing was brought in; try again.' };
  }
}

async function teamPicks(
  studioId: string,
  raw: BringInInput['team'],
): Promise<{ ok: true; designer: { id: string; role: string } | null; pm: { id: string; role: string } | null; supervisor: { id: string; role: string } | null } | { ok: false; error: string }> {
  const one = async (v: unknown, roles: ('OWNER' | 'PM' | 'DESIGNER' | 'SUPERVISOR')[], what: string) => {
    if (typeof v !== 'string' || v === '') return { ok: true as const, row: null };
    const row = await prisma.studioMember.findFirst({ where: { id: v.slice(0, 64), studioId, status: 'ACTIVE', role: { in: roles } }, select: { id: true, role: true } });
    return row ? { ok: true as const, row } : { ok: false as const, error: `Pick the ${what} from your team.` };
  };
  const d = await one(raw?.designerId, ['DESIGNER', 'PM', 'OWNER'], 'designer');
  if (!d.ok) return d;
  const p = await one(raw?.pmId, ['PM'], 'project manager');
  if (!p.ok) return p;
  const s = await one(raw?.supervisorId, ['SUPERVISOR'], 'supervisor');
  if (!s.ok) return s;
  return { ok: true, designer: d.row, pm: p.row, supervisor: s.row };
}

/** A free quotation number: the source's own when free ("2312"), else with -H, -H2… */
async function freeNumber(tx: Tx, studioId: string, wanted: string): Promise<string> {
  let n = wanted;
  for (let i = 1; await tx.studioQuote.findFirst({ where: { studioId, number: n }, select: { id: true } }); i += 1) n = i === 1 ? `${wanted}-H` : `${wanted}-H${i}`;
  return n;
}

interface ImportCtx {
  studioId: string;
  leadId: string;
  client: { name: string; phone: string | null; society: string | null; locality: string | null; config: string | null };
  mapped: MappedQuote;
  design: MappedQuote | null;
  studio: NonNullable<Awaited<ReturnType<typeof studioDefaults>>>;
  now: Date;
  byId: string | null;
  by: { id: string; name: string } | null;
}

/** Our quotation from the source (and its Design Final when the app has one), or the one already imported. */
async function importQuote(tx: Tx, c: ImportCtx): Promise<string> {
  const key = importKey(c.mapped.sourceId);
  const prior = await tx.studioQuote.findFirst({ where: { studioId: c.studioId, importedFrom: key }, select: { id: true, clientId: true } });
  if (prior) {
    if (prior.clientId && prior.clientId !== c.leadId) throw new Refused('This quotation was already brought in for another lead.');
    return prior.id;
  }
  const phases = readPhases(c.studio.paymentPhases);
  const base = (m: MappedQuote) => ({
    studioId: c.studioId,
    clientId: c.leadId,
    clientName: c.client.name,
    clientPhone: c.client.phone,
    society: c.client.society,
    locality: c.client.locality ?? m.location,
    config: c.client.config ?? m.bhk,
    status: 'ISSUED' as const,
    issuedOn: m.terms.quoteDate ? dayToDb(m.terms.quoteDate) : c.now,
    quoteDate: m.terms.quoteDate ? dayToDb(m.terms.quoteDate) : null,
    feeBps: m.terms.feeBps,
    discountBps: m.terms.discountBps,
    onSpotPaise: toDb(m.terms.onSpotPaise),
    onSpotLabel: m.terms.onSpotLabel,
    gstBps: m.terms.gstBps,
    bookingAdvancePaise: c.studio.branding?.bookingAdvancePaise ?? BigInt(0),
    ...(phases ? { phases: phases as unknown as Prisma.InputJsonValue } : {}),
    welcomeNote: c.studio.branding?.welcomeNote ?? null,
    terms: c.studio.branding?.terms ?? null,
    importedAt: c.now,
    lines: {
      create: m.lines.map((l) => ({
        room: l.room,
        product: l.product,
        code: l.code,
        unit: l.unit,
        details: l.details,
        widthMm: l.widthMm,
        heightMm: l.heightMm,
        qtyMilli: l.qtyMilli,
        ratePaise: toDb(l.ratePaise),
        amountPaise: toDb(l.amountPaise),
        sortOrder: l.sortOrder,
      })),
    },
  });
  const number = await freeNumber(tx, c.studioId, c.mapped.number);
  const sales = await tx.studioQuote.create({ data: { ...base(c.mapped), number, stage: 'SALES', importedFrom: key }, select: { id: true, number: true } });
  await record({ db: tx, by: c.by, studioId: c.studioId, clientId: c.leadId, kind: 'QUOTED', summary: `Quotation ${sales.number} brought in from the Hauspire quotation app (Q-${c.mapped.number})`, meta: { quoteId: sales.id, bringIn: true } });
  if (c.design) {
    const dNumber = await freeNumber(tx, c.studioId, `${sales.number}-D`);
    const df = await tx.studioQuote.create({
      data: { ...base(c.design), number: dNumber, stage: 'DESIGN', basedOnId: sales.id, importedFrom: importKey(c.design.sourceId) },
      select: { id: true },
    });
    await writeRevision(tx, c.studioId, df.id, c.by);
  }
  return sales.id;
}

async function designFinalId(tx: Tx, studioId: string, salesId: string): Promise<string | null> {
  const df = await tx.studioQuote.findFirst({ where: { studioId, basedOnId: salesId, stage: 'DESIGN' }, orderBy: { createdAt: 'desc' }, select: { id: true } });
  return df?.id ?? null;
}

/** The next frozen revision of the quotation as it stands (the shape revisions.ts keeps), inside the transaction. */
async function writeRevision(tx: Tx, studioId: string, quoteId: string, by: { id: string; name: string } | null): Promise<{ id: string; n: number; totalPaise: number }> {
  const q = await tx.studioQuote.findFirst({ where: { id: quoteId, studioId }, select: { id: true, ...QUOTE_FOR_SNAPSHOT } });
  if (!q) throw new Refused('That quotation is not one of yours.');
  const snap = snapshotOf(q);
  const last = await tx.studioQuoteRevision.findFirst({ where: { studioId, quoteId }, orderBy: { n: 'desc' }, select: { n: true } });
  const n = nextRevisionNumber(last ? [last.n] : []);
  const row = await tx.studioQuoteRevision.create({
    data: {
      studioId,
      quoteId,
      n,
      lines: snap.lines as unknown as Prisma.InputJsonValue,
      terms: snap.terms as unknown as Prisma.InputJsonValue,
      totalPaise: toDb(snap.totals.totalPaise),
      totals: snap.totals as unknown as Prisma.InputJsonValue,
      sentById: by?.id ?? null,
      sentByName: by?.name ?? null,
    },
    select: { id: true },
  });
  return { id: row.id, n, totalPaise: snap.totals.totalPaise };
}

/** The quotation's sales final: kept when it stands; else a new revision of it as it is, marked, with the studio's stages. */
async function ensureSalesFinal(tx: Tx, c: { studioId: string; quoteId: string; schedule: PaymentStage[]; contractPaise: number; now: Date; by: { id: string; name: string } | null }): Promise<void> {
  const q = await tx.studioQuote.findFirst({
    where: { id: c.quoteId, studioId: c.studioId },
    select: { id: true, number: true, status: true, clientId: true, ...QUOTE_FOR_SNAPSHOT, salesFinalRevision: { select: { n: true, lines: true, totals: true, totalPaise: true } }, salesFinalSchedule: true },
  });
  if (!q) throw new Refused('That quotation is not one of yours.');
  if (finalFacts(q).usable) return;
  const rev = await writeRevision(tx, c.studioId, q.id, c.by);
  if (rev.totalPaise !== c.contractPaise) throw new Refused('The quotation’s total changed since you confirmed it. Check it again.');
  await tx.studioQuote.update({
    where: { id: q.id },
    data: {
      status: q.status === 'DRAFT' ? 'ISSUED' : q.status,
      issuedOn: q.status === 'DRAFT' ? c.now : undefined,
      salesFinalRevisionId: rev.id,
      salesFinalSchedule: c.schedule as unknown as Prisma.InputJsonValue,
      salesFinalAt: c.now,
      salesFinalById: c.by?.id ?? null,
    },
  });
  if (q.clientId) {
    await record({ db: tx, by: c.by, studioId: c.studioId, clientId: q.clientId, kind: 'SALES_FINAL', summary: `${revisionLabel(rev.n)} of ${q.number} marked as the sales final while bringing in the project`, meta: { quoteId: q.id, revision: rev.n, bringIn: true } });
  }
}

/** For the project page (the caller has checked the member may read it): "Brought in from … on …", or null. */
export async function broughtInOf(projectId: string, studioId: string): Promise<{ line: string; on: string } | null> {
  const p = await prisma.homeProject.findFirst({ where: { id: projectId, introduction: { studioId } }, select: { broughtInAt: true, broughtInFrom: true } });
  if (!p?.broughtInAt) return null;
  return { line: broughtInLine(p.broughtInFrom), on: istDay(p.broughtInAt) };
}
