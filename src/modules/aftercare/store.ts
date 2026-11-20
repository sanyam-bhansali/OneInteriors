import 'server-only';

/**
 * Warranty claims and service visits, read and written (owner, 20 Nov 2026;
 * docs/studio-os/AFTERCARE.md). The rules are in rules.ts; this file loads
 * the project, applies them, and writes.
 *
 * The order on every submit, as the owner put it: the project is the
 * client's and on a Max studio; then the payment gate (100% paid, from the
 * ledger); then the rest. Nothing is stored, and no photo is uploaded,
 * before the gate passes.
 *
 * Who may submit: the owner of the brief, as for snags. Family can see the
 * page, not raise.
 */

import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { formatINR, fromDb, toDb } from '@/lib/money';
import { resolveSiteUrl } from '@/lib/site';
import { notify, notifyStudio } from '@/modules/notify/service';
import { CUSTOMER_PAYMENT_SELECT, CUSTOMER_QUOTE_CHANGE_SELECT, customerLedger } from '@/modules/portal/money-locker-view';
import { effectivePhase, isPhase } from '@/modules/project/lifecycle-rules';
import { createWarrantyClaimSnag } from '@/modules/project/snag-flow';
import { addDays, dayFromDb, istDay } from '@/modules/project/working-days';
import { storeSitePhoto } from '@/modules/storage/site-photos';
import { can, currentMember } from '@/modules/studio/access';
import { planOf } from '@/modules/studio/software-plan';
import { createPaymentLink, razorpayReady, refundPayment } from './razorpay';
import { READER_MODEL, readClaim, type ReaderPhoto } from './reader';
import {
  CLAIM_DESCRIPTION_MAX,
  CLAIM_PHOTOS_MAX,
  HOLD_MINUTES,
  notCoveredReply,
  SERVICE_CATEGORIES,
  SERVICE_DESCRIPTION_MAX,
  SERVICE_LABEL,
  SLOT_STARTS,
  STUDIO_MOVE_DAYS,
  checkDescription,
  checkServiceChargesInput,
  bookingIsFree,
  checkSlot,
  checkStudioSlot,
  claimTitle,
  coverageRulesFrom,
  decideCoverage,
  freeServiceUntil,
  isServiceCategory,
  paymentGate,
  readServiceCharges,
  readSlotVisits,
  serviceSlotDays,
  serviceState,
  slotDayLabel,
  slotKey,
  slotLabel,
  warrantyOpen,
  type CoverageRule,
  type PaymentGate,
  type ServiceCategory,
  type ServiceState,
  type SlotDay,
} from './rules';

export const AFTERCARE_ERRORS = {
  notYours: 'That project is not yours.',
  ownerOnly: 'Only the person whose home it is can raise this.',
  notOpen: 'This is not open for your project yet.',
  needsPhoto: 'Add at least one photo of the problem.',
  area: 'Pick what the problem is about.',
  category: 'Pick what kind of work it is.',
  noCharge: 'Your studio has not opened visits for this kind of work yet.',
  slotFull: 'That slot was just taken. Pick another one.',
  photos: `At most ${CLAIM_PHOTOS_MAX} photos.`,
} as const;

const PROJECT_SELECT = {
  id: true,
  phase: true,
  warrantyEndsOn: true,
  handoverSignedAt: true,
  cancelledAt: true,
  paymentPhases: true,
  payments: { select: CUSTOMER_PAYMENT_SELECT },
  quoteChanges: { select: CUSTOMER_QUOTE_CHANGE_SELECT },
  family: { select: { userId: true, joinedAt: true, removedAt: true } },
  introduction: {
    select: {
      studioId: true,
      studio: { select: { tradeName: true, softwarePlan: true, fullSoftware: true, serviceCharges: true, serviceSlotVisits: true } },
      brief: { select: { userId: true, user: { select: { name: true, phone: true, email: true } } } },
    },
  },
} satisfies Prisma.HomeProjectSelect;

type ProjectRow = Prisma.HomeProjectGetPayload<{ select: typeof PROJECT_SELECT }>;

interface Loaded {
  p: ProjectRow;
  owner: boolean;
  studioId: string;
  phase: string;
  gate: PaymentGate;
  /** The last day of the free service month after the handover sign-off; null before the sign-off. */
  freeUntil: string | null;
}

/** The project, if `userId` is its owner or joined family, on a Max studio. */
async function load(userId: string, projectId: string): Promise<{ ok: true; v: Loaded } | { ok: false; error: string }> {
  if (!projectId) return { ok: false, error: AFTERCARE_ERRORS.notYours };
  const p = await prisma.homeProject.findUnique({ where: { id: projectId.slice(0, 64) }, select: PROJECT_SELECT });
  if (!p || p.cancelledAt) return { ok: false, error: AFTERCARE_ERRORS.notYours };
  const owner = p.introduction.brief.userId === userId;
  const family = p.family.some((f) => f.userId === userId && f.joinedAt !== null && f.removedAt === null);
  if (!owner && !family) return { ok: false, error: AFTERCARE_ERRORS.notYours };
  /* Max studios only while it is tested (owner, 20 Nov 2026). */
  if (planOf(p.introduction.studio) !== 'MAX') return { ok: false, error: AFTERCARE_ERRORS.notOpen };
  const phase = isPhase(p.phase) ? effectivePhase(p.phase, p.warrantyEndsOn ? dayFromDb(p.warrantyEndsOn) : null, new Date()) : 'DESIGN';
  const freeUntil = freeServiceUntil(p.handoverSignedAt ? istDay(p.handoverSignedAt) : null);
  return { ok: true, v: { p, owner, studioId: p.introduction.studioId, phase, gate: paymentGate(customerLedger(p)), freeUntil } };
}

/** Has the project used its one free visit (a booked visit at ₹0)? */
async function freeVisitUsed(projectId: string): Promise<boolean> {
  return (await prisma.serviceRequest.count({ where: { projectId, status: 'BOOKED', chargePaise: 0 } })) > 0;
}

async function rulesFor(studioId: string): Promise<CoverageRule[]> {
  const own = await prisma.warrantyCoverageRule.findMany({ where: { studioId, active: true } });
  if (own.length > 0) return coverageRulesFrom(own);
  return coverageRulesFrom(await prisma.warrantyCoverageRule.findMany({ where: { studioId: null, active: true } }));
}

/** Slots taken at the studio, counting live holds and booked visits, over the days shown. */
async function takenSlots(studioId: string, from: string, to: string, now: Date): Promise<Map<string, number>> {
  const rows = await prisma.serviceRequest.findMany({
    where: {
      studioId,
      slotDay: { gte: new Date(`${from}T00:00:00Z`), lte: new Date(`${to}T00:00:00Z`) },
      OR: [{ status: 'BOOKED' }, { status: 'HELD', holdUntil: { gt: now } }],
    },
    select: { slotDay: true, slotStart: true },
  });
  const m = new Map<string, number>();
  for (const r of rows) {
    const k = slotKey(dayFromDb(r.slotDay), r.slotStart);
    m.set(k, (m.get(k) ?? 0) + 1);
  }
  return m;
}

// ── The client's page ──────────────────────────────────────────

export interface AftercareView {
  projectId: string;
  studio: string;
  owner: boolean;
  payments: { cleared: boolean; pendingPaise: number | null; message: string | null };
  warranty: { open: boolean; message: string | null; endsOn: string | null; areas: { key: string; label: string }[] };
  service: {
    ready: boolean;
    /** The one free visit within 30 days of the handover is still open (the payment gate still applies). */
    free: boolean;
    freeUntil: string | null;
    /** `chargePaise` is what the client pays now; `listPaise` the studio's visiting charge, shown struck out in the free month (null: none set). */
    categories: { key: ServiceCategory; label: string; chargePaise: number; listPaise: number | null }[];
    days: SlotDay[];
  };
  /** `note`: the studio's line when it moved, cancelled or finished the visit; `refunded` when a cancelled paid visit was refunded. */
  requests: { id: string; category: string; when: string; chargePaise: number; listPaise: number | null; state: ServiceState; payUrl: string | null; note: string | null; refunded: boolean }[];
  claims: { id: string; at: string; covered: boolean; area: string; snagId: string | null }[];
}

export async function aftercareView(userId: string, projectId: string, now = new Date()): Promise<{ ok: true; view: AftercareView } | { ok: false; error: string }> {
  const r = await load(userId, projectId);
  if (!r.ok) return r;
  const { p, owner, studioId, phase, gate, freeUntil } = r.v;
  const rules = await rulesFor(studioId);
  const charges = readServiceCharges(p.introduction.studio.serviceCharges);
  const today = istDay(now);
  const free = bookingIsFree(today, freeUntil, freeUntil !== null && (await freeVisitUsed(p.id)));
  const days0 = serviceSlotDays(today, readSlotVisits(p.introduction.studio.serviceSlotVisits), new Map());
  const taken = await takenSlots(studioId, days0[0]!.date, days0[days0.length - 1]!.date, now);
  const [requests, claims] = await Promise.all([
    prisma.serviceRequest.findMany({
      where: { projectId: p.id },
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: { id: true, category: true, slotDay: true, slotStart: true, chargePaise: true, status: true, holdUntil: true, payUrl: true, studioNote: true, refundId: true },
    }),
    prisma.warrantyClaim.findMany({ where: { projectId: p.id }, orderBy: { createdAt: 'desc' }, take: 20, select: { id: true, createdAt: true, covered: true, ruleKey: true, snagId: true } }),
  ]);
  const warranty = warrantyOpen(phase);
  const label = (k: string) => rules.find((x) => x.key === k)?.label ?? k;
  return {
    ok: true,
    view: {
      projectId: p.id,
      studio: p.introduction.studio.tradeName,
      owner,
      payments: { cleared: gate.cleared, pendingPaise: gate.pendingPaise, message: gate.message },
      warranty: {
        open: warranty.ok,
        message: warranty.ok ? null : warranty.error,
        endsOn: p.warrantyEndsOn ? dayFromDb(p.warrantyEndsOn) : null,
        areas: rules.map((x) => ({ key: x.key, label: x.label })),
      },
      service: {
        ready: free || razorpayReady(),
        free,
        freeUntil,
        /* The free visit: every kind of work open at ₹0; otherwise only the kinds the studio has a charge for. */
        categories: SERVICE_CATEGORIES.filter((c) => free || charges[c] !== undefined).map((c) => ({ key: c, label: SERVICE_LABEL[c], chargePaise: free ? 0 : charges[c]!, listPaise: charges[c] ?? null })),
        days: serviceSlotDays(today, readSlotVisits(p.introduction.studio.serviceSlotVisits), taken),
      },
      requests: requests.map((x) => {
        const state = serviceState(x.status, x.holdUntil, now);
        return {
          id: x.id,
          category: isServiceCategory(x.category) ? SERVICE_LABEL[x.category] : x.category,
          when: `${slotDayLabel(dayFromDb(x.slotDay))}, ${slotLabel(x.slotStart)}`,
          chargePaise: fromDb(x.chargePaise),
          /* A free visit shows the studio's charge for that work, struck out. */
          listPaise: fromDb(x.chargePaise) === 0 && isServiceCategory(x.category) ? (charges[x.category] ?? null) : null,
          state,
          payUrl: state === 'held' ? x.payUrl : null,
          note: x.studioNote,
          refunded: x.refundId !== null,
        };
      }),
      claims: claims.map((c) => ({ id: c.id, at: c.createdAt.toISOString(), covered: c.covered, area: label(c.ruleKey), snagId: c.snagId })),
    },
  };
}

// ── Warranty claim ─────────────────────────────────────────────

export type ClaimResult =
  | { ok: true; covered: true; claimId: string; snagId: string; message: string }
  | { ok: true; covered: false; claimId: string; message: string; serviceCategory: ServiceCategory | null }
  | { ok: false; error: string; pendingPaise?: number | null };

const toBase64 = async (f: File): Promise<ReaderPhoto> => ({ mediaType: f.type, base64: Buffer.from(await f.arrayBuffer()).toString('base64') });

export async function raiseWarrantyClaim(
  userId: string,
  projectId: string,
  input: { description: unknown; area: unknown },
  photos: File[],
): Promise<ClaimResult> {
  const r = await load(userId, projectId);
  if (!r.ok) return r;
  const { p, owner, studioId, phase, gate } = r.v;
  /* 1. The payment gate, before anything else. */
  if (!gate.cleared) return { ok: false, error: gate.message!, pendingPaise: gate.pendingPaise };
  if (!owner) return { ok: false, error: AFTERCARE_ERRORS.ownerOnly };
  const open = warrantyOpen(phase);
  if (!open.ok) return { ok: false, error: open.error };
  const desc = checkDescription(input.description, CLAIM_DESCRIPTION_MAX);
  if (!desc.ok) return desc;
  const rules = await rulesFor(studioId);
  const area = typeof input.area === 'string' ? input.area.trim().toUpperCase().slice(0, 40) : '';
  if (!rules.some((x) => x.key === area)) return { ok: false, error: AFTERCARE_ERRORS.area };
  const files = photos.filter((f) => f && f.size > 0);
  if (files.length === 0) return { ok: false, error: AFTERCARE_ERRORS.needsPhoto };
  if (files.length > CLAIM_PHOTOS_MAX) return { ok: false, error: AFTERCARE_ERRORS.photos };

  /* 2. The photos read automatically; the data says whether that area is covered. */
  const reader = await readClaim(rules, desc.value, area, await Promise.all(files.map(toBase64)));
  const decision = decideCoverage(rules, area, reader);
  if (!decision) return { ok: false, error: AFTERCARE_ERRORS.area };

  const paths: string[] = [];
  for (const f of files) {
    const stored = await storeSitePhoto(p.id, f);
    if (!stored.ok) return { ok: false, error: stored.error };
    paths.push(stored.path);
  }
  const record = {
    projectId: p.id,
    raisedById: userId,
    description: desc.value,
    photoPaths: paths,
    clientRuleKey: area,
    ruleKey: decision.rule.key,
    covered: decision.covered,
    decidedBy: decision.by,
    readerModel: reader.ok || reader.why !== 'not-configured' ? READER_MODEL : null,
    readerReason: reader.ok ? reader.reason || null : null,
    readerFailure: reader.ok ? null : reader.why,
  };

  if (!decision.covered) {
    /* Not covered: the automatic reply, nothing raised, nobody asked to answer. */
    const claim = await prisma.warrantyClaim.create({ data: record, select: { id: true } });
    return { ok: true, covered: false, claimId: claim.id, message: notCoveredReply(decision.rule), serviceCategory: decision.rule.serviceCategory };
  }

  /* 3. Covered: a warranty snag, for the design head to assign. */
  const title = claimTitle(reader, desc.value);
  const out = await prisma.$transaction(async (tx) => {
    const snagId = await createWarrantyClaimSnag(tx, { projectId: p.id, title, note: desc.value, photoPaths: paths, userId });
    const claim = await tx.warrantyClaim.create({ data: { ...record, snagId }, select: { id: true } });
    return { snagId, claimId: claim.id };
  });
  const client = p.introduction.brief.user?.name?.trim() || 'Your client';
  void notifyStudio(studioId, { kind: 'snag-raised', snagId: out.snagId, title, room: null });
  void prisma.studioMember
    .findMany({ where: { studioId, designHead: true, status: 'ACTIVE' }, select: { userId: true } })
    .then((heads) => Promise.all(heads.map((h) => notify(h.userId, { kind: 'warranty-claim', projectId: p.id, client, title, area: decision.rule.label }))))
    .catch(() => undefined);
  return {
    ok: true,
    covered: true,
    claimId: out.claimId,
    snagId: out.snagId,
    message: `Covered under your warranty. Your claim is raised with ${p.introduction.studio.tradeName}; you will hear when it has a fix-by date. Follow it under Snags.`,
  };
}

// ── Service request ────────────────────────────────────────────

/** `payUrl` null: booked already (the free month). */
export type ServiceResult = { ok: true; id: string; payUrl: string | null; booked: boolean; chargePaise: number; when: string } | { ok: false; error: string; pendingPaise?: number | null };

export async function bookServiceVisit(
  userId: string,
  projectId: string,
  input: { category: unknown; description: unknown; day: unknown; start: unknown },
  photos: File[] = [],
  now = new Date(),
): Promise<ServiceResult> {
  const r = await load(userId, projectId);
  if (!r.ok) return r;
  const { p, owner, studioId, gate, freeUntil } = r.v;
  /* 1. The payment gate, before anything else (and the only way into the free month). */
  if (!gate.cleared) return { ok: false, error: gate.message!, pendingPaise: gate.pendingPaise };
  if (!owner) return { ok: false, error: AFTERCARE_ERRORS.ownerOnly };
  if (!isServiceCategory(input.category)) return { ok: false, error: AFTERCARE_ERRORS.category };
  const category = input.category;
  const free = bookingIsFree(istDay(now), freeUntil, freeUntil !== null && (await freeVisitUsed(p.id)));
  const charge = free ? 0 : readServiceCharges(p.introduction.studio.serviceCharges)[category];
  if (charge === undefined) return { ok: false, error: AFTERCARE_ERRORS.noCharge };
  const desc = checkDescription(input.description, SERVICE_DESCRIPTION_MAX);
  if (!desc.ok) return desc;
  const slot = checkSlot(input.day, input.start, istDay(now));
  if (!slot.ok) return slot;
  if (!free && !razorpayReady()) return { ok: false, error: 'Paying for a visit is not switched on yet. Please try again later.' };
  const files = photos.filter((f) => f && f.size > 0);
  if (files.length > CLAIM_PHOTOS_MAX) return { ok: false, error: AFTERCARE_ERRORS.photos };
  const paths: string[] = [];
  for (const f of files) {
    const stored = await storeSitePhoto(p.id, f);
    if (!stored.ok) return { ok: false, error: stored.error };
    paths.push(stored.path);
  }

  /* 2. Hold the slot, one booking at a time per studio. */
  const holdUntil = new Date(now.getTime() + HOLD_MINUTES * 60_000);
  const visits = readSlotVisits(p.introduction.studio.serviceSlotVisits);
  const held = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "studios" WHERE "id" = ${studioId} FOR UPDATE`;
    /* One unpaid hold per project: a new pick lets go of the last one. */
    await tx.serviceRequest.updateMany({ where: { projectId: p.id, status: 'HELD', holdUntil: { gt: now } }, data: { status: 'CANCELLED' } });
    const taken = await tx.serviceRequest.count({
      where: {
        studioId,
        slotDay: new Date(`${slot.day}T00:00:00Z`),
        slotStart: slot.start,
        OR: [{ status: 'BOOKED' }, { status: 'HELD', holdUntil: { gt: now } }],
      },
    });
    if (taken >= visits) return null;
    return tx.serviceRequest.create({
      data: {
        projectId: p.id,
        studioId,
        raisedById: userId,
        category,
        description: desc.value,
        photoPaths: paths,
        chargePaise: toDb(charge),
        slotDay: new Date(`${slot.day}T00:00:00Z`),
        slotStart: slot.start,
        holdUntil,
        /* The free month: booked at once, nothing to pay. */
        ...(free ? { status: 'BOOKED' as const } : {}),
      },
      select: { id: true },
    });
  });
  if (!held) return { ok: false, error: AFTERCARE_ERRORS.slotFull };
  const when = `${slotDayLabel(slot.day)}, ${slotLabel(slot.start)}`;
  if (free) {
    await announceBooked(held.id);
    return { ok: true, id: held.id, payUrl: null, booked: true, chargePaise: 0, when };
  }

  /* 3. The payment link; the visit is booked only when it is paid. */
  const user = p.introduction.brief.user;
  const link = await createPaymentLink({
    amountPaise: charge,
    referenceId: held.id,
    description: `${SERVICE_LABEL[category]} visit, ${when}`,
    customer: { name: user?.name ?? null, phone: user?.phone ?? null, email: user?.email ?? null },
    callbackUrl: `${resolveSiteUrl()}/api/pay/razorpay/service`,
    expiresAt: holdUntil,
  });
  if (!link.ok) {
    await prisma.serviceRequest.update({ where: { id: held.id }, data: { status: 'CANCELLED' }, select: { id: true } });
    return { ok: false, error: link.error };
  }
  await prisma.serviceRequest.update({ where: { id: held.id }, data: { payLinkId: link.id, payUrl: link.url }, select: { id: true } });
  return { ok: true, id: held.id, payUrl: link.url, booked: false, chargePaise: charge, when };
}

/**
 * Razorpay says the link is paid (the signed redirect or the webhook): the
 * visit is booked. Once: the second call finds it booked and does nothing.
 * A payment that lands after the hold ran out still books — the client paid.
 */
export async function markServicePaid(linkId: string, paymentId: string, now = new Date()): Promise<{ ok: true; id: string; fresh: boolean } | { ok: false; error: string }> {
  const req = await prisma.serviceRequest.findUnique({ where: { payLinkId: linkId.slice(0, 64) }, select: { id: true, status: true } });
  if (!req) return { ok: false, error: 'That payment is not for a visit we know.' };
  if (req.status === 'BOOKED') return { ok: true, id: req.id, fresh: false };
  const moved = await prisma.serviceRequest.updateMany({
    where: { id: req.id, status: { not: 'BOOKED' } },
    data: { status: 'BOOKED', paymentId: paymentId.slice(0, 64), paidAt: now },
  });
  if (moved.count === 0) return { ok: true, id: req.id, fresh: false };
  await announceBooked(req.id);
  return { ok: true, id: req.id, fresh: true };
}

/** A visit just booked (paid, or free in the first month): the office, the design head and the client hear. */
async function announceBooked(requestId: string): Promise<void> {
  const req = await prisma.serviceRequest.findUnique({
    where: { id: requestId },
    select: {
      projectId: true,
      studioId: true,
      category: true,
      slotDay: true,
      slotStart: true,
      raisedById: true,
      studio: { select: { tradeName: true } },
      project: { select: { introduction: { select: { brief: { select: { user: { select: { name: true } } } } } } } },
    },
  });
  if (!req) return;
  const category = isServiceCategory(req.category) ? SERVICE_LABEL[req.category] : req.category;
  const when = `${slotDayLabel(dayFromDb(req.slotDay))}, ${slotLabel(req.slotStart)}`;
  const client = req.project.introduction.brief.user?.name?.trim() || 'A client';
  const event = { kind: 'service-booked' as const, projectId: req.projectId, client, category, when };
  void notifyStudio(req.studioId, event);
  void prisma.studioMember
    .findMany({ where: { studioId: req.studioId, designHead: true, status: 'ACTIVE' }, select: { userId: true } })
    .then((heads) => Promise.all(heads.map((h) => notify(h.userId, event, { email: false }))))
    .catch(() => undefined);
  void notify(req.raisedById, { kind: 'service-confirmed', category, when, studio: req.studio.tradeName });
}

// ── The studio ─────────────────────────────────────────────────

export interface ServiceSettings {
  charges: Record<ServiceCategory, string>;
  visits: number;
  canEdit: boolean;
}

/** Settings, Warranty: the visiting charges, in rupees. Read by the office. */
export async function myServiceSettings(): Promise<ServiceSettings | null> {
  const member = await currentMember();
  if (!member || !['OWNER', 'PM'].includes(member.role)) return null;
  const s = await prisma.studio.findUnique({ where: { id: member.studioId }, select: { serviceCharges: true, serviceSlotVisits: true } });
  const c = readServiceCharges(s?.serviceCharges);
  const charges = Object.fromEntries(SERVICE_CATEGORIES.map((k) => [k, c[k] !== undefined ? String(c[k]! / 100) : ''])) as Record<ServiceCategory, string>;
  return { charges, visits: readSlotVisits(s?.serviceSlotVisits), canEdit: can(member, 'payments.template') };
}

/** The owner sets the charges (the same right as the warranty) and the visits per slot. */
export async function saveServiceSettings(raw: Record<string, unknown>, visitsRaw: unknown): Promise<{ ok: true; message: string } | { ok: false; error: string }> {
  const member = await currentMember();
  if (!member || !can(member, 'payments.template')) return { ok: false, error: 'Only the studio owner sets the visiting charges.' };
  const checked = checkServiceChargesInput(raw);
  if (!checked.ok) return checked;
  const t = String(visitsRaw ?? '').trim();
  const visits = Number(t);
  if (!/^\d+$/.test(t) || visits < 1 || visits > 20) return { ok: false, error: 'Visits per slot is a whole number from 1 to 20.' };
  await prisma.studio.update({ where: { id: member.studioId }, data: { serviceCharges: checked.value, serviceSlotVisits: visits } });
  const n = Object.keys(checked.value).length;
  return {
    ok: true,
    message: n === 0 ? 'Saved. No category has a charge, so clients cannot book a visit.' : `Saved. Clients can book ${n} kind${n === 1 ? '' : 's'} of visit, up to ${visits} per slot.`,
  };
}

export interface StudioVisit {
  id: string;
  projectId: string;
  client: string;
  category: string;
  when: string;
  day: string;
  start: string;
  description: string;
  charge: string;
  paid: boolean;
  state: ServiceState;
}

export interface StudioVisits {
  visits: StudioVisit[];
  /** Owner, PM and design head move, cancel and finish visits; accounts reads. */
  canAct: boolean;
  /** Days the studio may move a visit to. */
  moveDays: { date: string; label: string }[];
  starts: { start: string; label: string }[];
}

/** The office and the design head; accounts reads. */
async function visitStaff(): Promise<{ studioId: string; canAct: boolean; userId: string } | null> {
  const member = await currentMember();
  if (!member || member.status !== 'ACTIVE') return null;
  const head = member.role === 'DESIGNER' && member.designHead === true;
  if (!['OWNER', 'PM', 'ACCOUNTS'].includes(member.role) && !head) return null;
  return { studioId: member.studioId, canAct: member.role === 'OWNER' || member.role === 'PM' || head, userId: member.userId };
}

/**
 * Visits for the office and the design head, soonest first: booked and held
 * ones from today, and booked ones of the last 14 days still to be marked done.
 */
export async function studioServiceVisits(now = new Date()): Promise<StudioVisits | null> {
  const staff = await visitStaff();
  if (!staff) return null;
  const today = istDay(now);
  const rows = await prisma.serviceRequest.findMany({
    where: {
      studioId: staff.studioId,
      project: { cancelledAt: null },
      OR: [
        { slotDay: { gte: new Date(`${today}T00:00:00Z`) }, status: { in: ['BOOKED', 'HELD'] } },
        { slotDay: { gte: new Date(`${addDays(today, -14)}T00:00:00Z`), lt: new Date(`${today}T00:00:00Z`) }, status: 'BOOKED' },
      ],
    },
    orderBy: [{ slotDay: 'asc' }, { slotStart: 'asc' }],
    take: 200,
    select: {
      id: true,
      projectId: true,
      category: true,
      slotDay: true,
      slotStart: true,
      description: true,
      chargePaise: true,
      paymentId: true,
      status: true,
      holdUntil: true,
      project: { select: { introduction: { select: { brief: { select: { user: { select: { name: true } } } } } } } },
    },
  });
  const visits = rows
    .map((r) => ({
      id: r.id,
      projectId: r.projectId,
      client: r.project.introduction.brief.user?.name?.trim() || 'Client',
      category: isServiceCategory(r.category) ? SERVICE_LABEL[r.category] : r.category,
      when: `${slotDayLabel(dayFromDb(r.slotDay))}, ${slotLabel(r.slotStart)}`,
      day: dayFromDb(r.slotDay),
      start: r.slotStart,
      description: r.description,
      charge: fromDb(r.chargePaise) === 0 ? 'Free visit' : formatINR(fromDb(r.chargePaise)),
      paid: r.paymentId !== null,
      state: serviceState(r.status, r.holdUntil, now),
    }))
    .filter((v) => v.state === 'booked' || v.state === 'held');
  const moveDays = Array.from({ length: STUDIO_MOVE_DAYS }, (_, i) => addDays(today, i + 1)).map((d) => ({ date: d, label: slotDayLabel(d) }));
  return { visits, canAct: staff.canAct, moveDays, starts: SLOT_STARTS.map((st) => ({ start: st, label: slotLabel(st) })) };
}

type VisitResult = { ok: true; message: string } | { ok: false; error: string };

const VISIT_FOR_CHANGE = {
  id: true,
  studioId: true,
  status: true,
  category: true,
  slotDay: true,
  slotStart: true,
  chargePaise: true,
  paymentId: true,
  raisedById: true,
  studio: { select: { tradeName: true } },
} satisfies Prisma.ServiceRequestSelect;

/** A booked visit of the member's own studio, for a change. */
async function bookedVisit(requestId: string): Promise<{ ok: true; staff: { studioId: string }; v: Prisma.ServiceRequestGetPayload<{ select: typeof VISIT_FOR_CHANGE }> } | { ok: false; error: string }> {
  const staff = await visitStaff();
  if (!staff || !staff.canAct) return { ok: false, error: 'Only the owner, a project manager or the design head changes a visit.' };
  const v = await prisma.serviceRequest.findFirst({ where: { id: requestId.slice(0, 64), studioId: staff.studioId }, select: VISIT_FOR_CHANGE });
  if (!v) return { ok: false, error: 'That visit is gone.' };
  if (v.status !== 'BOOKED') return { ok: false, error: 'Only a booked visit can be changed.' };
  return { ok: true, staff, v };
}

const visitWords = (v: { category: string; slotDay: Date; slotStart: string }) => ({
  category: isServiceCategory(v.category) ? SERVICE_LABEL[v.category] : v.category,
  when: `${slotDayLabel(dayFromDb(v.slotDay))}, ${slotLabel(v.slotStart)}`,
});

const studioLine = (v: unknown): string | null => {
  const t = typeof v === 'string' ? v.trim().replace(/\s+/g, ' ').slice(0, 300) : '';
  return t || null;
};

/** The studio moves a booked visit to another slot (not before tomorrow); the client hears. */
export async function moveServiceVisit(requestId: string, input: { day: unknown; start: unknown; note: unknown }, now = new Date()): Promise<VisitResult> {
  const r = await bookedVisit(requestId);
  if (!r.ok) return r;
  const slot = checkStudioSlot(input.day, input.start, istDay(now));
  if (!slot.ok) return slot;
  const note = studioLine(input.note);
  await prisma.serviceRequest.update({
    where: { id: r.v.id },
    data: { slotDay: new Date(`${slot.day}T00:00:00Z`), slotStart: slot.start, studioNote: note },
    select: { id: true },
  });
  const w = visitWords({ category: r.v.category, slotDay: new Date(`${slot.day}T00:00:00Z`), slotStart: slot.start });
  void notify(r.v.raisedById, { kind: 'service-changed', what: 'moved', category: w.category, when: w.when, studio: r.v.studio.tradeName, note });
  return { ok: true, message: `Moved to ${w.when}. The client is told.` };
}

/**
 * The studio cancels a booked visit, with a reason the client reads. A paid
 * visit is refunded in full through Razorpay first; if the refund does not
 * go through, nothing is cancelled.
 */
export async function cancelServiceVisit(requestId: string, reason: unknown): Promise<VisitResult> {
  const r = await bookedVisit(requestId);
  if (!r.ok) return r;
  const note = studioLine(reason);
  if (!note || note.length < 5) return { ok: false, error: 'Say why, in a few words. The client reads this.' };
  const amount = fromDb(r.v.chargePaise);
  let refundId: string | null = null;
  if (r.v.paymentId && amount > 0) {
    const refund = await refundPayment(r.v.paymentId, amount);
    if (!refund.ok) return refund;
    refundId = refund.id;
  }
  const moved = await prisma.serviceRequest.updateMany({ where: { id: r.v.id, studioId: r.staff.studioId, status: 'BOOKED' }, data: { status: 'CANCELLED', studioNote: note, refundId } });
  if (moved.count === 0) return { ok: false, error: 'Someone just changed this visit. Refresh to see the latest.' };
  const w = visitWords(r.v);
  const line = refundId ? `${note} Your ${formatINR(amount)} is refunded.` : note;
  void notify(r.v.raisedById, { kind: 'service-changed', what: 'cancelled', category: w.category, when: w.when, studio: r.v.studio.tradeName, note: line });
  return { ok: true, message: refundId ? `Cancelled, and ${formatINR(amount)} refunded. The client is told.` : 'Cancelled. The client is told.' };
}

/** The visit happened: done, with an optional line for the client. */
export async function finishServiceVisit(requestId: string, note: unknown, now = new Date()): Promise<VisitResult> {
  const r = await bookedVisit(requestId);
  if (!r.ok) return r;
  const line = studioLine(note);
  const moved = await prisma.serviceRequest.updateMany({ where: { id: r.v.id, studioId: r.staff.studioId, status: 'BOOKED' }, data: { status: 'DONE', doneAt: now, studioNote: line } });
  if (moved.count === 0) return { ok: false, error: 'Someone just changed this visit. Refresh to see the latest.' };
  const w = visitWords(r.v);
  void notify(r.v.raisedById, { kind: 'service-changed', what: 'done', category: w.category, when: w.when, studio: r.v.studio.tradeName, note: line });
  return { ok: true, message: 'Marked done. The client is told.' };
}
