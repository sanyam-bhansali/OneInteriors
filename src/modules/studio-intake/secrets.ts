/**
 * The keys on a studio's lead doors, and Meta's signature.
 *
 * Pure (node:crypto only, no `server-only`) so the rules are tested directly
 * (tests/studio-intake.test.ts) — CONTRIBUTING §9.5.
 *
 * ## A key is shown once and kept as a hash
 *
 * A door's key is 32 random bytes, shown to the owner the moment the door is
 * made (or given a new key) and never again. Only its SHA-256 is stored, the
 * way a password would be, except that a random 256-bit key needs no salt or
 * slow hash: nobody is going to guess it, so the only thing the hash defends
 * against is somebody reading the table, and SHA-256 is enough for that.
 *
 * ## Compared in constant time
 *
 * Both sides are hashed first and the two digests compared with
 * `timingSafeEqual`, so the comparison takes the same time however many
 * characters of a guess were right, and always compares equal lengths.
 *
 * ## Meta signs with the app secret
 *
 * Meta's posts carry `X-Hub-Signature-256: sha256=<hex HMAC of the raw body>`
 * keyed with the Meta app's secret (env `META_APP_SECRET`). The body must be
 * the exact bytes received: parse first and re-serialise, and the signature
 * never matches. Ported from AxLeads (lib/webhooks/verify-signature.ts), minus
 * its MOCK_META bypass: nothing here may switch the check off.
 */

import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

/** Every key starts with this, so a key pasted in the wrong box is recognisable. */
export const KEY_PREFIX = 'oik_';

/** A new door key: `oik_` and 32 random bytes, base64url. */
export function newSecret(): string {
  return `${KEY_PREFIX}${randomBytes(32).toString('base64url')}`;
}

/** What is stored: the SHA-256 of the key, in hex. */
export function hashSecret(secret: string): string {
  return createHash('sha256').update(secret, 'utf8').digest('hex');
}

/** Whether a presented key is the one whose hash is stored. Never throws. */
export function secretMatches(presented: string | null | undefined, storedHash: string | null | undefined): boolean {
  if (!presented || !storedHash || !/^[0-9a-f]{64}$/.test(storedHash)) return false;
  const a = Buffer.from(hashSecret(presented.trim()), 'hex');
  const b = Buffer.from(storedHash, 'hex');
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Whether Meta signed this body. False when anything is missing: no secret
 * configured is a refusal, never a pass.
 */
export function verifyMetaSignature(rawBody: string, header: string | null | undefined, appSecret: string | null | undefined): boolean {
  if (!appSecret || !header) return false;
  const m = /^sha256=([0-9a-f]{64})$/i.exec(header.trim());
  if (!m) return false;
  const expected = createHmac('sha256', appSecret).update(rawBody, 'utf8').digest();
  const got = Buffer.from(m[1]!.toLowerCase(), 'hex');
  return got.length === expected.length && timingSafeEqual(got, expected);
}

/**
 * The id for a lead whose sender gave none: `h:` and a hash of what
 * identifies it (phone, else email, else name) and the minute it came in.
 *
 * So a website that double-posts one enquiry (a double tap, a retry) lands
 * one lead, and the same person enquiring again an hour later is a second
 * event (which the phone check then adds to their lead's timeline).
 */
export function fallbackExternalId(identity: string, at: Date): string {
  const minute = Math.floor(at.getTime() / 60_000);
  return `h:${createHash('sha256').update(`${identity.trim().toLowerCase()}|${minute}`, 'utf8').digest('hex').slice(0, 40)}`;
}
