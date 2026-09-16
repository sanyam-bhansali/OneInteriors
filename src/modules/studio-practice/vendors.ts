import 'server-only';

/**
 * Vendors, work orders and what has been paid.
 *
 * The money is all in `ledger.ts`, which is pure and tested. This is Postgres,
 * ownership and the writes.
 *
 * Every query is scoped by the studio id from the session. A vendor's rates are
 * a studio's cost base — the single most commercially sensitive thing in this
 * database after the product master — and nothing in this file takes a studio
 * id as an argument.
 */

import { prisma } from '@/lib/prisma';
import { fromDb, toDb, type Paise } from '@/lib/money';
import { myStudioId } from '@/modules/studio-quote/store';
import { workOrderMoney, byVendor, canPay, type VendorPosition } from './ledger';
import type { QuoteUnitName } from '@/modules/studio-quote/pricing';

export { MODE_LABELS, COMMON_TRADES } from './vocabulary';
export type { PaymentModeName } from './vocabulary';

import type { PaymentModeName } from './vocabulary';

export interface VendorRow {
  id: string;
  name: string;
  trade: string;
  phone: string | null;
  isActive: boolean;
  billPaise: Paise;
  paidPaise: Paise;
  balancePaise: Paise;
  openOrders: number;
}

export interface WorkOrderRow {
  id: string;
  projectId: string;
  projectName: string;
  vendorId: string;
  vendorName: string;
  trade: string;
  issuedOn: Date;
  dueOn: Date | null;
  billPaise: Paise;
  paidPaise: Paise;
  balancePaise: Paise;
  settled: boolean;
  overpaidPaise: Paise;
  lines: {
    id: string;
    description: string;
    unit: QuoteUnitName;
    qtyMilli: number | null;
    ratePaise: Paise;
    amountPaise: Paise;
  }[];
  payments: {
    id: string;
    paidOn: Date;
    amountPaise: Paise;
    mode: PaymentModeName;
    reference: string | null;
  }[];
}

/** Every vendor, with their position. Most owed first — this list is read to
 *  decide who gets paid today. */
export async function myVendors(): Promise<VendorRow[]> {
  const studioId = await myStudioId();
  if (!studioId) return [];

  try {
    const [vendors, orders] = await Promise.all([
      prisma.studioVendor.findMany({ where: { studioId }, orderBy: { name: 'asc' } }),
      prisma.studioWorkOrder.findMany({
        where: { studioId },
        include: {
          vendor: { select: { id: true, name: true, trade: true } },
          lines: true,
          payments: { select: { amountPaise: true } },
        },
      }),
    ]);

    const positions = new Map<string, VendorPosition>(
      byVendor(
        orders.map((o) => ({
          vendorId: o.vendor.id,
          vendorName: o.vendor.name,
          trade: o.vendor.trade,
          lines: o.lines.map((l) => ({
            unit: l.unit as QuoteUnitName,
            qtyMilli: l.qtyMilli,
            ratePaise: fromDb(l.ratePaise),
            amountPaise: fromDb(l.amountPaise),
          })),
          payments: o.payments.map((p) => ({ amountPaise: fromDb(p.amountPaise) })),
        })),
      ).map((p) => [p.vendorId, p]),
    );

    return vendors
      .map((v) => {
        const position = positions.get(v.id);
        return {
          id: v.id,
          name: v.name,
          trade: v.trade,
          phone: v.phone,
          isActive: v.isActive,
          billPaise: position?.billPaise ?? 0,
          paidPaise: position?.paidPaise ?? 0,
          balancePaise: position?.balancePaise ?? 0,
          openOrders: position?.openOrders ?? 0,
        };
      })
      .sort((a, b) => b.balancePaise - a.balancePaise || a.name.localeCompare(b.name));
  } catch (error) {
    console.error('[studio-practice] myVendors failed', error);
    return [];
  }
}

export async function myWorkOrders(): Promise<WorkOrderRow[]> {
  const studioId = await myStudioId();
  if (!studioId) return [];

  try {
    const rows = await prisma.studioWorkOrder.findMany({
      where: { studioId },
      orderBy: { issuedOn: 'desc' },
      include: {
        vendor: { select: { id: true, name: true } },
        project: { select: { id: true, name: true } },
        lines: { orderBy: { sortOrder: 'asc' } },
        payments: { orderBy: { paidOn: 'desc' } },
      },
      take: 200,
    });

    return rows.map((row) => {
      const lines = row.lines.map((l) => ({
        id: l.id,
        description: l.description,
        unit: l.unit as QuoteUnitName,
        qtyMilli: l.qtyMilli,
        ratePaise: fromDb(l.ratePaise),
        amountPaise: fromDb(l.amountPaise),
      }));
      const payments = row.payments.map((p) => ({
        id: p.id,
        paidOn: p.paidOn,
        amountPaise: fromDb(p.amountPaise),
        mode: p.mode as PaymentModeName,
        reference: p.reference,
      }));

      const money = workOrderMoney(lines, payments);

      return {
        id: row.id,
        projectId: row.project.id,
        projectName: row.project.name,
        vendorId: row.vendor.id,
        vendorName: row.vendor.name,
        trade: row.trade,
        issuedOn: row.issuedOn,
        dueOn: row.dueOn,
        ...money,
        lines,
        payments,
      };
    });
  } catch (error) {
    console.error('[studio-practice] myWorkOrders failed', error);
    return [];
  }
}

export type Result = { ok: true } | { ok: false; error: string };

export async function addVendor(input: {
  name: string;
  trade: string;
  phone?: string;
}): Promise<Result> {
  const studioId = await myStudioId();
  if (!studioId) return { ok: false, error: 'No studio on this account.' };

  const name = input.name.trim();
  const trade = input.trade.trim();
  if (name.length < 2) return { ok: false, error: 'Give them a name.' };
  if (trade.length < 2) return { ok: false, error: 'What do they do?' };

  try {
    await prisma.studioVendor.create({
      data: { studioId, name, trade, phone: input.phone?.trim() || null },
    });
    return { ok: true };
  } catch (error) {
    if (error instanceof Error && error.message.includes('Unique constraint')) {
      return { ok: false, error: 'You already have a vendor with that name.' };
    }
    console.error('[studio-practice] addVendor failed', error);
    return { ok: false, error: 'That did not save.' };
  }
}

export async function addWorkOrder(input: {
  projectId: string;
  vendorId: string;
  dueOn?: string;
}): Promise<Result> {
  const studioId = await myStudioId();
  if (!studioId) return { ok: false, error: 'No studio on this account.' };

  // Both have to be theirs. Ids arriving from a form prove nothing.
  const [project, vendor] = await Promise.all([
    prisma.studioProject.findFirst({ where: { id: input.projectId, studioId }, select: { id: true } }),
    prisma.studioVendor.findFirst({ where: { id: input.vendorId, studioId }, select: { id: true, trade: true } }),
  ]);

  if (!project) return { ok: false, error: 'That project is not yours.' };
  if (!vendor) return { ok: false, error: 'That vendor is not yours.' };

  try {
    await prisma.studioWorkOrder.create({
      data: {
        studioId,
        projectId: project.id,
        vendorId: vendor.id,
        trade: vendor.trade,
        dueOn: input.dueOn ? new Date(input.dueOn) : null,
      },
    });
    return { ok: true };
  } catch (error) {
    console.error('[studio-practice] addWorkOrder failed', error);
    return { ok: false, error: 'That did not save.' };
  }
}

export async function addWorkOrderLine(input: {
  workOrderId: string;
  description: string;
  unit: QuoteUnitName;
  qty: number;
  ratePaise: Paise;
}): Promise<Result> {
  const studioId = await myStudioId();
  if (!studioId) return { ok: false, error: 'No studio on this account.' };

  const order = await prisma.studioWorkOrder.findFirst({
    where: { id: input.workOrderId, studioId },
    select: { id: true },
  });
  if (!order) return { ok: false, error: 'That work order is not yours.' };

  const description = input.description.trim();
  if (description.length < 2) return { ok: false, error: 'What is the work?' };
  if (!Number.isFinite(input.qty) || input.qty <= 0) {
    return { ok: false, error: 'A quantity, please.' };
  }

  const qtyMilli = Math.round(input.qty * 1000);
  // Computed once, here, and stored as the line's amount — a snapshot of the
  // vendor's rate as it was when the order was raised.
  const amountPaise = Math.round((input.ratePaise * qtyMilli) / 1000);

  try {
    const last = await prisma.studioWorkOrderLine.findFirst({
      where: { workOrderId: order.id },
      orderBy: { sortOrder: 'desc' },
      select: { sortOrder: true },
    });

    await prisma.studioWorkOrderLine.create({
      data: {
        workOrderId: order.id,
        description,
        unit: input.unit,
        qtyMilli,
        ratePaise: toDb(input.ratePaise),
        amountPaise: toDb(amountPaise),
        sortOrder: (last?.sortOrder ?? 0) + 10,
      },
    });
    return { ok: true };
  } catch (error) {
    console.error('[studio-practice] addWorkOrderLine failed', error);
    return { ok: false, error: 'That did not save.' };
  }
}

/**
 * Record money going out.
 *
 * Refused if it would take the order past its bill — `canPay` says by how much.
 * Accepting it and showing a negative balance means the mistake is found at
 * reconciliation rather than at the keyboard, and by then somebody has been
 * paid twice.
 */
export async function recordPayment(input: {
  workOrderId: string;
  amountPaise: Paise;
  mode: PaymentModeName;
  reference?: string;
  paidOn?: string;
}): Promise<Result> {
  const studioId = await myStudioId();
  if (!studioId) return { ok: false, error: 'No studio on this account.' };

  const order = await prisma.studioWorkOrder.findFirst({
    where: { id: input.workOrderId, studioId },
    include: { lines: true, payments: { select: { amountPaise: true } } },
  });
  if (!order) return { ok: false, error: 'That work order is not yours.' };

  const money = workOrderMoney(
    order.lines.map((l) => ({
      unit: l.unit as QuoteUnitName,
      qtyMilli: l.qtyMilli,
      ratePaise: fromDb(l.ratePaise),
      amountPaise: fromDb(l.amountPaise),
    })),
    order.payments.map((p) => ({ amountPaise: fromDb(p.amountPaise) })),
  );

  const allowed = canPay(money, input.amountPaise);
  if (!allowed.ok) return allowed;

  try {
    await prisma.studioVendorPayment.create({
      data: {
        workOrderId: order.id,
        amountPaise: toDb(input.amountPaise),
        mode: input.mode,
        reference: input.reference?.trim() || null,
        paidOn: input.paidOn ? new Date(input.paidOn) : new Date(),
      },
    });
    return { ok: true };
  } catch (error) {
    console.error('[studio-practice] recordPayment failed', error);
    return { ok: false, error: 'That did not save.' };
  }
}

/** What the studio owes in total, for the dashboard. */
export async function totalOwed(): Promise<Paise> {
  const vendors = await myVendors();
  return vendors.reduce((sum, v) => sum + Math.max(0, v.balancePaise), 0);
}
