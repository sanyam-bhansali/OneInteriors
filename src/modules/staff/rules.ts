/**
 * Employee records (owner, 21 Nov 2026): "employee meta data which includes
 * 50 mb of documents which includes aadhar card, offer letter, pan card,
 * residential address proof, photo then salary, incentives, payout of
 * incentives, devices provided". Pure; tested in tests/staff-records.test.ts.
 *
 * Owner and accounts only: Aadhaar and PAN copies, salary and incentives are
 * nobody else's business. Files go to the private crew-kyc bucket (signed
 * links that last ten minutes), up to 3.8 MB each (the upload limit) and
 * 50 MB a person in all.
 */

export const STAFF_DOC_KINDS = {
  AADHAAR: 'Aadhaar card',
  PAN: 'PAN card',
  OFFER_LETTER: 'Offer letter',
  ADDRESS_PROOF: 'Residential address proof',
  PHOTO: 'Photo',
  OTHER: 'Other',
} as const;
export type StaffDocKind = keyof typeof STAFF_DOC_KINDS;
export const isStaffDocKind = (v: unknown): v is StaffDocKind => typeof v === 'string' && v in STAFF_DOC_KINDS;
/** The documents every employee should have on file. */
export const REQUIRED_DOCS: readonly StaffDocKind[] = ['AADHAAR', 'PAN', 'OFFER_LETTER', 'ADDRESS_PROOF', 'PHOTO'];

/** 50 MB of documents a person (owner). */
export const STAFF_DOCS_LIMIT_BYTES = 50 * 1024 * 1024;
/** One file, inside the 4 MB server-action limit (next.config.ts). */
export const STAFF_FILE_MAX_BYTES = Math.floor(3.8 * 1024 * 1024);
export const STAFF_FILE_TYPES: ReadonlyMap<string, string> = new Map([
  ['image/jpeg', 'jpg'],
  ['image/png', 'png'],
  ['image/webp', 'webp'],
  ['application/pdf', 'pdf'],
]);
export const STAFF_FILE_ACCEPT = 'image/jpeg,image/png,image/webp,application/pdf';

export const DEVICE_KINDS = ['Laptop', 'Phone', 'Tablet', 'SIM card', 'Measuring tool', 'Vehicle', 'Other'] as const;

/** Why this file cannot be taken, given what the person already has on file; null when it can. */
export function staffFileError(f: { type: string; size: number }, usedBytes: number): string | null {
  if (!STAFF_FILE_TYPES.has(f.type)) return 'A document can be a JPG, PNG, WebP or PDF.';
  if (f.size === 0) return 'That file is empty.';
  if (f.size > STAFF_FILE_MAX_BYTES) return 'One file can be up to 3.8 MB. Scan or photograph it at a smaller size.';
  if (usedBytes + f.size > STAFF_DOCS_LIMIT_BYTES) return `That would pass 50 MB for this person (${mb(usedBytes)} used). Remove an old file first.`;
  return null;
}

export const mb = (bytes: number): string => `${(bytes / 1024 / 1024).toFixed(1)} MB`;

/** Where a document is kept in the private bucket. */
export function staffDocPath(studioId: string, memberId: string, kind: StaffDocKind, uuid: string, ext: string): string {
  return `studio_${studioId}/staff_${memberId}/${kind.toLowerCase()}-${uuid}.${ext}`;
}

/** A file's name as shown: its own, trimmed, else the kind. */
export function cleanFileName(name: unknown, kind: StaffDocKind): string {
  const n = typeof name === 'string' ? name.replace(/[\r\n\t]/g, ' ').trim().slice(0, 120) : '';
  return n || STAFF_DOC_KINDS[kind];
}

/** The salary in force on a day: the latest that started on or before it. */
export function salaryOn<T extends { fromDay: string; monthlyPaise: number }>(rows: readonly T[], day: string): T | null {
  return [...rows].filter((r) => r.fromDay <= day).sort((a, b) => b.fromDay.localeCompare(a.fromDay))[0] ?? null;
}

/** YYYY-MM, or null. */
export function parseMonth(raw: unknown): string | null {
  return typeof raw === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(raw) ? raw : null;
}

/** Incentives earned and paid out, and what is still owed. */
export function incentiveTotals(rows: readonly { amountPaise: number; paid: boolean }[]) {
  const earned = rows.reduce((a, r) => a + r.amountPaise, 0);
  const paid = rows.filter((r) => r.paid).reduce((a, r) => a + r.amountPaise, 0);
  return { earned, paid, owed: earned - paid };
}

/** An amount typed in rupees ("35,000" or "35000.50") → paise; null when not a positive amount under ₹1 crore. */
export function parseRupees(raw: unknown): number | null {
  const s = typeof raw === 'string' ? raw.replace(/[₹,\s]/g, '') : typeof raw === 'number' ? String(raw) : '';
  if (!/^\d+(\.\d{1,2})?$/.test(s)) return null;
  const paise = Math.round(Number(s) * 100);
  return paise > 0 && paise <= 1_00_00_000 * 100 ? paise : null;
}

export const cleanText =(raw: unknown, max: number): string => (typeof raw === 'string' ? raw.replace(/\s+/g, ' ').trim().slice(0, max) : '');
