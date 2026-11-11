/**
 * Cleaning what our team types into an item (owner, 10 Nov 2026). Pure.
 *
 * Lists (materials, finishes, other names) arrive one per line. Hindi and
 * Marathi arrive as `hi` / `mr` objects with the same fields; an empty one is
 * dropped, so the page falls back to English field by field.
 */

import { isSlug, normaliseName, slugify } from './rules';

export const ITEM_ROOMS = ['Kitchen', 'Bedroom', 'Living', 'Bathroom', 'Whole home', 'Civil'] as const;

export interface ItemInput {
  slug: string;
  name: string;
  room: string;
  summary: string;
  whatItDoes: string;
  materials: string[];
  finishes: string[];
  typicalSize: string | null;
  aliases: string[];
  published: boolean;
  translations: Record<string, Record<string, string | string[]>> | null;
}

function text(v: unknown, max: number): string {
  return typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max) : '';
}

function para(v: unknown, max: number): string {
  return typeof v === 'string' ? v.replace(/\r\n/g, '\n').trim().slice(0, max) : '';
}

/** One per line (or an array), trimmed, empty and repeated lines dropped, at most 20. */
export function lines(v: unknown, max = 120): string[] {
  const raw = Array.isArray(v) ? v : typeof v === 'string' ? v.split(/\r?\n/) : [];
  const out: string[] = [];
  for (const r of raw) {
    const t = text(r, max);
    if (t && !out.includes(t)) out.push(t);
  }
  return out.slice(0, 20);
}

function words(v: unknown): Record<string, string | string[]> | null {
  if (!v || typeof v !== 'object') return null;
  const r = v as Record<string, unknown>;
  const out: Record<string, string | string[]> = {};
  const name = text(r.name, 120);
  const summary = para(r.summary, 400);
  const whatItDoes = para(r.whatItDoes, 1200);
  const typicalSize = text(r.typicalSize, 160);
  const materials = lines(r.materials);
  const finishes = lines(r.finishes);
  if (name) out.name = name;
  if (summary) out.summary = summary;
  if (whatItDoes) out.whatItDoes = whatItDoes;
  if (typicalSize) out.typicalSize = typicalSize;
  if (materials.length) out.materials = materials;
  if (finishes.length) out.finishes = finishes;
  return Object.keys(out).length ? out : null;
}

export function cleanItemInput(
  raw: Partial<Record<keyof ItemInput, unknown>> & { hi?: unknown; mr?: unknown },
  opts: { partial?: boolean } = {},
): { ok: true; value: ItemInput } | { ok: false; error: string } {
  const name = text(raw.name, 120);
  if (!name) return { ok: false, error: 'Give the item a name.' };
  const room = text(raw.room, 40);
  if (!(ITEM_ROOMS as readonly string[]).includes(room)) return { ok: false, error: 'Pick the room it belongs in.' };
  const typed = text(raw.slug, 80).toLowerCase();
  const slug = typed ? typed : slugify(name);
  if (!isSlug(slug)) return { ok: false, error: 'The address can only have lowercase letters, numbers and hyphens, like "kitchen-base-cabinets".' };

  const hi = words(raw.hi ?? (raw.translations as Record<string, unknown> | undefined)?.hi);
  const mr = words(raw.mr ?? (raw.translations as Record<string, unknown> | undefined)?.mr);
  const translations = hi || mr ? { ...(hi ? { hi } : {}), ...(mr ? { mr } : {}) } : null;

  const value: ItemInput = {
    slug,
    name,
    room,
    summary: para(raw.summary, 400),
    whatItDoes: para(raw.whatItDoes, 1200),
    materials: lines(raw.materials),
    finishes: lines(raw.finishes),
    typicalSize: text(raw.typicalSize, 160) || null,
    aliases: lines(raw.aliases, 80).map(normaliseName).filter(Boolean),
    published: raw.published === true || raw.published === 'on' || raw.published === 'true',
    translations,
  };
  if (!opts.partial && value.published && !value.summary) return { ok: false, error: 'Write what it is before publishing the page.' };
  return { ok: true, value };
}
