/**
 * Reading what Meta, Google, a website or a portal sends, and turning it into
 * one lead (lead intake, 21 Oct 2026; docs/studio-os/LEAD-INTAKE.md).
 *
 * Pure, no `server-only` — CONTRIBUTING §9.5 — and tested exhaustively
 * (tests/studio-intake.test.ts), because every source names its fields its
 * own way and the only defence is a test per spelling.
 *
 * ## Three steps, each its own function
 *
 *  1. **Parse** one source's shape into an `IncomingLead`: what the person
 *     said, untouched. `parseGeneric`, `parseGoogle`, `parseMetaLead`.
 *  2. **Shape** it into what a StudioClient row holds (`shapeLead`): the
 *     phone normalised exactly as the enquiry form does (so the duplicate
 *     check compares like with like), the area turned into a locality slug
 *     when we know it, "3 BHK flat" into "3 BHK", "25 lakh" into paise.
 *     Anything that does not fit a column goes into the notes rather than
 *     being dropped: a studio reading the card sees everything the person
 *     answered.
 *  3. **Attribute** it (`attributionFor`): which ClientSource, which of the
 *     studio's own source names, and the source note (campaign, ad, form).
 *
 * ## Field names are matched loosely on purpose
 *
 * Advertisers name (and misspell) form questions freely: AxLeads has seen
 * "Buget Range" and "budjet" on real Pune forms. Keys are compared after
 * lowercasing and turning spaces and hyphens into underscores, and the
 * budget, home and area questions are recognised by pattern, not by name.
 */

import { CAPS, CONFIGS, localitySlug, looksLikeEmail, normalisePhone } from '@/modules/studio-practice/capture-fields';
import type { ClientSourceName } from '@/modules/studio-practice/vocabulary';

export type ConnectionKindName = 'WEBSITE' | 'GOOGLE_LEAD_FORM' | 'PORTAL' | 'META_PAGE';

/** What one source said about one person, before any cleaning. */
export interface IncomingLead {
  name: string | null;
  phone: string | null;
  email: string | null;
  city: string | null;
  locality: string | null;
  society: string | null;
  config: string | null;
  budget: string | null;
  message: string | null;
  /** Every other question and its answer, in the order they came. */
  answers: { question: string; answer: string }[];
  /** utm_source, a portal's own name, "source". */
  sourceHint: string | null;
  /** Campaign, ad set, ad and form names or ids, for the source note. */
  attribution: string[];
  /** The sender's own id for this lead, if it gave one. */
  externalId: string | null;
  platform: 'FACEBOOK' | 'INSTAGRAM' | null;
  isTest: boolean;
}

export function emptyLead(): IncomingLead {
  return {
    name: null,
    phone: null,
    email: null,
    city: null,
    locality: null,
    society: null,
    config: null,
    budget: null,
    message: null,
    answers: [],
    sourceHint: null,
    attribution: [],
    externalId: null,
    platform: null,
    isTest: false,
  };
}

/** `"Full Name"`, `"full-name"`, `"FULL_NAME"` → `full_name`. */
export function normKey(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[?:]+$/g, '')
    .replace(/[\s\-.]+/g, '_')
    .replace(/[^a-z0-9_]/g, '')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
}

/** A string, a number or the first of an array of them; anything else is null. */
function text(v: unknown, cap = 500): string | null {
  if (Array.isArray(v)) return text(v[0], cap);
  if (typeof v === 'number' && Number.isFinite(v)) return String(v);
  if (typeof v !== 'string') return null;
  const t = v.replace(/\s+/g, ' ').trim();
  return t.length > 0 ? t.slice(0, cap) : null;
}

// ── Recognising a field ────────────────────────────────────────

type Slot = 'name' | 'first_name' | 'last_name' | 'phone' | 'email' | 'city' | 'locality' | 'society' | 'config' | 'budget' | 'message' | 'source' | 'campaign' | 'id';

const EXACT: Record<string, Slot> = {
  name: 'name',
  full_name: 'name',
  fullname: 'name',
  your_name: 'name',
  customer_name: 'name',
  contact_name: 'name',
  client_name: 'name',
  first_name: 'first_name',
  firstname: 'first_name',
  last_name: 'last_name',
  lastname: 'last_name',
  surname: 'last_name',
  phone: 'phone',
  phone_number: 'phone',
  phonenumber: 'phone',
  mobile: 'phone',
  mobile_number: 'phone',
  mobile_no: 'phone',
  mobileno: 'phone',
  contact: 'phone',
  contact_number: 'phone',
  contact_no: 'phone',
  whatsapp: 'phone',
  whatsapp_number: 'phone',
  tel: 'phone',
  telephone: 'phone',
  user_phone: 'phone',
  email: 'email',
  email_address: 'email',
  e_mail: 'email',
  emailid: 'email',
  email_id: 'email',
  user_email: 'email',
  city: 'city',
  locality: 'locality',
  area: 'locality',
  location: 'locality',
  address: 'locality',
  street_address: 'locality',
  society: 'society',
  society_name: 'society',
  project: 'society',
  project_name: 'society',
  building: 'society',
  building_name: 'society',
  apartment: 'society',
  bhk: 'config',
  config: 'config',
  configuration: 'config',
  property_type: 'config',
  flat_type: 'config',
  home_type: 'config',
  budget: 'budget',
  budget_range: 'budget',
  message: 'message',
  notes: 'message',
  note: 'message',
  comments: 'message',
  comment: 'message',
  requirement: 'message',
  requirements: 'message',
  query: 'message',
  enquiry: 'message',
  inquiry: 'message',
  source: 'source',
  utm_source: 'source',
  lead_source: 'source',
  portal: 'source',
  campaign: 'campaign',
  campaign_name: 'campaign',
  utm_campaign: 'campaign',
  utm_medium: 'campaign',
  utm_content: 'campaign',
  utm_term: 'campaign',
  ad_name: 'campaign',
  id: 'id',
  lead_id: 'id',
  leadid: 'id',
  event_id: 'id',
  enquiry_id: 'id',
};

/**
 * Which slot a question fills. Exact names first, then the patterns that
 * catch advertisers' own wording ("What is your budget?", "Flat type (BHK)",
 * "Area in Pune").
 */
export function slotFor(rawKey: string): Slot | null {
  const k = normKey(rawKey);
  if (!k) return null;
  const exact = EXACT[k];
  if (exact) return exact;
  if (/budget|buget|budjet|budgt|spend|invest/.test(k)) return 'budget';
  if (/bhk|property_type|flat_type|home_type|configuration|apartment_type/.test(k)) return 'config';
  if (/phone|mobile|whatsapp/.test(k)) return 'phone';
  if (/e_?mail/.test(k)) return 'email';
  if (/society|project_name|building/.test(k)) return 'society';
  if (/locality|area|location/.test(k) && !/sq|carpet/.test(k)) return 'locality';
  if (/city/.test(k)) return 'city';
  return null;
}

/** Keys a sender uses for itself (secrets, honeypots, framework noise): never shown on a lead. */
const IGNORED = new Set(['key', 'google_key', 'api_key', 'secret', 'token', 'form_key', 'is_test', 'g_recaptcha_response', 'recaptcha', 'csrf', 'csrf_token', 'website_url', 'redirect', 'redirect_url', 'page_url', 'referrer']);

/** Put one answer where it belongs. The first value for a slot wins. */
function put(lead: IncomingLead, rawKey: string, value: string, parts: { first: string | null; last: string | null }): void {
  const slot = slotFor(rawKey);
  const k = normKey(rawKey);
  if (IGNORED.has(k) || k.startsWith('_')) return;
  switch (slot) {
    case 'name':
      lead.name ??= value;
      return;
    case 'first_name':
      parts.first ??= value;
      return;
    case 'last_name':
      parts.last ??= value;
      return;
    case 'phone':
      lead.phone ??= value;
      return;
    case 'email':
      lead.email ??= value;
      return;
    case 'city':
      lead.city ??= value;
      return;
    case 'locality':
      lead.locality ??= value;
      return;
    case 'society':
      lead.society ??= value;
      return;
    case 'config':
      lead.config ??= value;
      return;
    case 'budget':
      lead.budget ??= value;
      return;
    case 'message':
      lead.message = lead.message ? `${lead.message}\n${value}` : value;
      return;
    case 'source':
      lead.sourceHint ??= value;
      return;
    case 'campaign':
      lead.attribution.push(value);
      return;
    case 'id':
      lead.externalId ??= value.slice(0, 120);
      return;
    default:
      if (lead.answers.length < 25) lead.answers.push({ question: rawKey.trim().slice(0, 120), answer: value.slice(0, 500) });
  }
}

function finishName(lead: IncomingLead, parts: { first: string | null; last: string | null }): IncomingLead {
  if (!lead.name && (parts.first || parts.last)) lead.name = [parts.first, parts.last].filter(Boolean).join(' ');
  return lead;
}

// ── 1. Parsing each source ─────────────────────────────────────

/**
 * A website, a portal, a WhatsApp tool, Zapier or Pabbly: one flat object,
 * JSON or form-encoded, named however that tool names things. A body that
 * wraps the lead (`{ "lead": {…} }`, `{ "data": {…} }`) is unwrapped once.
 */
export function parseGeneric(body: unknown): IncomingLead {
  const lead = emptyLead();
  const parts = { first: null as string | null, last: null as string | null };
  if (!body || typeof body !== 'object' || Array.isArray(body)) return lead;
  let o = body as Record<string, unknown>;
  for (const wrap of ['lead', 'data', 'payload', 'fields']) {
    const inner = o[wrap];
    if (inner && typeof inner === 'object' && !Array.isArray(inner)) {
      /* Keep the wrapper's own id and source when the inner has none. */
      o = { ...Object.fromEntries(Object.entries(o).filter(([k]) => k !== wrap)), ...(inner as Record<string, unknown>) };
      break;
    }
  }
  for (const [k, v] of Object.entries(o).slice(0, 80)) {
    const value = text(v, k === 'message' || slotFor(k) === 'message' ? CAPS.message : 500);
    if (value) put(lead, k, value, parts);
  }
  return finishName(lead, parts);
}

export interface GoogleLeadPayload {
  googleKey: string | null;
  leadId: string | null;
  isTest: boolean;
  lead: IncomingLead;
}

/**
 * A Google Ads lead form webhook: `google_key`, `lead_id`, `is_test`,
 * `user_column_data: [{ column_id, string_value, column_name? }]`, and the
 * campaign, ad group, creative and form ids (sent as numbers).
 *
 * Standard columns are upper-snake ids (FULL_NAME, PHONE_NUMBER, EMAIL,
 * CITY…). A custom question's `column_id` is the advertiser's own, and its
 * `column_name` is the wording, which is what the studio should read.
 */
export function parseGoogle(body: unknown): GoogleLeadPayload {
  const lead = emptyLead();
  const parts = { first: null as string | null, last: null as string | null };
  const o = body && typeof body === 'object' && !Array.isArray(body) ? (body as Record<string, unknown>) : {};
  const columns = Array.isArray(o.user_column_data) ? o.user_column_data : [];
  for (const c of columns.slice(0, 60)) {
    if (!c || typeof c !== 'object') continue;
    const col = c as Record<string, unknown>;
    const id = text(col.column_id, 120) ?? '';
    const value = text(col.string_value, CAPS.message);
    if (!value) continue;
    const named = text(col.column_name, 120);
    switch (id.toUpperCase()) {
      case 'FULL_NAME':
        lead.name ??= value;
        break;
      case 'FIRST_NAME':
        parts.first ??= value;
        break;
      case 'LAST_NAME':
        parts.last ??= value;
        break;
      case 'PHONE_NUMBER':
      case 'WORK_PHONE':
        lead.phone ??= value;
        break;
      case 'EMAIL':
      case 'WORK_EMAIL':
        lead.email ??= value;
        break;
      case 'CITY':
        lead.city ??= value;
        break;
      case 'POSTAL_CODE':
        lead.answers.push({ question: 'Pincode', answer: value });
        break;
      case 'STREET_ADDRESS':
        lead.locality ??= value;
        break;
      default:
        /* A custom question: placed by its wording when it has one. */
        put(lead, named ?? id, value, parts);
    }
  }
  const campaign = text(o.campaign_id, 40);
  const form = text(o.form_id ?? o.lead_form_id, 40);
  if (campaign) lead.attribution.push(`campaign ${campaign}`);
  if (form) lead.attribution.push(`form ${form}`);
  lead.isTest = o.is_test === true || o.is_test === 'true';
  const leadId = text(o.lead_id, 120) ?? text(o.gcl_id, 120);
  lead.externalId = leadId;
  return { googleKey: text(o.google_key, 200), leadId, isTest: lead.isTest, lead: finishName(lead, parts) };
}

/** One lead Meta says exists, from the webhook (the answers come from Graph). */
export interface MetaLeadRef {
  pageId: string;
  leadgenId: string;
  formId: string | null;
}

/** Meta's ids are digits. Anything else is not from Meta and is not passed to Graph. */
export const isMetaId = (v: unknown): v is string => typeof v === 'string' && /^\d{1,32}$/.test(v);

/**
 * The leads in a Meta webhook post: `{ object: "page", entry: [{ id, changes:
 * [{ field: "leadgen", value: { leadgen_id, page_id, form_id } }] }] }`.
 * Other fields (feed, messages) are not leads and are skipped.
 */
export function parseMetaWebhook(body: unknown): MetaLeadRef[] {
  const o = body && typeof body === 'object' ? (body as { entry?: unknown }) : {};
  const entries = Array.isArray(o.entry) ? o.entry : [];
  const out: MetaLeadRef[] = [];
  for (const e of entries.slice(0, 50)) {
    if (!e || typeof e !== 'object') continue;
    const entry = e as { id?: unknown; changes?: unknown };
    const changes = Array.isArray(entry.changes) ? entry.changes : [];
    for (const c of changes.slice(0, 50)) {
      if (!c || typeof c !== 'object') continue;
      const change = c as { field?: unknown; value?: Record<string, unknown> };
      if (change.field !== 'leadgen' || !change.value) continue;
      const v = change.value;
      const leadgenId = typeof v.leadgen_id === 'number' ? String(v.leadgen_id) : v.leadgen_id;
      const pageIdRaw = v.page_id ?? entry.id;
      const pageId = typeof pageIdRaw === 'number' ? String(pageIdRaw) : pageIdRaw;
      const formRaw = typeof v.form_id === 'number' ? String(v.form_id) : v.form_id;
      if (!isMetaId(leadgenId) || !isMetaId(pageId)) continue;
      out.push({ pageId, leadgenId, formId: isMetaId(formRaw) ? formRaw : null });
    }
  }
  return out;
}

/**
 * A lead as Graph returns it (`GET /{leadgen_id}?fields=created_time,
 * field_data,ad_id,ad_name,adset_name,campaign_name,form_id,platform`):
 * `field_data: [{ name, values: [...] }]`, `platform: "fb" | "ig"`.
 */
export function parseMetaLead(graph: unknown): IncomingLead {
  const lead = emptyLead();
  const parts = { first: null as string | null, last: null as string | null };
  const o = graph && typeof graph === 'object' ? (graph as Record<string, unknown>) : {};
  const fields = Array.isArray(o.field_data) ? o.field_data : [];
  for (const f of fields.slice(0, 60)) {
    if (!f || typeof f !== 'object') continue;
    const field = f as { name?: unknown; values?: unknown };
    const name = text(field.name, 120);
    const values = Array.isArray(field.values) ? field.values.map((v) => text(v, CAPS.message)).filter((v): v is string => Boolean(v)) : [];
    if (!name || values.length === 0) continue;
    /* Multiple-choice answers come as several values. The underscores Meta
       puts in option values ("3_bhk", "25-50_lakh") read better as spaces. */
    const value = values.join(', ').replace(/_/g, ' ');
    put(lead, name, slotFor(name) === 'email' || slotFor(name) === 'phone' ? values[0]! : value, parts);
  }
  lead.platform = o.platform === 'ig' || o.platform === 'instagram' ? 'INSTAGRAM' : 'FACEBOOK';
  const campaign = text(o.campaign_name, 120);
  const adset = text(o.adset_name, 120);
  const ad = text(o.ad_name, 120);
  if (campaign) lead.attribution.push(`campaign ${campaign}`);
  if (adset) lead.attribution.push(`ad set ${adset}`);
  if (ad) lead.attribution.push(`ad ${ad}`);
  lead.externalId = text(o.id, 40);
  return finishName(lead, parts);
}

// ── 2. Shaping into a lead ─────────────────────────────────────

/** The home, as the board's property line offers it, or null when it is not one of them. */
export function configFrom(raw: string | null): string | null {
  if (!raw) return null;
  const v = raw.toLowerCase();
  if (CONFIGS.includes(raw.trim())) return raw.trim();
  if (/villa|row\s*house|bungalow|independent/.test(v)) return 'Villa / Row house';
  if (/\brk\b|studio apartment/.test(v)) return null;
  const m = /(\d)\s*(?:\+\s*)?(?:[_\s-]*)bhk/.exec(v) ?? /^\s*(\d)\b/.exec(v);
  if (!m) return null;
  const n = Number(m[1]);
  if (n <= 0) return null;
  if (n >= 4) return '4+ BHK';
  return `${n} BHK`;
}

const UNIT_RUPEES: Record<string, bigint> = {
  k: 1_000n,
  thousand: 1_000n,
  l: 1_00_000n,
  lac: 1_00_000n,
  lacs: 1_00_000n,
  lakh: 1_00_000n,
  lakhs: 1_00_000n,
  lk: 1_00_000n,
  cr: 1_00_00_000n,
  crore: 1_00_00_000n,
  crores: 1_00_00_000n,
};

/** Budgets a studio would believe: ₹50,000 to ₹50 crore. Outside that it is a typo. */
const MIN_BUDGET_PAISE = 50_000n * 100n;
const MAX_BUDGET_PAISE = 50n * 1_00_00_000n * 100n;

/**
 * One amount in paise: "25 lakh", "25L", "1.2 cr", "₹15,00,000", "800000".
 * A range ("10-15 lakh", "15 to 25 lakhs") or anything else is null: the
 * words go into the notes instead, because picking one end of a range would
 * put a number on the card the person never said.
 *
 * Integer arithmetic only (CONTRIBUTING §7: no floats in a money path):
 * "1.2" is read as 12 and a scale of 10.
 */
export function budgetPaiseFrom(raw: string | null): bigint | null {
  if (!raw) return null;
  const v = raw.toLowerCase().replace(/₹|rs\.?|inr|rupees?/g, ' ').replace(/,/g, '').trim();
  if (/\d\s*(?:-|–|to|and)\s*\d/.test(v) || /\d\s*[a-z]+\s*(?:-|–|to)\s*\d/.test(v)) return null;
  const m = /^(?:upto|up to|under|below|about|around|approx\.?)?\s*(\d+)(?:\.(\d{1,3}))?\s*([a-z]+)?\s*\+?$/.exec(v);
  if (!m) return null;
  const whole = m[1]!;
  const frac = m[2] ?? '';
  const unitWord = m[3] ?? '';
  const unit = unitWord ? UNIT_RUPEES[unitWord] : 1n;
  if (unit === undefined) return null;
  const scale = 10n ** BigInt(frac.length);
  const rupees = (BigInt(whole + frac) * unit) / scale;
  const paise = rupees * 100n;
  if (paise < MIN_BUDGET_PAISE || paise > MAX_BUDGET_PAISE) return null;
  return paise;
}

/** "PUNE" and "pune " → "Pune". */
function titleCase(v: string): string {
  return v
    .toLowerCase()
    .split(/\s+/)
    .map((w) => (w ? w[0]!.toUpperCase() + w.slice(1) : w))
    .join(' ');
}

/** What a StudioClient row is made from. */
export interface LeadDraft {
  name: string;
  phone: string | null;
  email: string | null;
  city: string | null;
  locality: string | null;
  society: string | null;
  config: string | null;
  budgetPaise: bigint | null;
  notes: string | null;
  isTest: boolean;
}

export type Shaped = { ok: true; draft: LeadDraft } | { ok: false; error: string };

const NOTES_CAP = 4000;

/**
 * An incoming lead as a card. Refused only when there is nobody to ring or
 * write to: no number that works and no email. A wrong number is kept in the
 * notes ("Phone given as …") so the studio can still try it.
 */
export function shapeLead(lead: IncomingLead): Shaped {
  const phone = lead.phone ? normalisePhone(lead.phone) : null;
  const rawEmail = lead.email?.trim() ?? '';
  const email = rawEmail && rawEmail.length <= CAPS.email && looksLikeEmail(rawEmail) ? rawEmail.toLowerCase() : null;
  if (!phone && !email) {
    return { ok: false, error: lead.phone ? `The phone number "${lead.phone.slice(0, 20)}" is not a mobile number, and there is no email.` : 'No phone number or email in the lead.' };
  }

  const name = (lead.name?.trim() || (email ? email.split('@')[0]! : '') || 'Name not given').slice(0, CAPS.name);

  const rawArea = lead.locality?.trim().slice(0, CAPS.locality) ?? '';
  const slug = rawArea ? localitySlug(rawArea) : null;
  const config = configFrom(lead.config);
  const budgetPaise = budgetPaiseFrom(lead.budget);
  const city = lead.city ? titleCase(lead.city.trim()).slice(0, 40) : null;

  const lines: string[] = [];
  if (lead.isTest) lines.push('Test lead (sent to check the connection).');
  if (lead.message) lines.push(lead.message.trim());
  if (rawArea && !slug) lines.push(`Area given as: ${rawArea}`);
  if (lead.config && !config) lines.push(`Home given as: ${lead.config}`);
  if (lead.budget && budgetPaise === null) lines.push(`Budget given as: ${lead.budget}`);
  if (lead.phone && !phone) lines.push(`Phone given as: ${lead.phone.slice(0, 30)}`);
  if (rawEmail && !email) lines.push(`Email given as: ${rawEmail.slice(0, 120)}`);
  for (const a of lead.answers) lines.push(`${a.question}: ${a.answer}`);
  const notes = lines.join('\n').slice(0, NOTES_CAP);

  return {
    ok: true,
    draft: {
      name,
      phone,
      email,
      city,
      locality: slug,
      society: lead.society ? lead.society.slice(0, 80) : null,
      config,
      budgetPaise,
      notes: notes.length > 0 ? notes : null,
      isTest: lead.isTest,
    },
  };
}

// ── 3. Where it came from ──────────────────────────────────────

export interface Attribution {
  source: ClientSourceName;
  /** One of the studio's own source names, found or made ("99acres", "Google lead form"). */
  leadSourceName: string | null;
  sourceNote: string;
  /** "your Google lead form", for the timeline and the alert. */
  how: string;
}

/** Google's own lead forms, as the studio's source list names them. */
export const GOOGLE_SOURCE_NAME = 'Google lead form';

/** A portal's or tool's word for itself, as one of our sources when it is one. */
function enumFromHint(hint: string): ClientSourceName | null {
  const h = hint.toLowerCase();
  if (/instagram|^ig$/.test(h)) return 'INSTAGRAM';
  if (/facebook|^fb$|^meta$/.test(h)) return 'FACEBOOK';
  if (/^(website|web|site|organic|direct)$/.test(h)) return 'WEBSITE';
  if (/referr/.test(h)) return 'REFERRAL';
  if (/walk/.test(h)) return 'WALK_IN';
  if (/architect/.test(h)) return 'ARCHITECT';
  return null;
}

/** A source name as the settings screen would accept one (2 to 40 characters). */
export function cleanSourceName(raw: string | null): string | null {
  const v = raw?.replace(/\s+/g, ' ').trim().slice(0, 40) ?? '';
  return v.length >= 2 ? v : null;
}

/**
 * Which source a lead counts under on the analytics page.
 *
 * - Website: WEBSITE, with any utm words in the note.
 * - Portal: the tool's own word for itself when it names one of ours
 *   (facebook, instagram, referral), else one of the studio's own source
 *   names — what the post says ("99acres") or the door's label.
 * - Google lead form: the studio's own "Google lead form" source.
 * - Meta: FACEBOOK or INSTAGRAM, by where the ad was shown.
 */
export function attributionFor(kind: ConnectionKindName, label: string, lead: IncomingLead): Attribution {
  const bits = lead.attribution.filter(Boolean).slice(0, 4);
  const note = (head: string) => [head, ...bits].join(' · ').slice(0, 200);
  switch (kind) {
    case 'META_PAGE': {
      const source = lead.platform === 'INSTAGRAM' ? 'INSTAGRAM' : 'FACEBOOK';
      return { source, leadSourceName: null, sourceNote: note(`Meta lead ad (${source === 'INSTAGRAM' ? 'Instagram' : 'Facebook'})`), how: 'your Meta lead ad' };
    }
    case 'GOOGLE_LEAD_FORM':
      return { source: 'OTHER', leadSourceName: GOOGLE_SOURCE_NAME, sourceNote: note(GOOGLE_SOURCE_NAME), how: 'your Google lead form' };
    case 'WEBSITE': {
      const hint = lead.sourceHint ? `from ${lead.sourceHint.slice(0, 40)}` : null;
      return { source: 'WEBSITE', leadSourceName: null, sourceNote: [label, hint, ...bits].filter(Boolean).join(' · ').slice(0, 200), how: `your website (${label})` };
    }
    case 'PORTAL': {
      const hint = cleanSourceName(lead.sourceHint);
      const ours = hint ? enumFromHint(hint) : null;
      if (ours) return { source: ours, leadSourceName: null, sourceNote: note(label), how: label };
      const own = hint ?? cleanSourceName(label);
      return { source: 'OTHER', leadSourceName: own, sourceNote: note(label), how: own ?? label };
    }
  }
}

// ── Idempotency ────────────────────────────────────────────────

export type IntakeStatusName = 'RECEIVED' | 'LANDED' | 'FAILED' | 'DUPLICATE';

/**
 * How long a lead may sit as RECEIVED before a retry may take it over. Far
 * longer than a Graph fetch and an insert, far shorter than Meta's retry
 * window: a claim stranded by the function being stopped mid-`after()` is
 * released while retries are still arriving. (AxLeads, lib/db/routing.ts.)
 */
export const RECLAIM_AFTER_MS = 10 * 60 * 1000;

/**
 * Somebody sent a lead this door has seen before. Landed (or added to an
 * existing lead) means never again. Failed means the retry may try again.
 * Received means another request is working on it, unless it has been at it
 * so long that it must have died.
 */
export function onSeenAgain(existing: { status: IntakeStatusName; updatedAt: Date }, now: Date): 'skip' | 'retry' {
  if (existing.status === 'LANDED' || existing.status === 'DUPLICATE') return 'skip';
  if (existing.status === 'FAILED') return 'retry';
  return now.getTime() - existing.updatedAt.getTime() >= RECLAIM_AFTER_MS ? 'retry' : 'skip';
}

// ── Meta page tokens ───────────────────────────────────────────

export interface PageToken {
  token: string;
  /** When set, only the studio with this slug may take this page's leads. */
  studio: string | null;
}

/**
 * `STUDIO_META_PAGE_TOKENS`: a JSON object from page id to its page access
 * token, `{ "<pageId>": "<token>" }`, or `{ "<pageId>": { "token": "…",
 * "studio": "<studio slug>" } }` to tie the page to one studio. Anything
 * unreadable is an empty map, never a throw (CONTRIBUTING §8).
 */
export function parsePageTokens(raw: string | null | undefined): Map<string, PageToken> {
  const out = new Map<string, PageToken>();
  const v = raw?.trim();
  if (!v) return out;
  let parsed: unknown;
  try {
    parsed = JSON.parse(v);
  } catch {
    return out;
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return out;
  for (const [pageId, entry] of Object.entries(parsed as Record<string, unknown>)) {
    if (!isMetaId(pageId)) continue;
    if (typeof entry === 'string' && entry.trim()) out.set(pageId, { token: entry.trim(), studio: null });
    else if (entry && typeof entry === 'object') {
      const e = entry as { token?: unknown; studio?: unknown };
      if (typeof e.token === 'string' && e.token.trim()) {
        out.set(pageId, { token: e.token.trim(), studio: typeof e.studio === 'string' && e.studio.trim() ? e.studio.trim() : null });
      }
    }
  }
  return out;
}

/** Graph's address for one lead. The token goes in a header, never here. */
export const GRAPH_VERSION = 'v21.0';
export function graphLeadUrl(leadgenId: string): string {
  return `https://graph.facebook.com/${GRAPH_VERSION}/${leadgenId}?fields=created_time,field_data,ad_id,ad_name,adset_name,campaign_name,form_id,platform`;
}

/** A Graph error body's message, short and safe to show the owner. */
export function graphError(body: unknown, status: number): string {
  const e = body && typeof body === 'object' ? (body as { error?: { message?: unknown } }).error : undefined;
  const msg = typeof e?.message === 'string' ? e.message.replace(/access_token=[^&\s]+/gi, 'access_token=…').slice(0, 200) : `HTTP ${status}`;
  return `Meta did not give the lead: ${msg}`;
}

/** Form-encoded bodies (an HTML form posting straight here) as a plain object. */
export function formToObject(params: URLSearchParams): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of params) if (!(k in out)) out[k] = v;
  return out;
}
