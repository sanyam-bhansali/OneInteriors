import 'server-only';

/**
 * Studio OS Phase 3 reads: crews, a project's work orders, Pay these, Price
 * these, the payments ledger, labour against the contract, statements, and
 * what Today shows. Every read starts from the signed-in member and their
 * role (studio/roles.ts): crews and money for owner and accounts; a
 * project's work orders for its PM and supervisor through `memberOnProject`,
 * with every money field stripped on the server for anyone without
 * `workorder.money` (rules.ts `stripMoney`). Nothing here takes a studio id
 * from the caller.
 */

import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { fromDb } from '@/lib/money';
import { currentMember, memberOnProject, type StudioMemberRef } from '@/modules/studio/access';
import { can, projectsVisibleTo, type StudioAction } from '@/modules/studio/roles';
import { firstName, homeLabel } from '@/modules/studio/workspace-view';
import { addDays, dayFromDb, istDay } from '@/modules/project/working-days';
import { signedKycLinks } from '@/modules/storage/crew-kyc';
import { GATE_SELECT, gateStagesOf } from '@/modules/studio-design/store';
import { readSignedStages } from '@/modules/portal/payments';
import { kycSummary, maskedAadhaar, maskedAccount, panHolderType, type CrewKindName } from './kyc';
import { hasBalance, labourSummary, linePending, overQuote, lineAmount, workOrderMoney, type LabourSummary, type MoneyLine, type WorkOrderMoney } from './money';
import { defaultCarpentry, quoteSqftMilli, type CarpentryModeName } from './pricing';
import { planFromFinal, viewFor, type LineView, type PaymentView, type SourceLine, type WorkOrderStatusName, type WorkOrderView } from './rules';
import { readCrewSettings, type CrewSettings } from './settings';
import { CARPENTRY, tradeLabel, type CrewUnitName, type Trade } from './trades';
import { execGate } from './exec-gates';
import { templateOrDefault } from '@/modules/studio-sales/payment-template';

// ── Who is asking ─────────────────────────────────────────────

export async function memberWith(action: StudioAction): Promise<StudioMemberRef | null> {
  const m = await currentMember();
  return m && can(m, action) ? m : null;
}

export async function settingsOf(studioId: string): Promise<CrewSettings> {
  const s = await prisma.studio.findUnique({ where: { id: studioId }, select: { crewSettings: true } }).catch(() => null);
  return readCrewSettings(s?.crewSettings ?? null);
}

// ── Shared selects and mapping ────────────────────────────────

const BRIEF_SELECT = { society: true, locality: true, propertyType: true, contactName: true, user: { select: { name: true } } } as const;
const PROJECT_LABEL = { id: true, introduction: { select: { brief: { select: BRIEF_SELECT } } } } as const;

type BriefRow = { society: string | null; locality: string | null; propertyType: string | null; contactName: string | null; user: { name: string | null } | null };

export const projectName = (b: BriefRow): string => `${firstName(b.contactName ?? b.user?.name)} · ${homeLabel(b)}`;

export const WO_SELECT = {
  id: true,
  number: true,
  projectId: true,
  vendorId: true,
  trades: true,
  status: true,
  dueOn: true,
  archivedAt: true,
  sourceKind: true,
  stepIds: true,
  workDoneAt: true,
  workDoneByName: true,
  createdByName: true,
  vendor: { select: { name: true, phone: true } },
  project: { select: PROJECT_LABEL },
  lines: { orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }] },
  payments: { orderBy: [{ paidOn: 'asc' }, { createdAt: 'asc' }] },
} satisfies Prisma.HomeWorkOrderSelect;

export type WoRow = Prisma.HomeWorkOrderGetPayload<{ select: typeof WO_SELECT }>;
type LineRow = WoRow['lines'][number];

const n = (v: bigint | null): number | null => (v === null ? null : fromDb(v));

export function moneyLine(l: LineRow): MoneyLine {
  return {
    ratePaise: n(l.ratePaise),
    qtyMilli: l.qtyMilli,
    measuredQtyMilli: l.measuredQtyMilli,
    agreedPaise: n(l.agreedPaise),
    isExtra: l.isExtra,
    quotedAmountPaise: n(l.quotedAmountPaise),
    removed: l.removedAt !== null,
  };
}

export const moneyOf = (r: Pick<WoRow, 'lines' | 'payments'>): WorkOrderMoney =>
  workOrderMoney(
    r.lines.map(moneyLine),
    r.payments.map((p) => ({ amountPaise: fromDb(p.amountPaise), kind: p.kind })),
  );

/** The full view of a work order (money included); `viewFor` strips it for a PM. */
export function toView(r: WoRow, trades: readonly Trade[], steps: ReadonlyMap<string, { label: string; done: boolean }>): WorkOrderView {
  const m = moneyOf(r);
  const live = r.lines.filter((l) => l.removedAt === null);
  const corrected = new Set(r.payments.map((p) => p.correctsId).filter((x): x is string => x !== null));
  const lines: LineView[] = live.map((l) => {
    const ml = moneyLine(l);
    return {
      id: l.id,
      room: l.room,
      product: l.product,
      code: l.code,
      widthMm: l.widthMm,
      heightMm: l.heightMm,
      trade: l.trade,
      tradeLabel: tradeLabel(trades, l.trade),
      guessed: l.guessed,
      item: l.item,
      unit: l.unit,
      carpentry: l.carpentry,
      qtyMilli: l.qtyMilli,
      measuredQtyMilli: l.measuredQtyMilli,
      qtySource: l.qtySource,
      isExtra: l.isExtra,
      pending: linePending(ml),
      overQuote: overQuote(ml),
      ratePaise: ml.ratePaise,
      rateEdited: l.rateEdited,
      agreedPaise: ml.agreedPaise,
      amountPaise: lineAmount(ml),
      quotedAmountPaise: ml.quotedAmountPaise,
    };
  });
  const payments: PaymentView[] = r.payments.map((p) => ({
    id: p.id,
    kind: p.kind,
    amountPaise: fromDb(p.amountPaise),
    mode: p.mode,
    reference: p.reference,
    note: p.note,
    paidOn: dayFromDb(p.paidOn),
    byName: p.byName,
    correctsId: p.correctsId,
    corrected: corrected.has(p.id),
  }));
  return {
    id: r.id,
    number: r.number,
    projectId: r.projectId,
    projectName: projectName(r.project.introduction.brief),
    vendorId: r.vendorId,
    crewName: r.vendor.name,
    crewPhone: r.vendor.phone,
    trades: r.trades.map((k) => ({ key: k, label: tradeLabel(trades, k) })),
    status: r.status,
    dueOn: r.dueOn ? dayFromDb(r.dueOn) : null,
    archived: r.archivedAt !== null,
    sourceKind: r.sourceKind,
    stepIds: r.stepIds,
    steps: r.stepIds.map((id) => ({ id, ...(steps.get(id) ?? { label: 'A step no longer on the plan', done: false }) })),
    workDoneAt: r.workDoneAt?.toISOString() ?? null,
    workDoneByName: r.workDoneByName,
    createdByName: r.createdByName,
    lines,
    needPrice: m.needPrice,
    needQty: m.needQty,
    extras: live.filter((l) => l.isExtra).length,
    overQuoteLines: lines.filter((l) => l.overQuote).length,
    paymentCount: r.payments.length,
    money: {
      billPaise: m.billPaise,
      asQuotedPaise: m.asQuotedPaise,
      extrasPaise: m.extrasPaise,
      variancePaise: m.variancePaise,
      clientValuePaise: m.clientValuePaise,
      paidPaise: m.paidPaise,
      balancePaise: m.balancePaise,
      advanceOutPaise: m.advanceOutPaise,
      settled: m.settled,
    },
    payments,
  };
}

async function stepsFor(ids: readonly string[]): Promise<Map<string, { label: string; done: boolean }>> {
  if (ids.length === 0) return new Map();
  const rows = await prisma.homeChecklistItem.findMany({ where: { id: { in: [...new Set(ids)] } }, select: { id: true, label: true, doneAt: true } });
  return new Map(rows.map((r) => [r.id, { label: r.label, done: r.doneAt !== null }]));
}

// ── Crews ─────────────────────────────────────────────────────

export interface CrewRow {
  id: string;
  name: string;
  kind: CrewKindName;
  trades: { key: string; label: string }[];
  phone: string | null;
  workingSince: string | null;
  archived: boolean;
  kyc: { label: string; tone: 'good' | 'alert' | 'neutral' };
  rateItems: number;
  orders: number;
  openOrders: number;
  billPaise: number;
  balancePaise: number;
}

const crewTrades = (v: { trade: string; trades: string[] }): string[] => [...new Set([v.trade, ...v.trades].filter(Boolean))];

/** Every crew, with their position across live projects. Owner and accounts (`crew.edit`). */
export async function crewsList(): Promise<{ crews: CrewRow[]; settings: CrewSettings } | null> {
  const m = await memberWith('crew.edit');
  if (!m) return null;
  const [settings, crews, orders] = await Promise.all([
    settingsOf(m.studioId),
    prisma.studioVendor.findMany({ where: { studioId: m.studioId }, orderBy: { name: 'asc' }, include: { _count: { select: { rates: true } } } }),
    prisma.homeWorkOrder.findMany({
      where: { studioId: m.studioId, archivedAt: null, project: { cancelledAt: null } },
      select: { vendorId: true, status: true, lines: { select: LINE_MONEY }, payments: { select: { amountPaise: true, kind: true } } },
    }),
  ]);
  const by = new Map<string, { orders: number; open: number; bill: number; balance: number }>();
  for (const o of orders) {
    const mm = workOrderMoney(o.lines.map(lineMoneyLite), o.payments.map((p) => ({ amountPaise: fromDb(p.amountPaise), kind: p.kind })));
    const cur = by.get(o.vendorId) ?? { orders: 0, open: 0, bill: 0, balance: 0 };
    cur.orders += 1;
    if (o.status !== 'SETTLED') cur.open += 1;
    cur.bill += mm.billPaise;
    cur.balance += mm.balancePaise;
    by.set(o.vendorId, cur);
  }
  return {
    settings,
    crews: crews.map((c) => {
      const pos = by.get(c.id);
      return {
        id: c.id,
        name: c.name,
        kind: c.kind,
        trades: crewTrades(c).map((k) => ({ key: k, label: tradeLabel(settings.trades, k) })),
        phone: c.phone,
        workingSince: c.workingSince,
        archived: c.archivedAt !== null || !c.isActive,
        kyc: kycSummary(c),
        rateItems: c._count.rates,
        orders: pos?.orders ?? 0,
        openOrders: pos?.open ?? 0,
        billPaise: pos?.bill ?? 0,
        balancePaise: pos?.balance ?? 0,
      };
    }),
  };
}

export const LINE_MONEY = { ratePaise: true, qtyMilli: true, measuredQtyMilli: true, agreedPaise: true, isExtra: true, quotedAmountPaise: true, removedAt: true } as const;

export function lineMoneyLite(l: { ratePaise: bigint | null; qtyMilli: number | null; measuredQtyMilli: number | null; agreedPaise: bigint | null; isExtra: boolean; quotedAmountPaise: bigint | null; removedAt: Date | null }): MoneyLine {
  return {
    ratePaise: n(l.ratePaise),
    qtyMilli: l.qtyMilli,
    measuredQtyMilli: l.measuredQtyMilli,
    agreedPaise: n(l.agreedPaise),
    isExtra: l.isExtra,
    quotedAmountPaise: n(l.quotedAmountPaise),
    removed: l.removedAt !== null,
  };
}

export interface CrewDetail {
  id: string;
  name: string;
  kind: CrewKindName;
  trade: string;
  trades: string[];
  phone: string | null;
  altPhone: string | null;
  address: string | null;
  workingSince: string | null;
  notes: string | null;
  archived: boolean;
  panNumber: string | null;
  panHolder: string | null;
  aadhaar: string;
  hasAadhaar: boolean;
  kyc: { label: string; tone: 'good' | 'alert' | 'neutral' };
  kycCheckedAt: string | null;
  docs: { doc: 'aadhaar' | 'pan' | 'agreement'; onFile: boolean; link: string | null }[];
  upiId: string | null;
  bankAccountName: string | null;
  bankAccountNumber: string | null;
  bankAccountMasked: string | null;
  bankIfsc: string | null;
  rates: { id: string; item: string; unit: CrewUnitName; ratePaise: number | null; trade: string | null }[];
  orders: WorkOrderView[];
  payments: (PaymentView & { workOrderId: string; projectName: string })[];
  totals: { billPaise: number; paidPaise: number; balancePaise: number; open: number };
  settings: CrewSettings;
}

/** One crew: identity, payee details, rate card, work orders on live projects, payment ledger. Owner and accounts. */
export async function crewDetail(id: string): Promise<CrewDetail | null> {
  const m = await memberWith('crew.edit');
  if (!m) return null;
  const c = await prisma.studioVendor.findFirst({ where: { id, studioId: m.studioId }, include: { rates: { orderBy: [{ sortOrder: 'asc' }, { item: 'asc' }] } } });
  if (!c) return null;
  const [settings, rows] = await Promise.all([
    settingsOf(m.studioId),
    prisma.homeWorkOrder.findMany({ where: { vendorId: c.id, studioId: m.studioId, project: { cancelledAt: null } }, orderBy: { createdAt: 'desc' }, select: WO_SELECT }),
  ]);
  const steps = await stepsFor(rows.flatMap((r) => r.stepIds));
  const orders = (rows).map((r) => toView(r, settings.trades, steps));
  const live = orders.filter((o) => !o.archived);
  const paths = [c.aadhaarDocPath, c.panDocPath, c.agreementDocPath].filter((p): p is string => Boolean(p));
  const links = await signedKycLinks(paths);
  const link = (p: string | null) => (p ? (links.get(p) ?? null) : null);
  return {
    id: c.id,
    name: c.name,
    kind: c.kind,
    trade: c.trade,
    trades: crewTrades(c),
    phone: c.phone,
    altPhone: c.altPhone,
    address: c.address,
    workingSince: c.workingSince,
    notes: c.notes,
    archived: c.archivedAt !== null || !c.isActive,
    panNumber: c.panNumber,
    panHolder: c.panNumber ? panHolderType(c.panNumber) : null,
    aadhaar: maskedAadhaar(c.aadhaarLast4),
    hasAadhaar: c.aadhaarLast4 !== null,
    kyc: kycSummary(c),
    kycCheckedAt: c.kycCheckedAt ? istDay(c.kycCheckedAt) : null,
    docs: [
      { doc: 'aadhaar', onFile: Boolean(c.aadhaarDocPath), link: link(c.aadhaarDocPath) },
      { doc: 'pan', onFile: Boolean(c.panDocPath), link: link(c.panDocPath) },
      { doc: 'agreement', onFile: Boolean(c.agreementDocPath), link: link(c.agreementDocPath) },
    ],
    upiId: c.upiId,
    bankAccountName: c.bankAccountName,
    bankAccountNumber: c.bankAccountNumber,
    bankAccountMasked: maskedAccount(c.bankAccountNumber),
    bankIfsc: c.bankIfsc,
    rates: c.rates.map((r) => ({ id: r.id, item: r.item, unit: (r.crewUnit ?? legacyUnit(r.unit)) as CrewUnitName, ratePaise: r.ratePaise === null || r.ratePaise <= 0n ? null : fromDb(r.ratePaise), trade: r.trade })),
    orders,
    payments: orders
      .flatMap((o) => (o.payments ?? []).map((p) => ({ ...p, workOrderId: o.id, projectName: o.projectName })))
      .sort((a, b) => (a.paidOn < b.paidOn ? 1 : a.paidOn > b.paidOn ? -1 : 0)),
    totals: {
      billPaise: live.reduce((s, o) => s + (o.money?.billPaise ?? 0), 0),
      paidPaise: live.reduce((s, o) => s + (o.money?.paidPaise ?? 0), 0),
      balancePaise: live.reduce((s, o) => s + (o.money?.balancePaise ?? 0), 0),
      open: live.filter((o) => o.status !== 'SETTLED').length,
    },
    settings,
  };
}

/** An older rate row's quotation unit, read as a crew unit. */
export function legacyUnit(u: 'AREA' | 'SQFT' | 'RFT' | 'UNIT'): CrewUnitName {
  return u === 'RFT' ? 'RFT' : u === 'UNIT' ? 'NOS' : 'SQFT';
}

// ── A project's Crews tab ─────────────────────────────────────

export interface PlanTrade {
  trade: string;
  label: string;
  lines: { id: string; room: string; product: string; size: string | null; qty: string | null; guessed: boolean; carpentry: CarpentryModeName | null }[];
  crews: { id: string; name: string; kind: CrewKindName; hasOrder: boolean }[];
}

export interface ProjectCrews {
  projectId: string;
  name: string;
  canBuild: boolean;
  seesMoney: boolean;
  canPay: boolean;
  source: { kind: 'DESIGN_FINAL' | 'SALES_FINAL'; number: string } | null;
  plan: PlanTrade[];
  orders: WorkOrderView[];
  allCrews: { id: string; name: string; trades: string[] }[];
  steps: { id: string; label: string; stage: string; done: boolean }[];
  locks: { label: string; payment: string }[];
  labour: LabourSummary | null;
  dueDefault: string;
  trades: Trade[];
}

const sizeWords = (w: number | null, h: number | null) => (w && h ? `${w} × ${h} mm` : null);

/** The Crews tab: work orders (money stripped for a PM), and what is left to order from the final. */
export async function projectCrews(projectId: string, now = new Date()): Promise<{ ok: true; tab: ProjectCrews } | { ok: false; error: string }> {
  const check = await memberOnProject(projectId, 'workorder.read');
  if (!check.ok) return check;
  const { member, access } = check;
  const canBuild = access.may('workorder.build');
  const seesMoney = access.may('workorder.money');
  const p = await prisma.homeProject.findUnique({
    where: { id: projectId },
    select: {
      ...GATE_SELECT,
      contractPaise: true,
      designFinalQuoteId: true,
      signedQuoteId: true,
      introduction: { select: { brief: { select: BRIEF_SELECT } } },
      stages: { orderBy: { sortOrder: 'asc' }, select: { name: true, kind: true, items: { where: { inScope: true }, orderBy: { sortOrder: 'asc' }, select: { id: true, label: true, doneAt: true, gatePayment: true } } } },
    },
  });
  if (!p) return { ok: false, error: 'That project is not one of yours.' };
  const settings = await settingsOf(member.studioId);
  const rows = (await prisma.homeWorkOrder.findMany({ where: { projectId }, orderBy: { number: 'asc' }, select: WO_SELECT }));
  const execSteps = p.stages.filter((s) => s.kind !== 'DESIGN').flatMap((s) => s.items.map((i) => ({ ...i, stage: s.name })));
  const stepMap = new Map(execSteps.map((s) => [s.id, { label: s.label, done: s.doneAt !== null }]));
  const orders = rows.map((r) => viewFor(toView(r, settings.trades, stepMap), seesMoney));

  const quoteId = p.designFinalQuoteId ?? p.signedQuoteId;
  const quote = quoteId ? await prisma.studioQuote.findFirst({ where: { id: quoteId, studioId: member.studioId }, select: { number: true, lines: { orderBy: { sortOrder: 'asc' } } } }) : null;
  const source = quote ? { kind: (p.designFinalQuoteId ? 'DESIGN_FINAL' : 'SALES_FINAL') as 'DESIGN_FINAL' | 'SALES_FINAL', number: quote.number } : null;

  let plan: PlanTrade[] = [];
  let allCrews: ProjectCrews['allCrews'] = [];
  if (canBuild && quote) {
    const ordered = new Set(rows.filter((r) => r.archivedAt === null).flatMap((r) => r.lines.filter((l) => l.removedAt === null && l.quoteLineId).map((l) => l.quoteLineId!)));
    const source: SourceLine[] = quote.lines
      .filter((l) => fromDb(l.amountPaise) > 0 || (l.widthMm && l.heightMm))
      .map((l) => ({ id: l.id, room: l.room, product: l.product, code: l.code, unit: l.unit, details: l.details, widthMm: l.widthMm, heightMm: l.heightMm, qtyMilli: l.qtyMilli, amountPaise: fromDb(l.amountPaise) }));
    const grouped = planFromFinal(source, { studio: settings.routes, useHauspire: settings.useHauspire }, ordered);
    const crews = await prisma.studioVendor.findMany({ where: { studioId: member.studioId, archivedAt: null, isActive: true }, orderBy: { name: 'asc' }, select: { id: true, name: true, kind: true, trade: true, trades: true } });
    const onProject = new Set(rows.map((r) => r.vendorId));
    allCrews = crews.map((c) => ({ id: c.id, name: c.name, trades: crewTrades(c) }));
    const order = settings.trades.map((t) => t.key);
    plan = [...grouped.entries()]
      .sort((a, b) => (order.indexOf(a[0]) + 1 || 99) - (order.indexOf(b[0]) + 1 || 99))
      .map(([trade, lines]) => ({
        trade,
        label: tradeLabel(settings.trades, trade),
        lines: lines.map((l) => {
          const sq = quoteSqftMilli({ product: l.product, code: l.code, unit: l.unit, widthMm: l.widthMm, heightMm: l.heightMm, qtyMilli: l.qtyMilli });
          return {
            id: l.id,
            room: l.room,
            product: l.product,
            size: sizeWords(l.widthMm, l.heightMm),
            qty: sq !== null ? `${(sq / 1000).toFixed(2)} sq ft` : l.qtyMilli ? `${(l.qtyMilli / 1000).toFixed(2).replace(/\.00$/, '')} ${l.unit === 'RFT' ? 'rft' : l.unit === 'UNIT' ? 'no.' : 'sq ft'}` : null,
            guessed: l.guessed,
            carpentry: trade === CARPENTRY ? defaultCarpentry(l.code) : null,
          };
        }),
        crews: crews.filter((c) => crewTrades(c).includes(trade)).map((c) => ({ id: c.id, name: c.name, kind: c.kind, hasOrder: onProject.has(c.id) })),
      }));
  } else if (canBuild) {
    const crews = await prisma.studioVendor.findMany({ where: { studioId: member.studioId, archivedAt: null, isActive: true }, orderBy: { name: 'asc' }, select: { id: true, name: true, trade: true, trades: true } });
    allCrews = crews.map((c) => ({ id: c.id, name: c.name, trades: crewTrades(c) }));
  }

  // The client's execution payment locks, so the PM knows why a step will not tick.
  const stages = gateStagesOf(p);
  const payments = readSignedStages(p.paymentPhases) ?? [];
  const locks = execSteps
    .filter((s) => s.doneAt === null)
    .map((s) => ({ label: s.label, gate: execGate({ label: s.label, gatePayment: s.gatePayment }, settings.execGates, payments, stages) }))
    .filter((x): x is { label: string; gate: { open: false; payment: string } } => !x.gate.open)
    .map((x) => ({ label: x.label, payment: x.gate.payment }));

  const labour = can(member, 'vendor.rates')
    ? labourSummary(p.contractPaise === null ? null : fromDb(p.contractPaise), rows.filter((r) => r.archivedAt === null).map(moneyOf), settings.labourTargetPct)
    : null;

  return {
    ok: true,
    tab: {
      projectId,
      name: projectName(p.introduction.brief),
      canBuild,
      seesMoney,
      canPay: access.may('crew.pay'),
      source,
      plan,
      orders,
      allCrews,
      steps: execSteps.map((s) => ({ id: s.id, label: s.label, stage: s.stage, done: s.doneAt !== null })),
      locks,
      labour,
      dueDefault: addDays(istDay(now), settings.dueDays),
      trades: settings.trades,
    },
  };
}

/** One work order, for accounts' and the owner's page (/studio/vendors/orders/<id>). */
export async function workOrderPage(id: string): Promise<{ order: WorkOrderView; canPay: boolean; canBuild: boolean; seesMoney: boolean; advanceLimitPaise: number; payee: Payee | null } | null> {
  const m = await currentMember();
  if (!m) return null;
  const row = (await prisma.homeWorkOrder.findFirst({ where: { id, studioId: m.studioId }, select: WO_SELECT }));
  if (!row) return null;
  const check = await memberOnProject(row.projectId, 'workorder.read');
  if (!check.ok) return null;
  const settings = await settingsOf(m.studioId);
  const steps = await stepsFor(row.stepIds);
  const seesMoney = check.access.may('workorder.money');
  const canPay = check.access.may('crew.pay');
  return {
    order: viewFor(toView(row, settings.trades, steps), seesMoney),
    canPay,
    canBuild: check.access.may('workorder.build'),
    seesMoney,
    advanceLimitPaise: settings.advanceLimitPaise,
    payee: canPay ? await payeeOf(row.vendorId, m.studioId) : null,
  };
}

export interface Payee {
  upiId: string | null;
  bankAccountName: string | null;
  bankAccountMasked: string | null;
  bankIfsc: string | null;
}

export async function payeeOf(vendorId: string, studioId: string): Promise<Payee | null> {
  const v = await prisma.studioVendor.findFirst({ where: { id: vendorId, studioId }, select: { upiId: true, bankAccountName: true, bankAccountNumber: true, bankIfsc: true } });
  return v ? { upiId: v.upiId, bankAccountName: v.bankAccountName, bankAccountMasked: maskedAccount(v.bankAccountNumber), bankIfsc: v.bankIfsc } : null;
}

// ── Overviews (owner and accounts) ────────────────────────────

export interface PayRow {
  id: string;
  number: number;
  crewName: string;
  vendorId: string;
  trades: string;
  projectName: string;
  projectId: string;
  status: WorkOrderStatusName;
  dueOn: string | null;
  overdue: boolean;
  billPaise: number;
  paidPaise: number;
  balancePaise: number;
  variancePaise: number;
  pendingLines: number;
}

/** Pay these: every live work order with more than ₹1 outstanding, largest balance first; and the three figures. */
export async function payThese(now = new Date()): Promise<{ rows: PayRow[]; outstandingPaise: number; extrasPaise: number; extrasOrders: number; needPrice: number; needQty: number; advanceLimitPaise: number } | null> {
  const m = await memberWith('workorder.money');
  if (!m) return null;
  const settings = await settingsOf(m.studioId);
  const rows = await prisma.homeWorkOrder.findMany({
    where: { studioId: m.studioId, archivedAt: null, project: { cancelledAt: null } },
    select: {
      id: true,
      number: true,
      vendorId: true,
      projectId: true,
      trades: true,
      status: true,
      dueOn: true,
      vendor: { select: { name: true } },
      project: { select: PROJECT_LABEL },
      lines: { select: LINE_MONEY },
      payments: { select: { amountPaise: true, kind: true } },
    },
  });
  const today = istDay(now);
  let extrasPaise = 0;
  let extrasOrders = 0;
  let needPrice = 0;
  let needQty = 0;
  const out: PayRow[] = [];
  for (const r of rows) {
    const mm = workOrderMoney(r.lines.map(lineMoneyLite), r.payments.map((p) => ({ amountPaise: fromDb(p.amountPaise), kind: p.kind })));
    extrasPaise += mm.extrasPaise;
    if (mm.extrasPaise > 100) extrasOrders += 1;
    needPrice += mm.needPrice;
    needQty += mm.needQty;
    if (!hasBalance(mm)) continue;
    const due = r.dueOn ? dayFromDb(r.dueOn) : null;
    out.push({
      id: r.id,
      number: r.number,
      crewName: r.vendor.name,
      vendorId: r.vendorId,
      trades: r.trades.map((k) => tradeLabel(settings.trades, k)).join(', '),
      projectName: projectName(r.project.introduction.brief),
      projectId: r.projectId,
      status: r.status,
      dueOn: due,
      overdue: due !== null && due < today,
      billPaise: mm.billPaise,
      paidPaise: mm.paidPaise,
      balancePaise: mm.balancePaise,
      variancePaise: mm.variancePaise,
      pendingLines: mm.pendingLines,
    });
  }
  out.sort((a, b) => b.balancePaise - a.balancePaise);
  return { rows: out, outstandingPaise: out.reduce((s, r) => s + r.balancePaise, 0), extrasPaise, extrasOrders, needPrice, needQty, advanceLimitPaise: settings.advanceLimitPaise };
}

export interface PriceRow {
  lineId: string;
  workOrderId: string;
  projectName: string;
  projectId: string;
  crewName: string;
  room: string;
  product: string;
  tradeLabel: string;
  item: string;
  unit: CrewUnitName;
  ratePaise: number | null;
  qtyMilli: number | null;
  quotedAmountPaise: number | null;
  size: string | null;
  isExtra: boolean;
  pending: 'price' | 'qty';
}

/** Price these: every line on a live work order that needs a price or a quantity. Owner and accounts. */
export async function priceThese(): Promise<{ price: PriceRow[]; qty: PriceRow[] } | null> {
  const m = await memberWith('workorder.money');
  if (!m) return null;
  const settings = await settingsOf(m.studioId);
  const lines = await prisma.homeWorkOrderLine.findMany({
    where: { removedAt: null, agreedPaise: null, workOrder: { studioId: m.studioId, archivedAt: null, project: { cancelledAt: null } }, OR: [{ ratePaise: null }, { ratePaise: { lte: 0 } }, { qtyMilli: null, measuredQtyMilli: null }] },
    orderBy: [{ workOrder: { createdAt: 'asc' } }, { sortOrder: 'asc' }],
    take: 500,
    select: {
      ...LINE_MONEY,
      id: true,
      room: true,
      product: true,
      trade: true,
      item: true,
      unit: true,
      widthMm: true,
      heightMm: true,
      workOrder: { select: { id: true, projectId: true, vendor: { select: { name: true } }, project: { select: PROJECT_LABEL } } },
    },
  });
  const rows: PriceRow[] = [];
  for (const l of lines) {
    const pending = linePending(lineMoneyLite(l));
    if (!pending) continue;
    rows.push({
      lineId: l.id,
      workOrderId: l.workOrder.id,
      projectName: projectName(l.workOrder.project.introduction.brief),
      projectId: l.workOrder.projectId,
      crewName: l.workOrder.vendor.name,
      room: l.room,
      product: l.product,
      tradeLabel: tradeLabel(settings.trades, l.trade),
      item: l.item,
      unit: l.unit,
      ratePaise: n(l.ratePaise),
      qtyMilli: l.qtyMilli,
      quotedAmountPaise: n(l.quotedAmountPaise),
      size: sizeWords(l.widthMm, l.heightMm),
      isExtra: l.isExtra,
      pending,
    });
  }
  return { price: rows.filter((r) => r.pending === 'price'), qty: rows.filter((r) => r.pending === 'qty') };
}

export interface LedgerRow {
  id: string;
  paidOn: string;
  crewName: string;
  vendorId: string;
  projectName: string;
  workOrderId: string;
  kind: 'PAYMENT' | 'ADVANCE' | 'CORRECTION';
  mode: string;
  reference: string | null;
  note: string | null;
  amountPaise: number;
  byName: string;
}

/** Every rupee paid to a crew, newest first (the latest 400), with the total by mode. Owner and accounts. */
export async function crewPaymentsLedger(): Promise<{ rows: LedgerRow[]; totalPaise: number; byMode: { mode: string; amountPaise: number }[] } | null> {
  const m = await memberWith('workorder.money');
  if (!m) return null;
  const rows = await prisma.homeCrewPayment.findMany({
    where: { studioId: m.studioId },
    orderBy: [{ paidOn: 'desc' }, { createdAt: 'desc' }],
    take: 400,
    select: {
      id: true,
      paidOn: true,
      kind: true,
      mode: true,
      reference: true,
      note: true,
      amountPaise: true,
      byName: true,
      workOrder: { select: { id: true, vendorId: true, vendor: { select: { name: true } }, project: { select: PROJECT_LABEL } } },
    },
  });
  const out: LedgerRow[] = rows.map((r) => ({
    id: r.id,
    paidOn: dayFromDb(r.paidOn),
    crewName: r.workOrder.vendor.name,
    vendorId: r.workOrder.vendorId,
    projectName: projectName(r.workOrder.project.introduction.brief),
    workOrderId: r.workOrder.id,
    kind: r.kind,
    mode: r.mode,
    reference: r.reference,
    note: r.note,
    amountPaise: fromDb(r.amountPaise),
    byName: r.byName,
  }));
  const modes = new Map<string, number>();
  for (const r of out) modes.set(r.mode, (modes.get(r.mode) ?? 0) + r.amountPaise);
  return { rows: out, totalPaise: out.reduce((s, r) => s + r.amountPaise, 0), byMode: [...modes.entries()].map(([mode, amountPaise]) => ({ mode, amountPaise })) };
}

export interface LabourRow extends LabourSummary {
  projectId: string;
  projectName: string;
  orders: number;
}

/** Labour against the contract, every live project with work orders. The owner's (`vendor.rates`). */
export async function labourOverview(): Promise<{ rows: LabourRow[]; targetPct: number } | null> {
  const m = await memberWith('vendor.rates');
  if (!m) return null;
  const settings = await settingsOf(m.studioId);
  const projects = await prisma.homeProject.findMany({
    where: { introduction: { studioId: m.studioId }, cancelledAt: null, workOrders: { some: { archivedAt: null } } },
    select: {
      ...PROJECT_LABEL,
      contractPaise: true,
      workOrders: { where: { archivedAt: null }, select: { lines: { select: LINE_MONEY }, payments: { select: { amountPaise: true, kind: true } } } },
    },
    take: 300,
  });
  const rows: LabourRow[] = projects.map((p) => ({
    projectId: p.id,
    projectName: projectName(p.introduction.brief),
    orders: p.workOrders.length,
    ...labourSummary(
      p.contractPaise === null ? null : fromDb(p.contractPaise),
      p.workOrders.map((o) => workOrderMoney(o.lines.map(lineMoneyLite), o.payments.map((x) => ({ amountPaise: fromDb(x.amountPaise), kind: x.kind })))),
      settings.labourTargetPct,
    ),
  }));
  rows.sort((a, b) => (a.marginBp ?? 99_999) - (b.marginBp ?? 99_999));
  return { rows, targetPct: settings.labourTargetPct };
}

export interface Statement {
  order: WorkOrderView;
  studio: { name: string; address: string | null };
  crew: { name: string; phone: string | null; address: string | null; pan: string | null; aadhaar: string; kind: CrewKindName };
  generatedOn: string;
  reference: string;
}

/** A work order's statement of account (lines by room, billed, extras, paid, balance). Owner and accounts. */
export async function statementOf(id: string, now = new Date()): Promise<Statement | null> {
  const m = await memberWith('workorder.money');
  if (!m) return null;
  const row = (await prisma.homeWorkOrder.findFirst({ where: { id, studioId: m.studioId }, select: WO_SELECT }));
  if (!row) return null;
  const [settings, crew, studio] = await Promise.all([
    settingsOf(m.studioId),
    prisma.studioVendor.findUnique({ where: { id: row.vendorId }, select: { name: true, phone: true, address: true, panNumber: true, aadhaarLast4: true, kind: true } }),
    prisma.studio.findUnique({ where: { id: m.studioId }, select: { tradeName: true, addressLine: true } }),
  ]);
  if (!crew || !studio) return null;
  const steps = await stepsFor(row.stepIds);
  return {
    order: toView(row, settings.trades, steps),
    studio: { name: studio.tradeName, address: studio.addressLine },
    crew: { name: crew.name, phone: crew.phone, address: crew.address, pan: crew.panNumber, aadhaar: maskedAadhaar(crew.aadhaarLast4), kind: crew.kind },
    generatedOn: istDay(now),
    reference: `WO-${row.number}-${row.id.slice(-6).toUpperCase()}`,
  };
}

// ── Today, and site mode ──────────────────────────────────────

export interface CrewToday {
  /** PM and owner: lines with no quantity yet, and work orders whose linked steps are all done but not marked work done. */
  toMeasure: { projectId: string; projectName: string; lines: number }[];
  toMarkDone: { projectId: string; projectName: string; crewName: string; number: number }[];
  /** Owner and accounts: work done and not paid, or due within a week. */
  toPay: { id: string; crewName: string; projectName: string; balancePaise: number; dueOn: string | null; workDone: boolean }[];
}

/** What Today shows about crews, for the signed-in member's role. Null when nothing applies to them. */
export async function crewToday(now = new Date()): Promise<CrewToday | null> {
  const m = await currentMember();
  if (!m) return null;
  const build = can(m, 'workorder.build', { assigned: true });
  const money = can(m, 'workorder.money');
  if (!build && !money) return null;
  const visible = projectsVisibleTo(m);
  const rows = await prisma.homeWorkOrder.findMany({
    where: { studioId: m.studioId, archivedAt: null, status: { not: 'SETTLED' }, project: { cancelledAt: null, ...(money ? {} : visible) } },
    select: {
      id: true,
      number: true,
      projectId: true,
      status: true,
      dueOn: true,
      stepIds: true,
      vendor: { select: { name: true } },
      project: { select: PROJECT_LABEL },
      lines: { select: LINE_MONEY },
      payments: { select: { amountPaise: true, kind: true } },
    },
    take: 500,
  });
  const steps = await stepsFor(rows.flatMap((r) => r.stepIds));
  const today = istDay(now);
  const soon = addDays(today, 7);
  const measure = new Map<string, { projectId: string; projectName: string; lines: number }>();
  const out: CrewToday = { toMeasure: [], toMarkDone: [], toPay: [] };
  for (const r of rows) {
    const name = projectName(r.project.introduction.brief);
    const mm = workOrderMoney(r.lines.map(lineMoneyLite), r.payments.map((p) => ({ amountPaise: fromDb(p.amountPaise), kind: p.kind })));
    if (build && r.status !== 'DRAFT' && mm.needQty > 0) {
      const cur = measure.get(r.projectId) ?? { projectId: r.projectId, projectName: name, lines: 0 };
      cur.lines += mm.needQty;
      measure.set(r.projectId, cur);
    }
    if (build && (r.status === 'IN_PROGRESS' || r.status === 'ISSUED') && r.stepIds.length > 0 && r.stepIds.every((id) => steps.get(id)?.done)) {
      out.toMarkDone.push({ projectId: r.projectId, projectName: name, crewName: r.vendor.name, number: r.number });
    }
    const due = r.dueOn ? dayFromDb(r.dueOn) : null;
    if (money && hasBalance(mm) && (r.status === 'WORK_DONE' || (due !== null && due <= soon))) {
      out.toPay.push({ id: r.id, crewName: r.vendor.name, projectName: name, balancePaise: mm.balancePaise, dueOn: due, workDone: r.status === 'WORK_DONE' });
    }
  }
  out.toMeasure = [...measure.values()];
  out.toPay.sort((a, b) => b.balancePaise - a.balancePaise);
  return out;
}

/** Site mode: which crew is on which of this member's jobs. Names and trades only, never money. */
export async function crewsOnMySites(): Promise<{ projectId: string; projectName: string; crews: { name: string; trades: string; status: WorkOrderStatusName }[] }[]> {
  const m = await currentMember();
  if (!m || !can(m, 'workorder.read', { assigned: true })) return [];
  const settings = await settingsOf(m.studioId);
  const rows = await prisma.homeWorkOrder.findMany({
    where: { studioId: m.studioId, archivedAt: null, status: { in: ['ISSUED', 'IN_PROGRESS'] }, project: { cancelledAt: null, ...projectsVisibleTo(m) } },
    orderBy: { number: 'asc' },
    select: { projectId: true, trades: true, status: true, vendor: { select: { name: true } }, project: { select: PROJECT_LABEL } },
    take: 200,
  });
  const by = new Map<string, { projectId: string; projectName: string; crews: { name: string; trades: string; status: WorkOrderStatusName }[] }>();
  for (const r of rows) {
    const cur = by.get(r.projectId) ?? { projectId: r.projectId, projectName: projectName(r.project.introduction.brief), crews: [] };
    cur.crews.push({ name: r.vendor.name, trades: r.trades.map((k) => tradeLabel(settings.trades, k)).join(', '), status: r.status });
    by.set(r.projectId, cur);
  }
  return [...by.values()];
}

/** Settings → Crews and trades: the settings and which trades are in use. Owner. */
export async function crewSettingsPage(): Promise<{ settings: CrewSettings; inUse: string[]; paymentLabels: string[] } | null> {
  const m = await memberWith('crew.settings');
  if (!m) return null;
  const [settings, inUse, studio] = await Promise.all([settingsOf(m.studioId), tradesInUse(m.studioId), prisma.studio.findUnique({ where: { id: m.studioId }, select: { paymentTemplate: true } })]);
  return { settings, inUse, paymentLabels: templateOrDefault(studio?.paymentTemplate ?? null).map((s) => s.label) };
}

export async function tradesInUse(studioId: string): Promise<string[]> {
  const [crews, orders] = await Promise.all([
    prisma.studioVendor.findMany({ where: { studioId }, select: { trade: true, trades: true } }),
    prisma.homeWorkOrder.findMany({ where: { studioId }, select: { trades: true } }),
  ]);
  return [...new Set([...crews.flatMap((c) => [c.trade, ...c.trades]), ...orders.flatMap((o) => o.trades)])];
}
