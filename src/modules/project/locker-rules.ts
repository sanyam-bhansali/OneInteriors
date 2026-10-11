/**
 * The home locker's rules (studio workspace Phase 5). Pure, and tested
 * (tests/locker.test.ts); the writes are in locker.ts.
 *
 * - Documents are versioned. A new revision of a drawing is a new row with
 *   `version + 1` and `supersedesId` pointing at the one it replaces. Only the
 *   newest of a chain can be replaced, so a chain never forks.
 * - A SHARED document is never edited or removed: the customer may have
 *   opened it, forwarded it, relied on it. It can only be superseded. A
 *   draft (never shared) can be removed.
 * - The customer sees the newest SHARED version of each chain. A draft
 *   revision of a shared drawing leaves the shared one showing until the
 *   studio shares the revision.
 * - Materials get their product code when ordered: the code the customer
 *   would quote to a shop for a spare or a repair.
 * - Automatically filed: the agreement and the final quote at signing
 *   (Phase 1), a receipt with each recorded payment, and each decision's
 *   outcome (a record pointing at the decision, `decision:<id>`).
 */

import { DECISION_PREFIX } from '@/modules/portal/documents';

export interface DocRow {
  id: string;
  version: number;
  supersedesId: string | null;
  sharedAt: Date | null;
  deletedAt: Date | null;
}

/** May this document get a new version? Only the newest live one of its chain. */
export function canSupersede(doc: DocRow, all: DocRow[]): { ok: true; version: number } | { ok: false; error: string } {
  if (doc.deletedAt) return { ok: false, error: 'That document was taken off the project.' };
  if (all.some((d) => d.supersedesId === doc.id && !d.deletedAt)) return { ok: false, error: 'There is a newer version of this document already. Replace that one.' };
  return { ok: true, version: doc.version + 1 };
}

/** May this document be removed? Drafts only; a shared document can only be replaced by a new version. */
export function canRemove(doc: DocRow): { ok: true } | { ok: false; error: string } {
  if (doc.deletedAt) return { ok: true };
  if (doc.sharedAt) return { ok: false, error: 'The customer already has this one, so it stays. Upload a new version to replace it.' };
  return { ok: true };
}

/**
 * The documents the customer sees: shared, not removed, and not replaced by
 * a newer SHARED version. Order kept.
 */
export function customerVisible<T extends DocRow>(docs: T[]): T[] {
  const live = docs.filter((d) => d.sharedAt && !d.deletedAt);
  const replaced = new Set(live.map((d) => d.supersedesId).filter((id): id is string => Boolean(id)));
  return live.filter((d) => !replaced.has(d.id));
}

/** The newest version of each chain, drafts included, for the studio's list. */
export function newestVersions<T extends DocRow>(docs: T[]): T[] {
  const live = docs.filter((d) => !d.deletedAt);
  const replaced = new Set(live.map((d) => d.supersedesId).filter((id): id is string => Boolean(id)));
  return live.filter((d) => !replaced.has(d.id));
}

export const PRODUCT_CODE_MAX = 60;

/** A product code as a shop would print it: letters, digits and a few separators. Empty clears it. */
export function checkProductCode(v: unknown): { ok: true; value: string | null } | { ok: false; error: string } {
  const s = typeof v === 'string' ? v.trim().replace(/\s+/g, ' ') : '';
  if (!s) return { ok: true, value: null };
  if (s.length > PRODUCT_CODE_MAX) return { ok: false, error: `Codes are at most ${PRODUCT_CODE_MAX} characters.` };
  if (!/^[\p{L}\p{N}][\p{L}\p{N} ./#()+_-]*$/u.test(s)) return { ok: false, error: 'Type the code as printed on the order, letters and numbers.' };
  return { ok: true, value: s };
}

// ── Decision outcomes, filed as records ────────────────────────

export const decisionDocKey = (decisionId: string) => `${DECISION_PREFIX}${decisionId}`;

/** The decision a filed outcome points at, or null for any other document. */
export function decisionOfDoc(storageKey: string): string | null {
  if (!storageKey.startsWith(DECISION_PREFIX)) return null;
  const id = storageKey.slice(DECISION_PREFIX.length);
  return /^[A-Za-z0-9_-]{1,64}$/.test(id) ? id : null;
}

/** "Your choice: Kitchen shutter finish, Walnut grain (+₹14,000)". */
export function decisionDocTitle(title: string, option: string, price: string): string {
  return `Your choice: ${title}, ${option}${price === 'As quoted' ? '' : ` (${price})`}`.slice(0, 100);
}
