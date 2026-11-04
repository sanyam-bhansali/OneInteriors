import { generateKeyPairSync, sign, type KeyObject } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { verifyFirebaseToken } from '@/modules/auth/firebase-token';
import { homeProfile } from '@/modules/brief/home-profile';
import { EMPTY_BRIEF, type Brief } from '@/modules/brief/types';

/**
 * Firebase phone sign-in (owner, 4 Nov 2026): we only trust a token Google
 * signed, for our project, by the phone provider, not expired. Tokens here
 * are signed by a key made in the test and served as the "Google" key set.
 */

const PROJECT = 'one-interiors-test';
const NOW = 1_800_000_000;

const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const other = generateKeyPairSync('rsa', { modulusLength: 2048 });
const keys = async () => [{ ...publicKey.export({ format: 'jwk' }), kid: 'k1' }];

function token(claims: Record<string, unknown>, opts: { kid?: string; key?: KeyObject; alg?: string } = {}) {
  const header = Buffer.from(JSON.stringify({ alg: opts.alg ?? 'RS256', kid: opts.kid ?? 'k1', typ: 'JWT' })).toString('base64url');
  const body = Buffer.from(
    JSON.stringify({
      iss: `https://securetoken.google.com/${PROJECT}`,
      aud: PROJECT,
      sub: 'uid-1',
      iat: NOW - 10,
      auth_time: NOW - 10,
      exp: NOW + 3600,
      phone_number: '+919822041736',
      firebase: { sign_in_provider: 'phone' },
      ...claims,
    }),
  ).toString('base64url');
  const sig = sign('RSA-SHA256', Buffer.from(`${header}.${body}`), opts.key ?? privateKey).toString('base64url');
  return `${header}.${body}.${sig}`;
}

describe('checking the Firebase token', () => {
  it('accepts a phone token Google signed for our project', async () => {
    expect(await verifyFirebaseToken(token({}), PROJECT, keys, NOW)).toEqual({ ok: true, phone: '+919822041736', uid: 'uid-1' });
  });

  it('refuses a token signed by any other key', async () => {
    expect(await verifyFirebaseToken(token({}, { key: other.privateKey }), PROJECT, keys, NOW)).toMatchObject({ ok: false, reason: 'bad_signature' });
    expect(await verifyFirebaseToken(token({}, { kid: 'unknown' }), PROJECT, keys, NOW)).toMatchObject({ ok: false, reason: 'bad_signature' });
  });

  it('refuses a body changed after signing (a different number)', async () => {
    const [h, , s] = token({}).split('.');
    const forged = Buffer.from(JSON.stringify({ phone_number: '+919999999999' })).toString('base64url');
    expect(await verifyFirebaseToken(`${h}.${forged}.${s}`, PROJECT, keys, NOW)).toMatchObject({ ok: false });
  });

  it('refuses another project, an expired token, and non-RS256', async () => {
    expect(await verifyFirebaseToken(token({ aud: 'someone-else' }), PROJECT, keys, NOW)).toMatchObject({ reason: 'wrong_project' });
    expect(await verifyFirebaseToken(token({ iss: 'https://securetoken.google.com/x' }), PROJECT, keys, NOW)).toMatchObject({ reason: 'wrong_project' });
    expect(await verifyFirebaseToken(token({ exp: NOW - 120 }), PROJECT, keys, NOW)).toMatchObject({ reason: 'expired' });
    expect(await verifyFirebaseToken(token({ iat: NOW + 600 }), PROJECT, keys, NOW)).toMatchObject({ reason: 'malformed' });
    expect(await verifyFirebaseToken(token({}, { alg: 'none' }), PROJECT, keys, NOW)).toMatchObject({ reason: 'malformed' });
    expect(await verifyFirebaseToken('not-a-token', PROJECT, keys, NOW)).toMatchObject({ reason: 'malformed' });
  });

  it('refuses a sign-in that did not prove a phone number', async () => {
    expect(await verifyFirebaseToken(token({ firebase: { sign_in_provider: 'google.com' } }), PROJECT, keys, NOW)).toMatchObject({ reason: 'not_phone' });
    expect(await verifyFirebaseToken(token({ phone_number: undefined }), PROJECT, keys, NOW)).toMatchObject({ reason: 'not_phone' });
  });
});

describe('My Home Profile', () => {
  const brief: Brief = {
    ...EMPTY_BRIEF,
    contactName: 'Priya Sharma',
    propertyType: 'BHK_3',
    carpetAreaSqft: 1180,
    locality: 'baner',
    scope: 'FULL_HOME',
    tier: 'PREMIUM',
    styleLikes: ['warm-modern', 'japandi'],
    styleDislikes: ['luxe-glam'],
    household: { adults: 2, children: 1, elderly: 0, pets: false, worksFromHome: true },
    priorityRanking: ['MATERIAL_QUALITY', 'BUDGET'],
    involvement: 'COLLABORATE',
    completedAt: '2026-11-04T10:00:00.000Z',
    lastStep: 12,
  };

  it('is named for them, with their home, plan and style DNA on top', () => {
    const p = homeProfile(brief, 'Priya Sharma');
    expect(p.title).toBe("Priya's Home Profile");
    expect(p.homeLine).toMatch(/^3 BHK · 1,180 sq ft · Baner$/);
    expect(p.planLine).toMatch(/Premium$/);
    expect(p.dna?.shares.map((s) => s.label)).toEqual(['Warm Modern', 'Japandi']);
    expect(p.complete).toBe(true);
  });

  it('groups every answer given, and leaves out what was not answered', () => {
    const p = homeProfile(brief, null);
    expect(p.groups.map((g) => g.id)).toEqual(['home', 'work', 'budget', 'style', 'family', 'ways']);
    const style = p.groups.find((g) => g.id === 'style')!;
    expect(style.answers).toEqual([
      { label: 'Likes', value: 'Warm Modern, Japandi' },
      { label: 'Rules out', value: 'Luxe Glam' },
    ]);
    expect(p.groups.flatMap((g) => g.answers).some((a) => a.label === 'Language')).toBe(false);
  });

  it('says "Your Home Profile" before a name, and is empty before any answer', () => {
    const p = homeProfile(EMPTY_BRIEF, null);
    expect(p.title).toBe('Your Home Profile');
    expect(p.groups).toEqual([]);
    expect(p.dna).toBeNull();
    expect(p.complete).toBe(false);
  });
});
