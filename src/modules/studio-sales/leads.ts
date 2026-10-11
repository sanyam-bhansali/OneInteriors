import 'server-only';

/**
 * The lead page's reads and writes (Studio OS Phase 1, docs/studio-os/
 * PHASE-1-SALES.md §2): details, notes, the meeting, files, "Read rooms",
 * a new quotation from the lead, and everything the page shows about its
 * quotations and booking.
 *
 * Every function starts from the signed-in person's lead scope
 * (studio/lead-scope.ts) and asks `can()` per action: a salesperson works
 * only the leads assigned to them; owner and PM, every lead. Nothing here
 * moves a lead between columns.
 */

import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { fromDb, toDb } from '@/lib/money';
import { clientById, type ClientRow } from '@/modules/studio-practice/clients';
import { record } from '@/modules/studio-practice/events';
import { normalisePhone } from '@/modules/studio-practice/csv';
import { SOURCE_LABELS, type ClientSourceName } from '@/modules/studio-practice/vocabulary';
import { actingMember, leadInScope, mayOnLead, myLeadScope, type LeadScope } from '@/modules/studio/lead-scope';
import { can } from '@/modules/studio/roles';
import { applyConfiguration, createQuote } from '@/modules/studio-quote/quotes';
import { isConfigName } from '@/modules/studio-quote/configure';
import { canReadPlans, readFloorPlan, readablePlanType } from '@/modules/floorplan/read';
import { leadFileExists, leadUploadTicket, readLeadFile, removeLeadFiles, signedLeadFileLinks } from '@/modules/storage/lead-files';
import {
  budgetText,
  checkLeadFile,
  cleanFileName,
  editSummary,
  meetingLabel,
  nextStep,
  parseBudget,
  parseMeeting,
  pathBelongsTo,
  type NextStep,
} from './lead-rules';
import { revisionLabel } from './revision-rules';
import { bookingForLead, type LeadBooking } from './booking';

export type LeadResult = { ok: true } | { ok: false; error: string };

const NOT_YOURS = 'That lead is not one of yours.';
const NOT_ROLE = 'Your role in the studio does not include that. Ask your studio owner.';

/** The lead, checked for this action, or the reason not. */
async function leadFor(clientId: string, action: 'lead.read' | 'lead.edit' | 'quote.write'): Promise<{ scope: LeadScope; lead: { id: string; assignedToId: string | null; name: string } } | { error: string }> {
  const scope = await myLeadScope();
  if (!scope) return { error: 'Sign in as your studio first.' };
  const lead = await leadInScope(scope, String(clientId ?? ''));
  if (!lead) return { error: NOT_YOURS };
  if (!mayOnLead(scope, action, lead)) return { error: NOT_ROLE };
  return { scope, lead };
}

// ── The page ───────────────────────────────────────────────────

export interface LeadFileView {
  id: string;
  kind: 'FLOOR_PLAN' | 'OTHER';
  name: string;
  bytes: number;
  contentType: string;
  url: string | null;
  uploadedByName: string | null;
  createdAt: Date;
  /** "Read rooms" was pressed and found this many rooms. */
  roomsRead: number | null;
}

export interface LeadQuoteView {
  id: string;
  number: string;
  status: string;
  stage: string;
  totalPaise: number | null;
  revisions: { n: number; label: string; sentAt: Date; totalPaise: number; isSalesFinal: boolean }[];
  salesFinal: string | null;
  updatedAt: Date;
}

export interface LeadPage {
  client: ClientRow;
  sourceText: string;
  budgetText: string;
  meetingText: string | null;
  files: LeadFileView[];
  quotes: LeadQuoteView[];
  booking: LeadBooking | null;
  next: NextStep;
  /** The quotation the next step points at (the newest one). */
  nextQuoteId: string | null;
  may: {
    edit: boolean;
    quote: boolean;
    assign: boolean;
    book: boolean;
    refund: boolean;
    readRooms: boolean;
  };
  /** Who can be given the lead (owner and PM see this). */
  members: { id: string; name: string }[];
  sources: { id: string; name: string }[];
  /** The newest quotation with a sales final and no booking, for Record booking. */
  bookableQuoteId: string | null;
}

export async function leadPage(clientId: string): Promise<LeadPage | null> {
  const scope = await myLeadScope();
  if (!scope) return null;
  const client = await clientById(clientId);
  if (!client) return null;
  const studioId = scope.studioId;

  const [fileRows, quoteRows, contacted, members, sources, booking] = await Promise.all([
    prisma.studioClientFile.findMany({
      where: { studioId, clientId: client.id },
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: { id: true, kind: true, name: true, bytes: true, contentType: true, storagePath: true, uploadedByName: true, createdAt: true, reading: true },
    }),
    prisma.studioQuote.findMany({
      where: { ...scope.quotes, studioId, clientId: client.id },
      orderBy: { updatedAt: 'desc' },
      take: 20,
      select: {
        id: true,
        number: true,
        status: true,
        stage: true,
        updatedAt: true,
        salesFinalRevisionId: true,
        revisions: { orderBy: { n: 'asc' }, select: { id: true, n: true, sentAt: true, totalPaise: true } },
      },
    }),
    prisma.studioClientEvent.count({ where: { studioId, clientId: client.id, kind: 'CONTACTED' } }),
    scope.seesAll
      ? prisma.studioMember.findMany({
          where: { studioId, status: 'ACTIVE', role: { in: ['OWNER', 'PM', 'SALES'] } },
          orderBy: { createdAt: 'asc' },
          select: { id: true, user: { select: { name: true, email: true, phone: true } } },
        })
      : Promise.resolve([]),
    prisma.studioLeadSource.findMany({ where: { studioId }, orderBy: { name: 'asc' }, select: { id: true, name: true } }),
    bookingForLead(studioId, client),
  ]);

  const links = await signedLeadFileLinks(fileRows.map((f) => f.storagePath));
  const files: LeadFileView[] = fileRows.map((f) => {
    const reading = f.reading && typeof f.reading === 'object' ? (f.reading as { rooms?: unknown[] }) : null;
    return {
      id: f.id,
      kind: f.kind,
      name: f.name,
      bytes: f.bytes,
      contentType: f.contentType,
      url: links.get(f.storagePath) ?? null,
      uploadedByName: f.uploadedByName,
      createdAt: f.createdAt,
      roomsRead: reading && Array.isArray(reading.rooms) ? reading.rooms.length : null,
    };
  });

  const quotes: LeadQuoteView[] = quoteRows.map((q) => {
    const last = q.revisions[q.revisions.length - 1];
    const final = q.revisions.find((r) => r.id === q.salesFinalRevisionId);
    return {
      id: q.id,
      number: q.number,
      status: q.status,
      stage: q.stage,
      totalPaise: last ? fromDb(last.totalPaise) : null,
      revisions: q.revisions.map((r) => ({ n: r.n, label: revisionLabel(r.n), sentAt: r.sentAt, totalPaise: fromDb(r.totalPaise), isSalesFinal: r.id === q.salesFinalRevisionId })),
      salesFinal: final ? revisionLabel(final.n) : null,
      updatedAt: q.updatedAt,
    };
  });

  const booked = booking !== null && !booking.cancelled;
  const withFinal = quoteRows.find((q) => q.salesFinalRevisionId !== null);
  const next = nextStep({
    contacted: contacted > 0 || client.lastContactedAt !== null,
    hasFloorPlan: files.some((f) => f.kind === 'FLOOR_PLAN'),
    quoteCount: quotes.length,
    sentRevisions: quotes.reduce((n, q) => n + q.revisions.length, 0),
    hasSalesFinal: withFinal !== undefined,
    booked,
  });

  const sourceText =
    client.leadSourceName ?? (SOURCE_LABELS[client.source as ClientSourceName] ?? 'Other');

  return {
    client,
    sourceText,
    budgetText: budgetText(client.budgetPaise),
    meetingText: client.meetingAt ? meetingLabel(client.meetingAt) : null,
    files,
    quotes,
    booking,
    next,
    nextQuoteId: quotes[0]?.id ?? null,
    may: {
      edit: mayOnLead(scope, 'lead.edit', client),
      quote: mayOnLead(scope, 'quote.write', client),
      assign: can(scope.member, 'lead.assign'),
      book: can(scope.member, 'booking.record'),
      refund: can(scope.member, 'booking.refund'),
      readRooms: canReadPlans(),
    },
    members: members.map((m) => ({ id: m.id, name: m.user.name?.trim() || m.user.email?.split('@')[0] || m.user.phone || 'Someone' })),
    sources,
    bookableQuoteId: !booked && withFinal ? withFinal.id : null,
  };
}

// ── Details ────────────────────────────────────────────────────

export interface EditLeadInput {
  clientId: string;
  name: unknown;
  phone: unknown;
  email: unknown;
  society: unknown;
  config: unknown;
  budget: unknown;
  /** One of ours ("FACEBOOK"), or "own:<id>" for the studio's own name. */
  source: unknown;
  force?: boolean;
}

export type EditResult = LeadResult | { ok: false; error: string; duplicateOf: { id: string; name: string } };

const text = (v: unknown, max: number): string | null => (typeof v === 'string' ? v.trim().replace(/\s+/g, ' ').slice(0, max) || null : null);

/** Edit what is known about them. A phone already on another lead is asked about, not refused. */
export async function editLeadDetails(input: EditLeadInput): Promise<EditResult> {
  const found = await leadFor(input.clientId, 'lead.edit');
  if ('error' in found) return { ok: false, error: found.error };
  const { scope } = found;
  const studioId = scope.studioId;

  const name = text(input.name, 120);
  if (!name || name.length < 2) return { ok: false, error: 'Who is it? A name, please.' };
  const rawPhone = text(input.phone, 30);
  const phone = rawPhone ? normalisePhone(rawPhone) : null;
  if (rawPhone && !phone) return { ok: false, error: 'That phone number does not look right. Ten digits, please.' };
  const email = text(input.email, 160)?.toLowerCase() ?? null;
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return { ok: false, error: 'That email address does not look right.' };
  const budget = parseBudget(input.budget);
  if (!budget.ok) return budget;

  const rawSource = typeof input.source === 'string' ? input.source : 'OTHER';
  let source: ClientSourceName = 'OTHER';
  let leadSourceId: string | null = null;
  if (rawSource.startsWith('own:')) {
    const own = await prisma.studioLeadSource.findFirst({ where: { id: rawSource.slice(4), studioId }, select: { id: true } });
    if (!own) return { ok: false, error: 'That source is not one of yours.' };
    leadSourceId = own.id;
  } else if (rawSource in SOURCE_LABELS) {
    source = rawSource as ClientSourceName;
  }

  const before = await prisma.studioClient.findFirst({
    where: { ...scope.leads, id: found.lead.id, studioId, deletedAt: null },
    select: { name: true, phone: true, email: true, society: true, config: true, budgetPaise: true, source: true, leadSourceId: true },
  });
  if (!before) return { ok: false, error: NOT_YOURS };
  // A lead One Interiors introduced keeps that source; nobody can mark their own as ours.
  if (before.source === 'ONE_INTERIORS') {
    source = 'ONE_INTERIORS';
    leadSourceId = null;
  } else if (source === 'ONE_INTERIORS') {
    source = 'OTHER';
  }

  const phoneDigits = phone ? phone.replace(/\D/g, '').slice(-10) : null;
  if (phoneDigits && phoneDigits !== before.phone && input.force !== true) {
    const other = await prisma.studioClient.findFirst({
      where: { studioId, phone: phoneDigits, id: { not: found.lead.id }, deletedAt: null, isDemo: false },
      select: { id: true, name: true },
    });
    if (other) return { ok: false, error: `${other.name} already has that number.`, duplicateOf: other };
  }

  const after = {
    name,
    phone: phoneDigits,
    email,
    society: text(input.society, 120),
    config: text(input.config, 20),
    budgetPaise: budget.paise === null ? null : toDb(budget.paise),
    source,
    leadSourceId,
  };
  const changed = (Object.keys(after) as (keyof typeof after)[])
    .filter((k) => String(after[k] ?? '') !== String(before[k] ?? ''))
    .map((k) => (k === 'budgetPaise' ? 'budget' : k === 'leadSourceId' ? 'source' : k));
  const words = editSummary([...new Set(changed)]);
  if (!words) return { ok: true };

  await prisma.studioClient.updateMany({ where: { ...scope.leads, id: found.lead.id, studioId, deletedAt: null }, data: after });
  await record({ studioId, clientId: found.lead.id, kind: 'EDITED', summary: words, meta: { fields: [...new Set(changed)] } });
  return { ok: true };
}

/** A free-text note on the timeline. */
export async function addLeadNote(clientId: string, note: unknown): Promise<LeadResult> {
  const found = await leadFor(clientId, 'lead.edit');
  if ('error' in found) return { ok: false, error: found.error };
  const words = typeof note === 'string' ? note.trim().slice(0, 2000) : '';
  if (words.length === 0) return { ok: false, error: 'Write the note first.' };
  await record({ studioId: found.scope.studioId, clientId: found.lead.id, kind: 'NOTE', summary: words });
  return { ok: true };
}

/** Set, move or clear the meeting. Empty day = clear. */
export async function setLeadMeeting(clientId: string, day: unknown, time: unknown, note: unknown): Promise<LeadResult> {
  const found = await leadFor(clientId, 'lead.edit');
  if ('error' in found) return { ok: false, error: found.error };
  const studioId = found.scope.studioId;
  const clearing = typeof day !== 'string' || day.trim() === '';
  const at = clearing ? null : parseMeeting(day, time);
  if (!clearing && !at) return { ok: false, error: 'Pick the day and the time of the meeting.' };
  const words = text(note, 120);
  await prisma.studioClient.updateMany({
    where: { ...found.scope.leads, id: found.lead.id, studioId, deletedAt: null },
    data: { meetingAt: at, meetingNote: at ? words : null },
  });
  await record({
    studioId,
    clientId: found.lead.id,
    kind: 'MEETING',
    summary: at ? `Meeting set: ${meetingLabel(at)}${words ? ` · ${words}` : ''}` : 'Meeting cleared',
    meta: { at: at?.toISOString() ?? null },
  });
  return { ok: true };
}

/** Give one lead to somebody, or back to the pool, from the lead page. Owner and PM. */
export { assignClients as assignLeads } from '@/modules/studio-practice/clients';

// ── Files ──────────────────────────────────────────────────────

/** A one-time upload URL for a file on this lead. */
export async function leadFileTicket(clientId: string, contentType: unknown, bytes: unknown): Promise<{ ok: true; path: string; url: string | null } | { ok: false; error: string }> {
  const found = await leadFor(clientId, 'lead.edit');
  if ('error' in found) return { ok: false, error: found.error };
  const check = checkLeadFile(contentType, bytes);
  if (!check.ok) return check;
  return leadUploadTicket(found.scope.studioId, found.lead.id, check.ext);
}

/** Record a file the browser has uploaded with its ticket. */
export async function attachLeadFile(input: { clientId: string; path: unknown; name: unknown; contentType: unknown; bytes: unknown; kind: unknown }): Promise<LeadResult> {
  const found = await leadFor(input.clientId, 'lead.edit');
  if ('error' in found) return { ok: false, error: found.error };
  const studioId = found.scope.studioId;
  const check = checkLeadFile(input.contentType, input.bytes);
  if (!check.ok) return check;
  if (!pathBelongsTo(input.path, studioId, found.lead.id)) return { ok: false, error: 'That upload is not for this lead. Try again.' };
  if (!(await leadFileExists(input.path))) return { ok: false, error: 'The file did not finish uploading. Try again.' };
  const kind = input.kind === 'FLOOR_PLAN' ? 'FLOOR_PLAN' : 'OTHER';
  const name = cleanFileName(input.name);
  const by = await actingMember();
  await prisma.studioClientFile.create({
    data: {
      studioId,
      clientId: found.lead.id,
      kind,
      storagePath: input.path,
      name,
      contentType: String(input.contentType).split(';')[0]!.trim().toLowerCase(),
      bytes: input.bytes as number,
      uploadedById: by?.id ?? null,
      uploadedByName: by?.name ?? null,
    },
  });
  await record({ studioId, clientId: found.lead.id, kind: 'FILE', summary: kind === 'FLOOR_PLAN' ? `Floor plan attached: ${name}` : `File attached: ${name}` });
  return { ok: true };
}

/** Remove a file from the lead, and from storage. */
export async function removeLeadFile(fileId: string): Promise<LeadResult> {
  const scope = await myLeadScope();
  if (!scope) return { ok: false, error: 'Sign in as your studio first.' };
  const studioId = scope.studioId;
  const file = await prisma.studioClientFile.findFirst({
    where: { id: String(fileId ?? ''), studioId, client: { ...scope.leads, studioId, deletedAt: null } },
    select: { id: true, name: true, storagePath: true, clientId: true, client: { select: { assignedToId: true } } },
  });
  if (!file) return { ok: false, error: 'That file is not on one of your leads.' };
  if (!mayOnLead(scope, 'lead.edit', file.client)) return { ok: false, error: NOT_ROLE };
  await removeLeadFiles([file.storagePath]);
  await prisma.studioClientFile.deleteMany({ where: { id: file.id, studioId } });
  await record({ studioId, clientId: file.clientId, kind: 'FILE', summary: `File removed: ${file.name}` });
  return { ok: true };
}

/**
 * "Read rooms": the floor-plan reader, on a file somebody chose. Optional
 * and never automatic. The rooms it finds fill the next quotation's room
 * list (studio-quote/quotes.ts reads the newest read floor plan).
 */
export async function readRoomsOn(fileId: string): Promise<{ ok: true; rooms: number; summary: string } | { ok: false; error: string }> {
  const scope = await myLeadScope();
  if (!scope) return { ok: false, error: 'Sign in as your studio first.' };
  const studioId = scope.studioId;
  if (!canReadPlans()) return { ok: false, error: 'The floor-plan reader is not switched on for this deployment.' };
  const file = await prisma.studioClientFile.findFirst({
    where: { id: String(fileId ?? ''), studioId, client: { ...scope.leads, studioId, deletedAt: null } },
    select: { id: true, storagePath: true, contentType: true, clientId: true, client: { select: { assignedToId: true } } },
  });
  if (!file) return { ok: false, error: 'That file is not on one of your leads.' };
  if (!mayOnLead(scope, 'lead.edit', file.client)) return { ok: false, error: NOT_ROLE };
  if (!readablePlanType(file.contentType)) return { ok: false, error: 'The reader takes a PDF, JPG, PNG or WebP plan.' };
  const bytes = await readLeadFile(file.storagePath);
  if (!bytes) return { ok: false, error: 'We could not open the stored file. Try again.' };
  const result = await readFloorPlan(Buffer.from(bytes).toString('base64'), file.contentType);
  if (!result.ok) return { ok: false, error: 'The reader could not make out the rooms on this plan. Enter them in the quotation instead.' };
  const r = result.reading;
  const reading = {
    rooms: r.rooms.map((x) => ({ name: x.name, code: x.code, widthMm: x.widthMm, depthMm: x.depthMm })),
    kitchenRunMm: r.kitchenRunMm,
    bathrooms: r.bathrooms,
    hasStudy: r.hasStudy,
    areaSource: r.carpetAreaSource,
    bedrooms: r.bedrooms,
    carpetAreaSqft: r.carpetAreaSqft,
  };
  await prisma.studioClientFile.updateMany({ where: { id: file.id, studioId }, data: { kind: 'FLOOR_PLAN', reading } });
  const summary = `${r.bedrooms} bedroom${r.bedrooms === 1 ? '' : 's'}, ${r.bathrooms} bathroom${r.bathrooms === 1 ? '' : 's'}${r.carpetAreaSqft ? `, about ${r.carpetAreaSqft} sq ft` : ''}`;
  await record({ studioId, clientId: file.clientId, kind: 'FILE', summary: `Rooms read from the floor plan: ${summary}` });
  return { ok: true, rooms: r.rooms.length, summary };
}

// ── A new quotation, from the lead ─────────────────────────────

/**
 * "New quotation" on the lead: linked to the lead and filled from it (name,
 * phone, society, BHK; the read floor plan's rooms and kitchen when there
 * is one), then built from the studio's standard build for that size.
 */
export async function newQuoteForLead(clientId: string): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const found = await leadFor(clientId, 'quote.write');
  if ('error' in found) return { ok: false, error: found.error };
  const studioId = found.scope.studioId;
  const lead = await prisma.studioClient.findFirst({
    where: { ...found.scope.leads, id: found.lead.id, studioId, deletedAt: null },
    select: { id: true, name: true, phone: true, email: true, society: true, config: true, carpetSqft: true, introductionId: true, source: true },
  });
  if (!lead) return { ok: false, error: NOT_YOURS };
  if (lead.introductionId || lead.source === 'ONE_INTERIORS') {
    return { ok: false, error: 'This client came through One Interiors. Use "Make the final quote" on this page, so they can read and sign it in the app.' };
  }
  const plan = await prisma.studioClientFile.findFirst({
    where: { studioId, clientId: lead.id, kind: 'FLOOR_PLAN', reading: { not: Prisma.AnyNull } },
    orderBy: { createdAt: 'desc' },
    select: { reading: true },
  }).catch(() => null);
  const reading = (plan?.reading ?? null) as { bathrooms?: number; kitchenRunMm?: number | null; bedrooms?: number; carpetAreaSqft?: number | null; hasStudy?: boolean } | null;
  const config = lead.config ?? (reading?.bedrooms ? `${Math.min(4, Math.max(1, reading.bedrooms))} BHK` : null);
  const created = await createQuote({
    clientName: lead.name,
    clientPhone: lead.phone ?? undefined,
    society: lead.society ?? undefined,
    config: config ?? undefined,
    carpetSqft: lead.carpetSqft ?? reading?.carpetAreaSqft ?? undefined,
    clientId: lead.id,
  });
  if (!created.ok) return created;
  if (lead.email) await prisma.studioQuote.updateMany({ where: { id: created.id, studioId }, data: { clientEmail: lead.email } });
  if (isConfigName(config)) {
    await applyConfiguration({
      quoteId: created.id,
      home: {
        config,
        kitchenRunMm: reading?.kitchenRunMm ?? null,
        bathrooms: reading?.bathrooms ?? (config === '1 BHK' ? 1 : 2),
        study: reading?.hasStudy === true,
        usePlan: reading !== null,
      },
    });
  }
  return created;
}
