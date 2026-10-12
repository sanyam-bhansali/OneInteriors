import 'server-only';

/**
 * Floor plan → first quotation (owner, 12 Oct 2026).
 *
 * A salesperson attaches the client's floor plan to the lead; the lead page
 * then calls `buildFromPlan` (it runs after the upload has answered, with
 * "Reading the plan and building the first quotation…" on screen). The plan
 * is read once (`floorplan/plan-reads.ts`: hash cache, daily cap, timeout)
 * and a DRAFT quotation is made for the lead through the ordinary
 * `createQuote` + `applyConfiguration`, sized from the plan by the standard
 * build (`configure.ts`, Hauspire's first-quote rules). Without an API key,
 * or when the plan cannot be read, the quotation is built from the lead's
 * BHK instead and the page says why.
 *
 * Permissions are the lead's: a salesperson only on their own leads, through
 * `myLeadScope` / `mayOnLead`, and `createQuote` checks again. Nothing about
 * the plan is logged.
 */

import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { leadInScope, mayOnLead, myLeadScope } from '@/modules/studio/lead-scope';
import { record } from '@/modules/studio-practice/events';
import { readLeadFile } from '@/modules/storage/lead-files';
import { canReadPlans } from '@/modules/floorplan/read';
import { checkPlanFile, planReadMessage, STALE_READ_MS } from '@/modules/floorplan/plan-cache';
import { readPlanOnce } from '@/modules/floorplan/plan-reads';
import { applyConfiguration, createQuote } from './quotes';
import { readRoomsRefusal } from './write-rules';
import {
  fileReadingOf,
  homeFromLead,
  homeFromReading,
  jobView,
  outcomeMessage,
  readingSummary,
  type PlanJobStatus,
  type PlanJobView,
  type StoredFileReading,
} from './from-plan-rules';

export type PlanBuildResult =
  | { ok: true; status: PlanJobStatus; message: string; quoteId: string | null; notes: string[] }
  | { ok: false; error: string };

const NOT_YOURS = 'That lead is not one of yours.';
const NOT_ROLE = 'Your role in the studio does not include that. Ask your studio owner.';

type FileRow = { id: string; kind: string; storagePath: string; contentType: string; bytes: number; clientId: string };

/** Read one lead file once and keep the rooms on it. */
async function readFile(studioId: string, file: FileRow): Promise<{ ok: true; stored: StoredFileReading } | { ok: false; reason: string }> {
  if (!canReadPlans()) return { ok: false, reason: 'not-configured' };
  const check = checkPlanFile(file.contentType, file.bytes);
  if (!check.ok) return { ok: false, reason: check.reason };
  try {
    const bytes = await readLeadFile(file.storagePath);
    if (!bytes) return { ok: false, reason: 'no-file' };
    const read = await readPlanOnce(studioId, bytes, file.contentType);
    if (!read.ok) return read;
    const stored = fileReadingOf(read.reading);
    await prisma.studioClientFile.updateMany({
      where: { id: file.id, studioId },
      data: { kind: 'FLOOR_PLAN', reading: stored as unknown as Prisma.InputJsonValue },
    });
    await record({
      studioId,
      clientId: file.clientId,
      kind: 'FILE',
      summary: `Rooms read from the floor plan: ${readingSummary(stored)}`,
    });
    return { ok: true, stored };
  } catch (error) {
    console.error('[from-plan] read failed', error instanceof Error ? error.name : 'unknown');
    return { ok: false, reason: 'reader-failed' };
  }
}

/**
 * Mark a file's run as started, unless one is already running. Atomic: the
 * guarded update takes a finished (or dead) run; with no row, the create
 * takes it, and a second press at the same moment hits the unique `fileId`
 * and is told the plan is being read — never two runs, never two quotations.
 */
async function claimJob(studioId: string, clientId: string, fileId: string): Promise<boolean> {
  const now = new Date();
  const stale = new Date(now.getTime() - STALE_READ_MS);
  const { count } = await prisma.studioPlanJob.updateMany({
    where: { fileId, OR: [{ status: { not: 'READING' } }, { startedAt: { lt: stale } }] },
    data: { status: 'READING', message: null, quoteId: null, startedAt: now, finishedAt: null },
  });
  if (count > 0) return true;
  try {
    await prisma.studioPlanJob.create({ data: { studioId, clientId, fileId, status: 'READING', startedAt: now } });
    return true;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') return false;
    throw error;
  }
}

async function finishJob(fileId: string, status: PlanJobStatus, message: string, quoteId: string | null) {
  await prisma.studioPlanJob
    .update({ where: { fileId }, data: { status, message: message.slice(0, 600), quoteId, finishedAt: new Date() } })
    .catch(() => undefined);
}

/**
 * Read a lead's floor plan and build the first quotation from it.
 *
 * `auto` is the run straight after an upload: it builds only when the lead
 * has no quotation yet (a later plan is read, and the page offers the
 * button). `manual` is "Build a quotation from this plan": always a new
 * draft. A client One Interiors introduced is read, never quoted here —
 * theirs is the final quote the customer signs in the app. `read` only
 * reads (the lead page's "Read rooms"): the rooms then fill the next
 * quotation.
 */
export async function buildFromPlan(clientId: string, ref: { fileId?: string; storagePath?: string }, mode: 'auto' | 'manual' | 'read'): Promise<PlanBuildResult> {
  const scope = await myLeadScope();
  if (!scope) return { ok: false, error: 'Sign in as your studio first.' };
  const studioId = scope.studioId;
  const found = await leadInScope(scope, String(clientId ?? ''));
  if (!found) return { ok: false, error: NOT_YOURS };
  const mayRead = mayOnLead(scope, 'lead.edit', found);
  const mayQuote = mayOnLead(scope, 'quote.write', found);
  if (!mayRead && !mayQuote) return { ok: false, error: NOT_ROLE };

  const fileId = typeof ref.fileId === 'string' && ref.fileId.length <= 64 ? ref.fileId : null;
  const path = typeof ref.storagePath === 'string' && ref.storagePath.length <= 300 ? ref.storagePath : null;
  if (!fileId && !path) return { ok: false, error: 'Which file?' };
  const file = await prisma.studioClientFile.findFirst({
    where: { studioId, clientId: found.id, ...(fileId ? { id: fileId } : { storagePath: path! }) },
    select: { id: true, kind: true, storagePath: true, contentType: true, bytes: true, clientId: true },
  });
  if (!file) return { ok: false, error: 'That file is not on this lead.' };
  if (mode !== 'manual' && mode !== 'read' && file.kind !== 'FLOOR_PLAN') return { ok: true, status: 'READ', message: '', quoteId: null, notes: [] };

  const lead = await prisma.studioClient.findFirst({
    where: { ...scope.leads, id: found.id, studioId, deletedAt: null },
    select: { id: true, name: true, phone: true, email: true, society: true, config: true, carpetSqft: true, introductionId: true, source: true },
  });
  if (!lead) return { ok: false, error: NOT_YOURS };

  const oneInteriors = lead.introductionId !== null || lead.source === 'ONE_INTERIORS';
  const quotes = await prisma.studioQuote.count({ where: { studioId, clientId: lead.id } });
  const readOnlyWhy =
    mode === 'read' ? 'asked' : oneInteriors ? 'one-interiors' : !mayQuote ? 'no-role' : mode === 'auto' && quotes > 0 ? 'has-quote' : null;

  if (!(await claimJob(studioId, lead.id, file.id))) {
    return { ok: true, status: 'READING', message: planReadMessage('busy'), quoteId: null, notes: [] };
  }

  const read = await readFile(studioId, file);

  /* The same plan is being read by another run right now (the same file on
     another lead, or two presses at once): stop and say so. Building from
     the lead's BHK here would leave a second, plan-less quotation beside the
     one the other run is making. */
  if (!read.ok && read.reason === 'busy') {
    const message = planReadMessage('busy');
    await finishJob(file.id, 'FAILED', message, null);
    return { ok: true, status: 'FAILED', message, quoteId: null, notes: [] };
  }

  /* Read only: nothing more to make. */
  if (readOnlyWhy) {
    const status: PlanJobStatus = read.ok ? 'READ' : 'FAILED';
    const message = outcomeMessage({ read: read.ok, reason: read.ok ? null : read.reason, summary: read.ok ? readingSummary(read.stored) : null, built: null, builtFrom: null, readOnlyWhy });
    await finishJob(file.id, status, message, null);
    return { ok: true, status, message, quoteId: null, notes: [] };
  }

  const home = read.ok ? homeFromReading(read.stored, lead.config) : homeFromLead(lead.config);
  const created = await createQuote({
    clientName: lead.name,
    clientPhone: lead.phone ?? undefined,
    society: lead.society ?? undefined,
    config: home?.config ?? lead.config ?? undefined,
    carpetSqft: lead.carpetSqft ?? (read.ok ? read.stored.carpetAreaSqft : null) ?? undefined,
    clientId: lead.id,
  });
  if (!created.ok) {
    const message = `${read.ok ? `Read the plan: ${readingSummary(read.stored)}. ` : ''}${created.error}`;
    await finishJob(file.id, read.ok ? 'READ' : 'FAILED', message, null);
    return { ok: true, status: read.ok ? 'READ' : 'FAILED', message, quoteId: null, notes: [] };
  }

  const quote = await prisma.studioQuote.findFirst({ where: { id: created.id, studioId }, select: { number: true } });
  const number = quote?.number ?? '';
  if (lead.email) await prisma.studioQuote.updateMany({ where: { id: created.id, studioId }, data: { clientEmail: lead.email } });
  if (read.ok) {
    await prisma.studioQuotePlan.upsert({
      where: { quoteId: created.id },
      create: { quoteId: created.id, studioId, fileId: file.id },
      update: { fileId: file.id },
    });
  }

  let lines = 0;
  let notes: string[] = [];
  if (home) {
    const built = await applyConfiguration({ quoteId: created.id, home });
    if (built.ok) {
      lines = built.added;
      notes = built.notes;
    } else {
      notes = [built.error];
    }
  }

  const status: PlanJobStatus = read.ok && home ? 'BUILT' : home ? 'FALLBACK' : read.ok ? 'READ' : 'FAILED';
  const message = outcomeMessage({
    read: read.ok,
    reason: read.ok ? null : read.reason,
    summary: read.ok ? readingSummary(read.stored) : null,
    built: home ? { number, lines } : null,
    builtFrom: home ? (read.ok ? 'plan' : 'lead') : null,
    emptyQuote: home ? null : { number },
  });
  await finishJob(file.id, status, message, created.id);
  return { ok: true, status, message, quoteId: created.id, notes };
}

/**
 * "Read rooms" on a quotation: read the lead's floor plan (once — a plan read
 * before is not read again) and attach it to this quotation, so the builder
 * shows its rooms and "Size from the client's floor plan" uses them. The
 * flat's kitchen run and bathrooms are filled in; the lines are left alone
 * until somebody presses Rebuild.
 */
export async function readRoomsForQuote(quoteId: string): Promise<{ ok: true; message: string } | { ok: false; error: string }> {
  const scope = await myLeadScope();
  if (!scope) return { ok: false, error: 'Sign in as your studio first.' };
  const studioId = scope.studioId;
  const quote = await prisma.studioQuote.findFirst({
    where: { ...scope.quotes, id: String(quoteId ?? ''), studioId },
    select: { id: true, clientId: true, config: true, carpetSqft: true, status: true },
  });
  if (!quote) return { ok: false, error: 'That quotation is not yours.' };
  /* A draft only, and never one a project runs on: this rewrites the kitchen
     run, bathrooms and the plan the next rebuild is sized from. */
  const live = await prisma.homeProject.findFirst({ where: { signedQuoteId: quote.id, cancelledAt: null }, select: { id: true } });
  const refusal = readRoomsRefusal({ liveProject: live !== null, status: quote.status });
  if (refusal) return { ok: false, error: refusal };
  if (!quote.clientId) return { ok: false, error: 'This quotation is not linked to a lead, so there is no floor plan to read.' };
  const lead = await leadInScope(scope, quote.clientId);
  if (!lead) return { ok: false, error: NOT_YOURS };
  if (!mayOnLead(scope, 'quote.write', lead)) return { ok: false, error: NOT_ROLE };
  if (!canReadPlans()) return { ok: false, error: planReadMessage('not-configured') };

  const file = await prisma.studioClientFile.findFirst({
    where: { studioId, clientId: lead.id, kind: 'FLOOR_PLAN' },
    orderBy: { createdAt: 'desc' },
    select: { id: true, kind: true, storagePath: true, contentType: true, bytes: true, clientId: true },
  });
  if (!file) return { ok: false, error: 'No floor plan on this lead yet. Attach it on the lead page first.' };

  const read = await readFile(studioId, file);
  if (!read.ok) return { ok: false, error: planReadMessage(read.reason) };

  await prisma.studioQuotePlan.upsert({
    where: { quoteId: quote.id },
    create: { quoteId: quote.id, studioId, fileId: file.id },
    update: { fileId: file.id },
  });
  const home = homeFromReading(read.stored, quote.config);
  await prisma.studioQuote.updateMany({
    where: { id: quote.id, studioId, status: 'DRAFT' },
    data: {
      kitchenRunMm: read.stored.kitchenRunMm,
      bathrooms: read.stored.bathrooms,
      ...(quote.config ? {} : home ? { config: home.config } : {}),
      ...(quote.carpetSqft == null && read.stored.carpetAreaSqft ? { carpetSqft: read.stored.carpetAreaSqft } : {}),
      updatedAt: new Date(),
    },
  });
  return { ok: true, message: `Read the plan: ${readingSummary(read.stored)}. Press Rebuild to size the lines from it.` };
}

/** What the lead page shows beside each floor plan: the last run, and whether reading is on. */
export async function planJobsFor(clientId: string): Promise<{ canRead: boolean; jobs: Record<string, PlanJobView> } | null> {
  const scope = await myLeadScope();
  if (!scope) return null;
  const lead = await leadInScope(scope, String(clientId ?? ''));
  if (!lead) return null;
  const rows = await prisma.studioPlanJob.findMany({
    where: { studioId: scope.studioId, clientId: lead.id },
    select: { fileId: true, status: true, message: true, quoteId: true, startedAt: true },
  });
  const quoteIds = rows.map((r) => r.quoteId).filter((x): x is string => x !== null);
  const numbers = quoteIds.length
    ? await prisma.studioQuote.findMany({ where: { ...scope.quotes, studioId: scope.studioId, id: { in: quoteIds } }, select: { id: true, number: true } })
    : [];
  const byId = new Map(numbers.map((q) => [q.id, q.number]));
  const now = new Date();
  const jobs: Record<string, PlanJobView> = {};
  for (const r of rows) {
    /* A quotation this person may not open is not linked. */
    const visible = r.quoteId && byId.has(r.quoteId) ? r.quoteId : null;
    jobs[r.fileId] = jobView({ ...r, quoteId: visible }, visible ? byId.get(visible)! : null, now);
  }
  return { canRead: canReadPlans(), jobs };
}

/** For the quotation builder: is reading on, and does this quotation's lead have a plan attached? */
export async function planReaderFor(clientId: string | null): Promise<{ canRead: boolean; leadHasPlan: boolean }> {
  const canRead = canReadPlans();
  if (!clientId) return { canRead, leadHasPlan: false };
  const scope = await myLeadScope();
  if (!scope) return { canRead, leadHasPlan: false };
  const n = await prisma.studioClientFile
    .count({ where: { studioId: scope.studioId, clientId, kind: 'FLOOR_PLAN', client: { ...scope.leads, deletedAt: null } } })
    .catch(() => 0);
  return { canRead, leadHasPlan: n > 0 };
}
