/**
 * What to draw: three room mock-ups from a Design DNA, and the words sent to
 * the image AI for each.
 *
 * Each round shows the same room three ways, so a yes or no teaches the DNA
 * something:
 *  - A: the leading style, at the DNA's own light and density;
 *  - B: the second style (a blend), or the lead at the other light if there is
 *    only one style;
 *  - C: the lead with light or density turned the other way.
 * A later round starts from the DNA as it stands after their answers, so the
 * set moves with them. Deterministic: the same DNA, room and round give the
 * same three, which keeps a reload from redrawing and charging again.
 *
 * Pure and tested.
 */

import { STYLE_LABELS, type StyleTag } from '@/modules/brief/types';
import type { DesignDna, Density, Lightness } from './dna';

export const MOCKUP_ROOMS = ['LIVING', 'KITCHEN', 'BEDROOM_MAIN'] as const;
export type MockupRoom = (typeof MOCKUP_ROOMS)[number];

export const MOCKUP_ROOM_LABELS: Record<MockupRoom, string> = {
  LIVING: 'Living room',
  KITCHEN: 'Kitchen',
  BEDROOM_MAIN: 'Main bedroom',
};

const ROOM_PHRASE: Record<MockupRoom, string> = {
  LIVING: 'living and dining room',
  KITCHEN: 'modular kitchen',
  BEDROOM_MAIN: 'master bedroom with built-in wardrobe',
};

export interface MockupVariant {
  variant: 'A' | 'B' | 'C';
  style: StyleTag;
  /** A second style blended in, for variant B. */
  blend: StyleTag | null;
  light: Lightness;
  density: Density;
  /** What the customer reads under the picture. */
  caption: string;
  /** What the image AI is asked to draw. */
  prompt: string;
}

const otherLight = (l: Lightness): Lightness => (l === 'deep' ? 'light' : l === 'light' ? 'balanced' : 'light');
const otherDensity = (d: Density): Density => (d === 'calm' ? 'layered' : 'calm');

const LIGHT_WORDS: Record<Lightness, string> = {
  light: 'bright, airy, pale walls, lots of natural daylight',
  balanced: 'soft natural daylight, mid tones',
  deep: 'moody and rich, deeper wall colours, warm lamp light',
};

const DENSITY_WORDS: Record<Density, string> = {
  calm: 'uncluttered, few well-chosen objects, clean lines',
  layered: 'layered with rugs, art, plants and decor',
};

export function mockupVariants(dna: DesignDna, room: MockupRoom, round: number, bhk: string | null): MockupVariant[] {
  const lead = dna.shares[0]!.tag;
  const second = dna.shares[1]?.tag ?? null;
  // Later rounds swap which twist C makes, so round 2 is not round 1 again.
  const twistLight = round % 2 === 0;

  const raw: Omit<MockupVariant, 'caption' | 'prompt'>[] = [
    { variant: 'A', style: lead, blend: null, light: dna.light, density: dna.density },
    second
      ? { variant: 'B', style: lead, blend: second, light: dna.light, density: dna.density }
      : { variant: 'B', style: lead, blend: null, light: otherLight(dna.light), density: dna.density },
    twistLight
      ? { variant: 'C', style: lead, blend: null, light: otherLight(dna.light), density: otherDensity(dna.density) }
      : { variant: 'C', style: lead, blend: null, light: dna.light, density: otherDensity(dna.density) },
  ];

  return raw.map((v) => ({
    ...v,
    caption: caption(v.style, v.blend, v.light, v.density),
    prompt: prompt(dna, room, v.style, v.blend, v.light, v.density, bhk),
  }));
}

function caption(style: StyleTag, blend: StyleTag | null, light: Lightness, density: Density): string {
  const name = blend ? `${STYLE_LABELS[style]} with ${STYLE_LABELS[blend]}` : STYLE_LABELS[style];
  const l = light === 'light' ? 'light' : light === 'deep' ? 'moody' : 'balanced';
  return `${name}, ${l} and ${density}`;
}

function prompt(
  dna: DesignDna,
  room: MockupRoom,
  style: StyleTag,
  blend: StyleTag | null,
  light: Lightness,
  density: Density,
  bhk: string | null,
): string {
  const where = bhk ? `a ${bhk} apartment in Pune, India` : 'an apartment in Pune, India';
  const styleText = blend ? `${STYLE_LABELS[style]} interior style with a touch of ${STYLE_LABELS[blend]}` : `${STYLE_LABELS[style]} interior style`;
  return [
    `Photorealistic interior photograph of a ${ROOM_PHRASE[room]} in ${where}.`,
    `${styleText}.`,
    `Colour palette: ${dna.palette.join(', ')}.`,
    `Materials: ${dna.materials.join(', ')}.`,
    `${LIGHT_WORDS[light]}; ${DENSITY_WORDS[density]}.`,
    'Realistic proportions for an Indian apartment, standard ceiling height, eye-level wide shot.',
    'No people, no text, no logos, no watermark.',
  ].join(' ');
}
