/**
 * The six questions a public enquiry form asks, and what counts as an answer.
 *
 * Pure, no `server-only` — CONTRIBUTING §9.5. The page renders from this and
 * the server validates against it, so a field cannot exist on one side and
 * not the other.
 *
 * ## Why the list is fixed
 *
 * A stranger filling this in on a phone will answer three things well and
 * abandon at the seventh. So it asks for what a studio actually needs to ring
 * back and what makes the callback worth making — name, phone, roughly what
 * and where — and nothing that can be found out on that call.
 *
 * Email is optional and last because a phone number is what gets used. Budget
 * is deliberately absent: a stranger who has not spoken to anybody yet either
 * does not know or will guess low, and a wrong number on the card is worse
 * than a blank one.
 *
 * ## Validation runs on the server, always
 *
 * Everything here is called again in `capture.ts` after the post. The browser
 * copy is a courtesy; the HTTP request is the interface, and anyone can post
 * to it with curl.
 */

import { PUNE_LOCALITIES } from '@/modules/brief/types';

/** Length caps. A JSONB column and a TEXT column both accept a megabyte. */
export const CAPS = {
  name: 80,
  phone: 20,
  email: 120,
  locality: 60,
  config: 40,
  message: 1200,
} as const;

export interface CaptureInput {
  name: string;
  phone: string;
  email?: string;
  locality?: string;
  config?: string;
  message?: string;
  /**
   * The honeypot. A real browser never fills it, because it is hidden from
   * layout and from the accessibility tree.
   */
  company?: string;
}

export interface CaptureClean {
  name: string;
  phone: string;
  email: string | null;
  locality: string | null;
  config: string | null;
  message: string | null;
}

export type CaptureVerdict =
  | { ok: true; value: CaptureClean }
  | { ok: false; field: keyof CaptureInput; message: string }
  /**
   * The honeypot caught it.
   *
   * Distinct from an error because the CALLER must not say so. A bot told it
   * failed simply tries again with the field blank; a bot told it succeeded
   * goes away. So this ends with a thank-you page and no row.
   */
  | { ok: false; silent: true };

/** What the property line offers. Free text would produce forty spellings. */
export const CONFIGS = ['1 BHK', '2 BHK', '3 BHK', '4+ BHK', 'Villa / Row house', 'Other'];

/**
 * A ten-digit Indian mobile, however it was typed.
 *
 * Shares the peeling approach with `csv.ts` rather than matching fixed
 * lengths, because the prefixes combine: `091-98765-43210` carries both a
 * trunk zero and a country code.
 */
export function normalisePhone(raw: string): string | null {
  const digits = raw.replace(/\D/g, '');
  if (digits.length === 0) return null;

  let d = digits;
  while (d.length > 10) {
    if (d.startsWith('0')) d = d.slice(1);
    else if (d.startsWith('91')) d = d.slice(2);
    else break;
  }

  if (d.length !== 10) return null;
  /* Indian mobile numbers start 6-9. A landline or a typo here is a callback
     that fails silently three days later, which is the worst outcome for
     both sides. */
  if (!/^[6-9]/.test(d)) return null;
  return d;
}

/**
 * Good enough to be worth storing.
 *
 * Deliberately not RFC 5322. A regex that accepts every legal address rejects
 * nothing useful and a regex that rejects every illegal one rejects real
 * people — this catches the typo that matters (no @, no dot, spaces) and
 * lets everything else through, because email is optional here anyway.
 */
export function looksLikeEmail(raw: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(raw);
}

/** Known Pune locality slugs, for turning a typed label back into one. */
const LOCALITY_BY_LABEL = new Map<string, string>(
  PUNE_LOCALITIES.map((l) => [l.label.toLowerCase(), l.slug]),
);

/**
 * A locality slug if we recognise what they typed, otherwise null.
 *
 * Unrecognised text is dropped rather than stored raw. The board groups and
 * filters on the slug, and a free-text "Baner " sitting beside the slug
 * `baner` would split one area into two that never compare equal — the same
 * trap AxLeads' grouping module spends three defences on.
 *
 * What they typed is not lost: it goes into the message, so a studio reading
 * the card still sees it.
 */
export function localitySlug(raw: string): string | null {
  return LOCALITY_BY_LABEL.get(raw.trim().toLowerCase()) ?? null;
}

export function validate(input: CaptureInput): CaptureVerdict {
  /* The honeypot first, before any work. */
  if (input.company && input.company.trim().length > 0) return { ok: false, silent: true };

  const name = (input.name ?? '').trim();
  if (name.length < 2) {
    return { ok: false, field: 'name', message: 'Tell us your name.' };
  }
  if (name.length > CAPS.name) {
    return { ok: false, field: 'name', message: 'That is longer than a name.' };
  }

  const phone = normalisePhone(input.phone ?? '');
  if (!phone) {
    return {
      ok: false,
      field: 'phone',
      message: 'A ten-digit mobile number, so they can call you back.',
    };
  }

  const rawEmail = (input.email ?? '').trim();
  if (rawEmail.length > 0) {
    if (rawEmail.length > CAPS.email || !looksLikeEmail(rawEmail)) {
      return { ok: false, field: 'email', message: 'That email does not look right.' };
    }
  }

  const rawMessage = (input.message ?? '').trim();
  if (rawMessage.length > CAPS.message) {
    return { ok: false, field: 'message', message: 'Keep it under a few paragraphs.' };
  }

  const rawLocality = (input.locality ?? '').trim().slice(0, CAPS.locality);
  const slug = rawLocality.length > 0 ? localitySlug(rawLocality) : null;

  const config = (input.config ?? '').trim().slice(0, CAPS.config);

  return {
    ok: true,
    value: {
      name,
      phone,
      email: rawEmail.length > 0 ? rawEmail : null,
      locality: slug,
      config: CONFIGS.includes(config) ? config : null,
      /* An unrecognised area is appended rather than dropped, so the studio
         still reads what the person actually said. */
      message: buildMessage(rawMessage, rawLocality, slug),
    },
  };
}

function buildMessage(message: string, rawLocality: string, slug: string | null): string | null {
  const bits: string[] = [];
  if (message.length > 0) bits.push(message);
  if (rawLocality.length > 0 && slug === null) bits.push(`Area given as: ${rawLocality}`);
  return bits.length > 0 ? bits.join('\n\n') : null;
}
