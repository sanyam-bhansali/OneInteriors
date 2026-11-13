import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  NO_CAMPAIGN,
  afterCursor,
  campaignAllowed,
  campaignKey,
  cleanCampaignPick,
  formLeadsUrl,
  loginUrl,
  mergeCampaigns,
  metaApp,
  readAdAccounts,
  readCampaigns,
  readPages,
  readToken,
  seal,
  sealingKey,
  unseal,
} from '@/modules/studio-intake/meta-connect';
import { onSeenAgain } from '@/modules/studio-intake/payloads';

/** Connect Facebook and campaign picking for Meta lead ads (owner, 12 Nov 2026). */

describe('tokens are sealed', () => {
  const key = sealingKey({ SESSION_SECRET: 'a'.repeat(32) })!;
  it('round-trips, and never stores the token in the clear', () => {
    const sealed = seal('EAAB-page-token-123456789', key);
    expect(sealed.startsWith('v1.')).toBe(true);
    expect(sealed).not.toContain('EAAB');
    expect(unseal(sealed, key)).toBe('EAAB-page-token-123456789');
  });
  it('a different key, or a changed byte, opens nothing', () => {
    const sealed = seal('secret-token-value-xyz', key);
    expect(unseal(sealed, sealingKey({ SESSION_SECRET: 'b'.repeat(32) }))).toBeNull();
    const parts = sealed.split('.');
    parts[3] = parts[3]!.slice(0, -2) + (parts[3]!.endsWith('AA') ? 'BB' : 'AA');
    expect(unseal(parts.join('.'), key)).toBeNull();
    expect(unseal('nonsense', key)).toBeNull();
    expect(unseal(sealed, null)).toBeNull();
  });
  it('STUDIO_TOKEN_KEY wins over SESSION_SECRET; nothing set is no key', () => {
    expect(sealingKey({ STUDIO_TOKEN_KEY: 'k'.repeat(32), SESSION_SECRET: 'a'.repeat(32) })!.equals(key)).toBe(false);
    expect(sealingKey({})).toBeNull();
    expect(sealingKey({ SESSION_SECRET: 'short' })).toBeNull();
  });
});

describe('the login', () => {
  it('asks for the lead-ads permissions, with state, and no secret in the address', () => {
    const u = new URL(loginUrl({ appId: '123456789', redirectUri: 'https://studio.example/api/studio/meta/callback', state: 'st8' }));
    expect(u.origin + u.pathname).toBe('https://www.facebook.com/v23.0/dialog/oauth');
    expect(u.searchParams.get('state')).toBe('st8');
    expect(u.searchParams.get('scope')).toContain('leads_retrieval');
    expect(u.searchParams.get('scope')).toContain('pages_manage_metadata');
    expect(u.searchParams.get('scope')).toContain('ads_read');
    expect(u.toString()).not.toContain('secret');
  });
  it('needs both the app id and its secret', () => {
    expect(metaApp({ META_APP_ID: '123456789' })).toBeNull();
    expect(metaApp({ META_APP_ID: 'abc', META_APP_SECRET: 's' })).toBeNull();
    expect(metaApp({ META_APP_ID: '123456789', META_APP_SECRET: 's' })).toEqual({ appId: '123456789', appSecret: 's' });
  });
  it('reads a token answer', () => {
    expect(readToken({ access_token: 'x'.repeat(30), expires_in: 5_000_000 })).toEqual({ token: 'x'.repeat(30), expiresIn: 5_000_000 });
    expect(readToken({ error: {} })).toBeNull();
  });
});

describe('Graph lists', () => {
  it('pages: ids, names, the token kept for the server, and whether they can advertise', () => {
    const pages = readPages({
      data: [
        { id: '111', name: 'Hauspire', access_token: 't'.repeat(40), tasks: ['ADVERTISE', 'ANALYZE'] },
        { id: '222', name: 'Fan page', access_token: 't'.repeat(40), tasks: ['ANALYZE'] },
        { id: 'not-a-page', name: 'x' },
      ],
    });
    expect(pages.map((p) => [p.id, p.canAdvertise])).toEqual([
      ['111', true],
      ['222', false],
    ]);
  });
  it('campaigns: only the lead-gathering ones', () => {
    const c = readCampaigns({
      data: [
        { id: '1', name: 'Baner 3BHK leads', objective: 'OUTCOME_LEADS', effective_status: 'ACTIVE' },
        { id: '2', name: 'Old leads', objective: 'LEAD_GENERATION', effective_status: 'PAUSED' },
        { id: '3', name: 'Reels reach', objective: 'OUTCOME_AWARENESS', effective_status: 'ACTIVE' },
      ],
    });
    expect(c.map((x) => x.id)).toEqual(['1', '2']);
  });
  it('ad accounts are act_ ids', () => {
    expect(readAdAccounts({ data: [{ id: 'act_42', name: 'Main' }, { id: '42' }] })).toEqual([{ id: 'act_42', name: 'Main' }]);
  });
  it('paging uses the cursor, never the next URL (it carries the token)', () => {
    expect(afterCursor({ paging: { cursors: { after: 'QVFI' }, next: 'https://graph.facebook.com/...&access_token=SECRET' } })).toBe('QVFI');
    expect(afterCursor({ paging: { cursors: { after: 'QVFI' } } })).toBeNull();
    const u = formLeadsUrl('555', 1_700_000_000, 'QVFI');
    expect(u).not.toContain('access_token');
    expect(new URL(u).searchParams.get('after')).toBe('QVFI');
    expect(JSON.parse(new URL(u).searchParams.get('filtering')!)).toEqual([{ field: 'time_created', operator: 'GREATER_THAN', value: 1_700_000_000 }]);
  });
});

describe('which campaigns', () => {
  it('every campaign, or only the picked ones; a lead from no ad is its own choice', () => {
    expect(campaignAllowed({ only: false, ids: [] }, '9')).toBe(true);
    expect(campaignAllowed({ only: true, ids: [] }, '9')).toBe(false);
    expect(campaignAllowed({ only: true, ids: ['9'] }, '9')).toBe(true);
    expect(campaignAllowed({ only: true, ids: ['9'] }, null)).toBe(false);
    expect(campaignAllowed({ only: true, ids: [NO_CAMPAIGN] }, null)).toBe(true);
    expect(campaignKey('abc')).toBe(NO_CAMPAIGN);
  });
  it('the pick is cleaned: Meta ids or "none", each once', () => {
    expect(cleanCampaignPick([{ id: '1', name: 'A' }, { id: '1', name: 'A again' }, { id: 'x' }, { id: NO_CAMPAIGN }, 'junk'])).toEqual([
      { id: '1', name: 'A' },
      { id: NO_CAMPAIGN, name: 'Not from an ad (form on the Page)' },
    ]);
    expect(cleanCampaignPick('nope')).toEqual([]);
  });
  it('merged lists keep each campaign once, the live one first', () => {
    const m = mergeCampaigns([{ id: '1', name: 'Live', status: 'ACTIVE' }], [{ id: '1', name: 'Seen', status: null }, { id: '2', name: 'Seen only', status: null }]);
    expect(m).toEqual([
      { id: '1', name: 'Live', status: 'ACTIVE' },
      { id: '2', name: 'Seen only', status: null },
    ]);
  });
  it('a kept-aside lead is not taken again by a resend, only by the picker', () => {
    expect(onSeenAgain({ status: 'SKIPPED', updatedAt: new Date(0) }, new Date())).toBe('skip');
  });
});

describe('source guards', () => {
  const read = (p: string) => readFileSync(p, 'utf8');
  it('the callback checks the state cookie before using the code', () => {
    const src = read('src/app/api/studio/meta/callback/route.ts');
    expect(src.indexOf('same(given, expected)')).toBeLessThan(src.indexOf('finishLogin(code)'));
  });
  it('a viewing developer cannot connect Facebook', () => {
    expect(read('src/modules/studio-intake/meta-account.ts')).toMatch(/member\.viewOnly === true \|\| !can\(member, 'lead\.settings'\)/);
  });
  it('past leads land quietly', () => {
    expect(read('src/modules/studio-intake/intake.ts')).toMatch(/landMetaLead\(door, eventId, lead, true\)/);
  });
  it('no token reaches the settings screen', () => {
    const conn = read('src/modules/studio-intake/connections.ts');
    expect(conn).not.toMatch(/metaTokenSealed: r\.metaTokenSealed/);
    expect(read('src/modules/studio-intake/meta-account.ts')).not.toMatch(/token: p\.token[^)]*}\)\);\s*return screen/);
  });
});
