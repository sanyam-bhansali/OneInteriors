/**
 * Material palettes for each style.
 *
 * These are the real thing, not decoration: the quiz asks people to choose a
 * direction before they have the vocabulary for it, so the tiles have to carry
 * actual material information — the walnut, the brass, the terrazzo — or the
 * choice is meaningless and the match built on it is noise.
 *
 * Colours are named after the material a Pune studio would actually quote.
 * Fixed hex, not theme tokens: a teak is a teak in dark mode too.
 */

import type { StyleTag } from './types';

export type Motif = 'minimal' | 'organic' | 'industrial' | 'deco' | 'ornate' | 'soft';

export interface StylePalette {
  /** Wall / ground */
  wall: string;
  /** Floor band */
  floor: string;
  /** Primary furniture mass */
  furniture: string;
  /** The accent a client would notice first */
  accent: string;
  /** Trim, joinery lines */
  trim: string;
  /** Which room archetype to draw */
  motif: Motif;
  /** Named materials, shown as swatch labels */
  materials: [string, string, string];
}

export const STYLE_PALETTES: Record<StyleTag, StylePalette> = {
  'contemporary-minimal': {
    wall: '#EDECE8',
    floor: '#CFC7BA',
    furniture: '#8E8B84',
    accent: '#22201E',
    trim: '#B4AFA6',
    motif: 'minimal',
    materials: ['Chalk white', 'Pale oak', 'Matte black'],
  },
  'warm-modern': {
    wall: '#E9DFD3',
    floor: '#A97C55',
    furniture: '#7C5A3E',
    accent: '#B45B36',
    trim: '#C9A886',
    motif: 'soft',
    materials: ['Warm plaster', 'Walnut', 'Terracotta'],
  },
  'indian-contemporary': {
    wall: '#F0E6D6',
    floor: '#8A5A34',
    furniture: '#6B4426',
    accent: '#C08A2E',
    trim: '#A8763F',
    motif: 'ornate',
    materials: ['Ivory lime', 'Teak', 'Antique brass'],
  },
  scandinavian: {
    wall: '#F4F3EF',
    floor: '#D9CBB4',
    furniture: '#B9C4C6',
    accent: '#5E7C8B',
    trim: '#C7C0B2',
    motif: 'minimal',
    materials: ['Snow white', 'Bleached ash', 'Slate blue'],
  },
  industrial: {
    wall: '#B7B2AC',
    floor: '#57534E',
    furniture: '#3B3A38',
    accent: '#8C4A2F',
    trim: '#6E6862',
    motif: 'industrial',
    materials: ['Bare concrete', 'Blackened steel', 'Reclaimed brick'],
  },
  'mid-century': {
    wall: '#E8DFC9',
    floor: '#9B6B41',
    furniture: '#5F7355',
    accent: '#C9922A',
    trim: '#B08A5C',
    motif: 'minimal',
    materials: ['Bone', 'Teak veneer', 'Mustard'],
  },
  'classical-ornate': {
    wall: '#EFE6D2',
    floor: '#5B3A24',
    furniture: '#40261A',
    accent: '#A98431',
    trim: '#8A6A3C',
    motif: 'ornate',
    materials: ['Cream moulding', 'Mahogany', 'Gilt'],
  },
  'art-deco': {
    wall: '#1F3A38',
    floor: '#2A2724',
    furniture: '#123331',
    accent: '#C9A227',
    trim: '#C9A227',
    motif: 'deco',
    materials: ['Emerald lacquer', 'Ebony', 'Polished brass'],
  },
  'rustic-earthy': {
    wall: '#DCCDB8',
    floor: '#8E5A3C',
    furniture: '#9A7A57',
    accent: '#9C4A2A',
    trim: '#B08F69',
    motif: 'organic',
    materials: ['Clay plaster', 'Kotah stone', 'Jute'],
  },
  'luxe-glam': {
    wall: '#EDE4DC',
    floor: '#D8CFC6',
    furniture: '#8E6F73',
    accent: '#B08D57',
    trim: '#C4A88C',
    motif: 'deco',
    materials: ['Champagne', 'Statuario marble', 'Rose gold'],
  },
  japandi: {
    wall: '#EAE5DA',
    floor: '#C4A87C',
    furniture: '#4A4744',
    accent: '#6E7A5A',
    trim: '#A8977E',
    motif: 'organic',
    materials: ['Warm paper', 'Light oak', 'Charcoal'],
  },
  'coastal-light': {
    wall: '#F1F2EE',
    floor: '#DED3BE',
    furniture: '#AFC3C7',
    accent: '#3F7A8C',
    trim: '#C6CFC9',
    motif: 'soft',
    materials: ['Sea salt', 'Driftwood', 'Harbour blue'],
  },
};

/** Deterministic pick so a studio always gets the same artwork. */
export function hashToIndex(seed: string, length: number): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return h % length;
}
