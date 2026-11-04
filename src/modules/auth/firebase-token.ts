/**
 * Checking the ID token Firebase gives a customer after they type the SMS code.
 *
 * Firebase sends the code and checks it; what reaches us is a signed token
 * that says "this person proved they hold +91…". We trust that only after
 * checking it ourselves, the way Google documents for servers without the
 * Admin SDK (no service-account key to keep):
 *
 *  - RS256, signed by one of Google's published securetoken keys (`kid`);
 *  - `aud` is our project id and `iss` is https://securetoken.google.com/<id>;
 *  - not expired, not issued in the future, `sub` present;
 *  - signed in with the phone provider, and a `phone_number` in the token.
 *
 * Pure apart from `fetch`, which is injected, so tests sign their own tokens.
 */

import { createPublicKey, verify as verifySignature, type JsonWebKey } from 'node:crypto';

const JWKS_URL = 'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com';
/** Clock difference we forgive between Google and this server. */
const SKEW_SECONDS = 60;

export type FirebaseTokenResult =
  | { ok: true; phone: string; uid: string }
  | { ok: false; reason: 'malformed' | 'bad_signature' | 'wrong_project' | 'expired' | 'not_phone' };

type Jwk = JsonWebKey & { kid?: string };
export type KeySource = () => Promise<Jwk[]>;

function b64urlJson(part: string): Record<string, unknown> | null {
  try {
    const value = JSON.parse(Buffer.from(part, 'base64url').toString('utf8'));
    return value && typeof value === 'object' ? (value as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

export async function verifyFirebaseToken(
  token: string,
  projectId: string,
  keys: KeySource = googleKeys,
  nowSeconds: number = Math.floor(Date.now() / 1000),
): Promise<FirebaseTokenResult> {
  const parts = token.split('.');
  if (parts.length !== 3) return { ok: false, reason: 'malformed' };
  const [h, p, s] = parts;
  const header = b64urlJson(h);
  const claims = b64urlJson(p);
  if (!header || !claims) return { ok: false, reason: 'malformed' };
  if (header.alg !== 'RS256' || typeof header.kid !== 'string') return { ok: false, reason: 'malformed' };

  const jwk = (await keys()).find((k) => k.kid === header.kid);
  if (!jwk) return { ok: false, reason: 'bad_signature' };

  let good = false;
  try {
    const key = createPublicKey({ key: jwk, format: 'jwk' });
    good = verifySignature('RSA-SHA256', Buffer.from(`${h}.${p}`), key, Buffer.from(s, 'base64url'));
  } catch {
    good = false;
  }
  if (!good) return { ok: false, reason: 'bad_signature' };

  if (claims.aud !== projectId || claims.iss !== `https://securetoken.google.com/${projectId}`) {
    return { ok: false, reason: 'wrong_project' };
  }
  const exp = Number(claims.exp);
  const iat = Number(claims.iat);
  const authTime = Number(claims.auth_time);
  if (!Number.isFinite(exp) || exp + SKEW_SECONDS < nowSeconds) return { ok: false, reason: 'expired' };
  if (!Number.isFinite(iat) || iat - SKEW_SECONDS > nowSeconds) return { ok: false, reason: 'malformed' };
  if (!Number.isFinite(authTime) || authTime - SKEW_SECONDS > nowSeconds) return { ok: false, reason: 'malformed' };
  if (typeof claims.sub !== 'string' || !claims.sub) return { ok: false, reason: 'malformed' };

  const firebase = (claims.firebase ?? {}) as { sign_in_provider?: unknown };
  const phone = claims.phone_number;
  if (firebase.sign_in_provider !== 'phone' || typeof phone !== 'string' || !phone) {
    return { ok: false, reason: 'not_phone' };
  }
  return { ok: true, phone, uid: claims.sub };
}

// ── Google's keys, cached for as long as Google says ───────────────────

let cache: { keys: Jwk[]; until: number } | null = null;

async function googleKeys(): Promise<Jwk[]> {
  if (cache && cache.until > Date.now()) return cache.keys;
  const res = await fetch(JWKS_URL, { cache: 'no-store' });
  if (!res.ok) throw new Error(`Firebase keys: HTTP ${res.status}`);
  const body = (await res.json()) as { keys?: Jwk[] };
  const maxAge = Number(/max-age=(\d+)/.exec(res.headers.get('cache-control') ?? '')?.[1] ?? 3600);
  cache = { keys: body.keys ?? [], until: Date.now() + Math.min(maxAge, 6 * 3600) * 1000 };
  return cache.keys;
}
