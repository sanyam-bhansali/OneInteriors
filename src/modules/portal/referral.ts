/**
 * OneReferrals — the mechanics (Phase 7).
 *
 * A customer gets a personal code (SANYAM-7K2Q) and a link to share
 * (/r/SANYAM-7K2Q). A friend who arrives through it carries the code on a
 * cookie for 30 days, and it is recorded on their brief. Nobody can refer
 * themselves.
 *
 * ## Not shown until the terms exist
 *
 * The owner's benefit is "refer a friend, get ₹10,000", and plan §17.3 asks
 * first: paid to whom, and when. Until the referral benefit carries terms in
 * benefits.ts, the code and the link appear on no screen. The tracking runs
 * regardless, so no referral made in the meantime is lost.
 *
 * Pure, and tested.
 */

/** No 0/O or 1/I — codes get read out over the phone. */
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export const CODE_RE = /^[A-Z]{2,8}-[A-HJ-NP-Z2-9]{4}$/;

export const REFERRAL_COOKIE = 'oi_ref';
export const REFERRAL_DAYS = 30;

/** "Sanyam Bhansali" + 4 random bytes → "SANYAM-7K2Q". A nameless customer is "HOME-…". */
export function makeCode(name: string | null | undefined, random: Uint8Array): string {
  const first = (name ?? '').trim().split(/\s+/)[0] ?? '';
  const letters = first.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 8);
  const head = letters.length >= 2 ? letters : 'HOME';
  const tail = Array.from(random.slice(0, 4), (b) => ALPHABET[b % ALPHABET.length]).join('');
  return `${head}-${tail}`;
}

/** A code as typed or linked, normalised — or null if it could not be one of ours. */
export function cleanCode(raw: string | null | undefined): string | null {
  const code = (raw ?? '').trim().toUpperCase();
  return CODE_RE.test(code) ? code : null;
}

/** A code only counts for somebody other than its owner. */
export function counts(ownerId: string | null, customerId: string | null): boolean {
  return Boolean(ownerId) && ownerId !== customerId;
}
