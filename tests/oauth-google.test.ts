import { describe, it, expect } from 'vitest';
import { createHash } from 'node:crypto';
import {
  challengeFor,
  decideLink,
  googleAuthUrl,
  newOAuthSecret,
  readGoogleIdToken,
} from '@/modules/auth/oauth-google';

/**
 * Sign in with Google — the rules. docs/CUSTOMER-JOURNEY-PLAN.md §3.
 */

const CLIENT = 'client-123.apps.googleusercontent.com';
const NOW = 1_790_000_000;

/** An unsigned token with these claims — signature is not checked (see module). */
function token(claims: Record<string, unknown>): string {
  const part = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64url');
  return `${part({ alg: 'RS256' })}.${part(claims)}.sig`;
}

const GOOD = {
  iss: 'https://accounts.google.com',
  aud: CLIENT,
  exp: NOW + 3600,
  sub: '1098765',
  email: 'Sanyam@Example.com',
  email_verified: true,
  name: 'Sanyam Bhansali',
};

describe('the link to Google', () => {
  it('asks for name and email only, with PKCE and a state', () => {
    const verifier = newOAuthSecret();
    const url = new URL(
      googleAuthUrl({ clientId: CLIENT, redirectUri: 'https://x/cb', state: 's1', verifier }),
    );
    expect(url.searchParams.get('scope')).toBe('openid email profile');
    expect(url.searchParams.get('state')).toBe('s1');
    expect(url.searchParams.get('code_challenge_method')).toBe('S256');
    expect(url.searchParams.get('code_challenge')).toBe(challengeFor(verifier));
    expect(url.searchParams.get('response_type')).toBe('code');
  });

  it('computes the S256 challenge the standard way', () => {
    const verifier = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk';
    expect(challengeFor(verifier)).toBe(createHash('sha256').update(verifier).digest('base64url'));
    // RFC 7636 Appendix B's worked example.
    expect(challengeFor(verifier)).toBe('E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM');
  });

  it('never repeats a secret', () => {
    expect(newOAuthSecret()).not.toBe(newOAuthSecret());
  });
});

describe('readGoogleIdToken', () => {
  it('reads a good token, lower-casing the email', () => {
    const result = readGoogleIdToken(token(GOOD), CLIENT, NOW);
    expect(result).toEqual({
      ok: true,
      identity: {
        subject: '1098765',
        email: 'sanyam@example.com',
        emailVerified: true,
        name: 'Sanyam Bhansali',
      },
    });
  });

  it('refuses a token for another app, from another issuer, or expired', () => {
    expect(readGoogleIdToken(token({ ...GOOD, aud: 'someone-else' }), CLIENT, NOW)).toEqual({
      ok: false,
      reason: 'audience',
    });
    expect(readGoogleIdToken(token({ ...GOOD, iss: 'https://evil.example' }), CLIENT, NOW)).toEqual({
      ok: false,
      reason: 'issuer',
    });
    expect(readGoogleIdToken(token({ ...GOOD, exp: NOW - 3600 }), CLIENT, NOW)).toEqual({
      ok: false,
      reason: 'expired',
    });
  });

  // The email is what an account is found by. An unverified one would let
  // somebody sign in as whoever owns that address here.
  it('refuses an unverified email', () => {
    expect(readGoogleIdToken(token({ ...GOOD, email_verified: false }), CLIENT, NOW)).toEqual({
      ok: false,
      reason: 'unverified-email',
    });
  });

  it('refuses anything that is not a token', () => {
    expect(readGoogleIdToken('nope', CLIENT, NOW)).toEqual({ ok: false, reason: 'malformed' });
    expect(readGoogleIdToken('a.!!!.c', CLIENT, NOW)).toEqual({ ok: false, reason: 'malformed' });
    expect(readGoogleIdToken(token({ ...GOOD, sub: '' }), CLIENT, NOW)).toEqual({
      ok: false,
      reason: 'malformed',
    });
  });
});

describe('decideLink', () => {
  const customer = { id: 'u1', role: 'CUSTOMER' as const, deleted: false };
  const studio = { id: 'u2', role: 'STUDIO' as const, deleted: false };

  it('signs in the account a Google login is already linked to', () => {
    expect(decideLink({ linkedUser: customer, emailUser: null })).toEqual({
      kind: 'sign-in',
      userId: 'u1',
    });
  });

  it('links Google to an existing customer with the same verified email', () => {
    expect(decideLink({ linkedUser: null, emailUser: customer })).toEqual({ kind: 'link', userId: 'u1' });
  });

  it('creates a customer when nobody has that email', () => {
    expect(decideLink({ linkedUser: null, emailUser: null })).toEqual({ kind: 'create' });
  });

  /**
   * The rule that matters most. A studio or ops account is approved by us and
   * holds a price list and clients' numbers; attaching a Google login to it
   * automatically would hand all of that to whoever controls the Google
   * account.
   */
  it('never links or signs in a studio or ops account', () => {
    expect(decideLink({ linkedUser: null, emailUser: studio })).toEqual({ kind: 'refuse-staff' });
    expect(decideLink({ linkedUser: studio, emailUser: null })).toEqual({ kind: 'refuse-staff' });
    expect(
      decideLink({ linkedUser: null, emailUser: { id: 'u3', role: 'OPS', deleted: false } }),
    ).toEqual({ kind: 'refuse-staff' });
  });

  it('refuses a deleted account', () => {
    expect(decideLink({ linkedUser: { ...customer, deleted: true }, emailUser: null })).toEqual({
      kind: 'refuse-deleted',
    });
  });
});
