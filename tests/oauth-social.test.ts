import { describe, it, expect } from 'vitest';
import { createVerify, generateKeyPairSync } from 'node:crypto';
import {
  appSecretProof,
  appleAuthUrl,
  appleClientSecret,
  facebookAuthUrl,
  readAppleIdToken,
  readAppleUser,
  readFacebookProfile,
} from '@/modules/auth/oauth-social';

const NOW = 1_790_000_000;
const token = (claims: object) =>
  `${Buffer.from('{"alg":"RS256"}').toString('base64url')}.${Buffer.from(JSON.stringify(claims)).toString('base64url')}.sig`;

describe('Facebook', () => {
  it('asks for name and email only', () => {
    const url = new URL(facebookAuthUrl({ appId: '123', redirectUri: 'https://x/cb', state: 's' }));
    expect(url.searchParams.get('scope')).toBe('public_profile,email');
    expect(url.searchParams.get('state')).toBe('s');
  });

  it('reads the profile, and refuses one with no usable id', () => {
    expect(readFacebookProfile({ id: '10223', email: 'A@B.in', name: ' Sanyam ' })).toEqual({
      subject: '10223',
      email: 'a@b.in',
      name: 'Sanyam',
    });
    expect(readFacebookProfile({ id: 'abc' })).toBeNull();
    expect(readFacebookProfile({ id: '1' })!.email).toBeNull();
  });

  it('proves the call with an HMAC of the token', () => {
    expect(appSecretProof('tok', 'secret')).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe('Apple', () => {
  it('posts the answer back to us, asking for name and email', () => {
    const url = new URL(appleAuthUrl({ clientId: 'in.oneinteriors.web', redirectUri: 'https://x/cb', state: 's' }));
    expect(url.searchParams.get('response_mode')).toBe('form_post');
    expect(url.searchParams.get('scope')).toBe('name email');
  });

  it('signs a client secret Apple can verify (ES256)', () => {
    const { privateKey, publicKey } = generateKeyPairSync('ec', { namedCurve: 'P-256' });
    const pem = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
    const jwt = appleClientSecret({ teamId: 'TEAM', keyId: 'KEY', clientId: 'in.oneinteriors.web', privateKey: pem, nowSeconds: NOW });
    const [h, b, s] = jwt.split('.');
    expect(JSON.parse(Buffer.from(h!, 'base64url').toString())).toEqual({ alg: 'ES256', kid: 'KEY', typ: 'JWT' });
    const claims = JSON.parse(Buffer.from(b!, 'base64url').toString());
    expect(claims).toMatchObject({ iss: 'TEAM', sub: 'in.oneinteriors.web', aud: 'https://appleid.apple.com' });
    const v = createVerify('SHA256');
    v.update(`${h}.${b}`);
    expect(v.verify({ key: publicKey, dsaEncoding: 'ieee-p1363' }, Buffer.from(s!, 'base64url'))).toBe(true);
  });

  it('checks issuer, audience, expiry and a verified email', () => {
    const good = { iss: 'https://appleid.apple.com', aud: 'web', exp: NOW + 600, sub: '001.abc', email: 'x@privaterelay.appleid.com', email_verified: 'true' };
    const r = readAppleIdToken(token(good), 'web', NOW);
    expect(r.ok && r.identity).toEqual({ subject: '001.abc', email: 'x@privaterelay.appleid.com', name: null });
    expect(readAppleIdToken(token({ ...good, iss: 'x' }), 'web', NOW)).toEqual({ ok: false, reason: 'issuer' });
    expect(readAppleIdToken(token({ ...good, aud: 'other' }), 'web', NOW)).toEqual({ ok: false, reason: 'audience' });
    expect(readAppleIdToken(token({ ...good, exp: NOW - 600 }), 'web', NOW)).toEqual({ ok: false, reason: 'expired' });
    expect(readAppleIdToken(token({ ...good, email_verified: 'false' }), 'web', NOW)).toEqual({ ok: false, reason: 'unverified-email' });
  });

  it('reads the first-time name, and nothing else', () => {
    expect(readAppleUser('{"name":{"firstName":"Sanyam","lastName":"B"},"email":"x"}')).toBe('Sanyam B');
    expect(readAppleUser('not json')).toBeNull();
    expect(readAppleUser(null)).toBeNull();
  });
});
