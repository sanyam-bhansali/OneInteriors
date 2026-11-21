/**
 * An invoice per payment stage, and the studio's details on it and on the
 * statement (owner, 21 Nov 2026: one TAX INVOICE per payment stage, approved
 * from the sample pages; no "GST included" wording on either document).
 * Pure; tested in tests/invoice-rules.test.ts. The reads are in invoice.ts.
 *
 * - The number: `${prefix}/${yy}-${yy+1}/${seq}` (HPL/26-27/0001), counting
 *   up within the studio and the Indian financial year (April to March) of
 *   the day it was first opened, in India's time.
 * - GST on a stage is its share of the project's GST (project-gst.ts
 *   `gstSplit`); the taxable value is that share ÷ 18%, split in half as
 *   CGST 9% and SGST 9% (IGST is not needed now: every site is in the
 *   studio's own state).
 * - Amount in words in the Indian system: crore, lakh, thousand.
 */

export const DEFAULT_SAC = '998391';
export const PREFIX_MAX = 10;
export const INVOICE_GST_RATE_BPS = 1800;

// ── The prefix and the number ─────────────────────────────────

/** "Hauspire Private Limited" → "HPL": the initials of the legal name's words, capitals, at most six. "INV" when there are none. */
export function prefixFromLegalName(name: string | null | undefined): string {
  const words = String(name ?? '')
    .replace(/[^A-Za-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
  const initials = words.map((w) => w[0]!.toUpperCase()).join('').slice(0, 6);
  return initials || 'INV';
}

/** The prefix the owner typed: letters, digits and hyphens, at most ten; empty means the default. */
export function checkPrefix(raw: unknown): { ok: true; prefix: string | null } | { ok: false; error: string } {
  const v = typeof raw === 'string' ? raw.trim().toUpperCase() : '';
  if (!v) return { ok: true, prefix: null };
  if (v.length > PREFIX_MAX || !/^[A-Z0-9][A-Z0-9-]*$/.test(v)) return { ok: false, error: `The invoice prefix is letters and digits only (a hyphen is fine), at most ${PREFIX_MAX}. For example HPL.` };
  return { ok: true, prefix: v };
}

/** The SAC code: 4 to 8 digits; empty means 998391. */
export function checkSac(raw: unknown): { ok: true; sac: string | null } | { ok: false; error: string } {
  const v = typeof raw === 'string' ? raw.replace(/\s+/g, '') : '';
  if (!v) return { ok: true, sac: null };
  if (!/^\d{4,8}$/.test(v)) return { ok: false, error: 'The SAC code is 4 to 8 digits, like 998391.' };
  return { ok: true, sac: v };
}

/** An IFSC: four letters, a zero, six letters or digits. Empty is fine (bank details are optional). */
export function checkIfsc(raw: unknown): { ok: true; ifsc: string | null } | { ok: false; error: string } {
  const v = typeof raw === 'string' ? raw.replace(/\s+/g, '').toUpperCase() : '';
  if (!v) return { ok: true, ifsc: null };
  if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(v)) return { ok: false, error: 'That IFSC does not look right. It is 11 characters, like HDFC0001234.' };
  return { ok: true, ifsc: v };
}

/** A bank account number: 6 to 20 digits. Empty is fine. */
export function checkAccountNumber(raw: unknown): { ok: true; number: string | null } | { ok: false; error: string } {
  const v = typeof raw === 'string' ? raw.replace(/[\s-]+/g, '') : '';
  if (!v) return { ok: true, number: null };
  if (!/^\d{6,20}$/.test(v)) return { ok: false, error: 'The account number is digits only, 6 to 20 of them.' };
  return { ok: true, number: v };
}

/** The Indian financial year of an instant, by India's calendar: April 2026 to March 2027 is 2026. */
export function indianFyStart(at: Date): number {
  const ist = new Date(at.getTime() + 330 * 60_000);
  const y = ist.getUTCFullYear();
  return ist.getUTCMonth() >= 3 ? y : y - 1;
}

/** 2026 → "26-27". */
export function fyLabel(fyStart: number): string {
  const yy = (n: number) => String(((n % 100) + 100) % 100).padStart(2, '0');
  return `${yy(fyStart)}-${yy(fyStart + 1)}`;
}

/** "HPL/26-27/0001". */
export function invoiceNumber(prefix: string, fyStart: number, seq: number): string {
  return `${prefix}/${fyLabel(fyStart)}/${String(seq).padStart(4, '0')}`;
}

// ── GST on one stage ──────────────────────────────────────────

export interface StageGst {
  /** The stage's share of the project's GST. */
  gstPaise: number;
  /** That share ÷ 18%, to the paisa. */
  taxablePaise: number;
  cgstPaise: number;
  sgstPaise: number;
}

/** CGST and SGST are each half of the stage's share (the odd paisa on SGST); the taxable value is the share ÷ 18%. */
export function stageGst(sharePaise: number): StageGst {
  const gst = Math.max(0, Math.round(sharePaise));
  const cgst = Math.floor(gst / 2);
  return { gstPaise: gst, taxablePaise: Math.round((gst * 10_000) / INVOICE_GST_RATE_BPS), cgstPaise: cgst, sgstPaise: gst - cgst };
}

// ── Amount in words ───────────────────────────────────────────

const ONES = ['Zero', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

function belowHundred(n: number): string {
  if (n < 20) return ONES[n]!;
  const t = TENS[Math.floor(n / 10)]!;
  return n % 10 ? `${t}-${ONES[n % 10]}` : t;
}

function belowThousand(n: number): string {
  const h = Math.floor(n / 100);
  const r = n % 100;
  return [h ? `${ONES[h]} Hundred` : '', r ? belowHundred(r) : ''].filter(Boolean).join(' ');
}

/** A whole number in the Indian system: 11577644 → "One Crore Fifteen Lakh Seventy-Seven Thousand Six Hundred Forty-Four". */
export function indianWords(n: number): string {
  const whole = Math.floor(Math.abs(n));
  if (whole === 0) return 'Zero';
  const crore = Math.floor(whole / 10_000_000);
  const lakh = Math.floor((whole % 10_000_000) / 100_000);
  const thousand = Math.floor((whole % 100_000) / 1000);
  const rest = whole % 1000;
  return [crore ? `${indianWords(crore)} Crore` : '', lakh ? `${belowHundred(lakh)} Lakh` : '', thousand ? `${belowHundred(thousand)} Thousand` : '', rest ? belowThousand(rest) : '']
    .filter(Boolean)
    .join(' ');
}

/** "Rupees One Lakh Fifteen Thousand Five Hundred Eighty-Two Only"; with paise, "… and Fifty Paise Only". */
export function amountInWords(paise: number): string {
  const abs = Math.abs(Math.round(paise));
  const rupees = Math.floor(abs / 100);
  const p = abs % 100;
  return `Rupees ${indianWords(rupees)}${p ? ` and ${belowHundred(p)} Paise` : ''} Only`;
}

// ── The studio's state, from its GSTIN ────────────────────────

const GST_STATES: Record<string, string> = {
  '01': 'Jammu and Kashmir',
  '02': 'Himachal Pradesh',
  '03': 'Punjab',
  '04': 'Chandigarh',
  '05': 'Uttarakhand',
  '06': 'Haryana',
  '07': 'Delhi',
  '08': 'Rajasthan',
  '09': 'Uttar Pradesh',
  '10': 'Bihar',
  '11': 'Sikkim',
  '12': 'Arunachal Pradesh',
  '13': 'Nagaland',
  '14': 'Manipur',
  '15': 'Mizoram',
  '16': 'Tripura',
  '17': 'Meghalaya',
  '18': 'Assam',
  '19': 'West Bengal',
  '20': 'Jharkhand',
  '21': 'Odisha',
  '22': 'Chhattisgarh',
  '23': 'Madhya Pradesh',
  '24': 'Gujarat',
  '26': 'Dadra and Nagar Haveli and Daman and Diu',
  '27': 'Maharashtra',
  '29': 'Karnataka',
  '30': 'Goa',
  '31': 'Lakshadweep',
  '32': 'Kerala',
  '33': 'Tamil Nadu',
  '34': 'Puducherry',
  '35': 'Andaman and Nicobar Islands',
  '36': 'Telangana',
  '37': 'Andhra Pradesh',
  '38': 'Ladakh',
};

/** "Maharashtra (27)" from the GSTIN's first two digits; Maharashtra when there is no GSTIN (every studio is in Pune today). */
export function stateOf(gstin: string | null | undefined): string {
  const code = String(gstin ?? '').trim().slice(0, 2);
  const name = GST_STATES[code];
  return name ? `${name} (${code})` : 'Maharashtra (27)';
}

// ── What a stage's invoice says ───────────────────────────────

/** "Design Closure" from "Design Closure (10%)" or "Booking Advance (Fully refundable within 3 days)". */
export const bareLabel = (label: string): string => label.replace(/\s*\([^)]*\)\s*$/, '').trim();

/** The stage's end deliverable: the first schedule stage with the same name (any case, brackets ignored), with the PDF's ** marks taken off. */
export function deliverableFor(label: string, schedules: readonly (readonly { label: string; note: string }[] | null | undefined)[]): string | null {
  const want = bareLabel(label).toLowerCase();
  for (const s of schedules) {
    const hit = s?.find((x) => bareLabel(x.label).toLowerCase() === want && x.note.trim());
    if (hit) return hit.note.replace(/\*\*/g, '').trim();
  }
  return null;
}

export interface InvoiceStageInput {
  index: number;
  label: string;
  pct: number | null;
  signedPaise: number;
  changesPaise: number;
  /** Owed now: signed plus changes. */
  amountPaise: number;
  paidPaise: number;
}

export interface InvoiceFigures {
  /** TAX INVOICE when the stage carries GST, else INVOICE. */
  title: 'TAX INVOICE' | 'INVOICE';
  /** "Design Closure (10%)". */
  stageLabel: string;
  /** The stage before its GST. */
  basePaise: number;
  /** Decisions and extra work that landed on this stage. */
  changesPaise: number;
  gst: StageGst | null;
  totalPaise: number;
  paidPaise: number;
  balancePaise: number;
}

/** One stage's invoice figures, from its ledger stage and its share of the project's GST. */
export function invoiceFigures(stage: InvoiceStageInput, gstSharePaise: number): InvoiceFigures {
  const gst = gstSharePaise > 0 ? stageGst(gstSharePaise) : null;
  const pct = stage.pct !== null && stage.pct > 0 ? ` (${Number.isInteger(stage.pct) ? stage.pct : stage.pct.toFixed(2).replace(/0$/, '')}%)` : '';
  const shortLabel = bareLabel(stage.label) || stage.label;
  return {
    title: gst ? 'TAX INVOICE' : 'INVOICE',
    stageLabel: pct ? `${shortLabel}${pct}` : stage.label,
    basePaise: stage.signedPaise - (gst?.gstPaise ?? 0),
    changesPaise: stage.changesPaise,
    gst,
    totalPaise: stage.amountPaise,
    paidPaise: stage.paidPaise,
    balancePaise: Math.max(0, stage.amountPaise - stage.paidPaise),
  };
}

/** "₹1,15,582 · 18 Nov 2026 · UPI" pieces: the last counted payment's day and how it came (several ways: none named). */
export function receivedOn(rows: readonly { receivedOn: string; mode: string | null }[]): { day: string | null; mode: string | null } {
  if (rows.length === 0) return { day: null, mode: null };
  const sorted = [...rows].sort((a, b) => a.receivedOn.localeCompare(b.receivedOn));
  const modes = new Set(rows.map((r) => r.mode).filter(Boolean));
  return { day: sorted[sorted.length - 1]!.receivedOn, mode: modes.size === 1 ? [...modes][0]! : null };
}
