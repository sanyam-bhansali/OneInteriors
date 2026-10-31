/**
 * The database side of the full Hauspire import (owner, 22 Oct 2026;
 * hauspire-import-plan.ts has the rules, scripts/import-hauspire-quotes.ts
 * runs it). No `server-only`: it is run from the command line with a
 * PrismaClient the script makes, and every query is scoped by the one
 * studio id the script resolved from `--studio`.
 *
 * A dry run reads and plans, and writes nothing. A real run creates the new
 * leads, then each quotation in its own transaction (its lines, its earlier
 * revisions, its Design Final link, a line on the lead's timeline), and one
 * AuditLog row (`studio.import.hauspireQuotes`) at the end. Nothing is sent
 * to anybody: no WhatsApp, no SMS, no email — customers never get WhatsApp
 * from One Interiors.
 */

import { Prisma, type PrismaClient } from '@prisma/client';
import { computeTotals } from '@/modules/studio-quote/pricing';
import { readPhases } from '@/modules/studio/payment-phases';
import type { RevisionLine, RevisionTerms, RevisionTotals } from '@/modules/studio-sales/revision-rules';
import { mapQuote, type MappedLine, type MappedQuote, type SourceQuote } from './hauspire-map';
import { contentKey, IMPORTED_PREFIX, planImport, SOURCE_NOTE, type ExistingClient, type ExistingQuote, type ImportPlan } from './hauspire-import-plan';

export const AUDIT_ACTION = 'studio.import.hauspireQuotes';
const BY = 'scripts/import-hauspire-quotes.ts';
/**
 * Where the rows came from, as people read it on the lead, its timeline and
 * each revision. The Hauspire quotation app by default; Hauspire's older
 * Excel quotations come through the same import as rows shaped like the
 * app's (owner, 30 Oct 2026), and must not say they came from the app.
 */
export const DEFAULT_SOURCE = 'Hauspire quotation app';

type Db = PrismaClient;
type Tx = Prisma.TransactionClient;

const day = (iso: string | null): Date | null => (iso ? new Date(`${iso}T00:00:00Z`) : null);
const isoDay = (d: Date | null): string | null => (d ? d.toISOString().slice(0, 10) : null);

export interface PoolTeam {
  memberId: string;
  name: string;
}

/** The sales head whose team pool new leads go into, by email or mobile; or why not. */
export async function resolvePoolTeam(db: Db, studioId: string, who: string): Promise<{ ok: true; team: PoolTeam } | { ok: false; error: string }> {
  const t = who.trim().toLowerCase();
  const digits = t.replace(/\D/g, '').slice(-10);
  const members = await db.studioMember.findMany({ where: { studioId }, select: { id: true, role: true, status: true, user: { select: { name: true, email: true, phone: true } } } });
  const hit = members.find((m) => (t.includes('@') ? m.user.email?.toLowerCase() === t : digits.length === 10 && (m.user.phone ?? '').replace(/\D/g, '').slice(-10) === digits));
  if (!hit) return { ok: false, error: `--pool-team "${who}" is nobody in this studio.` };
  if (hit.role === 'OWNER') return { ok: false, error: `--pool-team: ${hit.user.name || who} is the owner, and the owner's pool is the studio pool. Leave --pool-team out for that.` };
  if (hit.role !== 'SALES') return { ok: false, error: `--pool-team: ${hit.user.name || who} is ${hit.role}; a team pool belongs to a salesperson who heads a team.` };
  if (hit.status === 'SUSPENDED') return { ok: false, error: `--pool-team: ${hit.user.name || who} is ${hit.status.toLowerCase()}.` };
  return { ok: true, team: { memberId: hit.id, name: hit.user.name || hit.user.email || who } };
}

/** What is already here: the studio's imported quotations (as content keys) and its leads. */
export async function loadExisting(db: Db, studioId: string): Promise<{ existing: ExistingQuote[]; clients: ExistingClient[] }> {
  const [quotes, clients] = await Promise.all([
    db.studioQuote.findMany({
      where: { studioId, importedFrom: { startsWith: IMPORTED_PREFIX } },
      select: {
        id: true,
        importedFrom: true,
        number: true,
        clientId: true,
        importedAt: true,
        updatedAt: true,
        feeBps: true,
        discountBps: true,
        onSpotPaise: true,
        onSpotLabel: true,
        gstBps: true,
        quoteDate: true,
        lines: { orderBy: { sortOrder: 'asc' }, select: { room: true, product: true, code: true, unit: true, details: true, widthMm: true, heightMm: true, qtyMilli: true, ratePaise: true, amountPaise: true } },
      },
    }),
    db.studioClient.findMany({ where: { studioId, deletedAt: null }, select: { id: true, name: true, phone: true, locality: true, city: true } }),
  ]);
  return {
    existing: quotes.map((q) => ({
      id: q.id,
      importedFrom: q.importedFrom!,
      number: q.number,
      clientId: q.clientId,
      importedAt: q.importedAt,
      updatedAt: q.updatedAt,
      content: contentKey({
        lines: q.lines.map((l) => ({ ...l, code: l.code, unit: l.unit, ratePaise: Number(l.ratePaise), amountPaise: Number(l.amountPaise) })),
        terms: { feeBps: q.feeBps, discountBps: q.discountBps, onSpotPaise: Number(q.onSpotPaise), onSpotLabel: q.onSpotLabel, gstBps: q.gstBps, quoteDate: isoDay(q.quoteDate) },
      }),
    })),
    clients,
  };
}

export interface Written {
  clientsCreated: number;
  quotesCreated: number;
  quotesUpdated: number;
  revisions: number;
  failed: { number: string; reason: string }[];
}

/** Plan, and unless it is a dry run, write. */
/**
 * The row's own import time, written last so it equals the row's last change:
 * "edited here" (updatedAt past importedAt) is then never tripped by the run
 * itself, however slow (31 Oct 2026: one start time for the whole run made
 * the later rows of a 10-second run look edited).
 */
async function stampImported(tx: Prisma.TransactionClient, studioId: string, quoteId: string): Promise<void> {
  const at = new Date();
  await tx.studioQuote.updateMany({ where: { id: quoteId, studioId }, data: { importedAt: at, updatedAt: at } });
}

export async function runHauspireImport(
  db: Db,
  input: { studioId: string; rows: readonly SourceQuote[]; dryRun: boolean; poolTeam: PoolTeam | null; now?: Date; source?: string; previous?: readonly SourceQuote[]; replace?: readonly string[] },
): Promise<{ plan: ImportPlan; written: Written | null }> {
  const { studioId, dryRun, poolTeam } = input;
  const source = input.source?.trim() || DEFAULT_SOURCE;
  const now = input.now ?? new Date();
  const { existing, clients } = await loadExisting(db, studioId);
  const previous = input.previous ? new Map(input.previous.map((r) => [r.id, contentKey(mapQuote(r))])) : undefined;
  const plan = planImport({ rows: input.rows, existing, clients, previous, replace: input.replace ? new Set(input.replace) : undefined });
  if (dryRun) return { plan, written: null };

  const studio = await db.studio.findUnique({ where: { id: studioId }, select: { paymentPhases: true, branding: { select: { welcomeNote: true, terms: true, bookingAdvancePaise: true } } } });
  if (!studio) throw new Error('The studio disappeared while importing.');
  const stage = await db.studioStage.findFirst({ where: { studioId, kind: 'OPEN' }, orderBy: { sortOrder: 'asc' }, select: { id: true } });
  const phases = readPhases(studio.paymentPhases);
  const advance = studio.branding?.bookingAdvancePaise ?? BigInt(2_500_000);
  const written: Written = { clientsCreated: 0, quotesCreated: 0, quotesUpdated: 0, revisions: 0, failed: [] };

  // 1. The new leads.
  const leadOf = new Map<string, string>();
  if (plan.newClients.length > 0 && !stage) throw new Error('That studio has no open pipeline column. Open Leads once in the studio (it makes them), then run this again.');
  for (const c of plan.newClients) {
    /* A lead an earlier run made for this client (several leads matched then too): the same one again. */
    const before = await db.studioClient.findFirst({ where: { studioId, importedFrom: 'hauspire-quotes', externalId: c.key.slice(0, 190) }, select: { id: true } });
    if (before) {
      leadOf.set(c.key, before.id);
      continue;
    }
    const made = await db.studioClient.create({
      data: {
        studioId,
        stageId: stage!.id,
        name: c.name,
        phone: c.phone,
        locality: c.locality,
        config: c.config,
        source: 'OTHER',
        sourceNote: source === DEFAULT_SOURCE ? SOURCE_NOTE : `From ${source}`,
        poolTeamId: poolTeam?.memberId ?? null,
        importedFrom: 'hauspire-quotes',
        externalId: c.key.slice(0, 190),
      },
      select: { id: true },
    });
    leadOf.set(c.key, made.id);
    written.clientsCreated += 1;
  }

  // 2. The quotations, Sales Finals first (the plan sorts them).
  const ourIdOfSource = new Map<string, string>();
  for (const e of existing) ourIdOfSource.set(e.importedFrom.slice(IMPORTED_PREFIX.length), e.id);

  for (const q of plan.quotes) {
    if (q.action === 'same' || q.action === 'edited-here') continue;
    const clientId = q.client.kind === 'existing' ? q.client.id : (leadOf.get(q.client.key) ?? null);
    try {
      await db.$transaction(async (tx) => {
        if (q.action === 'update' && q.existingId) {
          await tx.studioQuoteLine.deleteMany({ where: { quoteId: q.existingId } });
          await tx.studioQuote.update({
            where: { id: q.existingId },
            data: { ...termsData(q.mapped), ...clientData(q.mapped), ...(clientId ? { clientId } : {}), importedAt: now, lines: { create: linesData(q.mapped.lines) } },
          });
          await addRevisions(tx, studioId, q.existingId, [q.mapped], { advance, phases, source });
          await stampImported(tx, studioId, q.existingId);
          written.quotesUpdated += 1;
          written.revisions += 1;
          return;
        }
        const basedOnId = q.salesSourceId ? (ourIdOfSource.get(q.salesSourceId) ?? null) : null;
        const wanted = q.mapped.stage === 'design' ? `${q.mapped.number}-D` : q.mapped.number;
        const number = await freeNumber(tx, studioId, wanted);
        const first = q.earlier[0] ?? q.mapped;
        const created = await tx.studioQuote.create({
          data: {
            studioId,
            number,
            stage: q.mapped.stage === 'design' ? 'DESIGN' : 'SALES',
            status: 'ISSUED',
            clientId,
            basedOnId,
            ...clientData(q.mapped),
            ...termsData(q.mapped),
            bookingAdvancePaise: advance,
            ...(phases ? { phases: phases as unknown as Prisma.InputJsonValue } : {}),
            welcomeNote: studio.branding?.welcomeNote ?? null,
            terms: studio.branding?.terms ?? null,
            issuedOn: day(first.terms.quoteDate) ?? (first.savedAt ? new Date(first.savedAt) : now),
            issuedLines: first.lines.map((l) => ({ room: l.room, product: l.product, amountPaise: l.amountPaise })) as unknown as Prisma.InputJsonValue,
            importedFrom: `${IMPORTED_PREFIX}${q.mapped.sourceId}`,
            importedAt: now,
            lines: { create: linesData(q.mapped.lines) },
          },
          select: { id: true, number: true },
        });
        ourIdOfSource.set(q.mapped.sourceId, created.id);
        /* Every save the old app kept, then the quotation as it stands: R1, R2… — what the client was sent. */
        written.revisions += await addRevisions(tx, studioId, created.id, [...q.earlier, q.mapped], { advance, phases, source });
        if (clientId) {
          await tx.studioClientEvent.create({
            data: {
              studioId,
              clientId,
              kind: 'QUOTED',
              actor: 'SYSTEM',
              byName: source,
              summary: `Quotation ${created.number} imported from ${source === DEFAULT_SOURCE ? 'the Hauspire quotation app' : source}${number !== wanted ? ` (its number there: ${q.mapped.number})` : ''}`,
              meta: { quoteId: created.id, hauspireImport: true, sourceNumber: q.mapped.number } as Prisma.InputJsonValue,
            },
          });
        }
        await stampImported(tx, studioId, created.id);
        written.quotesCreated += 1;
      });
    } catch (error) {
      written.failed.push({ number: q.mapped.number, reason: error instanceof Error ? error.message.split('\n')[0]!.slice(0, 200) : 'unknown' });
    }
  }

  // 3. One audit row for the run: counts only, no client data.
  await db.auditLog.create({
    data: {
      actorId: null,
      action: AUDIT_ACTION,
      entityType: 'Studio',
      entityId: studioId,
      after: {
        by: BY,
        rows: plan.report.rows,
        quotations: plan.report.quotations,
        byStage: plan.report.byStage,
        byAction: plan.report.byAction,
        clients: plan.report.clients,
        totalsMatched: plan.report.totalsMatched,
        mismatches: plan.report.mismatches.length,
        unreadable: plan.report.unreadable.length,
        poolTeamId: poolTeam?.memberId ?? null,
        ...written,
        failed: written.failed.length,
      } as Prisma.InputJsonValue,
    },
  });
  return { plan, written };
}

/** The old number when it is free here, else with -H, -H2… (as bringing in a project does). */
async function freeNumber(tx: Tx, studioId: string, wanted: string): Promise<string> {
  let n = wanted;
  for (let i = 1; await tx.studioQuote.findFirst({ where: { studioId, number: n }, select: { id: true } }); i += 1) n = i === 1 ? `${wanted}-H` : `${wanted}-H${i}`;
  return n;
}

function clientData(m: MappedQuote) {
  return { clientName: m.client, clientPhone: m.phone, locality: m.location, config: m.bhk, kitchenRunMm: m.kitchenRunMm };
}

function termsData(m: MappedQuote) {
  return {
    feeBps: m.terms.feeBps,
    discountBps: m.terms.discountBps,
    onSpotPaise: BigInt(m.terms.onSpotPaise),
    onSpotLabel: m.terms.onSpotLabel,
    gstBps: m.terms.gstBps,
    quoteDate: day(m.terms.quoteDate),
  };
}

function linesData(lines: readonly MappedLine[]) {
  return lines.map((l) => ({
    room: l.room,
    product: l.product,
    code: l.code,
    unit: l.unit,
    details: l.details,
    widthMm: l.widthMm,
    heightMm: l.heightMm,
    qtyMilli: l.qtyMilli,
    ratePaise: BigInt(l.ratePaise),
    amountPaise: BigInt(l.amountPaise),
    sortOrder: l.sortOrder,
  }));
}

/** Frozen revisions in the shape revisions.ts keeps, numbered after any the quotation has. */
async function addRevisions(tx: Tx, studioId: string, quoteId: string, versions: readonly MappedQuote[], ctx: { advance: bigint; phases: { label: string; pct: number }[] | null; source: string }): Promise<number> {
  const last = await tx.studioQuoteRevision.findFirst({ where: { studioId, quoteId }, orderBy: { n: 'desc' }, select: { n: true } });
  let n = last?.n ?? 0;
  for (const v of versions) {
    n += 1;
    const lines: RevisionLine[] = v.lines.map((l) => ({ room: l.room, product: l.product, code: l.code, unit: l.unit, details: l.details, widthMm: l.widthMm, heightMm: l.heightMm, qtyMilli: l.qtyMilli, ratePaise: l.ratePaise, amountPaise: l.amountPaise, note: null }));
    const terms: RevisionTerms = { feeBps: v.terms.feeBps, discountBps: v.terms.discountBps, onSpotPaise: v.terms.onSpotPaise, onSpotLabel: v.terms.onSpotLabel, bookingAdvancePaise: Number(ctx.advance), gstBps: v.terms.gstBps, phases: ctx.phases };
    const t = computeTotals(lines, { ...terms });
    const totals: RevisionTotals = { workPaise: t.workPaise, feePaise: t.feePaise, discountPaise: t.discountPaise, onSpotPaise: t.onSpotPaise, gstPaise: t.gstPaise, totalPaise: t.totalPaise };
    await tx.studioQuoteRevision.create({
      data: {
        studioId,
        quoteId,
        n,
        lines: lines as unknown as Prisma.InputJsonValue,
        terms: terms as unknown as Prisma.InputJsonValue,
        totalPaise: BigInt(t.totalPaise),
        totals: totals as unknown as Prisma.InputJsonValue,
        sentAt: v.savedAt ? new Date(v.savedAt) : new Date(),
        sentByName: ctx.source,
      },
    });
  }
  return versions.length;
}
