/**
 * The rules that keep floor-plan reading cheap and predictable.
 *
 * Pure (CONTRIBUTING §9.5) and tested; the database and the call are in
 * `plan-reads.ts`. Four guards, each a decision made here:
 *
 *  1. **One read per file.** A reading is stored against the sha256 of the
 *     file's bytes, per studio. The same plan attached twice, to two leads,
 *     or pressed twice, is read once. A plan the reader could not make out
 *     is not sent again; only a timeout or a server error earns one retry.
 *  2. **Size and type.** PDF, JPG, PNG or WebP. A photo up to 3.7 MB: it
 *     goes base64-encoded (4/3 of its size) and the reader refuses an image
 *     over 5 MB as sent, so a 4 MB photo would fail on every try. A PDF up to
 *     15 MB (our upload cap): about 20 MB encoded, inside the reader's 32 MB
 *     request limit.
 *  3. **A daily cap per studio** (200 reads a day, India time) — far above
 *     what a sales team uploads, low enough that a stuck loop cannot run up a
 *     bill.
 *  4. **One read at a time per file.** A read claims its row first; a second
 *     press while it runs waits instead of paying twice. A claim older than
 *     three minutes is a read that died, and counts as a failed attempt.
 *
 * Failures are reduced to a short code (`reason`). Nothing here, and nothing
 * stored, carries the plan or the reader's reply.
 */

/** Reads a studio may start in one India day. */
export const PLAN_READS_PER_DAY = 200;

/** Attempts per file: the first, and one retry after a timeout or server error. */
export const PLAN_READ_ATTEMPTS = 2;

/** A read still marked running after this long has died. */
export const STALE_READ_MS = 3 * 60_000;

const MB = 1024 * 1024;

/** The reader's limits, as sent: an image's base64 data, and the whole request. */
export const READER_IMAGE_MAX_ENCODED = 5 * MB;
export const READER_REQUEST_MAX = 32 * MB;

/** Bytes once base64-encoded. */
export const base64Length = (bytes: number) => 4 * Math.ceil(bytes / 3);

/** A photo's raw size cap: 3.7 MB, whose base64 (about 4.9 MB) stays under the reader's 5 MB. */
export const PHOTO_MAX_BYTES = Math.floor(3.7 * MB);

/** What the reader takes, and how large (raw bytes). */
export const PLAN_FILE_LIMITS: Record<string, number> = {
  'application/pdf': 15 * MB,
  'image/jpeg': PHOTO_MAX_BYTES,
  'image/png': PHOTO_MAX_BYTES,
  'image/webp': PHOTO_MAX_BYTES,
};

export type PlanFileCheck = { ok: true } | { ok: false; reason: 'file-type' | 'too-large' | 'photo-too-large' };

export function checkPlanFile(contentType: string, bytes: number): PlanFileCheck {
  const type = contentType.split(';')[0]!.trim().toLowerCase();
  const max = PLAN_FILE_LIMITS[type];
  if (!max) return { ok: false, reason: 'file-type' };
  if (!Number.isFinite(bytes) || bytes <= 0 || bytes > max) {
    return { ok: false, reason: type.startsWith('image/') ? 'photo-too-large' : 'too-large' };
  }
  return { ok: true };
}

/** Reasons the same file will never read better on a second try. */
const FINAL_REASONS = new Set(['unreadable', 'no-rooms', 'file-type', 'too-large', 'photo-too-large']);

export function isFinalFailure(reason: string | null | undefined): boolean {
  return reason != null && FINAL_REASONS.has(reason);
}

/** Midnight in India (UTC+5:30) at or before `now`, as a Date. */
export function istDayStart(now: Date): Date {
  const IST = 330 * 60_000;
  const local = new Date(now.getTime() + IST);
  const midnightLocal = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate());
  return new Date(midnightLocal - IST);
}

/** The stored row for this file's hash, as far as the decision needs it. */
export interface StoredRead {
  status: 'READING' | 'READ' | 'FAILED';
  reason: string | null;
  attempts: number;
  lastAttemptAt: Date;
}

export type ReadDecision =
  /** Already read: use the stored reading. No call. */
  | { kind: 'use' }
  /** Another read of this file is running right now. */
  | { kind: 'busy' }
  /** Do not call: the file failed for good, or used its attempts, or the cap is reached. */
  | { kind: 'refuse'; reason: string }
  /** Call the reader; `retry` when a row exists and is being tried again. */
  | { kind: 'read'; retry: boolean };

/**
 * Whether to call the reader for this file.
 *
 * `readsToday` is the studio's reads started since India midnight; the cap
 * applies to new calls only — a stored reading is always used.
 */
export function decideRead(stored: StoredRead | null, now: Date, readsToday: number, cap = PLAN_READS_PER_DAY): ReadDecision {
  if (stored?.status === 'READ') return { kind: 'use' };

  if (stored?.status === 'READING' && now.getTime() - stored.lastAttemptAt.getTime() < STALE_READ_MS) {
    return { kind: 'busy' };
  }

  if (stored) {
    /* FAILED, or a READING that died (counted as a failed attempt). */
    const reason = stored.status === 'READING' ? 'reader-failed' : (stored.reason ?? 'reader-failed');
    if (isFinalFailure(reason)) return { kind: 'refuse', reason };
    if (stored.attempts >= PLAN_READ_ATTEMPTS) return { kind: 'refuse', reason };
  }

  if (readsToday >= cap) return { kind: 'refuse', reason: 'daily-cap' };
  return { kind: 'read', retry: stored !== null };
}

/** What to tell the salesperson, in their words, for each reason. */
export function planReadMessage(reason: string): string {
  switch (reason) {
    case 'not-configured':
      return "Floor-plan reading isn't switched on yet.";
    case 'file-type':
      return 'The reader takes a PDF, JPG, PNG or WebP plan.';
    case 'too-large':
      return 'That PDF is too large for the reader: up to 15 MB. Send a smaller copy.';
    case 'photo-too-large':
      return 'Photo is too big — send a PDF or a smaller photo (up to 3.7 MB).';
    case 'unreadable':
    case 'no-rooms':
      return 'The reader could not make out the rooms on this plan.';
    case 'daily-cap':
      return `Your studio has read ${PLAN_READS_PER_DAY} plans today, the most in one day. Reading starts again tomorrow.`;
    case 'busy':
      return 'This plan is already being read — try again in a minute.';
    case 'no-file':
      return 'We could not open the stored file. Attach it again.';
    default:
      return 'The reader did not answer this time.';
  }
}
