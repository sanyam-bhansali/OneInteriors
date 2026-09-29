/**
 * What a quote covers — the scope, the rooms, and anything they unticked.
 *
 * ## Why this exists
 *
 * The first quote ignored the scope entirely. A customer who chose "Kitchen &
 * wardrobes" on a 1,250 sq ft 3 BHK was shown whole-home budget bands and then
 * quoted ₹15.5 L — beds, false ceiling, painting, electrical, a TV unit and a
 * safety door included (reproduced 29 Sep 2026; docs/CUSTOMER-JOURNEY-REVIEW.md
 * §4.2 #1). All four scopes are in the launch, so each one is priced as
 * itself:
 *
 * | Scope               | Lines                                                  |
 * |---------------------|--------------------------------------------------------|
 * | Full home           | every room, minus anything unticked                   |
 * | Kitchen & wardrobes | the kitchen + every bedroom's wardrobe and loft       |
 * | Single room(s)      | the rooms chosen, nothing else                        |
 * | Renovation          | the civil block + any rooms chosen                    |
 *
 * The checklist on the brief's scope screen is the quote: an item unticked
 * there leaves every studio's quote at once, so the comparison stays like for
 * like.
 *
 * Pure and tested (CONTRIBUTING §9.5). The same selection drives the brief's
 * checklist, the band prices on the level screen, and every studio's quote.
 */

import type { ScopeType } from '@/modules/brief/types';
import { CATALOGUE, NEED_ITEMS, ROOM_LABELS, type CatalogueItem, type Room } from './catalogue';

/** The rooms a customer can pick for a single-room job or a renovation. */
export const PICKABLE_ROOMS: Room[] = [
  'KITCHEN',
  'MASTER_BEDROOM',
  'SECOND_BEDROOM',
  'THIRD_BEDROOM',
  'LIVING_DINING',
  'BATHROOMS',
];

/** Which rooms a configuration actually has — no third bedroom in a 2 BHK. */
export function roomsFor(bhk: number): Room[] {
  return PICKABLE_ROOMS.filter((room) =>
    CATALOGUE.some((i) => i.room === room && !i.civil && (i.minBhk ?? 0) <= bhk),
  );
}

export interface ScopeSelection {
  scope: ScopeType | null;
  /** For a single-room job or a renovation: which rooms. */
  scopeRooms: string[];
  /** Catalogue codes they unticked on the checklist. */
  excludedItems: string[];
  /** What their household asks for that adds a line — `needAddsOf`. */
  adds?: NeedAdd[];
}

/**
 * The answers that add a line to the quote (build queue item 5): working from
 * home adds a study unit, a pooja room a mandir, "a lot of storage" extra
 * lofts. Vastu, smart home, low maintenance and entertaining change who fits,
 * not what is quoted, so they are not here.
 */
export const NEED_ADDS = ['WORKS_FROM_HOME', 'POOJA_ROOM', 'EXTRA_STORAGE'] as const;
export type NeedAdd = (typeof NEED_ADDS)[number];

/** Why the line is on their quote, in their terms. */
export const NEED_ADD_REASONS: Record<NeedAdd, string> = {
  WORKS_FROM_HOME: 'Added because you work from home',
  POOJA_ROOM: 'Added for your pooja room',
  EXTRA_STORAGE: 'Added because you need a lot of storage',
};

/** The adds a brief's household and needs imply. */
export function needAddsOf(brief: {
  needs?: readonly string[] | null;
  household?: { worksFromHome?: boolean } | null;
}): NeedAdd[] {
  const needs = new Set(brief.needs ?? []);
  const out: NeedAdd[] = [];
  if (brief.household?.worksFromHome) out.push('WORKS_FROM_HOME');
  if (needs.has('POOJA_ROOM')) out.push('POOJA_ROOM');
  if (needs.has('EXTRA_STORAGE')) out.push('EXTRA_STORAGE');
  return out;
}

/** The line each add brings, for this configuration. */
function itemForAdd(add: NeedAdd, bhk: number): CatalogueItem | undefined {
  const find = (code: string) => [...CATALOGUE, ...NEED_ITEMS].find((i) => i.code === code);
  switch (add) {
    case 'WORKS_FROM_HOME':
      // The second bedroom's workstation where there is one; a study unit in the living room otherwise.
      return bhk >= 2 ? find('second_workstation') : find('study_unit');
    case 'POOJA_ROOM':
      return find('mandir');
    case 'EXTRA_STORAGE':
      return find('extra_loft');
  }
}

export const FULL_HOME: ScopeSelection = { scope: 'FULL_HOME', scopeRooms: [], excludedItems: [] };

/** The selection a brief describes. */
export function selectionOf(brief: {
  scope: ScopeType | null;
  scopeRooms: string[];
  excludedItems: string[];
  needs?: readonly string[] | null;
  household?: { worksFromHome?: boolean } | null;
}): ScopeSelection {
  return {
    scope: brief.scope,
    scopeRooms: brief.scopeRooms ?? [],
    excludedItems: brief.excludedItems ?? [],
    adds: needAddsOf(brief),
  };
}

const isBedroom = (room: Room) =>
  room === 'MASTER_BEDROOM' || room === 'SECOND_BEDROOM' || room === 'THIRD_BEDROOM';

/** Is this item part of the scope at all, before anything is unticked? */
function inScope(item: CatalogueItem, selection: ScopeSelection): boolean {
  const rooms = new Set(selection.scopeRooms);
  switch (selection.scope) {
    case null:
    case 'FULL_HOME':
      return !item.civil;
    case 'KITCHEN_WARDROBE':
      return (
        item.room === 'KITCHEN' ||
        (isBedroom(item.room) && /_(wardrobe|loft)$/.test(item.code))
      );
    case 'SINGLE_ROOM':
      return !item.civil && rooms.has(item.room);
    case 'RENOVATION':
      return item.civil === true || rooms.has(item.room);
  }
}

/**
 * The lines the household adds on top of the scope, each with its reason.
 *
 * A whole-home or kitchen-and-wardrobes job gets them all. A job the customer
 * narrowed to named rooms (a single room, a renovation) gets only those in
 * the rooms they named — they drew that line themselves. A line the scope
 * already covers is not added twice.
 */
export function needLines(
  bhk: number,
  selection: ScopeSelection,
): { item: CatalogueItem; add: NeedAdd; reason: string }[] {
  const base = new Set(CATALOGUE.filter((i) => (i.minBhk ?? 0) <= bhk && inScope(i, selection)).map((i) => i.code));
  const narrow = selection.scope === 'SINGLE_ROOM' || selection.scope === 'RENOVATION';
  const rooms = new Set(selection.scopeRooms);
  const out: { item: CatalogueItem; add: NeedAdd; reason: string }[] = [];
  for (const add of selection.adds ?? []) {
    const item = itemForAdd(add, bhk);
    if (!item || base.has(item.code) || out.some((o) => o.item.code === item.code)) continue;
    if (narrow && !rooms.has(item.room)) continue;
    out.push({ item, add, reason: NEED_ADD_REASONS[add] });
  }
  return out;
}

/** Everything the scope covers for this configuration — the checklist. */
export function scopeCandidates(bhk: number, selection: ScopeSelection): CatalogueItem[] {
  const base = CATALOGUE.filter((i) => (i.minBhk ?? 0) <= bhk && inScope(i, selection));
  return [...base, ...needLines(bhk, selection).map((n) => n.item)];
}

/** What is actually quoted: the candidates, minus what they unticked. */
export function scopeItems(bhk: number, selection: ScopeSelection): CatalogueItem[] {
  const off = new Set(selection.excludedItems);
  return scopeCandidates(bhk, selection).filter((i) => !off.has(i.code));
}

/** The checklist, grouped by room in the order a quotation reads. */
export function checklistFor(
  bhk: number,
  selection: ScopeSelection,
): { room: Room; label: string; items: CatalogueItem[] }[] {
  const items = scopeCandidates(bhk, selection);
  const order = [...PICKABLE_ROOMS, 'WHOLE_HOME', 'CIVIL'] as Room[];
  return order
    .map((room) => ({ room, label: ROOM_LABELS[room], items: items.filter((i) => i.room === room) }))
    .filter((g) => g.items.length > 0);
}

/** Can the brief move on from the scope screen with this selection? */
export function scopeReady(bhk: number, selection: ScopeSelection): boolean {
  if (!selection.scope) return false;
  if (selection.scope === 'SINGLE_ROOM' && selection.scopeRooms.length === 0) return false;
  return scopeItems(bhk, selection).length > 0;
}

/**
 * The scope in a few words — "Kitchen & wardrobes", "Master bedroom and
 * kitchen", "Renovation — civil work and bathrooms" — for the running panel,
 * the quote's heading and the studio's brief.
 */
export function scopePhrase(selection: ScopeSelection): string | null {
  const rooms = selection.scopeRooms
    .filter((r): r is Room => r in ROOM_LABELS)
    .map((r) => ROOM_LABELS[r].toLowerCase());
  const list = rooms.length <= 1 ? rooms.join('') : `${rooms.slice(0, -1).join(', ')} and ${rooms.at(-1)}`;
  switch (selection.scope) {
    case 'FULL_HOME':
      return 'Full home';
    case 'KITCHEN_WARDROBE':
      return 'Kitchen & wardrobes';
    case 'SINGLE_ROOM':
      return list ? list.charAt(0).toUpperCase() + list.slice(1) : 'One room';
    case 'RENOVATION':
      return list ? `Renovation — civil work and ${list}` : 'Renovation — civil work';
    default:
      return null;
  }
}
