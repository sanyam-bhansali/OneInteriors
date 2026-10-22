/**
 * The Meta Conversions API request for one lead event (owner, 22 Oct 2026):
 * normalising and hashing, the exact payload, and the POST with an injected
 * `fetch` so tests never touch the network (tests/studio-capi.test.ts pins
 * the payload byte for byte).
 *
 * No `server-only`, so the tests can import it; it uses `node:crypto` and is
 * imported only by `studio-sales/conversions.ts` on the server.
 *
 * ## The shape (Meta's CRM "conversion leads" integration)
 *
 * ```json
 * { "data": [{
 *     "event_name": "QualifiedLead",
 *     "event_time": 1761120000,
 *     "event_id": "oi_1234567890123456_qualifiedlead",
 *     "action_source": "system_generated",
 *     "user_data": { "lead_id": 1234567890123456, "ph": ["<sha256>"], "em": ["<sha256>"] },
 *     "custom_data": { "lead_event_source": "One Interiors", "event_source": "crm" }
 * }] }
 * ```
 *
 * - `lead_id` is Meta's leadgen id, written as a JSON number exactly as Meta
 *   shows it. Leadgen ids are 15–17 digits, past what a JavaScript number
 *   holds exactly, so the digits are spliced into the JSON text rather than
 *   passed through `Number()` (which would quietly send a different lead).
 * - `ph`: the phone as E.164 digits without the plus (India: 91 and the ten
 *   digits), SHA-256, lower-case hex. `em`: the email trimmed and lower-cased,
 *   SHA-256. Each only when we have it. Nothing unhashed leaves the server.
 * - `event_id` makes a resend of the same event one event at Meta.
 *
 * ## The token
 *
 * In the `Authorization: Bearer` header, never in the URL (AxLeads put it in
 * `?access_token=`, where it lands in every proxy log), never in an error
 * we store or log.
 */

import { createHash } from 'node:crypto';
import { isMetaId } from './payloads';
import type { CapiConfig, CapiEventName } from './capi-rules';

export const CAPI_GRAPH_VERSION = 'v21.0';
export const LEAD_EVENT_SOURCE = 'One Interiors';

export const sha256Hex = (v: string): string => createHash('sha256').update(v, 'utf8').digest('hex');

/**
 * A phone as Meta wants it before hashing: country code and number, digits
 * only. Our phones are ten Indian digits (`normalisePhone`); a number already
 * carrying 91, or a 0 trunk prefix, is put right. Anything else that is not
 * 11 to 15 digits is not sent.
 */
export function metaPhone(raw: string | null | undefined): string | null {
  const d = (raw ?? '').replace(/\D/g, '');
  if (d.length === 10) return `91${d}`;
  if (d.length === 11 && d.startsWith('0')) return `91${d.slice(1)}`;
  if (d.length === 12 && d.startsWith('91')) return d;
  if (d.length >= 11 && d.length <= 15 && !d.startsWith('0')) return d;
  return null;
}

/** An email as Meta wants it before hashing: trimmed, lower case. */
export function metaEmail(raw: string | null | undefined): string | null {
  const v = (raw ?? '').trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) ? v : null;
}

export interface ConversionInput {
  eventName: CapiEventName;
  eventTime: Date;
  /** Meta's leadgen id (digits). */
  leadgenId: string;
  phone: string | null;
  email: string | null;
}

export interface CapiEvent {
  event_name: CapiEventName;
  event_time: number;
  event_id: string;
  action_source: 'system_generated';
  user_data: { lead_id: string; ph?: string[]; em?: string[] };
  custom_data: { lead_event_source: string; event_source: 'crm' };
}

/** One event. Null when the leadgen id is not one of Meta's (it is then never sent). */
export function buildConversionEvent(input: ConversionInput): CapiEvent | null {
  if (!isMetaId(input.leadgenId)) return null;
  const ph = metaPhone(input.phone);
  const em = metaEmail(input.email);
  return {
    event_name: input.eventName,
    event_time: Math.floor(input.eventTime.getTime() / 1000),
    event_id: `oi_${input.leadgenId}_${input.eventName.toLowerCase()}`,
    action_source: 'system_generated',
    user_data: {
      lead_id: input.leadgenId,
      ...(ph ? { ph: [sha256Hex(ph)] } : {}),
      ...(em ? { em: [sha256Hex(em)] } : {}),
    },
    custom_data: { lead_event_source: LEAD_EVENT_SOURCE, event_source: 'crm' },
  };
}

/**
 * The request body as text: `{ "data": [...] }`, with each `lead_id` written
 * as a bare JSON number (see the file note), and Meta's test code when the
 * studio is checking its set-up in Events Manager.
 */
export function requestBody(events: readonly CapiEvent[], testEventCode: string | null = null): string {
  const json = JSON.stringify({ data: events, ...(testEventCode ? { test_event_code: testEventCode } : {}) });
  /* lead_id is digits only (buildConversionEvent checks), so unquoting it cannot change anything else. */
  return json.replace(/"lead_id":"(\d{1,32})"/g, '"lead_id":$1');
}

/** Where the events go. The token is not in it. */
export function capiUrl(datasetId: string): string {
  return `https://graph.facebook.com/${CAPI_GRAPH_VERSION}/${datasetId}/events`;
}

/** Meta's error, short and safe to show the owner and to store. */
export function capiError(body: unknown, status: number): string {
  const e = body && typeof body === 'object' ? (body as { error?: { message?: unknown } }).error : undefined;
  const msg = typeof e?.message === 'string' ? e.message : `HTTP ${status}`;
  return msg.replace(/access_token=[^&\s]+/gi, 'access_token=…').replace(/EAA[A-Za-z0-9]{10,}/g, '…').slice(0, 200);
}

export type FetchLike = (url: string, init: { method: string; headers: Record<string, string>; body: string; signal?: AbortSignal }) => Promise<{ ok: boolean; status: number; json: () => Promise<unknown> }>;

export type PostResult = { ok: true } | { ok: false; error: string };

/** POST the events. Never throws; never puts the token anywhere but the header. */
export async function postConversions(fetchImpl: FetchLike, cfg: CapiConfig, events: readonly CapiEvent[], timeoutMs = 8000): Promise<PostResult> {
  if (events.length === 0) return { ok: true };
  try {
    const res = await fetchImpl(capiUrl(cfg.datasetId), {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${cfg.token}` },
      body: requestBody(events, cfg.testEventCode),
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (res.ok) return { ok: true };
    const body = await res.json().catch(() => null);
    return { ok: false, error: `Meta did not take it: ${capiError(body, res.status)}` };
  } catch (error) {
    return { ok: false, error: error instanceof Error && error.name === 'TimeoutError' ? 'Meta did not answer in time. It will be tried again tomorrow.' : 'Meta could not be reached. It will be tried again tomorrow.' };
  }
}
