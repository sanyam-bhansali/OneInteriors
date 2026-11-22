/**
 * The electrical bill (owner, 22 Nov 2026): "like our quotation builder but
 * very easy". The designer picks items from the electrical rate list (unit,
 * description and rate set by the owner or the design head), sets the
 * quantity and a note; nothing is priced in the browser. Sent to the client,
 * who approves it in the app; then its total is spread over the payment
 * stages not yet paid, by their percentages ("Spread over unpaid stages"),
 * and joins the project value. Pure; tested in tests/electrical-bill.test.ts.
 */

import { splitAcross } from '@/lib/money';

export const ELECTRICAL = 'ELECTRICAL';
export const ELECTRICAL_TITLE = 'Electrical bill';
export const LINES_MAX = 150;
export const NOTE_MAX = 200;
/** Quantities are in thousandths, as on every quote line. */
export const QTY_SCALE = 1000;
export const UNIT_WORDS = ['point', 'board', 'rft', 'metre', 'nos', 'set', 'box', 'coil', 'lot'] as const;

export interface ElectricalItem {
  id: string;
  name: string;
  unit: string;
  details: string | null;
  ratePaise: number;
}

export interface ElectricalLine {
  itemId: string;
  product: string;
  unitLabel: string;
  details: string | null;
  note: string | null;
  qtyMilli: number;
  ratePaise: number;
  amountPaise: number;
}

/** "2.5" → 2500 (thousandths); null when not a positive quantity under 100 000. */
export function parseQty(raw: unknown): number | null {
  const s = typeof raw === 'number' ? String(raw) : typeof raw === 'string' ? raw.trim() : '';
  if (!/^\d+(\.\d{1,3})?$/.test(s)) return null;
  const q = Math.round(Number(s) * QTY_SCALE);
  return q > 0 && q <= 100_000 * QTY_SCALE ? q : null;
}

/** A line's amount: rate × quantity, in whole rupees (as quote lines are). */
export const electricalAmount = (ratePaise: number, qtyMilli: number): number => Math.round((ratePaise * qtyMilli) / QTY_SCALE / 100) * 100;

/** The bill's lines, priced from the rate list. Every line needs an item from the list and a quantity. */
export function checkElectricalLines(raw: unknown, items: ReadonlyMap<string, ElectricalItem>): { ok: true; lines: ElectricalLine[] } | { ok: false; error: string } {
  if (!Array.isArray(raw) || raw.length === 0) return { ok: false, error: 'Add at least one item from the electrical rate list.' };
  if (raw.length > LINES_MAX) return { ok: false, error: `Up to ${LINES_MAX} lines on one electrical bill.` };
  const lines: ElectricalLine[] = [];
  for (const [i, r] of raw.entries()) {
    const o = r && typeof r === 'object' ? (r as Record<string, unknown>) : {};
    const item = typeof o.itemId === 'string' ? items.get(o.itemId) : undefined;
    if (!item) return { ok: false, error: `Line ${i + 1}: pick an item from the electrical rate list.` };
    const qtyMilli = parseQty(o.qty);
    if (qtyMilli === null) return { ok: false, error: `Line ${i + 1} (${item.name}): write how many ${item.unit}s, like 12.` };
    const note = typeof o.note === 'string' ? o.note.replace(/\s+/g, ' ').trim().slice(0, NOTE_MAX) || null : null;
    lines.push({ itemId: item.id, product: item.name, unitLabel: item.unit, details: item.details, note, qtyMilli, ratePaise: item.ratePaise, amountPaise: electricalAmount(item.ratePaise, qtyMilli) });
  }
  return { ok: true, lines };
}

/**
 * The discount on an electrical bill (owner, 22 Nov 2026: Hauspire's bills
 * take 15% off; "default 15, option to remove or change"): 15% unless the
 * designer changes it, 0 to 50%.
 */
export const DEFAULT_DISCOUNT_BPS = 1500;
export const MAX_DISCOUNT_BPS = 5000;
export function parseDiscount(raw: unknown): number | null {
  if (raw === undefined || raw === null || raw === '') return DEFAULT_DISCOUNT_BPS;
  const s = typeof raw === 'number' ? String(raw) : typeof raw === 'string' ? raw.replace('%', '').trim() : '';
  if (!/^\d+(\.\d{1,2})?$/.test(s)) return null;
  const bps = Math.round(Number(s) * 100);
  return bps <= MAX_DISCOUNT_BPS ? bps : null;
}

/** Work, the discount (whole rupees), GST on what is left (the project's rate), and the total. */
export function electricalTotals(
  lines: readonly Pick<ElectricalLine, 'amountPaise'>[],
  gstBps: number,
  discountBps = 0,
): { workPaise: number; discountPaise: number; gstPaise: number; totalPaise: number } {
  const workPaise = lines.reduce((a, l) => a + l.amountPaise, 0);
  const discountPaise = Math.round((workPaise * Math.max(0, discountBps)) / 10_000 / 100) * 100;
  const gstPaise = Math.round(((workPaise - discountPaise) * Math.max(0, gstBps)) / 10_000);
  return { workPaise, discountPaise, gstPaise, totalPaise: workPaise - discountPaise + gstPaise };
}

/**
 * Where an approved bill's total lands: over the stages not yet paid, by their
 * percentages (a stage with no percentage, the booking, takes none). With no
 * unpaid percentage stage left, it all lands on the last stage. Whole rupees
 * when the total is whole rupees; the parts add up exactly.
 */
export function spreadOverUnpaid(totalPaise: number, stages: readonly { pct: number | null }[], paidStageIndexes: ReadonlySet<number>): { stageIndex: number; deltaPaise: number }[] {
  if (totalPaise <= 0 || stages.length === 0) return [];
  const open = stages.map((s, i) => ({ i, pct: s.pct ?? 0 })).filter((s) => s.pct > 0 && !paidStageIndexes.has(s.i));
  if (open.length === 0) return [{ stageIndex: stages.length - 1, deltaPaise: totalPaise }];
  const parts =
    totalPaise % 100 === 0
      ? splitAcross(totalPaise / 100, open.map((s) => s.pct)).map((r) => r * 100)
      : splitAcross(totalPaise, open.map((s) => s.pct));
  return open.map((s, k) => ({ stageIndex: s.i, deltaPaise: parts[k]! })).filter((x) => x.deltaPaise !== 0);
}

/**
 * When an electrical bill can be made, changed and sent (owner, 22 Nov 2026: "they can change electrical bill
 * whenever needed after the project is created"): in every phase, design included — not only after sign-off
 * like extra work. Only a closed-out project, whose final payment is fixed, refuses it.
 */
export function electricalOpen(closedOut: boolean): { ok: true } | { ok: false; error: string } {
  return closedOut ? { ok: false, error: 'This project is closed out: its final payment is fixed, so the electrical bill cannot change.' } : { ok: true };
}

/** "12 points", "2.5 metres". */
export function qtyWords(qtyMilli: number, unit: string): string {
  const q = (qtyMilli / QTY_SCALE).toFixed(3).replace(/\.?0+$/, '');
  return `${q} ${unit}${q === '1' || /s$/.test(unit) || ['nos', 'rft', 'sqft', 'kg'].includes(unit) ? '' : 's'}`;
}
