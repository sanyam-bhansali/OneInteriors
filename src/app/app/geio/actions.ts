'use server';

/**
 * GEIO's one action: a question (and maybe a photo) in, a checked answer out.
 * Everything from the browser is length-capped and shape-checked here; the
 * home's facts are added on the server, never taken from the page.
 */

import { headers } from 'next/headers';
import { ARCHITECT } from '@/modules/consultation/architect';
import { askGeio, type GeioImage, type GeioLang, type GeioReply, type GeioTurn } from '@/modules/app/geio';

const WINDOW_MS = 10 * 60_000;
const MAX_PER_WINDOW = 20;
const MAX_IMAGE_CHARS = 2_000_000; // base64 of a ~1.5 MB photo; the page sends ~150 KB
const seen = new Map<string, number[]>();

function withinLimit(key: string): boolean {
  const now = Date.now();
  const recent = (seen.get(key) ?? []).filter((t) => now - t < WINDOW_MS);
  if (recent.length >= MAX_PER_WINDOW) return false;
  recent.push(now);
  seen.set(key, recent);
  if (seen.size > 5_000) seen.clear();
  return true;
}

const text = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

function image(v: unknown): GeioImage | null {
  if (typeof v !== 'string' || v.length > MAX_IMAGE_CHARS) return null;
  const m = v.match(/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/);
  return m ? { mediaType: m[1] as GeioImage['mediaType'], data: m[2]! } : null;
}

export type GeioResult = { ok: true; reply: GeioReply } | { ok: false; reason: 'unavailable' | 'busy' | 'empty' };

export async function askGeioAction(input: {
  question: unknown;
  history: unknown;
  image?: unknown;
  lang: unknown;
  name: unknown;
}): Promise<GeioResult> {
  const pic = image(input.image);
  const question = text(input.question, 600) || (pic ? 'Is this normal?' : '');
  if (!question) return { ok: false, reason: 'empty' };

  const h = await headers();
  const key = h.get('x-forwarded-for')?.split(',')[0]?.trim() || h.get('x-real-ip') || 'unknown';
  if (!withinLimit(key)) return { ok: false, reason: 'busy' };

  // Alternating turns, oldest first, ending with GEIO's — the model's API wants them that way.
  const raw = Array.isArray(input.history) ? input.history.slice(-8) : [];
  const history: GeioTurn[] = [];
  for (const t of raw) {
    if (!t || typeof t !== 'object') continue;
    const role = (t as { role?: unknown }).role === 'assistant' ? 'assistant' : 'user';
    const said = text((t as { text?: unknown }).text, 1500);
    if (!said || history.at(-1)?.role === role || (history.length === 0 && role !== 'user')) continue;
    history.push({ role, text: said });
  }
  if (history.at(-1)?.role === 'user') history.pop();

  const lang: GeioLang = input.lang === 'hi' || input.lang === 'mr' ? input.lang : 'en';
  const name = text(input.name, 40).replace(/[^\p{L}\p{M} .'-]/gu, '') || 'there';
  const expert = ARCHITECT.name.replace(/^Ar\.\s*/, '').split(' ')[0]!;

  const reply = await askGeio({ question, history, image: pic, lang, name, expert });
  return reply ? { ok: true, reply } : { ok: false, reason: 'unavailable' };
}
