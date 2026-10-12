/**
 * A crew's identity (Studio OS Phase 3, docs/studio-os/PHASE-3-EXECUTION.md):
 * what is required, what is checked, what is kept. Ported from Hauspire's
 * Vendor Ledger (docs/studio-os/HAUSPIRE-VENDOR-APP.md §3.8). Pure, tested in
 * tests/studio-crews-kyc.test.ts.
 *
 * The rule in one line: a PERMANENT crew needs a phone, a PAN and an Aadhaar;
 * a TEMPORARY crew needs a name and a trade. An agreement is never required.
 *
 * ## Aadhaar: the last four digits, and nothing else
 *
 * The twelve digits are accepted at the form, checked (Verhoeff, the
 * algorithm UIDAI uses), and then dropped: only `aadhaarLast4` leaves this
 * module for storage, so the full number never reaches the database or a log.
 * Holding full numbers is a liability under the Aadhaar Act that buys a
 * studio nothing.
 */

export type CrewKindName = 'TEMPORARY' | 'PERMANENT';

// ── PAN ───────────────────────────────────────────────────────

const PAN = /^[A-Z]{5}[0-9]{4}[A-Z]$/;

/** The fourth character is the holder type; a transposed character usually lands outside this set. */
const PAN_HOLDER: Record<string, string> = {
  P: 'Individual',
  C: 'Company',
  H: 'HUF',
  F: 'Firm',
  A: 'Association',
  T: 'Trust',
  B: 'Body of individuals',
  L: 'Local authority',
  J: 'Artificial juridical person',
  G: 'Government',
};

export function normalisePan(input: string): string {
  return input.trim().toUpperCase().replace(/\s+/g, '');
}

/** What is wrong with a PAN, or null when it is sound (or empty). */
export function panError(input: string): string | null {
  const pan = normalisePan(input);
  if (!pan) return null;
  if (pan.length !== 10) return 'A PAN is exactly 10 characters.';
  if (!PAN.test(pan)) return 'That is not a PAN: five letters, four digits, one letter.';
  if (!PAN_HOLDER[pan[3]!]) return `'${pan[3]}' is not a holder type. Check the fourth character.`;
  return null;
}

/** "Individual", "Firm"…, shown beside the field so a mistyped PAN stands out. */
export const panHolderType = (pan: string): string | null => PAN_HOLDER[normalisePan(pan)[3] ?? ''] ?? null;

// ── Aadhaar ───────────────────────────────────────────────────

const D = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  [1, 2, 3, 4, 0, 6, 7, 8, 9, 5],
  [2, 3, 4, 0, 1, 7, 8, 9, 5, 6],
  [3, 4, 0, 1, 2, 8, 9, 5, 6, 7],
  [4, 0, 1, 2, 3, 9, 5, 6, 7, 8],
  [5, 9, 8, 7, 6, 0, 4, 3, 2, 1],
  [6, 5, 9, 8, 7, 1, 0, 4, 3, 2],
  [7, 6, 5, 9, 8, 2, 1, 0, 4, 3],
  [8, 7, 6, 5, 9, 3, 2, 1, 0, 4],
  [9, 8, 7, 6, 5, 4, 3, 2, 1, 0],
] as const;
const P = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  [1, 5, 7, 6, 2, 8, 3, 0, 9, 4],
  [5, 8, 0, 3, 7, 9, 6, 1, 4, 2],
  [8, 9, 1, 6, 0, 4, 3, 5, 2, 7],
  [9, 4, 5, 3, 1, 2, 6, 8, 7, 0],
  [4, 2, 8, 6, 5, 7, 3, 9, 0, 1],
  [2, 7, 9, 3, 8, 0, 6, 4, 1, 5],
  [7, 0, 4, 6, 9, 1, 3, 2, 5, 8],
] as const;

/** Verhoeff: catches every single-digit slip and every swap of neighbours. */
export function verhoeffValid(digits: string): boolean {
  if (!/^\d+$/.test(digits)) return false;
  let c = 0;
  const rev = digits.split('').reverse();
  for (let i = 0; i < rev.length; i++) c = D[c]![P[i % 8]![Number(rev[i])]!]!;
  return c === 0;
}

export const digitsOnly = (input: string): string => input.replace(/\D/g, '');

/** What is wrong with an Aadhaar number, or null when it is sound (or empty). */
export function aadhaarError(input: string): string | null {
  const d = digitsOnly(input);
  if (!d) return null;
  if (d.length !== 12) return 'An Aadhaar number is 12 digits.';
  if (d[0] === '0' || d[0] === '1') return 'An Aadhaar number never starts with 0 or 1.';
  if (!verhoeffValid(d)) return 'Those 12 digits fail the Aadhaar check. One is probably mistyped.';
  return null;
}

/** The only Aadhaar value that may ever be stored. Null unless the number is sound. */
export function aadhaarLast4(input: string): string | null {
  const d = digitsOnly(input);
  return d.length === 12 && aadhaarError(d) === null ? d.slice(-4) : null;
}

/** How a stored Aadhaar is shown: XXXX XXXX 1234. No reveal. */
export const maskedAadhaar = (last4: string | null): string => (last4 ? `XXXX XXXX ${last4}` : 'Not on file');

// ── Payee details ─────────────────────────────────────────────

const UPI = /^[a-zA-Z0-9._-]{2,256}@[a-zA-Z][a-zA-Z0-9.-]{1,64}$/;
const IFSC = /^[A-Z]{4}0[A-Z0-9]{6}$/;

export function upiError(input: string): string | null {
  const v = input.trim();
  if (!v) return null;
  return UPI.test(v) ? null : 'A UPI ID looks like name@bank.';
}

export function ifscError(input: string): string | null {
  const v = input.trim().toUpperCase();
  if (!v) return null;
  return IFSC.test(v) ? null : 'An IFSC is 11 characters: four letters, a 0, then six letters or digits.';
}

export function accountNumberError(input: string): string | null {
  const v = digitsOnly(input);
  if (!input.trim()) return null;
  return v.length >= 9 && v.length <= 18 ? null : 'A bank account number is 9 to 18 digits.';
}

/** The account number as shown on screens other than the crew's own page: last four. */
export const maskedAccount = (n: string | null): string | null => (n ? `•••• ${n.slice(-4)}` : null);

// ── Completeness ──────────────────────────────────────────────

export interface CrewIdentity {
  kind: CrewKindName;
  phone: string | null;
  aadhaarLast4: string | null;
  panNumber: string | null;
  aadhaarDocPath: string | null;
  panDocPath: string | null;
}

/**
 * What is still missing on a permanent crew's file. Temporary crews are never
 * incomplete: a nag against a one-site hire teaches people to ignore it.
 * Scans are listed apart from numbers: a number with no scan is a claim.
 */
export function kycGaps(v: CrewIdentity): { blocking: string[]; soft: string[] } {
  if (v.kind !== 'PERMANENT') return { blocking: [], soft: [] };
  const blocking: string[] = [];
  if (!v.phone) blocking.push('phone number');
  if (!v.aadhaarLast4) blocking.push('Aadhaar');
  if (!v.panNumber) blocking.push('PAN');
  const soft: string[] = [];
  if (v.aadhaarLast4 && !v.aadhaarDocPath) soft.push('Aadhaar card scan');
  if (v.panNumber && !v.panDocPath) soft.push('PAN card scan');
  return { blocking, soft };
}

export function kycSummary(v: CrewIdentity): { label: string; tone: 'good' | 'alert' | 'neutral' } {
  if (v.kind !== 'PERMANENT') return { label: 'Temporary', tone: 'neutral' };
  const { blocking, soft } = kycGaps(v);
  if (blocking.length) return { label: `Missing ${blocking.join(', ')}`, tone: 'alert' };
  if (soft.length) return { label: `No ${soft.join(' or ')}`, tone: 'neutral' };
  return { label: 'KYC complete', tone: 'good' };
}

/**
 * The identity a crew may be saved with, or why not. The full Aadhaar goes in
 * and only its last four come out.
 */
export function checkIdentity(input: {
  kind: CrewKindName;
  phone: string;
  pan: string;
  aadhaar: string;
  /** Already on file (editing): a blank field keeps it. */
  existing?: { panNumber: string | null; aadhaarLast4: string | null };
}): { ok: true; panNumber: string | null; aadhaarLast4: string | null } | { ok: false; error: string } {
  const panErr = panError(input.pan);
  if (panErr) return { ok: false, error: panErr };
  const aErr = aadhaarError(input.aadhaar);
  if (aErr) return { ok: false, error: aErr };
  const panNumber = normalisePan(input.pan) || input.existing?.panNumber || null;
  const last4 = aadhaarLast4(input.aadhaar) ?? input.existing?.aadhaarLast4 ?? null;
  if (input.kind === 'PERMANENT') {
    const missing = [!input.phone.trim() && 'a phone number', !last4 && 'an Aadhaar', !panNumber && 'a PAN'].filter(Boolean) as string[];
    if (missing.length) return { ok: false, error: `A permanent crew needs ${missing.join(', ')}. Save them as temporary if you do not have these yet.` };
  }
  return { ok: true, panNumber, aadhaarLast4: last4 };
}

// ── Scans ─────────────────────────────────────────────────────

export const KYC_DOCS = ['aadhaar', 'pan', 'agreement'] as const;
export type KycDoc = (typeof KYC_DOCS)[number];
export const KYC_DOC_LABEL: Record<KycDoc, string> = { aadhaar: 'Aadhaar card', pan: 'PAN card', agreement: 'Agreement' };
export const KYC_DOC_FIELD: Record<KycDoc, 'aadhaarDocPath' | 'panDocPath' | 'agreementDocPath'> = {
  aadhaar: 'aadhaarDocPath',
  pan: 'panDocPath',
  agreement: 'agreementDocPath',
};
export const KYC_TYPES: ReadonlyMap<string, string> = new Map([
  ['image/jpeg', 'jpg'],
  ['image/png', 'png'],
  ['image/webp', 'webp'],
  ['application/pdf', 'pdf'],
]);
export const KYC_ACCEPT = 'image/jpeg,image/png,image/webp,application/pdf';
/** Inside the 4 MB server-action limit (next.config.ts). A phone photo of a card is well under. */
export const KYC_MAX_BYTES = Math.floor(3.8 * 1024 * 1024);

export const isKycDoc = (v: unknown): v is KycDoc => typeof v === 'string' && (KYC_DOCS as readonly string[]).includes(v);

/** Why this file cannot be a scan, or null. */
export function kycFileError(f: { type: string; size: number }): string | null {
  if (!KYC_TYPES.has(f.type)) return 'A scan can be a JPG, PNG, WebP or PDF.';
  if (f.size === 0) return 'That file is empty.';
  if (f.size > KYC_MAX_BYTES) return 'Scans can be up to 3.8 MB. Take the photo again at a smaller size.';
  return null;
}

/** Where a scan is kept in the private bucket. */
export function kycPath(studioId: string, crewId: string, doc: KycDoc, uuid: string, ext: string): string {
  return `studio_${studioId}/crew_${crewId}/${doc}-${uuid}.${ext}`;
}
