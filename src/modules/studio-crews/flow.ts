import 'server-only';

/**
 * Studio OS Phase 3 writes: crews and their KYC, rate cards, the studio's
 * crew settings, work orders built from the final, quantities, prices,
 * extras, statuses, and payments. Every write checks the member's role on
 * the server (studio/roles.ts) and the studio it belongs to; the PM's writes
 * may never carry money (a rate, an agreed amount, a payment), whatever the
 * form sent. The rules themselves are pure and tested (kyc.ts, pricing.ts,
 * money.ts, rules.ts, settings.ts).
 *
 * Easy, not automatic: nothing here pays, prices or moves a status by
 * itself. A person presses the button; the software prices, adds up and
 * refuses what would be a mistake.
 */

import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { fromDb, toDb } from '@/lib/money';
import { currentMember, memberOnProject, type StudioMemberRef } from '@/modules/studio/access';
import { can } from '@/modules/studio/roles';
import { recordEvent, type ProjectActor } from '@/modules/project/events';
import { addDays, dayToDb, isDay, istDay } from '@/modules/project/working-days';
import { storeKycScan } from '@/modules/storage/crew-kyc';
import { checkIdentity, isKycDoc, KYC_DOC_FIELD, accountNumberError, ifscError, upiError, digitsOnly, type CrewKindName } from './kyc';
import { canCorrect, canPayCrew, parseQty, parseRupeesPaise, workOrderMoney, type PayKind } from './money';
import { cardRate, resolveLine, type CardRow, type CarpentryModeName } from './pricing';
import { canRemoveOrder, canSwapCrew, checkStatus, nextNumber, planFromFinal, type SourceLine, type WorkOrderStatusName } from './rules';
import { checkCrewSettings, readCrewSettings, tradesFromForm, type CrewSettings } from './settings';
import { CARPENTRY, isCrewUnit, type CrewUnitName } from './trades';
import { legacyUnit, LINE_MONEY, lineMoneyLite, moneyOf, settingsOf, tradesInUse, WO_SELECT } from './store';

export type CrewResult = { ok: true; message: string; id?: string } | { ok: false; error: string };

const NOT_YOURS = 'That is not one of your studio’s.';
const ROLE = 'Your role in the studio does not include that. Ask your studio owner.';
const SIGN_IN = 'Sign in as your studio first.';
const GONE = 'That is not there any more. Reload the page.';
const FAILED = 'That did not save. Try again.';

const text = (v: unknown, max: number): string => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max) : '');
const longText = (v: unknown, max: number): string => (typeof v === 'string' ? v.replace(/\r\n/g, '\n').trim().slice(0, max) : '');
const orNull = (s: string): string | null => (s ? s : null);

async function who(action: Parameters<typeof can>[1]): Promise<{ ok: true; member: StudioMemberRef; name: string } | { ok: false; error: string }> {
  const member = await currentMember();
  if (!member) return { ok: false, error: SIGN_IN };
  if (!can(member, action)) return { ok: false, error: ROLE };
  const user = await prisma.user.findUnique({ where: { id: member.userId }, select: { name: true, phone: true } });
  return { ok: true, member, name: user?.name?.trim() || user?.phone || 'Studio team' };
}

const actorOf = (m: StudioMemberRef): ProjectActor => ({ type: 'STUDIO', id: m.userId });

function failed(where: string, e: unknown): CrewResult {
  console.error(`[studio-crews] ${where} failed`, e);
  return { ok: false, error: FAILED };
}

const isUnique = (e: unknown) => e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002';

// ── Settings ──────────────────────────────────────────────────

export async function saveCrewSettings(raw: {
  trades: { key?: string; label: string; active: boolean }[];
  routes: { match: string; text: string; trade: string }[];
  useHauspire: boolean;
  dueDays: unknown;
  labourTargetPct: unknown;
  advanceLimitRupees: unknown;
  installRateRupees: unknown;
  execGates: { step: string; payment: string }[];
  templates?: Record<string, { item: string; unit: string; rateRupees: string }[]>;
}): Promise<CrewResult> {
  const w = await who('crew.settings');
  if (!w.ok) return w;
  const current = await settingsOf(w.member.studioId);
  const trades = tradesFromForm(Array.isArray(raw.trades) ? raw.trades.slice(0, 40) : [], current.trades);
  const keys = trades.map((t) => t.key);
  const int = (v: unknown) => (typeof v === 'number' ? v : Number(String(v ?? '').trim()));
  const advance = String(raw.advanceLimitRupees ?? '').trim() === '0' ? 0 : parseRupeesPaise(raw.advanceLimitRupees);
  const install = parseRupeesPaise(raw.installRateRupees);
  const templates: CrewSettings['templates'] = raw.templates
    ? Object.fromEntries(
        Object.entries(raw.templates)
          .filter(([k]) => keys.includes(k))
          .map(([k, list]) => [
            k,
            (Array.isArray(list) ? list : []).slice(0, 40).flatMap((i) => {
              const item = text(i?.item, 80);
              if (!item) return [];
              return [{ item, unit: isCrewUnit(i?.unit) ? i.unit : ('SQFT' as CrewUnitName), ratePaise: parseRupeesPaise(i?.rateRupees) }];
            }),
          ]),
      )
    : current.templates;
  const next: CrewSettings = readCrewSettings({
    trades,
    routes: (Array.isArray(raw.routes) ? raw.routes : []).slice(0, 300).map((r) => ({ match: r?.match === 'keyword' ? 'keyword' : 'exact', text: text(r?.text, 80), trade: text(r?.trade, 40) })),
    useHauspire: raw.useHauspire !== false,
    templates,
    dueDays: int(raw.dueDays),
    labourTargetPct: int(raw.labourTargetPct),
    advanceLimitPaise: advance ?? current.advanceLimitPaise,
    installRatePaise: install ?? current.installRatePaise,
    execGates: (Array.isArray(raw.execGates) ? raw.execGates : []).map((g) => ({ step: text(g?.step, 80), payment: text(g?.payment, 80) })),
  });
  if (!Number.isInteger(int(raw.dueDays)) || int(raw.dueDays) < 0 || int(raw.dueDays) > 365) return { ok: false, error: 'Due days are 0 to 365.' };
  if (!Number.isInteger(int(raw.labourTargetPct)) || int(raw.labourTargetPct) < 0 || int(raw.labourTargetPct) > 90) return { ok: false, error: 'The labour target is 0 to 90 percent.' };
  if (install === null) return { ok: false, error: 'The installation rate has to be more than nothing.' };
  const routesDropped = (raw.routes ?? []).filter((r) => text(r?.text, 80)).length - next.routes.length;
  if (routesDropped > 0) return { ok: false, error: 'A routing row points at a trade that is not on the list.' };
  const bad = checkCrewSettings(next, await tradesInUse(w.member.studioId));
  if (bad) return { ok: false, error: bad };
  try {
    await prisma.studio.update({ where: { id: w.member.studioId }, data: { crewSettings: next as unknown as Prisma.InputJsonValue } });
    return { ok: true, message: 'Saved. New work orders use these from now on; ones already raised keep their own.' };
  } catch (e) {
    return failed('saveCrewSettings', e);
  }
}

// ── Crews ─────────────────────────────────────────────────────

export interface CrewInput {
  name: unknown;
  kind: unknown;
  trades: unknown;
  phone: unknown;
  altPhone?: unknown;
  address?: unknown;
  workingSince?: unknown;
  notes?: unknown;
  pan?: unknown;
  aadhaar?: unknown;
  upiId?: unknown;
  bankAccountName?: unknown;
  bankAccountNumber?: unknown;
  bankIfsc?: unknown;
}

function cleanCrew(input: CrewInput, settings: CrewSettings) {
  const name = text(input.name, 80);
  const kind: CrewKindName = input.kind === 'PERMANENT' ? 'PERMANENT' : 'TEMPORARY';
  const keys = settings.trades.map((t) => t.key);
  const trades = [...new Set((Array.isArray(input.trades) ? input.trades : [input.trades]).map((t) => text(t, 40)).filter((t) => keys.includes(t)))];
  const phone = digitsOnly(text(input.phone, 20)).slice(-10);
  return {
    name,
    kind,
    trades,
    phone,
    altPhone: digitsOnly(text(input.altPhone, 20)).slice(-10),
    address: text(input.address, 200),
    workingSince: text(input.workingSince, 20),
    notes: longText(input.notes, 2000),
    pan: text(input.pan, 20),
    aadhaar: text(input.aadhaar, 20),
    upiId: text(input.upiId, 100),
    bankAccountName: text(input.bankAccountName, 80),
    bankAccountNumber: digitsOnly(text(input.bankAccountNumber, 30)),
    bankIfsc: text(input.bankIfsc, 20).toUpperCase(),
  };
}

function checkCrew(c: ReturnType<typeof cleanCrew>): string | null {
  if (c.name.length < 2) return 'Give them a name.';
  if (c.trades.length === 0) return 'Pick at least one trade.';
  if (c.phone && !/^[6-9]\d{9}$/.test(c.phone)) return 'A 10-digit mobile number, please.';
  if (c.altPhone && !/^[6-9]\d{9}$/.test(c.altPhone)) return 'The other number should be a 10-digit mobile too.';
  return upiError(c.upiId) ?? accountNumberError(c.bankAccountNumber) ?? ifscError(c.bankIfsc);
}

/** Add a crew. Their trades' rate templates are copied onto their card (never linked). Owner and accounts. */
export async function addCrew(input: CrewInput): Promise<CrewResult> {
  const w = await who('crew.edit');
  if (!w.ok) return w;
  const settings = await settingsOf(w.member.studioId);
  const c = cleanCrew(input, settings);
  const bad = checkCrew(c);
  if (bad) return { ok: false, error: bad };
  const id = checkIdentity({ kind: c.kind, phone: c.phone, pan: c.pan, aadhaar: c.aadhaar });
  if (!id.ok) return id;
  const items = c.trades.flatMap((t, ti) => (settings.templates[t] ?? []).map((i, k) => ({ ...i, trade: t, sortOrder: ti * 100 + k })));
  const seen = new Set<string>();
  try {
    const crew = await prisma.studioVendor.create({
      data: {
        studioId: w.member.studioId,
        name: c.name,
        kind: c.kind,
        trade: c.trades[0]!,
        trades: c.trades,
        phone: orNull(c.phone),
        altPhone: orNull(c.altPhone),
        address: orNull(c.address),
        workingSince: orNull(c.workingSince),
        notes: orNull(c.notes),
        panNumber: id.panNumber,
        aadhaarLast4: id.aadhaarLast4,
        kycCheckedAt: c.kind === 'PERMANENT' ? new Date() : null,
        kycCheckedById: c.kind === 'PERMANENT' ? w.member.id : null,
        upiId: orNull(c.upiId),
        bankAccountName: orNull(c.bankAccountName),
        bankAccountNumber: orNull(c.bankAccountNumber),
        bankIfsc: orNull(c.bankIfsc),
        rates: {
          create: items
            .filter((i) => !seen.has(i.item.toLowerCase()) && (seen.add(i.item.toLowerCase()), true))
            .map((i) => ({ item: i.item, unit: i.unit === 'RFT' ? 'RFT' : i.unit === 'SQFT' ? 'SQFT' : 'UNIT', crewUnit: i.unit, ratePaise: i.ratePaise === null ? null : toDb(i.ratePaise), trade: i.trade, sortOrder: i.sortOrder })),
        },
      },
      select: { id: true },
    });
    return { ok: true, message: `${c.name} is added, with ${seen.size} rate item${seen.size === 1 ? '' : 's'} to fill in.`, id: crew.id };
  } catch (e) {
    if (isUnique(e)) return { ok: false, error: duplicateWords(e) };
    return failed('addCrew', e);
  }
}

function duplicateWords(e: unknown): string {
  const target = e instanceof Prisma.PrismaClientKnownRequestError ? String((e.meta as { target?: unknown } | undefined)?.target ?? '') : '';
  return target.includes('pan') ? 'Another crew already has that PAN.' : 'You already have a crew with that name.';
}

/** Edit a crew's details, kind, trades, identity and payee details. A blank PAN or Aadhaar keeps what is on file. */
export async function updateCrew(id: string, input: CrewInput): Promise<CrewResult> {
  const w = await who('crew.edit');
  if (!w.ok) return w;
  const existing = await prisma.studioVendor.findFirst({ where: { id, studioId: w.member.studioId }, select: { id: true, kind: true, panNumber: true, aadhaarLast4: true, trade: true, trades: true } });
  if (!existing) return { ok: false, error: NOT_YOURS };
  const settings = await settingsOf(w.member.studioId);
  const c = cleanCrew(input, settings);
  const bad = checkCrew(c);
  if (bad) return { ok: false, error: bad };
  const ident = checkIdentity({ kind: c.kind, phone: c.phone, pan: c.pan, aadhaar: c.aadhaar, existing });
  if (!ident.ok) return ident;
  // A trade they have work in stays on their list.
  const used = await prisma.homeWorkOrder.findMany({ where: { vendorId: id }, select: { trades: true } });
  const missing = [...new Set(used.flatMap((u) => u.trades))].find((t) => !c.trades.includes(t));
  if (missing) return { ok: false, error: 'They have work orders in a trade you took off. Keep that trade on their list.' };
  const madePermanent = existing.kind !== 'PERMANENT' && c.kind === 'PERMANENT';
  try {
    await prisma.studioVendor.update({
      where: { id },
      data: {
        name: c.name,
        kind: c.kind,
        trade: c.trades.includes(existing.trade) ? existing.trade : c.trades[0]!,
        trades: c.trades,
        phone: orNull(c.phone),
        altPhone: orNull(c.altPhone),
        address: orNull(c.address),
        workingSince: orNull(c.workingSince),
        notes: orNull(c.notes),
        panNumber: ident.panNumber,
        aadhaarLast4: ident.aadhaarLast4,
        ...(madePermanent || (c.kind === 'PERMANENT' && (c.pan || c.aadhaar)) ? { kycCheckedAt: new Date(), kycCheckedById: w.member.id } : {}),
        upiId: orNull(c.upiId),
        bankAccountName: orNull(c.bankAccountName),
        bankAccountNumber: orNull(c.bankAccountNumber),
        bankIfsc: orNull(c.bankIfsc),
      },
    });
    return { ok: true, message: madePermanent ? `${c.name} is a permanent crew now. Their history carries over.` : 'Saved.' };
  } catch (e) {
    if (isUnique(e)) return { ok: false, error: duplicateWords(e) };
    return failed('updateCrew', e);
  }
}

/** Archive or bring back a crew. Archived crews leave the pickers; their past bills still read. Never deleted once they have work. */
export async function archiveCrew(id: string, archived: boolean): Promise<CrewResult> {
  const w = await who('crew.edit');
  if (!w.ok) return w;
  const r = await prisma.studioVendor.updateMany({ where: { id, studioId: w.member.studioId }, data: { archivedAt: archived ? new Date() : null, isActive: !archived } });
  if (r.count !== 1) return { ok: false, error: NOT_YOURS };
  return { ok: true, message: archived ? 'Archived. They are off the pickers; their work orders and payments stay.' : 'Back on the list.' };
}

/** A KYC scan or the agreement: private, owner and accounts only. */
export async function uploadKycScan(id: string, doc: unknown, file: File | null): Promise<CrewResult> {
  const w = await who('crew.edit');
  if (!w.ok) return w;
  if (!isKycDoc(doc)) return { ok: false, error: 'Which document is it?' };
  if (!file || file.size === 0) return { ok: false, error: 'Choose the scan first.' };
  const crew = await prisma.studioVendor.findFirst({ where: { id, studioId: w.member.studioId }, select: { id: true } });
  if (!crew) return { ok: false, error: NOT_YOURS };
  const stored = await storeKycScan(w.member.studioId, crew.id, doc, file);
  if (!stored.ok) return stored;
  try {
    await prisma.studioVendor.update({ where: { id: crew.id }, data: { [KYC_DOC_FIELD[doc]]: stored.path } });
    return { ok: true, message: 'Scan filed. Only the owner and accounts can open it.' };
  } catch (e) {
    return failed('uploadKycScan', e);
  }
}

// ── Rate cards ────────────────────────────────────────────────

/** Add or change one rate-card item. A blank rate means "agree it per job". Changing a card never re-prices work already raised. */
export async function saveRate(crewId: string, input: { id?: unknown; item: unknown; unit: unknown; rateRupees: unknown; trade?: unknown }): Promise<CrewResult> {
  const w = await who('crew.edit');
  if (!w.ok) return w;
  const crew = await prisma.studioVendor.findFirst({ where: { id: crewId, studioId: w.member.studioId }, select: { id: true } });
  if (!crew) return { ok: false, error: NOT_YOURS };
  const item = text(input.item, 80);
  if (item.length < 2) return { ok: false, error: 'What is the item?' };
  const unit: CrewUnitName = isCrewUnit(input.unit) ? input.unit : 'SQFT';
  const raw = String(input.rateRupees ?? '').trim();
  const rate = raw === '' ? null : parseRupeesPaise(raw);
  if (raw !== '' && rate === null) return { ok: false, error: 'A rate in rupees, or leave it blank to agree it per job.' };
  const trade = text(input.trade, 40) || null;
  const data = { item, crewUnit: unit, unit: unit === 'RFT' ? ('RFT' as const) : unit === 'SQFT' ? ('SQFT' as const) : ('UNIT' as const), ratePaise: rate === null ? null : toDb(rate), trade };
  try {
    const rid = text(input.id, 64);
    if (rid) {
      const r = await prisma.studioVendorRate.updateMany({ where: { id: rid, vendorId: crew.id }, data });
      if (r.count !== 1) return { ok: false, error: GONE };
    } else {
      const last = await prisma.studioVendorRate.findFirst({ where: { vendorId: crew.id }, orderBy: { sortOrder: 'desc' }, select: { sortOrder: true } });
      await prisma.studioVendorRate.create({ data: { ...data, vendorId: crew.id, sortOrder: (last?.sortOrder ?? 0) + 10 } });
    }
    return { ok: true, message: 'Saved. New work orders use it; ones already raised keep their rate.' };
  } catch (e) {
    if (isUnique(e)) return { ok: false, error: 'That item is on their card already.' };
    return failed('saveRate', e);
  }
}

export async function deleteRate(crewId: string, rateId: string): Promise<CrewResult> {
  const w = await who('crew.edit');
  if (!w.ok) return w;
  const r = await prisma.studioVendorRate.deleteMany({ where: { id: rateId, vendor: { id: crewId, studioId: w.member.studioId } } });
  return r.count === 1 ? { ok: true, message: 'Taken off the card.' } : { ok: false, error: GONE };
}

/** Copy a trade's template onto a crew's card: only the items they do not have yet. */
export async function loadTemplate(crewId: string, trade: string): Promise<CrewResult> {
  const w = await who('crew.edit');
  if (!w.ok) return w;
  const crew = await prisma.studioVendor.findFirst({ where: { id: crewId, studioId: w.member.studioId }, select: { id: true, rates: { select: { item: true } } } });
  if (!crew) return { ok: false, error: NOT_YOURS };
  const settings = await settingsOf(w.member.studioId);
  const have = new Set(crew.rates.map((r) => r.item.toLowerCase()));
  const items = (settings.templates[trade] ?? []).filter((i) => !have.has(i.item.toLowerCase()));
  if (items.length === 0) return { ok: true, message: 'Their card already has every item of that template.' };
  try {
    await prisma.studioVendorRate.createMany({
      data: items.map((i, k) => ({ vendorId: crew.id, item: i.item, crewUnit: i.unit, unit: i.unit === 'RFT' ? 'RFT' : i.unit === 'SQFT' ? 'SQFT' : 'UNIT', ratePaise: i.ratePaise === null ? null : toDb(i.ratePaise), trade, sortOrder: 1000 + k })),
      skipDuplicates: true,
    });
    return { ok: true, message: `${items.length} item${items.length === 1 ? '' : 's'} added from the template.` };
  } catch (e) {
    return failed('loadTemplate', e);
  }
}

// ── Work orders ───────────────────────────────────────────────

async function cardOf(vendorId: string): Promise<CardRow[]> {
  const rates = await prisma.studioVendorRate.findMany({ where: { vendorId }, orderBy: { sortOrder: 'asc' }, select: { item: true, unit: true, crewUnit: true, ratePaise: true } });
  return rates.map((r) => ({ item: r.item, unit: r.crewUnit ?? legacyUnit(r.unit), ratePaise: r.ratePaise === null ? null : fromDb(r.ratePaise) }));
}

/** The final a project's work orders are built from: the design final, else the sales final (the signed quote). */
async function finalOf(projectId: string, studioId: string) {
  const p = await prisma.homeProject.findUnique({ where: { id: projectId }, select: { designFinalQuoteId: true, signedQuoteId: true, cancelledAt: true } });
  if (!p || p.cancelledAt) return null;
  const quoteId = p.designFinalQuoteId ?? p.signedQuoteId;
  if (!quoteId) return null;
  const quote = await prisma.studioQuote.findFirst({ where: { id: quoteId, studioId }, select: { id: true, lines: { orderBy: { sortOrder: 'asc' } } } });
  if (!quote) return null;
  return { quoteId: quote.id, kind: p.designFinalQuoteId ? 'DESIGN_FINAL' : 'SALES_FINAL', lines: quote.lines };
}

export interface BuildInput {
  dueOn?: unknown;
  picks: { trade: unknown; crewId: unknown; lineIds: unknown; carpentry?: unknown }[];
}

/**
 * Build work orders from the final: for each trade, the crew picked and the
 * lines ticked. One work order per crew per project (a crew already on the
 * project gets the lines added to theirs). Each line is priced from that
 * crew's card as it is now, and frozen. Owner, and the PM on the project.
 */
export async function buildWorkOrders(projectId: string, input: BuildInput, now = new Date()): Promise<CrewResult> {
  const check = await memberOnProject(projectId, 'workorder.build');
  if (!check.ok) return check;
  const { member } = check;
  const final = await finalOf(projectId, member.studioId);
  if (!final) return { ok: false, error: 'This project has no sales final or design final to build work orders from.' };
  const settings = await settingsOf(member.studioId);
  const existing = await prisma.homeWorkOrder.findMany({ where: { projectId }, select: { id: true, vendorId: true, number: true, archivedAt: true, trades: true, lines: { where: { removedAt: null }, select: { quoteLineId: true } } } });
  const ordered = new Set(existing.filter((o) => o.archivedAt === null).flatMap((o) => o.lines.map((l) => l.quoteLineId).filter((x): x is string => Boolean(x))));
  const source: SourceLine[] = final.lines.map((l) => ({ id: l.id, room: l.room, product: l.product, code: l.code, unit: l.unit, details: l.details, widthMm: l.widthMm, heightMm: l.heightMm, qtyMilli: l.qtyMilli, amountPaise: fromDb(l.amountPaise) }));
  const routed = planFromFinal(source, { studio: settings.routes, useHauspire: settings.useHauspire }, ordered);
  const routedById = new Map([...routed.values()].flat().map((l) => [l.id, l]));

  // Gather: crew → lines (with the trade they were picked under).
  const byCrew = new Map<string, { trade: string; line: (typeof source)[number] & { guessed: boolean }; carpentry: CarpentryModeName | null }[]>();
  const taken = new Set<string>();
  const keys = settings.trades.map((t) => t.key);
  for (const pick of (Array.isArray(input.picks) ? input.picks : []).slice(0, 40)) {
    const trade = text(pick.trade, 40);
    const crewId = text(pick.crewId, 64);
    if (!crewId || !keys.includes(trade)) continue;
    const modes = pick.carpentry && typeof pick.carpentry === 'object' ? (pick.carpentry as Record<string, unknown>) : {};
    for (const id of (Array.isArray(pick.lineIds) ? pick.lineIds : []).slice(0, 400)) {
      const lid = text(id, 64);
      const line = routedById.get(lid);
      if (!line || taken.has(lid)) continue;
      taken.add(lid);
      const mode = modes[lid] === 'FULL' ? 'FULL' : modes[lid] === 'INSTALL' ? 'INSTALL' : null;
      const list = byCrew.get(crewId) ?? [];
      list.push({ trade, line, carpentry: trade === CARPENTRY ? mode : null });
      byCrew.set(crewId, list);
    }
  }
  if (byCrew.size === 0) return { ok: false, error: 'Pick a crew for at least one trade, with its lines ticked.' };

  const crews = await prisma.studioVendor.findMany({ where: { id: { in: [...byCrew.keys()] }, studioId: member.studioId }, select: { id: true, name: true, archivedAt: true, isActive: true } });
  if (crews.length !== byCrew.size) return { ok: false, error: 'One of those crews is not yours.' };
  const archivedCrew = crews.find((c) => c.archivedAt !== null || !c.isActive);
  if (archivedCrew) return { ok: false, error: `${archivedCrew.name} is archived. Bring them back on the Crews page first.` };
  const archivedOrder = existing.find((o) => byCrew.has(o.vendorId) && o.archivedAt !== null);
  if (archivedOrder) return { ok: false, error: 'That crew has an archived work order on this project. Restore it, then add the work to it.' };

  const due = isDay(input.dueOn) ? (input.dueOn as string) : addDays(istDay(now), settings.dueDays);
  const name = (await prisma.user.findUnique({ where: { id: member.userId }, select: { name: true } }))?.name ?? null;
  const cards = new Map(await Promise.all([...byCrew.keys()].map(async (id) => [id, await cardOf(id)] as const)));

  try {
    const made = await prisma.$transaction(async (tx) => {
      let number = nextNumber(existing.map((o) => o.number));
      let count = 0;
      for (const [crewId, picks] of byCrew) {
        const card = cards.get(crewId) ?? [];
        const lines = picks.map((p, i) => {
          const priced = resolveLine(p.trade, { product: p.line.product, code: p.line.code, unit: p.line.unit, widthMm: p.line.widthMm, heightMm: p.line.heightMm, qtyMilli: p.line.qtyMilli }, card, { carpentry: p.carpentry, installRatePaise: settings.installRatePaise });
          return {
            quoteLineId: p.line.id,
            room: p.line.room.slice(0, 80),
            product: p.line.product.slice(0, 160),
            code: p.line.code,
            details: p.line.details,
            widthMm: p.line.widthMm,
            heightMm: p.line.heightMm,
            quotedAmountPaise: toDb(p.line.amountPaise),
            trade: p.trade,
            guessed: p.line.guessed,
            item: priced.item,
            unit: priced.unit,
            ratePaise: priced.ratePaise === null ? null : toDb(priced.ratePaise),
            carpentry: priced.carpentry,
            qtyMilli: priced.qtyMilli,
            qtySource: priced.qtySource,
            sortOrder: i * 10,
          };
        });
        const trades = [...new Set(picks.map((p) => p.trade))];
        const prior = existing.find((o) => o.vendorId === crewId);
        let woId: string;
        if (prior) {
          const last = await tx.homeWorkOrderLine.findFirst({ where: { workOrderId: prior.id }, orderBy: { sortOrder: 'desc' }, select: { sortOrder: true } });
          const base = (last?.sortOrder ?? 0) + 10;
          await tx.homeWorkOrderLine.createMany({ data: lines.map((l) => ({ ...l, workOrderId: prior.id, sortOrder: base + l.sortOrder })) });
          await tx.homeWorkOrder.update({ where: { id: prior.id }, data: { trades: [...new Set([...prior.trades, ...trades])] } });
          woId = prior.id;
        } else {
          const wo = await tx.homeWorkOrder.create({
            data: {
              studioId: member.studioId,
              projectId,
              vendorId: crewId,
              number: number++,
              trades,
              dueOn: dayToDb(due),
              sourceQuoteId: final.quoteId,
              sourceKind: final.kind,
              createdById: member.id,
              createdByName: name,
              lines: { create: lines },
            },
            select: { id: true },
          });
          woId = wo.id;
        }
        count += lines.length;
        await recordEvent(tx, { projectId, type: 'crew.ordered', actor: actorOf(member), refId: woId, payload: { lines: lines.length, added: Boolean(prior) } });
      }
      return count;
    });
    return { ok: true, message: `${made} line${made === 1 ? '' : 's'} on ${byCrew.size} work order${byCrew.size === 1 ? '' : 's'}. They are drafts: issue each one when the crew has it.` };
  } catch (e) {
    if (isUnique(e)) return { ok: false, error: 'Someone else built work orders on this project at the same moment. Reload and try again.' };
    return failed('buildWorkOrders', e);
  }
}

/** A work order the member may act on, with what they may do on its project. */
async function orderFor(woId: string, action: 'workorder.build' | 'workorder.money' | 'crew.pay' | 'workorder.read') {
  const member = await currentMember();
  if (!member) return { ok: false as const, error: SIGN_IN };
  const wo = await prisma.homeWorkOrder.findFirst({ where: { id: woId, studioId: member.studioId }, select: WO_SELECT });
  if (!wo) return { ok: false as const, error: GONE };
  const check = await memberOnProject(wo.projectId, action);
  if (!check.ok) return check;
  return { ok: true as const, member, wo, access: check.access };
}

async function lineFor(lineId: string, action: 'workorder.build' | 'workorder.money') {
  const member = await currentMember();
  if (!member) return { ok: false as const, error: SIGN_IN };
  const line = await prisma.homeWorkOrderLine.findFirst({
    where: { id: lineId, removedAt: null, workOrder: { studioId: member.studioId } },
    select: { id: true, item: true, trade: true, product: true, code: true, widthMm: true, heightMm: true, qtyMilli: true, measuredQtyMilli: true, agreedPaise: true, ratePaise: true, carpentry: true, isExtra: true, workOrder: { select: { id: true, projectId: true, vendorId: true, archivedAt: true, status: true } } },
  });
  if (!line) return { ok: false as const, error: GONE };
  const check = await memberOnProject(line.workOrder.projectId, action);
  if (!check.ok) return check;
  if (line.workOrder.archivedAt) return { ok: false as const, error: 'That work order is archived. Restore it to change it.' };
  if (line.workOrder.status === 'SETTLED') return { ok: false as const, error: 'That work order is settled. Owner or accounts reopen it first.' };
  return { ok: true as const, member, line, access: check.access };
}

/**
 * Quantities: the site measurement (wins over the quote) or, for a line with
 * none, an estimate. Clearing the measurement goes back to the quote's. The
 * PM and the owner on the project; accounts too, from "Price these".
 */
export async function setLineQty(lineId: string, input: { measured?: unknown; estimate?: unknown }): Promise<CrewResult> {
  const member = await currentMember();
  const action = member && can(member, 'workorder.money') ? 'workorder.money' : 'workorder.build';
  const r = await lineFor(lineId, action);
  if (!r.ok) return r;
  const data: Prisma.HomeWorkOrderLineUpdateInput = {};
  if (input.measured !== undefined) {
    const raw = String(input.measured ?? '').trim();
    const q = raw === '' ? null : parseQty(raw);
    if (raw !== '' && q === null) return { ok: false, error: 'A quantity more than 0, like 34.5.' };
    data.measuredQtyMilli = q;
    if (q !== null) data.qtySource = 'SITE';
  }
  if (input.estimate !== undefined) {
    const q = parseQty(input.estimate);
    if (q === null) return { ok: false, error: 'A quantity more than 0, like 34.5.' };
    data.qtyMilli = q;
    data.qtySource = 'ESTIMATE';
  }
  try {
    await prisma.homeWorkOrderLine.update({ where: { id: r.line.id }, data });
    return { ok: true, message: 'Quantity saved.' };
  } catch (e) {
    return failed('setLineQty', e);
  }
}

/** Installation only, or full carpentry. Re-prices the line from the crew's card as it is now (an agreed amount stays). */
export async function setLineCarpentry(lineId: string, mode: unknown): Promise<CrewResult> {
  const member = await currentMember();
  const r = await lineFor(lineId, member && can(member, 'workorder.money') ? 'workorder.money' : 'workorder.build');
  if (!r.ok) return r;
  if (r.line.trade !== CARPENTRY || r.line.isExtra) return { ok: false, error: 'Only a carpentry line from the quotation has this choice.' };
  const carpentry: CarpentryModeName = mode === 'FULL' ? 'FULL' : 'INSTALL';
  const settings = await settingsOf(r.member.studioId);
  const priced = resolveLine(CARPENTRY, { product: r.line.product, code: r.line.code, unit: r.line.widthMm && r.line.heightMm ? 'AREA' : null, widthMm: r.line.widthMm, heightMm: r.line.heightMm, qtyMilli: r.line.qtyMilli }, await cardOf(r.line.workOrder.vendorId), { carpentry, installRatePaise: settings.installRatePaise });
  try {
    await prisma.homeWorkOrderLine.update({
      where: { id: r.line.id },
      data: { carpentry, item: priced.item, unit: priced.unit, ratePaise: priced.ratePaise === null ? null : toDb(priced.ratePaise), rateEdited: false, ...(priced.qtyMilli !== null ? { qtyMilli: priced.qtyMilli } : {}) },
    });
    return { ok: true, message: carpentry === 'FULL' ? 'Full carpentry: priced from the crew’s card.' : 'Installation only: priced per sq ft.' };
  } catch (e) {
    return failed('setLineCarpentry', e);
  }
}

/** A line's rate (for this project only; the card is untouched) or agreed amount. Owner and accounts only: the PM never sets money. */
export async function setLinePrice(lineId: string, input: { rateRupees?: unknown; agreedRupees?: unknown }): Promise<CrewResult> {
  const r = await lineFor(lineId, 'workorder.money');
  if (!r.ok) return r;
  const data: Prisma.HomeWorkOrderLineUpdateInput = {};
  if (input.rateRupees !== undefined) {
    const raw = String(input.rateRupees ?? '').trim();
    const rate = raw === '' ? null : parseRupeesPaise(raw);
    if (raw !== '' && rate === null) return { ok: false, error: 'A rate in rupees, more than 0.' };
    const card = cardRate((await cardOf(r.line.workOrder.vendorId)).find((c) => c.item.toLowerCase() === r.line.item.toLowerCase()));
    data.ratePaise = rate === null ? null : toDb(rate);
    data.rateEdited = rate !== null && rate !== card;
  }
  if (input.agreedRupees !== undefined) {
    const raw = String(input.agreedRupees ?? '').trim();
    const agreed = raw === '' ? null : parseRupeesPaise(raw);
    if (raw !== '' && agreed === null) return { ok: false, error: 'An amount in rupees, more than 0, or blank to go back to rate × quantity.' };
    data.agreedPaise = agreed === null ? null : toDb(agreed);
  }
  try {
    await prisma.homeWorkOrderLine.update({ where: { id: r.line.id }, data });
    return { ok: true, message: 'Price saved. The bill adds up again.' };
  } catch (e) {
    return failed('setLinePrice', e);
  }
}

/**
 * Work outside the quotation. The PM says what and how much (quantity and
 * unit, or a lump sum to be priced); owner and accounts may also give the
 * rate or the agreed amount. A PM's extra with money in it is refused.
 */
export async function addExtra(woId: string, input: { what: unknown; room?: unknown; unit: unknown; qty?: unknown; rateRupees?: unknown; agreedRupees?: unknown }): Promise<CrewResult> {
  const member = await currentMember();
  const money = member ? can(member, 'workorder.money') : false;
  const r = await orderFor(woId, money ? 'workorder.money' : 'workorder.build');
  if (!r.ok) return r;
  if (r.wo.archivedAt || r.wo.status === 'SETTLED') return { ok: false, error: 'This work order is closed. Reopen it first.' };
  const what = text(input.what, 160);
  if (what.length < 2) return { ok: false, error: 'What was done?' };
  const unit: CrewUnitName = isCrewUnit(input.unit) ? input.unit : 'LUMP';
  const qtyRaw = String(input.qty ?? '').trim();
  const qty = qtyRaw === '' ? null : parseQty(qtyRaw);
  if (qtyRaw !== '' && qty === null) return { ok: false, error: 'A quantity more than 0, like 12.5.' };
  const rateRaw = String(input.rateRupees ?? '').trim();
  const agreedRaw = String(input.agreedRupees ?? '').trim();
  if (!money && (rateRaw || agreedRaw)) return { ok: false, error: 'Rates and amounts are set by the owner or accounts. Save the extra with its quantity; they price it.' };
  const rate = rateRaw ? parseRupeesPaise(rateRaw) : null;
  const agreed = agreedRaw ? parseRupeesPaise(agreedRaw) : null;
  if ((rateRaw && rate === null) || (agreedRaw && agreed === null)) return { ok: false, error: 'Amounts in rupees, more than 0.' };
  if (unit !== 'LUMP' && qty === null) return { ok: false, error: 'How much was done? Give the quantity, or make it a lump sum.' };
  const trade = r.wo.trades[0] ?? CARPENTRY;
  try {
    const last = await prisma.homeWorkOrderLine.findFirst({ where: { workOrderId: r.wo.id }, orderBy: { sortOrder: 'desc' }, select: { sortOrder: true } });
    await prisma.$transaction(async (tx) => {
      await tx.homeWorkOrderLine.create({
        data: {
          workOrderId: r.wo.id,
          room: text(input.room, 80) || 'Extra work',
          product: what,
          trade,
          item: what,
          unit,
          qtyMilli: unit === 'LUMP' ? (qty ?? 1000) : qty,
          qtySource: 'MANUAL',
          ratePaise: rate === null ? null : toDb(rate),
          agreedPaise: agreed === null ? null : toDb(agreed),
          isExtra: true,
          sortOrder: (last?.sortOrder ?? 0) + 10,
        },
      });
      await recordEvent(tx, { projectId: r.wo.projectId, type: 'crew.order_changed', actor: actorOf(r.member), refId: r.wo.id, payload: { change: 'extra' } });
    });
    return { ok: true, message: rate || agreed ? 'Extra added. It shows apart from the quotation on the bill.' : 'Extra added. It waits in "Price these" for owner or accounts.' };
  } catch (e) {
    return failed('addExtra', e);
  }
}

/** Take a line off a work order (kept on the record; the bill adds up again). */
export async function removeLine(lineId: string): Promise<CrewResult> {
  const member = await currentMember();
  const r = await lineFor(lineId, member && can(member, 'workorder.money') ? 'workorder.money' : 'workorder.build');
  if (!r.ok) return r;
  try {
    await prisma.$transaction(async (tx) => {
      await tx.homeWorkOrderLine.update({ where: { id: r.line.id }, data: { removedAt: new Date() } });
      await recordEvent(tx, { projectId: r.line.workOrder.projectId, type: 'crew.order_changed', actor: actorOf(r.member), refId: r.line.workOrder.id, payload: { change: 'line_removed' } });
    });
    return { ok: true, message: 'Taken off. If it was a quotation line, it can go on another work order now.' };
  } catch (e) {
    return failed('removeLine', e);
  }
}

/** Move a work order along: issue, start, work done (the PM's signal to pay), reopen; settled by owner or accounts. */
export async function setOrderStatus(woId: string, to: unknown): Promise<CrewResult> {
  const r = await orderFor(woId, 'workorder.read');
  if (!r.ok) return r;
  const target = ['DRAFT', 'ISSUED', 'IN_PROGRESS', 'WORK_DONE', 'SETTLED'].includes(String(to)) ? (to as WorkOrderStatusName) : null;
  if (!target) return { ok: false, error: 'Which status?' };
  if (r.wo.archivedAt) return { ok: false, error: 'This work order is archived. Restore it first.' };
  const m = moneyOf(r.wo);
  const ok = checkStatus(r.wo.status, target, { build: r.access.may('workorder.build'), money: r.access.may('workorder.money') }, { settled: m.settled });
  if (!ok.ok) return ok;
  const name = (await prisma.user.findUnique({ where: { id: r.member.userId }, select: { name: true } }))?.name ?? null;
  try {
    await prisma.$transaction(async (tx) => {
      await tx.homeWorkOrder.update({
        where: { id: r.wo.id },
        data: {
          status: target,
          ...(target === 'WORK_DONE' && r.wo.status !== 'SETTLED' ? { workDoneAt: new Date(), workDoneByName: name } : {}),
          ...(target === 'SETTLED' ? { settledAt: new Date() } : r.wo.status === 'SETTLED' ? { settledAt: null } : {}),
        },
      });
      await recordEvent(tx, { projectId: r.wo.projectId, type: 'crew.status', actor: actorOf(r.member), refId: r.wo.id, payload: { from: r.wo.status, to: target } });
    });
    const words: Record<WorkOrderStatusName, string> = {
      DRAFT: 'Back to draft.',
      ISSUED: 'Issued. The crew can start.',
      IN_PROGRESS: 'Marked in progress.',
      WORK_DONE: 'Marked work done. Accounts sees it under Pay these.',
      SETTLED: 'Settled. It folds away with the settled work orders.',
    };
    return { ok: true, message: words[target] };
  } catch (e) {
    return failed('setOrderStatus', e);
  }
}

/** The due date, the steps it is linked to, and notes. Owner and the PM on the project. */
export async function editOrder(woId: string, input: { dueOn?: unknown; stepIds?: unknown; notes?: unknown }): Promise<CrewResult> {
  const r = await orderFor(woId, 'workorder.build');
  if (!r.ok) return r;
  const data: Prisma.HomeWorkOrderUpdateManyMutationInput = {};
  if (input.dueOn !== undefined) {
    if (input.dueOn === '' || input.dueOn === null) data.dueOn = null;
    else if (isDay(input.dueOn)) data.dueOn = dayToDb(input.dueOn);
    else return { ok: false, error: 'A date, please.' };
  }
  if (input.stepIds !== undefined) {
    const ids = (Array.isArray(input.stepIds) ? input.stepIds : []).map((x) => text(x, 64)).filter(Boolean).slice(0, 40);
    const steps = ids.length ? await prisma.homeChecklistItem.findMany({ where: { id: { in: ids }, stage: { projectId: r.wo.projectId } }, select: { id: true } }) : [];
    data.stepIds = steps.map((s) => s.id);
  }
  if (input.notes !== undefined) data.notes = orNull(longText(input.notes, 2000));
  try {
    await prisma.homeWorkOrder.updateMany({ where: { id: r.wo.id, studioId: r.member.studioId }, data });
    return { ok: true, message: 'Saved.' };
  } catch (e) {
    return failed('editOrder', e);
  }
}

/** Give the work order to another crew: only while nothing is paid. The rates are not re-priced (Hauspire's rule). */
export async function swapCrew(woId: string, crewId: unknown): Promise<CrewResult> {
  const r = await orderFor(woId, 'workorder.build');
  if (!r.ok) return r;
  const id = text(crewId, 64);
  const crew = await prisma.studioVendor.findFirst({ where: { id, studioId: r.member.studioId, archivedAt: null, isActive: true }, select: { id: true, name: true } });
  if (!crew) return { ok: false, error: 'Pick one of your crews.' };
  const theirs = await prisma.homeWorkOrder.findFirst({ where: { projectId: r.wo.projectId, vendorId: crew.id }, select: { id: true } });
  const ok = canSwapCrew(r.wo.payments.length, theirs !== null);
  if (!ok.ok) return ok;
  try {
    await prisma.$transaction(async (tx) => {
      await tx.homeWorkOrder.update({ where: { id: r.wo.id }, data: { vendorId: crew.id } });
      await recordEvent(tx, { projectId: r.wo.projectId, type: 'crew.order_changed', actor: actorOf(r.member), refId: r.wo.id, payload: { change: 'crew_swapped' } });
    });
    return { ok: true, message: `${crew.name} has this work order now. Its rates stay as they were; owner or accounts can change them.` };
  } catch (e) {
    return failed('swapCrew', e);
  }
}

/** Archive (or restore) a work order. Removing it outright is only for one with nothing paid. */
export async function archiveOrder(woId: string, archived: boolean): Promise<CrewResult> {
  const r = await orderFor(woId, 'workorder.build');
  const rm = r.ok ? r : await orderFor(woId, 'workorder.money');
  if (!rm.ok) return rm;
  try {
    await prisma.$transaction(async (tx) => {
      await tx.homeWorkOrder.updateMany({ where: { id: rm.wo.id, studioId: rm.member.studioId }, data: { archivedAt: archived ? new Date() : null } });
      await recordEvent(tx, { projectId: rm.wo.projectId, type: 'crew.order_changed', actor: actorOf(rm.member), refId: rm.wo.id, payload: { change: archived ? 'archived' : 'restored' } });
    });
    return { ok: true, message: archived ? 'Archived. Its lines can go on another work order; its payments stay on the record.' : 'Restored.' };
  } catch (e) {
    return failed('archiveOrder', e);
  }
}

export async function removeOrder(woId: string): Promise<CrewResult> {
  const r = await orderFor(woId, 'workorder.build');
  if (!r.ok) return r;
  const ok = canRemoveOrder(r.wo.payments.length);
  if (!ok.ok) return ok;
  try {
    await prisma.$transaction(async (tx) => {
      await tx.homeWorkOrder.deleteMany({ where: { id: r.wo.id, studioId: r.member.studioId } });
      await recordEvent(tx, { projectId: r.wo.projectId, type: 'crew.order_changed', actor: actorOf(r.member), refId: r.wo.id, payload: { change: 'removed' } });
    });
    return { ok: true, message: 'Removed. Its lines are back in the list to order.' };
  } catch (e) {
    return failed('removeOrder', e);
  }
}

// ── Payments ──────────────────────────────────────────────────

const MODES = ['UPI', 'BANK', 'CASH', 'CHEQUE'] as const;

/**
 * Record money paid to a crew: any amount up to the balance (+₹1), or an
 * advance up to the studio's limit ahead of the bill. By name, on a day, by a
 * mode, with a reference and a note. Owner and accounts only.
 */
export async function recordCrewPayment(woId: string, input: { amountRupees: unknown; kind?: unknown; mode: unknown; reference?: unknown; note?: unknown; paidOn?: unknown }, now = new Date()): Promise<CrewResult> {
  const r = await orderFor(woId, 'crew.pay');
  if (!r.ok) return r;
  if (r.wo.archivedAt) return { ok: false, error: 'This work order is archived. Restore it to pay against it.' };
  const amount = parseRupeesPaise(input.amountRupees);
  if (amount === null) return { ok: false, error: 'How much? An amount in rupees.' };
  const kind: PayKind = input.kind === 'ADVANCE' ? 'ADVANCE' : 'PAYMENT';
  const mode = MODES.includes(input.mode as (typeof MODES)[number]) ? (input.mode as (typeof MODES)[number]) : null;
  if (!mode) return { ok: false, error: 'How was it paid: UPI, bank, cash or cheque?' };
  const today = istDay(now);
  const paidOn = isDay(input.paidOn) ? (input.paidOn as string) : today;
  if (paidOn > today) return { ok: false, error: 'A payment cannot be dated after today.' };
  const settings = await settingsOf(r.member.studioId);
  const name = (await prisma.user.findUnique({ where: { id: r.member.userId }, select: { name: true, phone: true } })) ?? null;
  const byName = name?.name?.trim() || name?.phone || 'Studio team';
  try {
    const out = await prisma.$transaction(
      async (tx) => {
        // Lock the work order, then re-read it: two people paying at once cannot both pass the balance check.
        await tx.$executeRaw`SELECT 1 FROM "home_work_orders" WHERE "id" = ${r.wo.id} FOR UPDATE`;
        const fresh = await tx.homeWorkOrder.findUnique({ where: { id: r.wo.id }, select: { lines: { select: LINE_MONEY }, payments: { select: { amountPaise: true, kind: true } } } });
        if (!fresh) throw new Refused(GONE);
        const m = workOrderMoney(fresh.lines.map(lineMoneyLite), fresh.payments.map((x) => ({ amountPaise: fromDb(x.amountPaise), kind: x.kind })));
        const ok = canPayCrew(m, amount, kind, settings.advanceLimitPaise);
        if (!ok.ok) throw new Refused(ok.error);
        const p = await tx.homeCrewPayment.create({
          data: { studioId: r.member.studioId, workOrderId: r.wo.id, kind, amountPaise: toDb(amount), mode, reference: orNull(text(input.reference, 80)), note: orNull(text(input.note, 200)), paidOn: dayToDb(paidOn), byId: r.member.id, byName },
          select: { id: true },
        });
        await recordEvent(tx, { projectId: r.wo.projectId, type: 'crew.paid', actor: actorOf(r.member), refId: p.id, payload: { workOrderId: r.wo.id, kind } });
        return m.balancePaise - amount;
      },
      { timeout: 30_000 },
    );
    return { ok: true, message: out > 100 ? 'Payment recorded. The balance is worked out again.' : out < -100 ? 'Advance recorded. It is recovered from the work as it is priced.' : 'Payment recorded. Nothing is outstanding now: mark it settled when the work is done.' };
  } catch (e) {
    if (e instanceof Refused) return { ok: false, error: e.message };
    return failed('recordCrewPayment', e);
  }
}

class Refused extends Error {}

/** Reverse a payment recorded by mistake: a new row, the old one kept. Then record the right one. Owner and accounts. */
export async function correctCrewPayment(paymentId: string, input: { note?: unknown }, now = new Date()): Promise<CrewResult> {
  const member = await currentMember();
  if (!member) return { ok: false, error: SIGN_IN };
  const p = await prisma.homeCrewPayment.findFirst({ where: { id: paymentId, studioId: member.studioId }, select: { id: true, kind: true, amountPaise: true, mode: true, workOrderId: true } });
  if (!p) return { ok: false, error: GONE };
  const r = await orderFor(p.workOrderId, 'crew.pay');
  if (!r.ok) return r;
  const already = await prisma.homeCrewPayment.findUnique({ where: { correctsId: p.id }, select: { id: true } });
  const ok = canCorrect({ kind: p.kind, amountPaise: fromDb(p.amountPaise) }, already !== null);
  if (!ok.ok) return ok;
  const user = await prisma.user.findUnique({ where: { id: member.userId }, select: { name: true, phone: true } });
  try {
    await prisma.$transaction(async (tx) => {
      const c = await tx.homeCrewPayment.create({
        data: {
          studioId: member.studioId,
          workOrderId: p.workOrderId,
          kind: 'CORRECTION',
          amountPaise: -p.amountPaise,
          mode: p.mode,
          note: orNull(text(input.note, 200)) ?? 'Reversed: recorded by mistake',
          paidOn: dayToDb(istDay(now)),
          byId: member.id,
          byName: user?.name?.trim() || user?.phone || 'Studio team',
          correctsId: p.id,
        },
        select: { id: true },
      });
      await recordEvent(tx, { projectId: r.wo.projectId, type: 'crew.corrected', actor: actorOf(member), refId: c.id, payload: { workOrderId: p.workOrderId } });
      if (r.wo.status === 'SETTLED') await tx.homeWorkOrder.update({ where: { id: p.workOrderId }, data: { status: 'WORK_DONE', settledAt: null } });
    });
    return { ok: true, message: 'Reversed. The old payment stays on the record with its correction; record the right one now.' };
  } catch (e) {
    if (isUnique(e)) return { ok: false, error: 'That payment is corrected already.' };
    return failed('correctCrewPayment', e);
  }
}
