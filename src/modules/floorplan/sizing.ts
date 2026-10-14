/**
 * Sizes from a floor plan, for a first quote and a studio's standard build.
 *
 * Pure (CONTRIBUTING §9.5). The rules are Hauspire's Quotation Studio's, which
 * were checked against its own quotations:
 *
 * - A bedroom's wardrobe takes 55% of the room's SHORTER wall, rounded to
 *   50 mm and kept between 1200 and 2400 mm — a wardrobe is never the whole
 *   wall (doors, windows and the bed are on it too) and never a token one.
 *   Shorter, as Hauspire's locked first-quote builder has it
 *   (`buildQuote.ts wardrobeWidth`, FIRST_QUOTE_LOCKED.md) and as
 *   docs/QUOTATION-ENGINE-INTEGRATION.md recorded; this file said "longer"
 *   until 12 Oct 2026, which over-sized every wardrobe on a long room.
 * - A room's false ceiling is its floor area.
 * - Bedrooms are taken master first (the one the plan calls master, else the
 *   largest), then the rest largest first, which is the order the quotation
 *   names them in (Master, Kids, Guest, Parents).
 */

import type { PlanRoomSize } from '@/modules/brief/types';

const MM2_PER_SQFT = 92_903.04;

export function areaSqft(room: Pick<PlanRoomSize, 'widthMm' | 'depthMm'>): number {
  return Math.round((room.widthMm * room.depthMm) / MM2_PER_SQFT);
}

/** The wardrobe width a bedroom takes. */
export function wardrobeWidthMm(room: Pick<PlanRoomSize, 'widthMm' | 'depthMm'>): number {
  const wall = Math.min(room.widthMm, room.depthMm);
  const width = Math.round((wall * 0.55) / 50) * 50;
  return Math.min(2400, Math.max(1200, width));
}

/** The plan's bedrooms, master first, then largest first. */
export function bedroomsInOrder(rooms: PlanRoomSize[]): PlanRoomSize[] {
  const beds = rooms.filter((r) => r.code === 'BEDROOM');
  const size = (r: PlanRoomSize) => r.widthMm * r.depthMm;
  const master = beds.find((r) => /master/i.test(r.name)) ?? [...beds].sort((a, b) => size(b) - size(a))[0];
  if (!master) return [];
  return [master, ...beds.filter((r) => r !== master).sort((a, b) => size(b) - size(a))];
}

/** Living and dining together, as a quotation prices their ceiling. */
export function livingSqft(rooms: PlanRoomSize[]): number | null {
  const parts = rooms.filter((r) => r.code === 'LIVING' || r.code === 'DINING');
  return parts.length ? parts.reduce((t, r) => t + areaSqft(r), 0) : null;
}

/**
 * The plan room for a quotation room, by name: "Master bedroom" is the first
 * bedroom, "Kids bedroom" the second, and so on; "Living and dining" is the
 * living and dining together; a study is the study.
 */
export function planRoomFor(
  quoteRoom: string,
  bedroomIndex: number | null,
  rooms: PlanRoomSize[],
): { widthMm: number; depthMm: number; sqft: number } | null {
  if (bedroomIndex !== null) {
    const bed = bedroomsInOrder(rooms)[bedroomIndex];
    return bed ? { widthMm: bed.widthMm, depthMm: bed.depthMm, sqft: areaSqft(bed) } : null;
  }
  if (/^living/i.test(quoteRoom)) {
    const sqft = livingSqft(rooms);
    const main = rooms.find((r) => r.code === 'LIVING') ?? rooms.find((r) => r.code === 'DINING');
    return sqft && main ? { widthMm: main.widthMm, depthMm: main.depthMm, sqft } : null;
  }
  if (/^kitchen/i.test(quoteRoom)) {
    const kitchen = rooms.find((r) => r.code === 'KITCHEN');
    return kitchen ? { widthMm: kitchen.widthMm, depthMm: kitchen.depthMm, sqft: areaSqft(kitchen) } : null;
  }
  if (/^study/i.test(quoteRoom)) {
    const study = rooms.find((r) => r.code === 'STUDY');
    return study ? { widthMm: study.widthMm, depthMm: study.depthMm, sqft: areaSqft(study) } : null;
  }
  return null;
}
