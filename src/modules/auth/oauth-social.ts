/**
 * Sign in with Facebook and with Apple — the pure halves, tested without a
 * network. The shape follows `oauth-google.ts`: build the provider's URL,
 * read what it hands back, and let `decideLink` there decide which account
 * it reaches. Social sign-in only ever creates or reaches CUSTOMER accounts.
 *
 * ## Why the tokens are not signature-checked
 *
 * Same reasoning as Google: the Apple id_token and the Facebook profile are
 * fetched by our server, directly from the provider, over TLS, in exchange
 * for a one-time code — never taken from the browser. The claims that matter
 * (issuer, audience, expiry, a verified email) are checked.
 */

import { createHmac, createSign } from 'node:crypto';

const SKEW_SECONDS = 120;

export interface SocialIdentity {
  subject: string;
  email: string | null;
  name: string | null;
}

// ── Facebook ───────────────────────────────────────────────────

export const FACEBOOK_VERSION = 'v19.0';
export const FACEBOOK_TOKEN_URL = `https://graph.facebook.com/${FACEBOOK_VERSION}/oauth/access_token`;
export const FACEBOOK_ME_URL = `https://graph.facebook.com/${FACEBOOK_VERSION}/me`;

export function facebookAuthUrl({ appId, redirectUri, state }: { appId: string; redirectUri: string; state: string }): string {
  const url = new URL(`https://www.facebook.com/${FACEBOOK_VERSION}/dialog/oauth`);
  url.searchParams.set('client_id', appId);
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('state', state);
  url.searchParams.set('response_type', 'code');
  // Name and email only — nothing that needs Facebook's app review.
  url.searchParams.set('scope', 'public_profile,email');
  return url.toString();
}

/** Facebook's `appsecret_proof`: proves the Graph call comes from our server, not a stolen token. */
export function appSecretProof(accessToken: string, appSecret: string): string {
  return createHmac('sha256', appSecret).update(accessToken).digest('hex');
}

/**
 * The /me response, as an identity. Facebook returns only a confirmed
 * primary email, and no email at all for accounts registered by phone — in
 * which case the sign-in is refused rather than creating an account we
 * cannot reach.
 */
export function readFacebookProfile(body: unknown): SocialIdentity | null {
  if (!body || typeof body !== 'object') return null;
  const b = body as Record<string, unknown>;
  if (typeof b.id !== 'string' || !/^\d{1,40}$/.test(b.id)) return null;
  const email = typeof b.email === 'string' && b.email.includes('@') ? b.email.trim().toLowerCase() : null;
  const name = typeof b.name === 'string' && b.name.trim() ? b.name.trim().slice(0, 80) : null;
  return { subject: b.id, email, name };
}

// ── Apple ──────────────────────────────────────────────────────

export const APPLE_AUTH_URL = 'https://appleid.apple.com/auth/authorize';
export const APPLE_TOKEN_URL = 'https://appleid.apple.com/auth/token';
const APPLE_ISSUER = 'https://appleid.apple.com';

export function appleAuthUrl({ clientId, redirectUri, state }: { clientId: string; redirectUri: string; state: string }): string {
  const url = new URL(APPLE_AUTH_URL);
  url.searchParams.set('client_id', clientId);
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('response_type', 'code');
  // Apple requires form_post whenever name or email is asked for.
  url.searchParams.set('response_mode', 'form_post');
  url.searchParams.set('scope', 'name email');
  url.searchParams.set('state', state);
  return url.toString();
}

/**
 * Apple's client secret: a short-lived ES256 JWT signed with our private key
 * (the .p8 from the Apple developer account). Generated per sign-in rather
 * than stored, so a leaked secret expires in minutes.
 */
export function appleClientSecret({
  teamId,
  keyId,
  clientId,
  privateKey,
  nowSeconds,
}: {
  teamId: string;
  keyId: string;
  clientId: string;
  privateKey: string;
  nowSeconds: number;
}): string {
  const enc = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const head = enc({ alg: 'ES256', kid: keyId, typ: 'JWT' });
  const body = enc({ iss: teamId, iat: nowSeconds, exp: nowSeconds + 300, aud: APPLE_ISSUER, sub: clientId });
  const signer = createSign('SHA256');
  signer.update(`${head}.${body}`);
  const sig = signer.sign({ key: privateKey, dsaEncoding: 'ieee-p1363' }).toString('base64url');
  return `${head}.${body}.${sig}`;
}

export type AppleCheck =
  | { ok: true; identity: SocialIdentity }
  | { ok: false; reason: 'malformed' | 'issuer' | 'audience' | 'expired' | 'unverified-email' };

export function readAppleIdToken(idToken: string, clientId: string, nowSeconds: number): AppleCheck {
  const parts = typeof idToken === 'string' ? idToken.split('.') : [];
  if (parts.length !== 3) return { ok: false, reason: 'malformed' };
  let c: Record<string, unknown>;
  try {
    c = JSON.parse(Buffer.from(parts[1]!, 'base64url').toString('utf8'));
  } catch {
    return { ok: false, reason: 'malformed' };
  }
  if (!c || typeof c !== 'object') return { ok: false, reason: 'malformed' };
  if (c.iss !== APPLE_ISSUER) return { ok: false, reason: 'issuer' };
  const aud = c.aud;
  if (!(Array.isArray(aud) ? aud.includes(clientId) : aud === clientId)) return { ok: false, reason: 'audience' };
  if (typeof c.exp !== 'number' || c.exp + SKEW_SECONDS < nowSeconds) return { ok: false, reason: 'expired' };
  if (typeof c.sub !== 'string' || !c.sub) return { ok: false, reason: 'malformed' };
  // Apple sends "true" as a string.
  const email = typeof c.email === 'string' ? c.email.trim().toLowerCase() : null;
  const verified = c.email_verified === true || c.email_verified === 'true';
  if (email && !verified) return { ok: false, reason: 'unverified-email' };
  return { ok: true, identity: { subject: c.sub, email, name: null } };
}

/**
 * The name Apple posts back — only on the very first sign-in, as a JSON
 * `user` form field. Unverified by nature (the person typed it), so it only
 * ever fills an empty name.
 */
export function readAppleUser(raw: string | null): string | null {
  if (!raw) return null;
  try {
    const u = JSON.parse(raw) as { name?: { firstName?: unknown; lastName?: unknown } };
    const parts = [u.name?.firstName, u.name?.lastName].filter((p): p is string => typeof p === 'string' && p.trim() !== '');
    const name = parts.join(' ').trim().slice(0, 80);
    return name || null;
  } catch {
    return null;
  }
}
