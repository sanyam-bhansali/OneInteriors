import { describe, expect, it } from 'vitest';
import {
  CAPI_EVENTS,
  MAX_ATTEMPTS,
  cleanCapiStages,
  defaultEventFor,
  eventForStage,
  eventsForMoves,
  parseCapiConfig,
  readCapiStages,
  stillToSend,
  type CapiConfig,
} from '@/modules/studio-intake/capi-rules';
import {
  buildConversionEvent,
  capiError,
  capiUrl,
  metaEmail,
  metaPhone,
  postConversions,
  requestBody,
  sha256Hex,
  type FetchLike,
} from '@/modules/studio-intake/capi-payload';

/**
 * Meta conversion feedback (owner, 22 Oct 2026): which column sends which
 * event, the studio's set-up from env, and the exact Conversions API request.
 * No network: `postConversions` is handed a fake fetch. All ids, tokens and
 * people here are invented.
 */

const FAKE_TOKEN = 'FAKE-TEST-TOKEN-not-a-real-one';
const cfg: CapiConfig = { datasetId: '100000000000001', token: FAKE_TOKEN, testEventCode: null };

describe('which column tells Meta what', () => {
  it('defaults: booked or handed over is a customer, nothing else sends', () => {
    expect(defaultEventFor('WON')).toBe('ConvertedLead');
    expect(defaultEventFor('DONE')).toBe('ConvertedLead');
    expect(defaultEventFor('OPEN')).toBeNull();
    expect(defaultEventFor('LOST')).toBeNull();
    expect(CAPI_EVENTS.map((e) => e.name)).toEqual(['Contacted', 'QualifiedLead', 'ConvertedLead']);
  });

  it('the owner’s choice wins, including "nothing" on a won column', () => {
    const map = readCapiStages({ v: 1, stages: { s_effective: 'QualifiedLead', s_won: null, s_calling: 'Contacted', s_bad: 'Purchase' } });
    expect(map).toEqual({ s_effective: 'QualifiedLead', s_won: null, s_calling: 'Contacted' });
    expect(eventForStage({ id: 's_effective', kind: 'OPEN' }, map)).toBe('QualifiedLead');
    expect(eventForStage({ id: 's_won', kind: 'WON' }, map)).toBeNull();
    expect(eventForStage({ id: 's_other_won', kind: 'WON' }, map)).toBe('ConvertedLead');
    expect(eventForStage({ id: 's_new', kind: 'OPEN' }, map)).toBeNull();
  });

  it('reads junk as nothing chosen', () => {
    for (const junk of [null, 'x', [], { stages: [] }, { stages: 'x' }]) expect(readCapiStages(junk)).toEqual({});
  });

  it('keeps only the studio’s own columns when saving', () => {
    const stages = [
      { id: 's1', kind: 'OPEN' as const },
      { id: 's2', kind: 'WON' as const },
    ];
    expect(cleanCapiStages({ s1: 'QualifiedLead', s2: '', s3: 'ConvertedLead', s4: 'Nonsense' }, stages)).toEqual({ v: 1, stages: { s1: 'QualifiedLead', s2: null } });
    expect(cleanCapiStages('junk', stages)).toEqual({ v: 1, stages: {} });
    expect(cleanCapiStages({ s1: 'NONE' }, stages)).toEqual({ v: 1, stages: { s1: null } });
  });

  it('queues only Meta lead-ad leads, only into a column that sends, once per lead and event', () => {
    const leads = new Map([
      ['meta-lead', { leadgenId: '1234567890123456' }],
      ['website-lead', { leadgenId: null }],
    ]);
    const stages = new Map<string, 'OPEN' | 'WON' | 'DONE' | 'LOST'>([
      ['calling', 'OPEN'],
      ['booked', 'WON'],
      ['handed', 'DONE'],
      ['lost', 'LOST'],
    ]);
    const out = eventsForMoves(
      [
        { clientId: 'meta-lead', toStageId: 'calling' },
        { clientId: 'meta-lead', toStageId: 'booked' },
        { clientId: 'meta-lead', toStageId: 'handed' },
        { clientId: 'meta-lead', toStageId: 'lost' },
        { clientId: 'website-lead', toStageId: 'booked' },
        { clientId: 'unknown', toStageId: 'booked' },
        { clientId: 'meta-lead', toStageId: 'not-a-column' },
      ],
      leads,
      stages,
      {},
    );
    expect(out).toEqual([{ clientId: 'meta-lead', stageId: 'booked', eventName: 'ConvertedLead' }]);
  });

  it('a row is sent at most five times', () => {
    expect(MAX_ATTEMPTS).toBe(5);
    expect(stillToSend({ status: 'QUEUED', attempts: 0 })).toBe(true);
    expect(stillToSend({ status: 'FAILED', attempts: 4 })).toBe(true);
    expect(stillToSend({ status: 'FAILED', attempts: 5 })).toBe(false);
    expect(stillToSend({ status: 'SENT', attempts: 1 })).toBe(false);
    expect(stillToSend({ status: 'SKIPPED', attempts: 0 })).toBe(false);
  });
});

describe('STUDIO_META_CAPI', () => {
  const raw = JSON.stringify({
    hauspire: { datasetId: '100000000000001', token: FAKE_TOKEN },
    other: { datasetId: 100000000000002, token: FAKE_TOKEN, testEventCode: 'TEST12345' },
    bad1: { datasetId: 'abc', token: FAKE_TOKEN },
    bad2: { datasetId: '100000000000003', token: 'short' },
    bad3: 'x',
  });

  it('finds the studio by slug, never anyone else’s', () => {
    expect(parseCapiConfig(raw, 'hauspire')).toEqual({ datasetId: '100000000000001', token: FAKE_TOKEN, testEventCode: null });
    expect(parseCapiConfig(raw, 'other')).toEqual({ datasetId: '100000000000002', token: FAKE_TOKEN, testEventCode: 'TEST12345' });
    for (const slug of ['bad1', 'bad2', 'bad3', 'missing', '']) expect(parseCapiConfig(raw, slug)).toBeNull();
  });

  it('missing or unreadable is "not set up", never a throw', () => {
    expect(parseCapiConfig(undefined, 'hauspire')).toBeNull();
    expect(parseCapiConfig('', 'hauspire')).toBeNull();
    expect(parseCapiConfig('{not json', 'hauspire')).toBeNull();
    expect(parseCapiConfig('[1]', 'hauspire')).toBeNull();
  });
});

describe('normalising before hashing', () => {
  it('phones become country code and number, digits only', () => {
    expect(metaPhone('9876543210')).toBe('919876543210');
    expect(metaPhone('+91 98765 43210')).toBe('919876543210');
    expect(metaPhone('09876543210')).toBe('919876543210');
    expect(metaPhone('919876543210')).toBe('919876543210');
    expect(metaPhone('+1 415 555 0100')).toBe('14155550100');
    expect(metaPhone('12345')).toBeNull();
    expect(metaPhone(null)).toBeNull();
  });

  it('emails are trimmed and lower-cased', () => {
    expect(metaEmail('  Asha@Example.COM ')).toBe('asha@example.com');
    expect(metaEmail('not an email')).toBeNull();
    expect(metaEmail(null)).toBeNull();
  });

  it('SHA-256 is lower-case hex of the normalised value', () => {
    expect(sha256Hex('919876543210')).toBe('92b5072176e723878b5e06ff3ca61898e4eb74e8c46642a0f2db800b17364ab0');
    expect(sha256Hex('asha@example.com')).toBe('ea4e36a829983d27e865b649cd10fcb61f2f1bcd857b47ab709e7adbe941ab68');
  });
});

describe('the payload, byte for byte', () => {
  const event = buildConversionEvent({
    eventName: 'QualifiedLead',
    eventTime: new Date('2026-10-22T08:00:00Z'),
    leadgenId: '1234567890123456789',
    phone: '9876543210',
    email: 'Asha@Example.com',
  })!;

  it('has Meta’s conversion-leads shape', () => {
    expect(event).toEqual({
      event_name: 'QualifiedLead',
      event_time: 1792656000,
      event_id: 'oi_1234567890123456789_qualifiedlead',
      action_source: 'system_generated',
      user_data: {
        lead_id: '1234567890123456789',
        ph: ['92b5072176e723878b5e06ff3ca61898e4eb74e8c46642a0f2db800b17364ab0'],
        em: ['ea4e36a829983d27e865b649cd10fcb61f2f1bcd857b47ab709e7adbe941ab68'],
      },
      custom_data: { lead_event_source: 'One Interiors', event_source: 'crm' },
    });
  });

  it('writes lead_id as the exact JSON number, past what a JS number can hold', () => {
    expect(requestBody([event])).toBe(
      '{"data":[{"event_name":"QualifiedLead","event_time":1792656000,"event_id":"oi_1234567890123456789_qualifiedlead","action_source":"system_generated","user_data":{"lead_id":1234567890123456789,"ph":["92b5072176e723878b5e06ff3ca61898e4eb74e8c46642a0f2db800b17364ab0"],"em":["ea4e36a829983d27e865b649cd10fcb61f2f1bcd857b47ab709e7adbe941ab68"]},"custom_data":{"lead_event_source":"One Interiors","event_source":"crm"}}]}',
    );
    expect(requestBody([event], 'TEST12345')).toMatch(/,"test_event_code":"TEST12345"}$/);
  });

  it('leaves out a phone or email it does not have, and refuses a lead id that is not Meta’s', () => {
    const bare = buildConversionEvent({ eventName: 'ConvertedLead', eventTime: new Date(0), leadgenId: '555', phone: null, email: 'nope' })!;
    expect(bare.user_data).toEqual({ lead_id: '555' });
    expect(buildConversionEvent({ eventName: 'ConvertedLead', eventTime: new Date(0), leadgenId: 'test-leadgen-1', phone: null, email: null })).toBeNull();
  });

  it('nothing unhashed leaves', () => {
    const body = requestBody([event]);
    expect(body).not.toContain('9876543210');
    expect(body.toLowerCase()).not.toContain('asha@example.com');
  });
});

describe('sending', () => {
  const event = buildConversionEvent({ eventName: 'ConvertedLead', eventTime: new Date('2026-10-22T08:00:00Z'), leadgenId: '1234567890123456', phone: '9876543210', email: null })!;

  function fakeFetch(answer: { ok: boolean; status: number; body?: unknown } | Error) {
    const calls: { url: string; init: Parameters<FetchLike>[1] }[] = [];
    const impl: FetchLike = async (url, init) => {
      calls.push({ url, init });
      if (answer instanceof Error) throw answer;
      return { ok: answer.ok, status: answer.status, json: async () => answer.body ?? {} };
    };
    return { impl, calls };
  }

  it('POSTs to the dataset, the token in the Authorization header only', async () => {
    const f = fakeFetch({ ok: true, status: 200, body: { events_received: 1 } });
    expect(await postConversions(f.impl, cfg, [event])).toEqual({ ok: true });
    expect(f.calls).toHaveLength(1);
    const [call] = f.calls;
    expect(call!.url).toBe('https://graph.facebook.com/v21.0/100000000000001/events');
    expect(call!.url).not.toContain(FAKE_TOKEN);
    expect(call!.init.method).toBe('POST');
    expect(call!.init.headers).toEqual({ 'content-type': 'application/json', authorization: `Bearer ${FAKE_TOKEN}` });
    expect(call!.init.body).not.toContain(FAKE_TOKEN);
    expect(call!.init.body).toBe(requestBody([event]));
    expect(capiUrl('42')).toBe('https://graph.facebook.com/v21.0/42/events');
  });

  it('a refusal comes back as Meta’s words, with no token in them', async () => {
    const f = fakeFetch({ ok: false, status: 400, body: { error: { message: `Invalid parameter access_token=${FAKE_TOKEN} EAABtesttesttesttest` } } });
    const r = await postConversions(f.impl, cfg, [event]);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error).toMatch(/^Meta did not take it: Invalid parameter/);
    expect(r.error).not.toContain(FAKE_TOKEN);
    expect(r.error).not.toContain('EAABtesttesttesttest');
    expect(capiError(null, 503)).toBe('HTTP 503');
  });

  it('a network failure is a failure to try again, never a throw', async () => {
    const f = fakeFetch(new Error('ECONNRESET'));
    expect(await postConversions(f.impl, cfg, [event])).toEqual({ ok: false, error: 'Meta could not be reached. It will be tried again tomorrow.' });
  });

  it('nothing to send sends nothing', async () => {
    const f = fakeFetch({ ok: true, status: 200 });
    expect(await postConversions(f.impl, cfg, [])).toEqual({ ok: true });
    expect(f.calls).toHaveLength(0);
  });
});
