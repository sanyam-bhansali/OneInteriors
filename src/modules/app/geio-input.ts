/**
 * What GEIO accepts from a client, shared by the website's server action
 * (`app/app/geio/actions.ts`) and the phone app's `POST /api/app/v1/geio`,
 * so the two cannot drift apart. Pure apart from the in-memory rate limit,
 * and tested.
 *
 * Everything from a client is length-capped and shape-checked here; the
 * home's facts are added on the server, never taken from the request.
 */

import { ARCHITECT } from '@/modules/consultation/architect';
import type { GeioImage, GeioLang, GeioReply, GeioTurn } from './geio';

/** `plan`: they have signed and their project is on Basic; GEIO comes with Assured. */
export type GeioResult = { ok: true; reply: GeioReply } | { ok: false; reason: 'unavailable' | 'busy' | 'empty' | 'plan' };

const WINDOW_MS = 10 * 60_000;
const MAX_PER_WINDOW = 20;
const MAX_IMAGE_CHARS = 2_000_000; // base64 of a ~1.5 MB photo; the page sends ~150 KB
const seen = new Map<string, number[]>();

/**
 * Twenty questions in ten minutes per key. The website keys by IP (it may be
 * signed out); the app keys by user id, because a phone network puts
 * thousands of people behind one address. Per instance, which is enough to
 * stop a loop; the monthly budget in geio-budget.ts is the real ceiling.
 */
export function withinLimit(key: string, now = Date.now()): boolean {
  const recent = (seen.get(key) ?? []).filter((t) => now - t < WINDOW_MS);
  if (recent.length >= MAX_PER_WINDOW) return false;
  recent.push(now);
  seen.set(key, recent);
  if (seen.size > 5_000) seen.clear();
  return true;
}

export const geioText = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

export function geioImage(v: unknown): GeioImage | null {
  if (typeof v !== 'string' || v.length > MAX_IMAGE_CHARS) return null;
  const m = v.match(/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/);
  return m ? { mediaType: m[1] as GeioImage['mediaType'], data: m[2]! } : null;
}

/** The question, or "Is this normal?" for a photo sent without one; empty means nothing to ask. */
export function geioQuestion(question: unknown, image: GeioImage | null): string {
  return geioText(question, 600) || (image ? 'Is this normal?' : '');
}

/** Alternating turns, oldest first, ending with GEIO's — the model's API wants them that way. */
export function geioHistory(input: unknown): GeioTurn[] {
  const raw = Array.isArray(input) ? input.slice(-8) : [];
  const history: GeioTurn[] = [];
  for (const t of raw) {
    if (!t || typeof t !== 'object') continue;
    const role = (t as { role?: unknown }).role === 'assistant' ? 'assistant' : 'user';
    const said = geioText((t as { text?: unknown }).text, 1500);
    if (!said || history.at(-1)?.role === role || (history.length === 0 && role !== 'user')) continue;
    history.push({ role, text: said });
  }
  if (history.at(-1)?.role === 'user') history.pop();
  return history;
}

export const geioLang = (v: unknown): GeioLang => (v === 'hi' || v === 'mr' ? v : 'en');

/** A first name safe to put in the prompt, or "there". */
export const geioName = (v: unknown) => geioText(v, 40).replace(/[^\p{L}\p{M} .'-]/gu, '').trim() || 'there';

/** The One Interiors expert's first name: "Ar. Meera Kulkarni" → "Meera". */
export function expertFirstName(name = ARCHITECT.name): string {
  return name.replace(/^Ar\.\s*/, '').split(' ')[0]!;
}
