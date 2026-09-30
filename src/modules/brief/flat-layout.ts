/**
 * A typical layout for a Pune flat of this configuration and size, in
 * metres — the rooms the 3D view builds (components/oi/Flat3D.tsx) and the
 * shape the sketches share. A schematic: bedrooms stacked along one side,
 * living and dining across the other, kitchen and bathrooms behind it.
 * Never presented as their floor plan.
 *
 * Pure, and tested: the rooms tile the plan exactly, so their areas add up
 * to the carpet area.
 */

import { scopeCandidates, type ScopeSelection } from '@/modules/quotation/scope';

export type LayoutRoomKey =
  | 'MASTER_BEDROOM'
  | 'SECOND_BEDROOM'
  | 'THIRD_BEDROOM'
  | 'FOURTH_BEDROOM'
  | 'LIVING_DINING'
  | 'KITCHEN'
  | 'BATHROOMS';

export interface LayoutRoom {
  key: LayoutRoomKey;
  label: string;
  /** Top-left corner and size on the floor, metres. x across, z deep. */
  x: number;
  z: number;
  w: number;
  d: number;
  kind: 'bedroom' | 'living' | 'kitchen' | 'bath';
}

export interface FlatLayout {
  width: number;
  depth: number;
  rooms: LayoutRoom[];
}

const SQFT_TO_M2 = 0.092903;
const BED_KEYS: LayoutRoomKey[] = ['MASTER_BEDROOM', 'SECOND_BEDROOM', 'THIRD_BEDROOM', 'FOURTH_BEDROOM'];
const BED_LABELS = ['Master bedroom', 'Bedroom 2', 'Bedroom 3', 'Bedroom 4'];

export function flatLayout(bedrooms: number, carpetAreaSqft: number): FlatLayout {
  const beds = Math.min(4, Math.max(1, Math.round(bedrooms)));
  const area = Math.max(250, carpetAreaSqft) * SQFT_TO_M2;
  const width = Math.sqrt(area * 1.4);
  const depth = area / width;

  const leftW = width * (beds === 1 ? 0.42 : 0.4);
  const rightW = width - leftW;
  const rooms: LayoutRoom[] = [];

  // Bedrooms down the left; the master a little larger.
  const weights = Array.from({ length: beds }, (_, i) => (i === 0 ? 1.25 : 1));
  const total = weights.reduce((a, b) => a + b, 0);
  let z = 0;
  weights.forEach((wt, i) => {
    const d = (depth * wt) / total;
    rooms.push({ key: BED_KEYS[i]!, label: BED_LABELS[i]!, x: 0, z, w: leftW, d, kind: 'bedroom' });
    z += d;
  });

  // Living and dining across the front; kitchen and bathrooms behind.
  const livingD = depth * 0.6;
  rooms.push({ key: 'LIVING_DINING', label: 'Living & dining', x: leftW, z: 0, w: rightW, d: livingD, kind: 'living' });
  const bathW = rightW * 0.4;
  rooms.push({ key: 'BATHROOMS', label: 'Bathrooms', x: leftW, z: livingD, w: bathW, d: depth - livingD, kind: 'bath' });
  rooms.push({ key: 'KITCHEN', label: 'Kitchen', x: leftW + bathW, z: livingD, w: rightW - bathW, d: depth - livingD, kind: 'kitchen' });

  return { width, depth, rooms };
}

/** Area of the rooms, m² — equals the carpet area by construction. */
export function layoutArea(layout: FlatLayout): number {
  return layout.rooms.reduce((a, r) => a + r.w * r.d, 0);
}

/** The layout's rooms that the work touches, from the scope; bedroom 4 follows bedroom 3. */
export function layoutRoomsInScope(bedrooms: number, selection: ScopeSelection): LayoutRoomKey[] {
  const rooms = new Set<string>(scopeCandidates(Math.min(3, bedrooms), selection).map((i) => i.room));
  const keys: LayoutRoomKey[] = ['MASTER_BEDROOM', 'SECOND_BEDROOM', 'THIRD_BEDROOM', 'LIVING_DINING', 'KITCHEN', 'BATHROOMS'];
  const out = keys.filter((k) => rooms.has(k));
  if (bedrooms >= 4 && rooms.has('THIRD_BEDROOM')) out.push('FOURTH_BEDROOM');
  return out;
}
