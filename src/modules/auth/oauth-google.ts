/**
 * Sign in with Google — the parts that are rules, not plumbing.
 *
 * ## Why this exists
 *
 * The owner's direction (29 Sep 2026): customers should not have to rely on a
 * one-time code to sign in. Google first; Apple and Facebook follow the same
 * shape (docs/CUSTOMER-JOURNEY-PLAN.md §3). None of them gives us a phone
 * number, so the brief's contact step still asks for it — social sign-in
 * removes the code, not the number.
 *
 * ## Why there is no library
 *
 * The OAuth 2.0 authorisation-code flow with PKCE, against Google's OpenID
 * Connect endpoints, is three requests and a handful of checks. This project
 * does not take a dependency for that much (see `prisma/load-env.ts`), and the
 * sessions are our own (`createSession`) — there is no second auth system to
 * keep in step.
 *
 * ## Why the ID token's signature is not checked here
 *
 * The token comes straight back from Google's token endpoint, over TLS, in
 * exchange for a code only we could redeem (it is bound to our client secret
 * and our PKCE verifier). OpenID Connect Core §3.1.3.7 allows TLS server
 * validation in place of the signature check in exactly that case. The claims
 * are still checked: issuer, audience, expiry, and that the email is verified.
 *
 * Pure (no `server-only`), so every rule below is tested (CONTRIBUTING §9.5).
 */

import { createHash, randomBytes } from 'node:crypto';

export const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
export const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_ISSUERS = new Set(['https://accounts.google.com', 'accounts.google.com']);

/** How much clock drift between Google and us is tolerated, in seconds. */
const SKEW_SECONDS = 120;

/** 256 bits, url-safe. For both `state` and the PKCE verifier. */
export function newOAuthSecret(): string {
  return randomBytes(32).toString('base64url');
}

/** The PKCE S256 challenge for a verifier. */
export function challengeFor(verifier: string): string {
  return createHash('sha256').update(verifier).digest('base64url');
}

/** Where to send the browser to ask Google. */
export function googleAuthUrl({
  clientId,
  redirectUri,
  state,
  verifier,
}: {
  clientId: string;
  redirectUri: string;
  state: string;
  verifier: string;
}): string {
  const url = new URL(GOOGLE_AUTH_URL);
  url.searchParams.set('client_id', clientId);
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('response_type', 'code');
  // Name and email only. No contacts, no drive, nothing else to explain.
  url.searchParams.set('scope', 'openid email profile');
  url.searchParams.set('state', state);
  url.searchParams.set('code_challenge', challengeFor(verifier));
  url.searchParams.set('code_challenge_method', 'S256');
  // A shared family laptop has more than one Google account signed in.
  url.searchParams.set('prompt', 'select_account');
  return url.toString();
}

export interface GoogleIdentity {
  /** Google's stable id for the person. Emails change; this does not. */
  subject: string;
  email: string | null;
  emailVerified: boolean;
  name: string | null;
}

export type IdTokenCheck =
  | { ok: true; identity: GoogleIdentity }
  | { ok: false; reason: 'malformed' | 'issuer' | 'audience' | 'expired' | 'unverified-email' };

/**
 * Read and check the ID token Google's token endpoint returned.
 *
 * An unverified email is refused outright: the email is what an account is
 * found by, and an unverified one would let somebody sign in as whoever owns
 * that address here.
 */
export function readGoogleIdToken(
  idToken: string,
  clientId: string,
  nowSeconds: number,
): IdTokenCheck {
  const parts = typeof idToken === 'string' ? idToken.split('.') : [];
  if (parts.length !== 3) return { ok: false, reason: 'malformed' };

  let claims: Record<string, unknown>;
  try {
    claims = JSON.parse(Buffer.from(parts[1]!, 'base64url').toString('utf8'));
  } catch {
    return { ok: false, reason: 'malformed' };
  }
  if (!claims || typeof claims !== 'object') return { ok: false, reason: 'malformed' };

  if (typeof claims.iss !== 'string' || !GOOGLE_ISSUERS.has(claims.iss)) {
    return { ok: false, reason: 'issuer' };
  }

  const aud = claims.aud;
  const audienceOk = Array.isArray(aud) ? aud.includes(clientId) : aud === clientId;
  if (!audienceOk) return { ok: false, reason: 'audience' };

  if (typeof claims.exp !== 'number' || claims.exp + SKEW_SECONDS < nowSeconds) {
    return { ok: false, reason: 'expired' };
  }

  if (typeof claims.sub !== 'string' || !claims.sub) return { ok: false, reason: 'malformed' };

  const email = typeof claims.email === 'string' ? claims.email.trim().toLowerCase() : null;
  const emailVerified = claims.email_verified === true || claims.email_verified === 'true';
  if (email && !emailVerified) return { ok: false, reason: 'unverified-email' };

  const name = typeof claims.name === 'string' && claims.name.trim() ? claims.name.trim().slice(0, 80) : null;

  return { ok: true, identity: { subject: claims.sub, email, emailVerified, name } };
}

export type Role = 'CUSTOMER' | 'STUDIO' | 'OPS' | 'ADMIN';

export type LinkDecision =
  /** This Google account is already linked; sign that user in. */
  | { kind: 'sign-in'; userId: string }
  /** A customer account with this email exists; link Google to it and sign in. */
  | { kind: 'link'; userId: string }
  /** No account yet: create a customer with this email. */
  | { kind: 'create' }
  /** The email belongs to a studio or ops account. Never linked automatically. */
  | { kind: 'refuse-staff' }
  /** The account behind it was deleted. */
  | { kind: 'refuse-deleted' };

/**
 * Who a Google sign-in becomes.
 *
 * Social sign-in only ever creates or reaches CUSTOMER accounts. An email that
 * belongs to a studio or ops account is refused rather than linked: those
 * accounts are approved by us and sign in by email or password, and quietly
 * attaching a Google login to one would give whoever controls that Google
 * account the studio's price list and its clients' numbers.
 */
export function decideLink({
  linkedUser,
  emailUser,
}: {
  /** The user this Google account is already linked to, if any. */
  linkedUser: { id: string; role: Role; deleted: boolean } | null;
  /** The user whose email matches the verified Google email, if any. */
  emailUser: { id: string; role: Role; deleted: boolean } | null;
}): LinkDecision {
  if (linkedUser) {
    if (linkedUser.deleted) return { kind: 'refuse-deleted' };
    if (linkedUser.role !== 'CUSTOMER') return { kind: 'refuse-staff' };
    return { kind: 'sign-in', userId: linkedUser.id };
  }
  if (emailUser) {
    if (emailUser.deleted) return { kind: 'refuse-deleted' };
    if (emailUser.role !== 'CUSTOMER') return { kind: 'refuse-staff' };
    return { kind: 'link', userId: emailUser.id };
  }
  return { kind: 'create' };
}
