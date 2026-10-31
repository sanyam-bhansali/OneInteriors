import 'server-only';

/**
 * "Start a project" for a studio's OWN client (owner, 11 Oct 2026;
 * docs/studio-workspace/OWN-CLIENTS.md): somebody who did not come through
 * One Interiors, from a quotation they accepted in the studio's builder.
 *
 * The project is a customer's project like any other: it hangs off an
 * `Introduction` (source STUDIO_OWN_CLIENT) on the customer's brief, so the
 * app, the website, site mode, payments, snags and decisions read it
 * unchanged. The plan is built by the same code as signing in the app
 * (portal/plan-write.ts `createSignedProject`: stages, room checklists,
 * payment stages summing to the contract, materials, agreement and quote in
 * the Locker). The customer's account is found or made by phone and linked
 * at once; the invite (`HomeProjectInvite`) is the short link the studio
 * shares, sent by SMS when a provider exists and by email when known —
 * never WhatsApp (own-project-invite.ts).
 *
 * The rules are pure, in own-project-rules.ts. Every query here is scoped by
 * the member's studio.
 */

import { designLengthFor, bhkOf, HAUSPIRE_DESIGN } from '@/modules/studio-design/template';
import { randomBytes } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { siteUrlFor } from '@/lib/site';
import { sendNotice } from '@/modules/auth/email';
import { smsProvider } from '@/modules/messaging/sms';
import { createSignedProject, PLAN_TX } from '@/modules/portal/plan-write';
import { quoteTotals } from '@/modules/portal/choose';
import { durationFor } from '@/modules/portal/tracker';
import { can, needsAssignment } from '@/modules/studio/roles';
import { readProfile } from '@/modules/studio/matching-profile';
import { ACCESS_ERRORS, type StudioMemberRef } from '@/modules/studio/access';
import { designPlanInput } from '@/modules/studio-design/plan-input';
import { recordEvent } from './events';
import { deliverInvite, type InviteChannel } from './own-project-invite';
import {
  accountRefusal,
  checkCustomer,
  CUSTOMER_ERRORS,
  INVITE_LANGS,
  inviteCode,
  inviteEmail,
  inviteMessage,
  localitySlug,
  maskedPhone,
  OWN_QUOTE_ERRORS,
  ownQuoteRefusal,
  parseStartOn,
  parseDesignDays,
  parseTotalDays,
  propertyTypeFrom,
  STARTABLE_STATUSES,
  cleanCode,
  type InviteLang,
} from './own-project-rules';

/** Every column `quoteTotals` reads, plus the lines the plan is built from. */
const QUOTE_SELECT = {
  id: true,
  number: true,
  status: true,
  introductionId: true,
  briefId: true,
  clientName: true,
  clientPhone: true,
  clientEmail: true,
  society: true,
  locality: true,
  config: true,
  quoteDate: true,
  issuedOn: true,
  createdAt: true,
  feeBps: true,
  discountBps: true,
  onSpotPaise: true,
  bookingAdvancePaise: true,
  gstBps: true,
  phases: true,
  studio: { select: { tradeName: true, paymentPhases: true, matchingProfile: true } },
  client: { select: { name: true, phone: true, email: true, society: true, locality: true, config: true, source: true, introductionId: true, deletedAt: true } },
  lines: {
    orderBy: { sortOrder: 'asc' },
    select: { id: true, room: true, product: true, details: true, unit: true, code: true, ratePaise: true, amountPaise: true, widthMm: true, heightMm: true, qtyMilli: true },
  },
} satisfies Prisma.StudioQuoteSelect;

export type OwnQuoteRow = Prisma.StudioQuoteGetPayload<{ select: typeof QUOTE_SELECT }>;
type QuoteRow = OwnQuoteRow;

/** The quotation a project starts from, read with the given client (a transaction's, for "Add an existing project"). */
export async function readOwnQuote(db: Pick<Prisma.TransactionClient, 'studioQuote'>, studioId: string, quoteId: string): Promise<OwnQuoteRow | null> {
  return db.studioQuote.findFirst({ where: { id: quoteId, studioId }, select: QUOTE_SELECT });
}

/** Sign-off to handover for a whole home, the studio's own figure where it filed one. */
export const defaultDays = (q: QuoteRow) => durationFor('FULL_HOME', readProfile(q.studio.matchingProfile).durationDays);

/** Today in India, "2026-10-14": the default start date on the form. */
export function istToday(now = new Date()): string {
  return new Date(now.getTime() + 330 * 60_000).toISOString().slice(0, 10);
}

/** On the clients' app address when there is one (APP_HOST, owner 1 Nov 2026); the site otherwise. */
export const joinLink = (code: string) => new URL(`/app/join/${code}`, siteUrlFor('app')).toString();

// ── The quotations a project can start from ────────────────────

export interface StartableQuote {
  id: string;
  number: string;
  status: 'ISSUED' | 'ACCEPTED';
  client: string;
  /** Prefilled on the form, from the client record or the quotation. */
  customer: { name: string; phone: string; email: string };
  home: string | null;
  totalPaise: number;
  /** The date on the quotation. */
  date: Date;
  defaultDays: number;
  /** The design steps' own length for this flat size (27 Oct 2026: "Design done in N days"). */
  defaultDesignDays: number;
}

/**
 * The member's studio's quotations for its own clients that a project can
 * start from: sent or won, not One Interiors', not started yet. Newest
 * first. Empty for a member who may not start projects.
 */
export async function startableQuotes(member: StudioMemberRef | null): Promise<StartableQuote[]> {
  if (!member || !can(member, 'project.create')) return [];
  const [rows, started] = await Promise.all([
    prisma.studioQuote.findMany({
      where: {
        studioId: member.studioId,
        status: { in: [...STARTABLE_STATUSES] },
        introductionId: null,
        briefId: null,
        OR: [{ clientId: null }, { client: { introductionId: null, deletedAt: null, source: { not: 'ONE_INTERIORS' } } }],
      },
      orderBy: { updatedAt: 'desc' },
      take: 60,
      select: QUOTE_SELECT,
    }),
    prisma.homeProject.findMany({ where: { introduction: { studioId: member.studioId } }, select: { signedQuoteId: true } }),
  ]);
  const taken = new Set(started.map((p) => p.signedQuoteId).filter(Boolean));
  const plan = await designPlanInput(member.studioId, {});
  const steps = plan.template && plan.template.length ? plan.template : HAUSPIRE_DESIGN;
  return rows
    .filter((q) => !taken.has(q.id))
    .map((q) => {
      const totals = quoteTotals(q);
      return {
        id: q.id,
        number: q.number,
        status: q.status as 'ISSUED' | 'ACCEPTED',
        client: q.client?.name ?? q.clientName,
        customer: {
          name: q.client?.name ?? q.clientName,
          phone: q.client?.phone ?? q.clientPhone ?? '',
          email: q.client?.email ?? q.clientEmail ?? '',
        },
        home: [q.society ?? q.client?.society, q.config ?? q.client?.config].filter(Boolean).join(', ') || null,
        totalPaise: totals.totalPaise,
        date: q.quoteDate ?? q.issuedOn ?? q.createdAt,
        defaultDays: defaultDays(q),
        defaultDesignDays: designLengthFor(steps, bhkOf(propertyTypeFrom(q.config ?? q.client?.config))),
      };
    })
    .filter((q) => q.totalPaise > 0);
}

// ── Starting the project ───────────────────────────────────────

export interface StartOwnProjectInput {
  quoteId: string;
  /** "YYYY-MM-DD". */
  startOn: string;
  /** Sign-off to handover in days; the studio's whole-home figure when left out. */
  totalDays?: number | string | null;
  /** Design done in days (27 Oct 2026); the design steps' own length for the flat when left out. */
  designDays?: number | string | null;
  customer: { name: string; phone: string; email?: string | null };
}

export interface OwnInvite {
  code: string;
  link: string;
  sentVia: InviteChannel[];
  /** The words to send, in each language, for the studio's own copy and paste. */
  messages: Record<InviteLang, string>;
}

export type StartOwnProjectResult = { ok: true; projectId: string; introductionId: string; invite: OwnInvite } | { ok: false; error: string };

/**
 * How the booking (Studio OS Phase 1, studio-sales/booking.ts) reuses this
 * path: the payment stages and contract come from the quotation's sales
 * final rather than its current terms, the right checked is booking.record
 *  (accounts, owner, PM), and the booking's own writes (the
 * payment row, the lead) run inside the same transaction.
 */
export interface StartOwnProjectOptions {
  action?: 'project.create' | 'booking.record' | 'project.bringIn';
  contractPaise?: number;
  stages?: { label: string; pct: number | null; amountPaise: number }[];
  onCreated?: (tx: Prisma.TransactionClient, project: { id: string; introductionId: string; customerUserId: string }) => Promise<void>;
}

/** A refusal raised inside the transaction, so nothing is written. */
export class Refused extends Error {
  constructor(readonly reason: string) {
    super(reason);
  }
}

export const freshCode = () => inviteCode((n) => new Uint8Array(randomBytes(n)));

/**
 * Start a project for the studio's own client from an accepted quotation
 * (`project.create`: owner or PM). One transaction: the customer's account
 * and brief (found or made by phone), the own-client introduction, the
 * project and its plan exactly as signing builds it, the PM on the project,
 * the events, the invite. Then the invite goes out (never WhatsApp).
 */
export async function startOwnProject(
  member: StudioMemberRef | null,
  input: StartOwnProjectInput,
  now = new Date(),
  opts: StartOwnProjectOptions = {},
): Promise<StartOwnProjectResult> {
  if (!member) return { ok: false, error: ACCESS_ERRORS.signIn };
  if (!can(member, opts.action ?? 'project.create')) return { ok: false, error: ACCESS_ERRORS.notYourRole };

  const customer = checkCustomer(input.customer);
  if (!customer.ok) return customer;
  const startOn = parseStartOn(input.startOn, now);
  if (!startOn) return { ok: false, error: 'Pick a start date from the last two months to a year ahead.' };

  const quoteId = String(input.quoteId ?? '').slice(0, 64);
  const q = await prisma.studioQuote.findFirst({ where: { id: quoteId, studioId: member.studioId }, select: QUOTE_SELECT });
  if (!q) return { ok: false, error: 'That quotation is not one of yours.' };
  const totalDays = parseTotalDays(input.totalDays, defaultDays(q));
  if (totalDays === null) return { ok: false, error: 'Handover between 7 days and two years from the start, please.' };

  const totals = quoteTotals(q);
  const alreadyStarted = (await prisma.homeProject.findFirst({ where: { signedQuoteId: q.id }, select: { id: true } })) !== null;
  const refusal = ownQuoteRefusal({
    status: q.status,
    introductionId: q.introductionId,
    briefId: q.briefId,
    client: q.client,
    lineCount: q.lines.length,
    totalPaise: opts.contractPaise ?? totals.totalPaise,
    alreadyStarted,
  });
  if (refusal) return { ok: false, error: refusal };

  const { name, phone, email } = customer.value;
  const existing = await prisma.user.findUnique({ where: { phone }, select: { id: true, role: true, deletedAt: true, name: true, email: true } });
  const accountRefused = accountRefusal(existing);
  if (accountRefused) return { ok: false, error: accountRefused };
  const emailTaken = email ? (await prisma.user.findUnique({ where: { email }, select: { id: true } })) !== null : false;

  const signedAt = now;
  const code = freshCode();
  // Studio OS Phase 2: the studio's design steps and the flat size, for the DESIGN stage.
  const design = await designPlanInput(member.studioId, { propertyType: propertyTypeFrom(q.config ?? q.client?.config) });
  const designDays = parseDesignDays(input.designDays, null);
  if (designDays === false) return { ok: false, error: 'Design done in 3 to 365 days, please.' };
  if (designDays !== null && designDays > totalDays - 4) return { ok: false, error: `Design in ${designDays} days leaves too little of ${totalDays} days for the rest. Make the handover later or the design shorter.` };
  design.days = designDays;
  try {
    const started = await prisma.$transaction(
      (tx) =>
        writeOwnProject(tx, {
          member,
          q,
          customer: { name, phone, email },
          existing,
          emailTaken,
          startOn,
          totalDays,
          contractPaise: opts.contractPaise ?? totals.totalPaise,
          stages: opts.stages ?? totals.stages.map((s) => ({ label: s.label, pct: s.pct ?? null, amountPaise: s.amountPaise })),
          signedAt,
          code,
          design,
          onCreated: opts.onCreated,
        }),
      PLAN_TX,
    );

    const { projectId, introductionId } = started;
    const invite = await sendOwnInvite({ projectId, code, phone, email, name, studio: q.studio.tradeName });
    return { ok: true, projectId, introductionId, invite };
  } catch (error) {
    if (error instanceof Refused) return { ok: false, error: error.reason };
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return { ok: false, error: OWN_QUOTE_ERRORS.started };
    }
    console.error('[own-project] start failed', error instanceof Error ? error.name : 'unknown');
    return { ok: false, error: 'That did not go through. Nothing was started; try again.' };
  }
}

/** Everything `writeOwnProject` needs, checked and read before the transaction. */
export interface OwnProjectWrite {
  member: StudioMemberRef;
  q: OwnQuoteRow;
  customer: { name: string; phone: string; email: string | null };
  existing: { id: string; role: string; deletedAt: Date | null; name: string | null; email: string | null } | null;
  emailTaken: boolean;
  startOn: Date;
  totalDays: number;
  contractPaise: number;
  stages: { label: string; pct: number | null; amountPaise: number }[];
  signedAt: Date;
  code: string;
  design: Awaited<ReturnType<typeof designPlanInput>>;
  onCreated?: StartOwnProjectOptions['onCreated'];
}

/**
 * The writes of starting an own-client project, inside the caller's
 * transaction: the customer's account and brief, the own-client
 * introduction, the project and its plan (`createSignedProject`), the member
 * on it, the events, the invite row and the audit line, then `onCreated`.
 * `startOwnProject` and "Add an existing project"
 * (studio-bring-in/bring-in.ts) both call it. Throws `Refused`.
 */
export async function writeOwnProject(tx: Prisma.TransactionClient, w: OwnProjectWrite): Promise<{ projectId: string; introductionId: string }> {
  const { member, q, existing, emailTaken, startOn, totalDays, signedAt, code, design } = w;
  const { name, phone, email } = w.customer;
  // The customer's account: theirs if they have one (CUSTOMER only, checked above), else made now.
  // `phoneVerified` stays empty until they sign in with the number — that is "joined".
  const user =
    existing ??
    (await tx.user.create({
      data: { phone, name, role: 'CUSTOMER', ...(email && !emailTaken ? { email } : {}) },
      select: { id: true, role: true, deletedAt: true, name: true, email: true },
    }));
  if (existing && !existing.name) await tx.user.update({ where: { id: existing.id }, data: { name } });

  // Their brief: one per person. A customer who already started one keeps it; otherwise a minimal one,
  // from the client record, kept out of One Interiors' funnel (`madeByStudio`).
  const brief =
    (await tx.brief.findUnique({ where: { userId: user.id }, select: { id: true } })) ??
    (await tx.brief.create({
      data: {
        userId: user.id,
        madeByStudio: true,
        contactName: name,
        contactPhone: phone,
        contactEmail: email,
        society: (q.society ?? q.client?.society)?.trim() || null,
        locality: localitySlug(q.locality ?? q.client?.locality),
        propertyType: propertyTypeFrom(q.config ?? q.client?.config),
      },
      select: { id: true },
    }));

  const prior = await tx.introduction.findUnique({
    where: { briefId_studioId: { briefId: brief.id, studioId: member.studioId } },
    select: { id: true, source: true, homeProject: { select: { id: true, cancelledAt: true } } },
  });
  if (prior) {
    /*
     * Start again after a delete or a refunded booking (owner, 27 Oct 2026:
     * "delete Ankita as she is on the previous version and remake the
     * project"). A client has one introduction per studio, and a project
     * one introduction, so the cancelled project steps aside: its
     * introduction moves to a copy of the brief with no account on it. It
     * stays in Deleted projects as a record, replaced and not restorable;
     * the client, their brief and their account go to the new project.
     */
    const cancelled = prior.source === 'STUDIO_OWN_CLIENT' && prior.homeProject?.cancelledAt != null;
    if (!cancelled) throw new Refused(prior.source === 'ONE_INTERIORS' ? CUSTOMER_ERRORS.introduced : CUSTOMER_ERRORS.alreadyHere);
    const old = await tx.brief.findUniqueOrThrow({ where: { id: brief.id }, select: { contactName: true, contactPhone: true, contactEmail: true, society: true, locality: true, propertyType: true } });
    const copy = await tx.brief.create({ data: { ...old, userId: null }, select: { id: true } });
    await tx.introduction.update({ where: { id: prior.id }, data: { briefId: copy.id } });
    await recordEvent(tx, { projectId: prior.homeProject!.id, type: 'project.replaced', actor: { type: 'STUDIO', id: member.userId }, refId: q.id, payload: { by: 'a new project for the same client' } });
  }

  const intro = await tx.introduction.create({
    data: {
      briefId: brief.id,
      studioId: member.studioId,
      source: 'STUDIO_OWN_CLIENT',
      introducedById: member.userId,
      introducedAt: signedAt,
      contactReleasedAt: signedAt,
      studioAcceptedAt: signedAt,
    },
    select: { id: true },
  });

  // The same code as signing in the app: quote → Won, the project, the plan, the Locker.
  const project = await createSignedProject(tx, {
    introductionId: intro.id,
    quote: { id: q.id, number: q.number, lines: q.lines },
    startOn,
    totalDays,
    contractPaise: w.contractPaise,
    stages: w.stages,
    signedAt,
    filedById: member.userId,
    filedByStudio: true,
    design,
  });

  // A PM sees only projects they are on; the one who started it is on it.
  if (needsAssignment(member.role)) {
    await tx.studioProjectMember.create({ data: { homeProjectId: project.id, memberId: member.id } });
  }

  const actor = { type: 'STUDIO' as const, id: member.userId };
  await recordEvent(tx, {
    projectId: project.id,
    type: 'plan.created',
    actor,
    refId: q.id,
    payload: { source: 'studio_own_client', payments: project.payments.length, totalDays },
    at: signedAt,
  });
  const invite = await tx.homeProjectInvite.create({
    data: { projectId: project.id, code, userId: user.id, phone, name, email, createdById: member.id },
    select: { id: true },
  });
  await recordEvent(tx, { projectId: project.id, type: 'customer.invited', actor, refId: invite.id, at: signedAt });
  await tx.auditLog.create({
    data: {
      actorId: member.userId,
      action: 'project.started_own_client',
      entityType: 'HomeProject',
      entityId: project.id,
      after: { quoteId: q.id, totalPaise: w.contractPaise, newAccount: !existing },
    },
  });
  await w.onCreated?.(tx, { id: project.id, introductionId: intro.id, customerUserId: user.id });
  return { projectId: project.id, introductionId: intro.id };
}

/** The words in every language, for one invite. */
function messagesFor(name: string, studio: string, link: string): Record<InviteLang, string> {
  const words = { customerFirst: name.split(/\s+/)[0] || name, studio, link };
  return Object.fromEntries(INVITE_LANGS.map((l) => [l, inviteMessage(l, words)])) as Record<InviteLang, string>;
}

/** Send one invite (SMS when a provider exists, email when known) and note what took it. Never throws. */
export async function sendOwnInvite(i: { projectId: string; code: string; phone: string; email: string | null; name: string; studio: string }): Promise<OwnInvite> {
  const link = joinLink(i.code);
  const messages = messagesFor(i.name, i.studio, link);
  let sentVia: InviteChannel[] = [];
  try {
    sentVia = await deliverInvite(
      { phone: i.phone, email: i.email, text: messages.en, emailNotice: inviteEmail({ customerFirst: i.name.split(/\s+/)[0] || i.name, studio: i.studio, link }) },
      { sms: smsProvider(), sendEmail: sendNotice },
    );
    if (sentVia.length > 0) await prisma.homeProjectInvite.update({ where: { code: i.code }, data: { sentVia } });
  } catch (error) {
    console.error('[own-project] invite not sent', error instanceof Error ? error.name : 'unknown');
  }
  return { code: i.code, link, sentVia, messages };
}

// ── The invite, on the project workspace ───────────────────────

export interface InviteState {
  code: string;
  link: string;
  sentVia: InviteChannel[];
  messages: Record<InviteLang, string>;
  /** They signed in with the invited number (or opened the link signed in). */
  joined: boolean;
  createdAt: Date;
}

/**
 * The live invite on an own-client project, for the workspace banner. The
 * caller has already checked the member may read the project
 * (studio/workspace.ts does, through `memberOnProject`).
 */
export async function inviteForProject(projectId: string): Promise<InviteState | null> {
  const row = await prisma.homeProjectInvite.findFirst({
    where: { projectId, revokedAt: null },
    orderBy: { createdAt: 'desc' },
    select: {
      code: true,
      name: true,
      sentVia: true,
      joinedAt: true,
      createdAt: true,
      project: { select: { introduction: { select: { studio: { select: { tradeName: true } }, brief: { select: { user: { select: { phoneVerified: true } } } } } } } },
    },
  });
  if (!row) return null;
  const link = joinLink(row.code);
  return {
    code: row.code,
    link,
    sentVia: row.sentVia.filter((v): v is InviteChannel => v === 'sms' || v === 'email'),
    messages: messagesFor(row.name, row.project.introduction.studio.tradeName, link),
    joined: row.joinedAt !== null || row.project.introduction.brief.user?.phoneVerified != null,
    createdAt: row.createdAt,
  };
}

/** Send the invite again with a new code (the old link stops working). `project.create` on this studio's own-client project. */
export async function resendOwnInvite(member: StudioMemberRef | null, projectId: string): Promise<{ ok: true; invite: OwnInvite } | { ok: false; error: string }> {
  if (!member) return { ok: false, error: ACCESS_ERRORS.signIn };
  if (!can(member, 'project.create')) return { ok: false, error: ACCESS_ERRORS.notYourRole };
  const last = await prisma.homeProjectInvite.findFirst({
    where: { projectId, project: { introduction: { studioId: member.studioId, source: 'STUDIO_OWN_CLIENT' } } },
    orderBy: { createdAt: 'desc' },
    select: { id: true, userId: true, phone: true, name: true, email: true, project: { select: { introduction: { select: { studio: { select: { tradeName: true } } } } } } },
  });
  if (!last) return { ok: false, error: ACCESS_ERRORS.notYours };
  if (needsAssignment(member.role)) {
    const on = await prisma.studioProjectMember.findUnique({ where: { homeProjectId_memberId: { homeProjectId: projectId, memberId: member.id } }, select: { id: true } });
    if (!on) return { ok: false, error: ACCESS_ERRORS.notYours };
  }
  const code = freshCode();
  await prisma.$transaction(async (tx) => {
    await tx.homeProjectInvite.updateMany({ where: { projectId, revokedAt: null }, data: { revokedAt: new Date() } });
    const row = await tx.homeProjectInvite.create({
      data: { projectId, code, userId: last.userId, phone: last.phone, name: last.name, email: last.email, createdById: member.id },
      select: { id: true },
    });
    await recordEvent(tx, { projectId, type: 'customer.invited', actor: { type: 'STUDIO', id: member.userId }, refId: row.id, payload: { again: true } });
  });
  const invite = await sendOwnInvite({ projectId, code, phone: last.phone, email: last.email, name: last.name, studio: last.project.introduction.studio.tradeName });
  return { ok: true, invite };
}

// ── The customer opens the link ────────────────────────────────

export interface JoinView {
  studio: string;
  customerFirst: string;
  /** "+91 98xxx xx210": the number to sign in with. */
  phoneHint: string;
  /** The signed-in person is the invited customer. */
  matches: boolean;
}

/** The join page's read: null when the code is unknown or replaced. */
export async function joinView(rawCode: string, userId: string | null): Promise<JoinView | null> {
  const code = cleanCode(rawCode);
  if (!code) return null;
  const row = await prisma.homeProjectInvite.findUnique({
    where: { code },
    select: { userId: true, phone: true, name: true, revokedAt: true, project: { select: { introduction: { select: { studio: { select: { tradeName: true } } } } } } },
  });
  if (!row || row.revokedAt) return null;
  return {
    studio: row.project.introduction.studio.tradeName,
    customerFirst: row.name.split(/\s+/)[0] || row.name,
    phoneHint: maskedPhone(row.phone),
    matches: userId !== null && userId === row.userId,
  };
}

/** The invited customer, signed in, opened the link: note it once. Their project is already theirs either way. */
export async function joinOwnProject(rawCode: string, userId: string): Promise<boolean> {
  const code = cleanCode(rawCode);
  if (!code) return false;
  const row = await prisma.homeProjectInvite.findUnique({ where: { code }, select: { id: true, projectId: true, userId: true, revokedAt: true, joinedAt: true } });
  if (!row || row.revokedAt || row.userId !== userId) return false;
  if (row.joinedAt) return true;
  await prisma.$transaction(async (tx) => {
    const n = await tx.homeProjectInvite.updateMany({ where: { id: row.id, joinedAt: null }, data: { joinedAt: new Date() } });
    if (n.count === 1) await recordEvent(tx, { projectId: row.projectId, type: 'customer.joined', actor: { type: 'CUSTOMER', id: userId }, refId: row.id });
  });
  return true;
}

// ── From the quotation builder ─────────────────────────────────

/**
 * For the quotation page: the project running on this quotation, if any, and
 * whether this member could start one from it now (its own client, sent or
 * won, `project.create`). Never throws.
 */
export async function projectForQuote(member: StudioMemberRef | null, quoteId: string): Promise<{ projectId: string | null; canStart: boolean }> {
  if (!member) return { projectId: null, canStart: false };
  try {
    const [project, q] = await Promise.all([
      prisma.homeProject.findFirst({ where: { signedQuoteId: quoteId, introduction: { studioId: member.studioId } }, select: { id: true } }),
      prisma.studioQuote.findFirst({
        where: { id: quoteId, studioId: member.studioId },
        select: { status: true, introductionId: true, briefId: true, client: { select: { source: true, introductionId: true, deletedAt: true } }, _count: { select: { lines: true } } },
      }),
    ]);
    if (project) return { projectId: project.id, canStart: false };
    if (!q || !can(member, 'project.create')) return { projectId: null, canStart: false };
    const refusal = ownQuoteRefusal({ ...q, lineCount: q._count.lines, totalPaise: 1, alreadyStarted: false });
    return { projectId: null, canStart: refusal === null };
  } catch {
    return { projectId: null, canStart: false };
  }
}
