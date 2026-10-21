import { describe, expect, it } from 'vitest';
import { createHmac } from 'node:crypto';
import {
  attributionFor,
  budgetPaiseFrom,
  configFrom,
  formToObject,
  graphError,
  graphLeadUrl,
  onSeenAgain,
  parseGeneric,
  parseGoogle,
  parseMetaLead,
  parseMetaWebhook,
  parsePageTokens,
  shapeLead,
  slotFor,
  RECLAIM_AFTER_MS,
  GOOGLE_SOURCE_NAME,
} from '@/modules/studio-intake/payloads';
import { fallbackExternalId, hashSecret, KEY_PREFIX, newSecret, secretMatches, verifyMetaSignature } from '@/modules/studio-intake/secrets';

/**
 * Lead intake (21 Oct 2026; docs/studio-os/LEAD-INTAKE.md): Meta lead ads,
 * Google lead forms, the website and portals landing leads on the board.
 */

describe('door keys', () => {
  it('a new key is prefixed, long and different every time', () => {
    const a = newSecret();
    const b = newSecret();
    expect(a.startsWith(KEY_PREFIX)).toBe(true);
    expect(a.length).toBeGreaterThan(40);
    expect(a).not.toBe(b);
  });

  it('only the hash is kept, and the key matches its own hash', () => {
    const key = newSecret();
    const hash = hashSecret(key);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hash).not.toContain(key);
    expect(secretMatches(key, hash)).toBe(true);
    expect(secretMatches(` ${key} `, hash)).toBe(true);
  });

  it('refuses a wrong, empty or missing key, and a malformed stored hash', () => {
    const hash = hashSecret(newSecret());
    expect(secretMatches(newSecret(), hash)).toBe(false);
    expect(secretMatches('', hash)).toBe(false);
    expect(secretMatches(null, hash)).toBe(false);
    expect(secretMatches('x', 'not-a-hash')).toBe(false);
    expect(secretMatches('x', null)).toBe(false);
  });
});

describe("Meta's signature", () => {
  const secret = 'test-app-secret';
  const body = '{"object":"page","entry":[]}';
  const sign = (b: string, s = secret) => `sha256=${createHmac('sha256', s).update(b).digest('hex')}`;

  it('accepts the HMAC of the exact body', () => {
    expect(verifyMetaSignature(body, sign(body), secret)).toBe(true);
    expect(verifyMetaSignature(body, sign(body).toUpperCase().replace('SHA256=', 'sha256='), secret)).toBe(true);
  });

  it('refuses a changed body, another secret, a bad header, or no secret at all', () => {
    expect(verifyMetaSignature(`${body} `, sign(body), secret)).toBe(false);
    expect(verifyMetaSignature(body, sign(body, 'other'), secret)).toBe(false);
    expect(verifyMetaSignature(body, 'sha1=abc', secret)).toBe(false);
    expect(verifyMetaSignature(body, null, secret)).toBe(false);
    expect(verifyMetaSignature(body, sign(body), '')).toBe(false);
    expect(verifyMetaSignature(body, sign(body), undefined)).toBe(false);
  });
});

describe('each lead once', () => {
  const now = new Date('2026-10-21T10:00:00Z');
  it('a landed or attached lead is never landed again', () => {
    expect(onSeenAgain({ status: 'LANDED', updatedAt: now }, now)).toBe('skip');
    expect(onSeenAgain({ status: 'DUPLICATE', updatedAt: new Date(0) }, now)).toBe('skip');
  });

  it('a failed one may be tried again', () => {
    expect(onSeenAgain({ status: 'FAILED', updatedAt: now }, now)).toBe('retry');
  });

  it('one being worked on is left alone, unless it has been stuck ten minutes', () => {
    expect(onSeenAgain({ status: 'RECEIVED', updatedAt: new Date(now.getTime() - 60_000) }, now)).toBe('skip');
    expect(onSeenAgain({ status: 'RECEIVED', updatedAt: new Date(now.getTime() - RECLAIM_AFTER_MS) }, now)).toBe('retry');
  });

  it('with no id from the sender, the same person in the same minute is one lead', () => {
    const t = new Date('2026-10-21T10:00:10Z');
    expect(fallbackExternalId('9876543210', t)).toBe(fallbackExternalId(' 9876543210 ', new Date('2026-10-21T10:00:50Z')));
    expect(fallbackExternalId('9876543210', t)).not.toBe(fallbackExternalId('9876543210', new Date('2026-10-21T10:01:01Z')));
    expect(fallbackExternalId('9876543210', t)).not.toBe(fallbackExternalId('9876543211', t));
    expect(fallbackExternalId('9876543210', t)).toMatch(/^h:[0-9a-f]{40}$/);
  });
});

describe('the generic door: website, portals, tools', () => {
  it('reads the usual spellings', () => {
    const lead = parseGeneric({
      full_name: 'Asha Patil',
      'Mobile Number': '+91 98765 43210',
      Email: 'asha@example.com',
      area: 'Baner',
      Society: 'Pristine Greens',
      BHK: '3 BHK flat',
      budget: '25 lakh',
      message: 'Kitchen and wardrobes',
      utm_source: '99acres',
      utm_campaign: 'oct-kitchens',
      lead_id: 'P-1001',
      key: 'oik_secret',
      'Possession date': 'March 2027',
    });
    expect(lead).toMatchObject({
      name: 'Asha Patil',
      phone: '+91 98765 43210',
      email: 'asha@example.com',
      locality: 'Baner',
      society: 'Pristine Greens',
      config: '3 BHK flat',
      budget: '25 lakh',
      message: 'Kitchen and wardrobes',
      sourceHint: '99acres',
      externalId: 'P-1001',
    });
    expect(lead.attribution).toEqual(['oct-kitchens']);
    expect(lead.answers).toEqual([{ question: 'Possession date', answer: 'March 2027' }]);
    /* The key is never put on the lead. */
    expect(JSON.stringify(lead)).not.toContain('oik_secret');
  });

  it('joins a first and last name, and unwraps { lead: {...} }', () => {
    const lead = parseGeneric({ source: 'Housing.com', lead: { first_name: 'Ravi', last_name: 'Kulkarni', phone: '9822012345' } });
    expect(lead.name).toBe('Ravi Kulkarni');
    expect(lead.phone).toBe('9822012345');
    expect(lead.sourceHint).toBe('Housing.com');
  });

  it('reads a form-encoded body', () => {
    const lead = parseGeneric(formToObject(new URLSearchParams('name=Meera&phone=09876543210&locality=Wakad')));
    expect(lead).toMatchObject({ name: 'Meera', phone: '09876543210', locality: 'Wakad' });
  });

  it('is not fooled by junk', () => {
    expect(parseGeneric(null).name).toBeNull();
    expect(parseGeneric([1, 2]).phone).toBeNull();
    expect(parseGeneric({ name: { evil: true }, phone: 9876543210 }).phone).toBe('9876543210');
  });

  it('recognises an advertiser’s own wording', () => {
    expect(slotFor('What is your budget?')).toBe('budget');
    expect(slotFor('Buget Range')).toBe('budget');
    expect(slotFor('Flat type (BHK)')).toBe('config');
    expect(slotFor('WhatsApp number')).toBe('phone');
    expect(slotFor('Area in Pune')).toBe('locality');
    expect(slotFor('Carpet area sq ft')).toBeNull();
  });
});

describe('Google lead forms', () => {
  const body = {
    lead_id: 'TeSter-123-ABCDEFGHIJKLMNOPQRSTUVWXYZ',
    api_version: '1.0',
    form_id: 40000000000,
    campaign_id: 12345678901,
    google_key: 'oik_googlekey',
    is_test: false,
    user_column_data: [
      { column_name: 'Full Name', string_value: 'Sonal Joshi', column_id: 'FULL_NAME' },
      { column_name: 'User Phone', string_value: '+919890012345', column_id: 'PHONE_NUMBER' },
      { column_name: 'User Email', string_value: 'sonal@example.com', column_id: 'EMAIL' },
      { column_name: 'City', string_value: 'pune', column_id: 'CITY' },
      { column_name: 'Flat type (BHK)', string_value: '2 BHK', column_id: 'flat_type' },
      { column_name: 'When do you get possession?', string_value: 'Next month', column_id: 'possession' },
    ],
  };

  it('reads the key, the lead id and the columns', () => {
    const g = parseGoogle(body);
    expect(g.googleKey).toBe('oik_googlekey');
    expect(g.leadId).toBe('TeSter-123-ABCDEFGHIJKLMNOPQRSTUVWXYZ');
    expect(g.isTest).toBe(false);
    expect(g.lead).toMatchObject({ name: 'Sonal Joshi', phone: '+919890012345', email: 'sonal@example.com', city: 'pune', config: '2 BHK' });
    expect(g.lead.answers).toEqual([{ question: 'When do you get possession?', answer: 'Next month' }]);
    expect(g.lead.attribution).toEqual(['campaign 12345678901', 'form 40000000000']);
  });

  it('knows a test, and joins first and last names', () => {
    const g = parseGoogle({
      is_test: true,
      user_column_data: [
        { column_id: 'FIRST_NAME', string_value: 'A' },
        { column_id: 'LAST_NAME', string_value: 'B' },
      ],
    });
    expect(g.isTest).toBe(true);
    expect(g.lead.name).toBe('A B');
    expect(g.googleKey).toBeNull();
  });

  it('counts under the studio’s own “Google lead form” source', () => {
    const a = attributionFor('GOOGLE_LEAD_FORM', 'Kitchens', parseGoogle(body).lead);
    expect(a.source).toBe('OTHER');
    expect(a.leadSourceName).toBe(GOOGLE_SOURCE_NAME);
    expect(a.sourceNote).toContain('campaign 12345678901');
  });
});

describe('Meta lead ads', () => {
  const webhook = {
    object: 'page',
    entry: [
      {
        id: '102030405060',
        time: 1760000000,
        changes: [
          { field: 'leadgen', value: { leadgen_id: '987654321012345', page_id: '102030405060', form_id: '555', created_time: 1760000000 } },
          { field: 'feed', value: { item: 'post' } },
          { field: 'leadgen', value: { leadgen_id: 'not-digits', page_id: '102030405060' } },
        ],
      },
      { id: '999', changes: [{ field: 'leadgen', value: { leadgen_id: 111222333 } }] },
    ],
  };

  it('finds the leads in a webhook, page id from the entry when the change has none', () => {
    expect(parseMetaWebhook(webhook)).toEqual([
      { pageId: '102030405060', leadgenId: '987654321012345', formId: '555' },
      { pageId: '999', leadgenId: '111222333', formId: null },
    ]);
    expect(parseMetaWebhook({})).toEqual([]);
    expect(parseMetaWebhook(null)).toEqual([]);
  });

  const graph = {
    id: '987654321012345',
    created_time: '2026-10-21T09:58:00+0000',
    ad_name: 'Kitchen reel',
    adset_name: 'PW Pune 25-45',
    campaign_name: 'Oct kitchens',
    form_id: '555',
    platform: 'ig',
    field_data: [
      { name: 'full_name', values: ['Priya Deshmukh'] },
      { name: 'phone_number', values: ['+919765432100'] },
      { name: 'email', values: ['priya@example.com'] },
      { name: 'city', values: ['Pune'] },
      { name: 'which_area_in_pune?', values: ['Hinjewadi'] },
      { name: 'flat_type', values: ['3_bhk'] },
      { name: 'what_is_your_budget?', values: ['15-25_lakh'] },
      { name: 'when_do_you_want_to_start?', values: ['within_1_month'] },
    ],
  };

  it('maps field_data, the platform and the campaign', () => {
    const lead = parseMetaLead(graph);
    expect(lead).toMatchObject({
      name: 'Priya Deshmukh',
      phone: '+919765432100',
      email: 'priya@example.com',
      city: 'Pune',
      locality: 'Hinjewadi',
      config: '3 bhk',
      budget: '15-25 lakh',
      platform: 'INSTAGRAM',
      externalId: '987654321012345',
    });
    expect(lead.answers).toEqual([{ question: 'when_do_you_want_to_start?', answer: 'within 1 month' }]);
    const a = attributionFor('META_PAGE', 'Hauspire Page', lead);
    expect(a.source).toBe('INSTAGRAM');
    expect(a.leadSourceName).toBeNull();
    expect(a.sourceNote).toBe('Meta lead ad (Instagram) · campaign Oct kitchens · ad set PW Pune 25-45 · ad Kitchen reel');
  });

  it('fb, or no platform, is Facebook', () => {
    expect(parseMetaLead({ ...graph, platform: 'fb' }).platform).toBe('FACEBOOK');
    expect(parseMetaLead({ field_data: [] }).platform).toBe('FACEBOOK');
  });

  it('page tokens: plain, tied to a studio, or unreadable', () => {
    const m = parsePageTokens(JSON.stringify({ '102030405060': 'tok-a', '777': { token: 'tok-b', studio: 'hauspire' }, bad: 'x', '888': { nope: 1 } }));
    expect(m.get('102030405060')).toEqual({ token: 'tok-a', studio: null });
    expect(m.get('777')).toEqual({ token: 'tok-b', studio: 'hauspire' });
    expect(m.size).toBe(2);
    expect(parsePageTokens('not json').size).toBe(0);
    expect(parsePageTokens('').size).toBe(0);
    expect(parsePageTokens(undefined).size).toBe(0);
    expect(parsePageTokens('["a"]').size).toBe(0);
  });

  it('the Graph address carries no token, and an error never shows one', () => {
    expect(graphLeadUrl('123')).toBe('https://graph.facebook.com/v21.0/123?fields=created_time,field_data,ad_id,ad_name,adset_name,campaign_name,form_id,platform');
    expect(graphError({ error: { message: 'Invalid OAuth access_token=EAAB123 token' } }, 400)).not.toContain('EAAB123');
    expect(graphError(null, 500)).toBe('Meta did not give the lead: HTTP 500');
  });
});

describe('shaping a lead into a card', () => {
  const base = parseGeneric({});

  it('normalises the phone the way the enquiry form does, so the duplicate check works', () => {
    const r = shapeLead({ ...base, name: 'Asha', phone: '+91 98765-43210' });
    expect(r.ok && r.draft.phone).toBe('9876543210');
  });

  it('keeps what does not fit a column in the notes', () => {
    const r = shapeLead({
      ...base,
      name: 'Asha',
      phone: '9876543210',
      locality: 'Somewhere New',
      config: 'Penthouse',
      budget: '15-25 lakh',
      message: 'Call after 6',
      answers: [{ question: 'Possession', answer: 'March' }],
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.draft.locality).toBeNull();
    expect(r.draft.config).toBeNull();
    expect(r.draft.budgetPaise).toBeNull();
    expect(r.draft.notes).toBe('Call after 6\nArea given as: Somewhere New\nHome given as: Penthouse\nBudget given as: 15-25 lakh\nPossession: March');
  });

  it('a known area becomes its slug, a home its label, an amount paise', () => {
    const r = shapeLead({ ...base, name: 'Asha', phone: '9876543210', locality: 'Baner', config: '3_bhk', budget: '25 lakh', city: 'PUNE' });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.draft.locality).toBe('baner');
    expect(r.draft.config).toBe('3 BHK');
    expect(r.draft.budgetPaise).toBe(25_00_000n * 100n);
    expect(r.draft.city).toBe('Pune');
    expect(r.draft.notes).toBeNull();
  });

  it('a wrong number with an email still lands, the number kept in the notes', () => {
    const r = shapeLead({ ...base, name: 'Asha', phone: '020 2567 8900', email: 'Asha@Example.com' });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.draft.phone).toBeNull();
    expect(r.draft.email).toBe('asha@example.com');
    expect(r.draft.notes).toContain('Phone given as: 020 2567 8900');
  });

  it('nobody to call or write to is refused, with a reason', () => {
    expect(shapeLead({ ...base, name: 'Asha' })).toEqual({ ok: false, error: 'No phone number or email in the lead.' });
    const bad = shapeLead({ ...base, name: 'Asha', phone: '12345' });
    expect(bad.ok).toBe(false);
  });

  it('a lead with no name is named from the email, or plainly', () => {
    const a = shapeLead({ ...base, email: 'ravi.k@example.com' });
    expect(a.ok && a.draft.name).toBe('ravi.k');
    const b = shapeLead({ ...base, phone: '9876543210' });
    expect(b.ok && b.draft.name).toBe('Name not given');
  });
});

describe('homes and budgets', () => {
  it('reads the home', () => {
    expect(configFrom('3 BHK')).toBe('3 BHK');
    expect(configFrom('2bhk')).toBe('2 BHK');
    expect(configFrom('3 bhk')).toBe('3 BHK');
    expect(configFrom('4+ BHK')).toBe('4+ BHK');
    expect(configFrom('5 BHK penthouse')).toBe('4+ BHK');
    expect(configFrom('Row house')).toBe('Villa / Row house');
    expect(configFrom('1 RK')).toBeNull();
    expect(configFrom('Office')).toBeNull();
    expect(configFrom(null)).toBeNull();
  });

  it('reads one amount, in paise, with integer arithmetic', () => {
    expect(budgetPaiseFrom('25 lakh')).toBe(2_500_000n * 100n);
    expect(budgetPaiseFrom('25L')).toBe(2_500_000n * 100n);
    expect(budgetPaiseFrom('1.2 cr')).toBe(12_000_000n * 100n);
    expect(budgetPaiseFrom('₹15,00,000')).toBe(1_500_000n * 100n);
    expect(budgetPaiseFrom('Rs. 800000')).toBe(800_000n * 100n);
    expect(budgetPaiseFrom('under 20 lakhs')).toBe(2_000_000n * 100n);
  });

  it('a range, nonsense or an unbelievable number is not a budget', () => {
    expect(budgetPaiseFrom('10-15 lakh')).toBeNull();
    expect(budgetPaiseFrom('15 to 25 lakhs')).toBeNull();
    expect(budgetPaiseFrom('15 lakh - 25 lakh')).toBeNull();
    expect(budgetPaiseFrom('not sure')).toBeNull();
    expect(budgetPaiseFrom('500')).toBeNull();
    expect(budgetPaiseFrom('900 cr')).toBeNull();
    expect(budgetPaiseFrom(null)).toBeNull();
  });
});

describe('where a lead counts', () => {
  const lead = (sourceHint: string | null) => ({ ...parseGeneric({}), sourceHint });

  it('a website lead is WEBSITE, with its utm words in the note', () => {
    const a = attributionFor('WEBSITE', 'Website', { ...lead('google'), attribution: ['oct'] });
    expect(a).toEqual({ source: 'WEBSITE', leadSourceName: null, sourceNote: 'Website · from google · oct', how: 'your website (Website)' });
  });

  it('a portal names itself, or is named by the door', () => {
    expect(attributionFor('PORTAL', 'Portals', lead('99acres'))).toMatchObject({ source: 'OTHER', leadSourceName: '99acres' });
    expect(attributionFor('PORTAL', 'Housing.com', lead(null))).toMatchObject({ source: 'OTHER', leadSourceName: 'Housing.com' });
  });

  it('a tool that says facebook or instagram counts under ours', () => {
    expect(attributionFor('PORTAL', 'Zapier', lead('facebook')).source).toBe('FACEBOOK');
    expect(attributionFor('PORTAL', 'Zapier', lead('Instagram')).source).toBe('INSTAGRAM');
    expect(attributionFor('PORTAL', 'Zapier', lead('referral')).source).toBe('REFERRAL');
  });
});
