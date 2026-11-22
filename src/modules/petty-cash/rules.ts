/**
 * Petty cash for site supervisors (owner, 21 Nov 2026). Pure: tested in
 * tests/petty-cash.test.ts; the writes are in store.ts.
 *
 * - Accounts (the owner or the accounts role) enters what was given to a
 *   supervisor; the money goes to their bank, the value lives in the app. The
 *   supervisor marks it received.
 * - The supervisor puts each expense under a project, with the bill photo
 *   (mandatory). They may tag any project of the studio (their own come
 *   first), and it shows in that project's money with who paid.
 * - Pending with a person = given − spent (rejected expenses do not count).
 * - Flags, each with its reason, for accounts to review and clear:
 *     NOT_ON_SITE     spent on a project the person is not on ("Sumil runs
 *                     the site, Akash spent")
 *     UNUSUAL_AMOUNT  far above the studio's usual expense
 *     SAME_BILL       the same bill photo already uploaded by them
 *     BILL_BY_OTHER   the same bill photo uploaded by someone else
 *     SAME_DETAILS    a bill with the same date, amount and shop as another
 *     NOT_A_BILL      the photo reader does not take the photo for a bill
 *     AMOUNT_DIFFERS  the bill reads a different amount from the one entered
 *   A flag never stops the expense: it is saved and shown for review.
 */

export const FLAG_CODES = ['NOT_ON_SITE', 'UNUSUAL_AMOUNT', 'SAME_BILL', 'BILL_BY_OTHER', 'SAME_DETAILS', 'NOT_A_BILL', 'AMOUNT_DIFFERS'] as const;
export type FlagCode = (typeof FLAG_CODES)[number];
export interface Flag {
  code: FlagCode;
  reason: string;
}
export const FLAG_LABEL: Record<FlagCode, string> = {
  NOT_ON_SITE: 'Not their site',
  UNUSUAL_AMOUNT: 'Unusual amount',
  SAME_BILL: 'Bill uploaded again',
  BILL_BY_OTHER: 'Same bill, another person',
  SAME_DETAILS: 'Same bill details',
  NOT_A_BILL: 'Not a bill?',
  AMOUNT_DIFFERS: 'Amount differs from bill',
};

/** Largest single expense or cash entry, in rupees: a typo guard, not a policy. */
export const MAX_RUPEES = 5_00_000;
export const NOTE_MAX = 200;
/** "A bit off from the historical data": more than this many times the usual, once there is enough history. */
export const UNUSUAL_FACTOR = 3;
export const UNUSUAL_MIN_HISTORY = 5;
/** The bill and the entered amount may differ by this much before it is flagged (rounding, a tip). */
export const AMOUNT_TOLERANCE = { rupees: 10, share: 0.05 };

const rupees = (paise: number) => `₹${Math.round(paise / 100).toLocaleString('en-IN')}`;

/** An amount typed in rupees ("1,250" or "1250.50") → paise; null when it is not a positive amount under the cap. */
export function parseRupees(raw: unknown): number | null {
  const s = typeof raw === 'string' ? raw.replace(/[₹,\s]/g, '') : typeof raw === 'number' ? String(raw) : '';
  if (!/^\d+(\.\d{1,2})?$/.test(s)) return null;
  const paise = Math.round(Number(s) * 100);
  if (paise <= 0 || paise > MAX_RUPEES * 100) return null;
  return paise;
}

export function cleanNote(raw: unknown): string {
  return (typeof raw === 'string' ? raw.replace(/\s+/g, ' ').trim() : '').slice(0, NOTE_MAX);
}

/** The middle value; null for none. */
export function median(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  const s = [...values].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m]! : Math.round((s[m - 1]! + s[m]!) / 2);
}

export interface FlagInput {
  amountPaise: number;
  memberId: string;
  memberName: string;
  projectName: string;
  /** Is the person on the project's team? */
  onSite: boolean;
  /** Who is on the project's site team (supervisors and PMs), for the reason. */
  siteTeam: readonly string[];
  /** The studio's earlier expense amounts (not rejected). */
  history: readonly number[];
  /** Earlier expenses with the same bill photo. */
  sameHash: readonly { memberId: string; memberName: string; day: string; projectName: string }[];
  /** Earlier expenses whose bill read the same date, amount and shop. */
  sameDetails: readonly { memberName: string; day: string; projectName: string }[];
  /** What the photo reader made of the bill; null when it could not read it. */
  read: { isBill: boolean; amountPaise: number | null; why: string } | null;
}

/** Every flag that applies, each with its reason in plain words. */
export function flagsFor(x: FlagInput): Flag[] {
  const out: Flag[] = [];
  if (!x.onSite) {
    out.push({
      code: 'NOT_ON_SITE',
      reason: x.siteTeam.length
        ? `${x.memberName} is not on ${x.projectName}'s team (${x.siteTeam.join(', ')} ${x.siteTeam.length === 1 ? 'runs' : 'run'} it), yet spent on it.`
        : `${x.memberName} is not on ${x.projectName}'s team, yet spent on it.`,
    });
  }
  const usual = x.history.length >= UNUSUAL_MIN_HISTORY ? median(x.history) : null;
  if (usual && x.amountPaise > usual * UNUSUAL_FACTOR) {
    out.push({ code: 'UNUSUAL_AMOUNT', reason: `${rupees(x.amountPaise)} is ${Math.round((x.amountPaise / usual) * 10) / 10}× the usual expense of ${rupees(usual)}.` });
  }
  const mine = x.sameHash.find((h) => h.memberId === x.memberId);
  if (mine) out.push({ code: 'SAME_BILL', reason: `This bill photo was already uploaded by ${x.memberName} on ${mine.day}, for ${mine.projectName}.` });
  const other = x.sameHash.find((h) => h.memberId !== x.memberId);
  if (other) out.push({ code: 'BILL_BY_OTHER', reason: `${other.memberName} uploaded the same bill photo on ${other.day}, for ${other.projectName}.` });
  if (!mine && !other && x.sameDetails.length) {
    const d = x.sameDetails[0]!;
    out.push({ code: 'SAME_DETAILS', reason: `A bill with the same date, amount and shop was already put in by ${d.memberName} on ${d.day}, for ${d.projectName}.` });
  }
  if (x.read) {
    if (!x.read.isBill) out.push({ code: 'NOT_A_BILL', reason: `The photo reader does not take this for a bill: ${x.read.why || 'no shop, amount or date on it'}.` });
    else if (x.read.amountPaise !== null && differs(x.read.amountPaise, x.amountPaise)) {
      out.push({ code: 'AMOUNT_DIFFERS', reason: `The bill reads ${rupees(x.read.amountPaise)}; ${rupees(x.amountPaise)} was entered.` });
    }
  }
  return out;
}

export function differs(billPaise: number, enteredPaise: number): boolean {
  const gap = Math.abs(billPaise - enteredPaise);
  return gap > AMOUNT_TOLERANCE.rupees * 100 && gap > enteredPaise * AMOUNT_TOLERANCE.share;
}

/** The flags as stored (JSON), dropping anything unknown. */
export function readFlags(raw: unknown): Flag[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((f): f is Flag => !!f && typeof f === 'object' && FLAG_CODES.includes((f as Flag).code) && typeof (f as Flag).reason === 'string');
}

/** A person's petty cash: given to them, marked received, spent (rejected expenses aside), and still with them. */
export function balanceOf(cash: readonly { amountPaise: number; received: boolean }[], spent: readonly { amountPaise: number; rejected: boolean }[]) {
  const given = cash.reduce((a, c) => a + c.amountPaise, 0);
  const received = cash.filter((c) => c.received).reduce((a, c) => a + c.amountPaise, 0);
  const spentPaise = spent.filter((s) => !s.rejected).reduce((a, s) => a + s.amountPaise, 0);
  return { given, received, spent: spentPaise, pending: given - spentPaise };
}

// ── The bill reader ───────────────────────────────────────────

/** A shop's name for matching: lowercase letters and digits only. */
export const vendorKey = (v: string | null | undefined): string => (v ?? '').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 40);

export function billPrompt(): string {
  return [
    'This is a photo or screenshot a site supervisor of an interiors studio in India uploaded as the bill for a petty-cash expense (hardware, transport, labour, small materials).',
    'Read it. Reply with ONLY a JSON object, no prose:',
    '{"isBill": true|false, "amountRupees": number|null, "date": "YYYY-MM-DD"|null, "vendor": string|null, "summary": string, "why": string}',
    '- isBill: true for a bill, invoice, receipt, or a UPI/bank payment screenshot showing an amount paid; false for anything else.',
    '- amountRupees: the total paid, in rupees; null if you cannot read it.',
    '- date and vendor (shop or payee): as written; null if not shown.',
    '- summary: what was bought, in under 12 words.',
    '- why: when isBill is false, why not, in under 15 words; else "".',
  ].join('\n');
}

export type BillRead = { ok: true; isBill: boolean; amountPaise: number | null; day: string | null; vendor: string | null; summary: string; why: string } | { ok: false; why: string };

export function parseBillReply(text: string): BillRead {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start < 0 || end <= start) return { ok: false, why: 'unreadable' };
  try {
    const j = JSON.parse(text.slice(start, end + 1)) as Record<string, unknown>;
    const amount = typeof j.amountRupees === 'number' && j.amountRupees > 0 && j.amountRupees <= MAX_RUPEES * 10 ? Math.round(j.amountRupees * 100) : null;
    const day = typeof j.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(j.date) ? j.date : null;
    const str = (v: unknown, n: number) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, n) : '');
    return { ok: true, isBill: j.isBill === true, amountPaise: amount, day, vendor: str(j.vendor, 80) || null, summary: str(j.summary, 120), why: str(j.why, 120) };
  } catch {
    return { ok: false, why: 'unreadable' };
  }
}
