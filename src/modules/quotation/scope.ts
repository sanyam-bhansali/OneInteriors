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
import { CATALOGUE, ROOM_LABELS, type CatalogueItem, type Room } from './catalogue';

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
}

export const FULL_HOME: ScopeSelection = { scope: 'FULL_HOME', scopeRooms: [], excludedItems: [] };

/** The selection a brief describes. */
export function selectionOf(brief: {
  scope: ScopeType | null;
  scopeRooms: string[];
  excludedItems: string[];
}): ScopeSelection {
  return {
    scope: brief.scope,
    scopeRooms: brief.scopeRooms ?? [],
    excludedItems: brief.excludedItems ?? [],
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

/** Everything the scope covers for this configuration — the checklist. */
export function scopeCandidates(bhk: number, selection: ScopeSelection): CatalogueItem[] {
  return CATALOGUE.filter((i) => (i.minBhk ?? 0) <= bhk && inScope(i, selection));
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
