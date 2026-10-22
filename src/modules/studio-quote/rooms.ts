/**
 * The builder's room list, as Hauspire's quotation builder keeps it
 * (`builder/page.tsx`: roomList, applyConfig, renameRoom, moveRoom,
 * sortByRooms) — and the per-line "Discounted" figure of its table.
 *
 * Pure, no `server-only`: the builder runs it in the browser and the tests
 * reach it (CONTRIBUTING §9.5).
 *
 * ## Rooms are a list, lines follow it
 *
 * A quotation's rooms are the rooms its lines are in. The builder also holds
 * a list of room NAMES, so a configuration can lay out the rooms of a 3 BHK
 * before anything is in them, and the room order can be changed: the table,
 * the document and the pickers all read one order — the list, then any room
 * that exists only on a line. An empty room is never saved; it is a heading
 * waiting for its first line, and it goes away on reload exactly as it does in
 * Hauspire's builder.
 */

import { roomsFor, type ConfigName } from './configure';
import type { WorkCodeName } from './pricing';

/** Distinct rooms of these lines, in the order they first appear. */
export function roomsOfLines(lines: readonly { room: string }[]): string[] {
  const out: string[] = [];
  for (const l of lines) if (l.room && !out.includes(l.room)) out.push(l.room);
  return out;
}

/**
 * The one room order: the list (deduplicated), then any room that only exists
 * on a line, in the order it appears. Adding a line never reshuffles rooms.
 */
export function orderedRooms(list: readonly string[], lines: readonly { room: string }[]): string[] {
  const out: string[] = [];
  for (const r of list) if (r && !out.includes(r)) out.push(r);
  for (const r of roomsOfLines(lines)) if (!out.includes(r)) out.push(r);
  return out;
}

/**
 * Lines reordered so rooms follow `order`. Stable: lines keep their order
 * inside a room, and a room not in `order` keeps its place after the rest.
 */
export function sortByRooms<T extends { room: string }>(lines: readonly T[], order: readonly string[]): T[] {
  const rank = (r: string) => {
    const i = order.indexOf(r);
    return i < 0 ? order.length : i;
  };
  return lines
    .map((l, i) => ({ l, i }))
    .sort((a, b) => rank(a.l.room) - rank(b.l.room) || a.i - b.i)
    .map((x) => x.l);
}

/**
 * "Apply {BHK} configuration", without touching a line (Hauspire's
 * `applyConfig`): the rooms that configuration has — the same names the
 * standard build uses, so a hand-added Kitchen and a built one are one room —
 * with every room already on the quotation kept, after them. Whole-home work
 * stays last among the configuration's rooms.
 */
export function configRooms(
  config: ConfigName,
  opts: { study: boolean; bathrooms: number },
  linesNow: readonly { room: string }[],
): string[] {
  const list = roomsFor({ config, kitchenRunMm: null, bathrooms: opts.bathrooms, study: opts.study }).map((r) => r.name);
  for (const r of roomsOfLines(linesNow)) if (!list.includes(r)) list.push(r);
  return list;
}

/**
 * Rename a room in the list. Renaming onto a room that already exists merges
 * the two (the later copy goes).
 */
export function renameInList(list: readonly string[], from: string, to: string): string[] {
  const next = list.map((r) => (r === from ? to : r));
  return next.filter((r, i) => next.indexOf(r) === i);
}

/** Move a room one place up (-1) or down (1). Unchanged at either end. */
export function moveInList(list: readonly string[], room: string, by: -1 | 1): string[] {
  const i = list.indexOf(room);
  const j = i + by;
  if (i < 0 || j < 0 || j >= list.length) return list.slice();
  const next = list.slice();
  [next[i], next[j]] = [next[j]!, next[i]!];
  return next;
}

/** A new room's name, cleaned; null when it is empty or already a room. */
export function newRoomName(typed: string, rooms: readonly string[]): string | null {
  const name = typed.trim().replace(/\s+/g, ' ').slice(0, 80);
  if (!name) return null;
  if (rooms.some((r) => r.toLowerCase() === name.toLowerCase())) return null;
  return name;
}

/**
 * A line's figure after the modular discount — Hauspire's "Discounted"
 * column: modular (MO-01) lines carry the discount, on-site (NM-01) lines do
 * not. Display only: the total's discount is taken once on the modular sum
 * (`computeTotals`), so the column can differ from it by a rupee of rounding
 * per line; the total is the figure that prints.
 *
 * The old app's own formula, to the rupee (owner, 22 Oct 2026):
 * `Math.round(amount × (1 − 15%))`, in its float order.
 */
export function discountedPaise(amountPaise: number, code: WorkCodeName, discountBps: number): number {
  if (code !== 'MODULAR' || discountBps <= 0) return amountPaise;
  return Math.round((amountPaise / 100) * (1 - discountBps / 10_000)) * 100 + 0;
}
