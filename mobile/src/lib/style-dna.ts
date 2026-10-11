import { STYLE_LABELS, type StyleTag } from './brief-types';

/**
 * Style DNA, worked out on the phone: no server needed.
 *
 * COPIED from the website (React Native cannot import from src/):
 *   - `styleDna` from src/modules/brief/style-dna.ts
 *   - `LIKE_WEIGHTS` from src/modules/matching/style-affinity.ts
 *   - the materials and colours from src/modules/brief/palettes.ts (STYLE_PALETTES)
 *   - the photos from src/data/style-photos.ts (STYLE_PHOTOS, the living-room set)
 * Keep them identical: the website's Style DNA card and the app's must agree.
 */

const LIKE_WEIGHTS = [1, 0.85, 0.7] as const;

/** wall, floor, furniture, trim, accent — and three named materials (shown in English). */
const PALETTES: Record<StyleTag, { colors: [string, string, string, string, string]; materials: [string, string, string] }> = {
  'contemporary-minimal': { colors: ['#EDECE8', '#CFC7BA', '#8E8B84', '#B4AFA6', '#22201E'], materials: ['Chalk white', 'Pale oak', 'Matte black'] },
  'warm-modern': { colors: ['#E9DFD3', '#A97C55', '#7C5A3E', '#C9A886', '#B45B36'], materials: ['Warm plaster', 'Walnut', 'Terracotta'] },
  'indian-contemporary': { colors: ['#F0E6D6', '#8A5A34', '#6B4426', '#A8763F', '#C08A2E'], materials: ['Ivory lime', 'Teak', 'Antique brass'] },
  scandinavian: { colors: ['#F4F3EF', '#D9CBB4', '#B9C4C6', '#C7C0B2', '#5E7C8B'], materials: ['Snow white', 'Bleached ash', 'Slate blue'] },
  industrial: { colors: ['#B7B2AC', '#57534E', '#3B3A38', '#6E6862', '#8C4A2F'], materials: ['Bare concrete', 'Blackened steel', 'Reclaimed brick'] },
  'mid-century': { colors: ['#E8DFC9', '#9B6B41', '#5F7355', '#B08A5C', '#C9922A'], materials: ['Bone', 'Teak veneer', 'Mustard'] },
  'classical-ornate': { colors: ['#EFE6D2', '#5B3A24', '#40261A', '#8A6A3C', '#A98431'], materials: ['Cream moulding', 'Mahogany', 'Gilt'] },
  'art-deco': { colors: ['#1F3A38', '#2A2724', '#123331', '#C9A227', '#C9A227'], materials: ['Emerald lacquer', 'Ebony', 'Polished brass'] },
  'rustic-earthy': { colors: ['#DCCDB8', '#8E5A3C', '#9A7A57', '#B08F69', '#9C4A2A'], materials: ['Clay plaster', 'Kotah stone', 'Jute'] },
  'luxe-glam': { colors: ['#EDE4DC', '#D8CFC6', '#8E6F73', '#C4A88C', '#B08D57'], materials: ['Champagne', 'Statuario marble', 'Rose gold'] },
  japandi: { colors: ['#EAE5DA', '#C4A87C', '#4A4744', '#A8977E', '#6E7A5A'], materials: ['Warm paper', 'Light oak', 'Charcoal'] },
  'coastal-light': { colors: ['#F1F2EE', '#DED3BE', '#AFC3C7', '#C6CFC9', '#3F7A8C'], materials: ['Sea salt', 'Driftwood', 'Harbour blue'] },
};

/** The website's Unsplash hotlinks for the style picker (living rooms). */
const PHOTO_IDS: Record<StyleTag, string> = {
  'contemporary-minimal': 'photo-1724582586529-62622e50c0b3',
  'warm-modern': 'photo-1720247520862-7e4b14176fa8',
  'indian-contemporary': 'photo-1713192706971-03900dcf5706',
  scandinavian: 'photo-1776673687936-65e63a5a3e05',
  industrial: 'photo-1650091009622-4cbe6def4d2e',
  'mid-century': 'photo-1541085929911-dea736e9287b',
  'classical-ornate': 'photo-1782365413737-afddac42efa4',
  'art-deco': 'photo-1757618977945-2d924c31ab2b',
  'rustic-earthy': 'photo-1782346056252-c3699920bf19',
  'luxe-glam': 'photo-1758448755778-90ebf4d0f1e7',
  japandi: 'photo-1715639116465-92add34d121f',
  'coastal-light': 'photo-1600493505873-cddd69453072',
};

export function stylePhoto(tag: StyleTag): string {
  return `https://images.unsplash.com/${PHOTO_IDS[tag]}?w=600&q=70&auto=format&fit=crop`;
}

export interface StyleDna {
  shares: { tag: StyleTag; label: string; pct: number }[];
  /** wall, floor, furniture, trim, accent of the leading style. */
  palette: string[];
  materials: [string, string, string];
  shareText: string;
}

export function styleDna(likes: readonly StyleTag[], site = 'https://oneinteriors.in'): StyleDna | null {
  const tags = likes.slice(0, 3);
  if (tags.length === 0) return null;
  const weights = tags.map((_, i) => LIKE_WEIGHTS[i] ?? 0.7);
  const total = weights.reduce((a, b) => a + b, 0);
  const pcts = weights.map((w) => Math.round((w / total) * 100));
  pcts[0] += 100 - pcts.reduce((a, b) => a + b, 0); // rounding lands on the leader
  const shares = tags.map((tag, i) => ({ tag, label: STYLE_LABELS[tag], pct: pcts[i] }));
  const p = PALETTES[tags[0]];
  const line = shares.map((s) => `${s.pct}% ${s.label}`).join(', ');
  return {
    shares,
    palette: p.colors,
    materials: p.materials,
    shareText: `My home's style DNA: ${line}. Find yours in four minutes: ${site}/quiz`,
  };
}
