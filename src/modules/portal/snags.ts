/**
 * Snags (docs/CUSTOMER-PLATFORM-PLAN.md, step 1): something wrong on site,
 * raised by the customer or at the handover walk-through, fixed by the
 * studio by a date. Pure, and tested.
 */

export const SNAG_LIMITS = { title: 120, room: 40, note: 600, photos: 4 } as const;

export type SnagStatus = 'OPEN' | 'FIXED';

const text = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().replace(/\s+/g, ' ').slice(0, max) : '');

export type SnagCheck = { ok: true; value: { title: string; room: string | null; note: string | null } } | { ok: false; error: string };

export function checkSnag(input: { title: unknown; room?: unknown; note?: unknown }): SnagCheck {
  const title = text(input.title, SNAG_LIMITS.title);
  if (title.length < 3) return { ok: false, error: 'Say what is wrong, in a few words.' };
  const room = text(input.room, SNAG_LIMITS.room) || null;
  const note = text(input.note, SNAG_LIMITS.note) || null;
  return { ok: true, value: { title, room, note } };
}

/** "Fix by Sat 10 Oct" while open and dated; "Fixed 26 Sep" once fixed; null otherwise. */
export function snagLine(s: { status: string; fixBy: Date | null; fixedAt: Date | null }): string | null {
  const fmt = (d: Date) =>
    d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'Asia/Kolkata' }).replace(',', '');
  if (s.status === 'FIXED') return s.fixedAt ? `Fixed ${fmt(s.fixedAt)}` : 'Fixed';
  return s.fixBy ? `Fix by ${fmt(s.fixBy)}` : null;
}
