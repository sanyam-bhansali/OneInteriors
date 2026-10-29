/**
 * A studio's own client (owner, 11 Oct 2026; docs/studio-workspace/
 * OWN-CLIENTS.md): the rules for starting a project from a quotation the
 * client accepted, and the words of the invite to the app. Pure
 * (CONTRIBUTING §9.5), tested in tests/own-project.test.ts; the database
 * half is `own-project.ts`.
 */

import { normalisePhone } from '@/modules/studio/phone';

// ── Which quotation can start a project ────────────────────────

/**
 * Won (ACCEPTED) is the builder's "the client said yes". Sent (ISSUED) also
 * qualifies: starting the project is the studio saying the client accepted
 * it, so the same transaction marks it Won. A draft or a lost quotation
 * never does.
 */
export const STARTABLE_STATUSES = ['ISSUED', 'ACCEPTED'] as const;

export interface OwnQuoteFacts {
  status: string;
  /** Set only on a quotation for a customer One Interiors introduced. */
  introductionId: string | null;
  briefId: string | null;
  client: { source: string; introductionId: string | null; deletedAt: Date | null } | null;
  lineCount: number;
  totalPaise: number;
  /** A project already started from this quotation. */
  alreadyStarted: boolean;
}

export const OWN_QUOTE_ERRORS = {
  introduced:
    'This client came to you through One Interiors. Their project starts when they sign your final quote in the app, so nothing is needed here.',
  status: 'Only a quotation the client accepted can start a project. Mark it as sent or won first.',
  empty: 'This quotation has nothing priced on it yet.',
  started: 'A project has already been started from this quotation.',
  clientGone: 'The client on this quotation has been deleted.',
} as const;

/** Why this quotation cannot start an own-client project, or null when it can. */
export function ownQuoteRefusal(q: OwnQuoteFacts): string | null {
  if (q.introductionId || q.briefId || q.client?.introductionId || q.client?.source === 'ONE_INTERIORS') return OWN_QUOTE_ERRORS.introduced;
  if (q.alreadyStarted) return OWN_QUOTE_ERRORS.started;
  if (q.client?.deletedAt) return OWN_QUOTE_ERRORS.clientGone;
  if (!(STARTABLE_STATUSES as readonly string[]).includes(q.status)) return OWN_QUOTE_ERRORS.status;
  if (q.lineCount === 0 || q.totalPaise <= 0) return OWN_QUOTE_ERRORS.empty;
  return null;
}

// ── The customer ───────────────────────────────────────────────

export interface CustomerInput {
  name: unknown;
  phone: unknown;
  email?: unknown;
}

export type CustomerCheck = { ok: true; value: { name: string; phone: string; email: string | null } } | { ok: false; error: string };

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** The customer's name, mobile (E.164) and optional email, as typed or prefilled. */
export function checkCustomer(input: CustomerInput): CustomerCheck {
  const name = typeof input.name === 'string' ? input.name.trim().replace(/\s+/g, ' ').slice(0, 80) : '';
  if (name.length < 2) return { ok: false, error: 'The customer’s name, please.' };
  const phone = typeof input.phone === 'string' ? normalisePhone(input.phone) : null;
  if (!phone) return { ok: false, error: 'The customer’s 10-digit mobile number, please. They sign in to the app with it.' };
  const rawEmail = typeof input.email === 'string' ? input.email.trim().toLowerCase().slice(0, 160) : '';
  if (rawEmail && !EMAIL.test(rawEmail)) return { ok: false, error: 'That email address does not look right. Leave it empty if you are not sure.' };
  return { ok: true, value: { name, phone, email: rawEmail || null } };
}

export const CUSTOMER_ERRORS = {
  staff:
    'This number belongs to a studio or One Interiors team account, so it cannot be a customer’s. Ask the customer for the number they will use for the app.',
  erased: 'This number belonged to an account that was deleted. Ask the customer for another number.',
  introduced:
    'This customer came to you through One Interiors. Their project starts when they sign your final quote in the app.',
  alreadyHere: 'This customer already has a project with your studio. Open it from Projects.',
} as const;

/**
 * Whether an existing account on that number can be the customer. Only a
 * CUSTOMER account is ever linked: a studio or ops account is refused, never
 * attached to a customer's project.
 */
export function accountRefusal(user: { role: string; deletedAt: Date | null } | null): string | null {
  if (!user) return null;
  if (user.deletedAt) return CUSTOMER_ERRORS.erased;
  if (user.role !== 'CUSTOMER') return CUSTOMER_ERRORS.staff;
  return null;
}

// ── Dates ──────────────────────────────────────────────────────

const DAY_MS = 86_400_000;

/** "2026-10-14" → that day at 00:00 UTC (how `startOn` is stored). From 60 days back to a year ahead of `today`. */
export function parseStartOn(raw: unknown, today: Date): Date | null {
  if (typeof raw !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null;
  const d = new Date(`${raw}T00:00:00Z`);
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== raw) return null;
  const t0 = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  if (d.getTime() < t0 - 60 * DAY_MS || d.getTime() > t0 + 365 * DAY_MS) return null;
  return d;
}

/** Sign-off to handover in days: 7 to 730, the matching profile's own limits. */
/** "Design done in N days": 3 to 365, or the steps' own length for the flat (`fallback`) when left out. */
export function parseDesignDays(raw: unknown, fallback: number | null): number | null | false {
  if (raw === undefined || raw === null || raw === '') return fallback;
  const n = typeof raw === 'number' ? raw : Number(String(raw).trim());
  if (!Number.isInteger(n) || n < 3 || n > 365) return false;
  return n;
}

export function parseTotalDays(raw: unknown, fallback: number): number | null {
  if (raw === undefined || raw === null || raw === '') return fallback;
  const n = typeof raw === 'number' ? raw : Number(String(raw).trim());
  if (!Number.isInteger(n) || n < 7 || n > 730) return null;
  return n;
}

// ── The minimal brief, from the client record ──────────────────

type PropertyTypeName = 'BHK_1' | 'BHK_2' | 'BHK_3' | 'BHK_4_PLUS' | 'VILLA';

/** "2 BHK", "2bhk", "3.5 BHK", "Villa" → the brief's property type; null when it says nothing we can read. */
export function propertyTypeFrom(config: string | null | undefined): PropertyTypeName | null {
  const c = (config ?? '').toLowerCase();
  if (/villa|bungalow|row ?house/.test(c)) return 'VILLA';
  const m = c.match(/(\d+(?:\.\d)?)\s*-?\s*bhk/);
  if (!m) return null;
  const n = Math.floor(Number(m[1]));
  if (n <= 1) return 'BHK_1';
  if (n === 2) return 'BHK_2';
  if (n === 3) return 'BHK_3';
  return 'BHK_4_PLUS';
}

/** "Baner", "Kalyani Nagar" → "baner", "kalyani-nagar": the brief's locality slug. */
export function localitySlug(text: string | null | undefined): string | null {
  const s = (text ?? '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  return s || null;
}

// ── The invite ─────────────────────────────────────────────────

/** No 0/O, 1/I/L: read aloud over the phone, typed off a screen. */
export const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const CODE_LENGTH = 8;

/** A fresh invite code from `random` bytes (crypto in the server, fixed in tests). */
export function inviteCode(random: (n: number) => Uint8Array): string {
  const bytes = random(CODE_LENGTH);
  let out = '';
  for (let i = 0; i < CODE_LENGTH; i++) out += CODE_ALPHABET[bytes[i]! % CODE_ALPHABET.length];
  return out;
}

/** Codes are typed back in any case, with spaces or a dash; null when it cannot be one. */
export function cleanCode(raw: string | null | undefined): string | null {
  const c = (raw ?? '').toUpperCase().replace(/[\s-]/g, '');
  if (c.length !== CODE_LENGTH) return null;
  for (const ch of c) if (!CODE_ALPHABET.includes(ch)) return null;
  return c;
}

/** "+91 98xxx xx210" — enough to recognise your own number on the join page. */
export function maskedPhone(phone: string): string {
  const d = phone.replace(/\D/g, '').slice(-10);
  return d.length === 10 ? `+91 ${d.slice(0, 2)}xxx xx${d.slice(7)}` : 'your number';
}

export type InviteLang = 'en' | 'hi' | 'mr';
export const INVITE_LANGS: readonly InviteLang[] = ['en', 'hi', 'mr'];
export const INVITE_LANG_NAMES: Record<InviteLang, string> = { en: 'English', hi: 'हिन्दी', mr: 'मराठी' };

export interface InviteWords {
  customerFirst: string;
  studio: string;
  link: string;
}

/**
 * The invite, in the customer's language: what the studio copies into its
 * own message, and the SMS when a provider exists. Short (an SMS or two)
 * and nothing a carrier's filter reads as spam.
 */
export function inviteMessage(lang: InviteLang, w: InviteWords): string {
  if (lang === 'hi') {
    return `${w.customerFirst} जी, ${w.studio} ने आपके घर का प्रोजेक्ट One Interiors ऐप पर शुरू किया है। रोज़ की साइट अपडेट, पेमेंट और दस्तावेज़ वहाँ देखें। इसी नंबर से साइन इन करें: ${w.link}`;
  }
  if (lang === 'mr') {
    return `${w.customerFirst}, ${w.studio} ने तुमच्या घराचा प्रोजेक्ट One Interiors ॲपवर सुरू केला आहे. रोजचे साइट अपडेट, पेमेंट आणि कागदपत्रे तिथे पाहा. याच नंबरने साइन इन करा: ${w.link}`;
  }
  return `${w.customerFirst}, ${w.studio} has started your home's project on the One Interiors app. See the daily site update, payments and documents there. Sign in with this number: ${w.link}`;
}

/** The email, when the client record has an address. Plain text, like every notice. */
export function inviteEmail(w: InviteWords): { title: string; body: string; url: string } {
  return {
    title: `${w.studio} has started your project on One Interiors`,
    body: `${w.customerFirst}, ${w.studio} has started your home's project on the One Interiors app. You can follow it there: a site update every working day, the plan, payments and your documents.\n\nOpen the link and sign in with the mobile number you gave ${w.studio}.`,
    url: w.link,
  };
}
