/**
 * Discover (owner, 7 Nov 2026): the pins in the feed.
 *
 * The customer scrolls rooms, saves what they love, and after about twenty
 * saves we show them their style. Every pin is one of two kinds:
 *
 *  - **built**: a photograph from a studio's finished project in Pune, shown
 *    without the studio's name, and only where the studio said its photos may
 *    appear that way (`pickerConsent`, the same consent the style picker
 *    uses). Renders never appear. A built pin knows what the home cost per
 *    square foot, so it carries a price band.
 *  - **example**: one of the free Unsplash photographs the style picker
 *    already uses, labelled as an example and credited. They keep the feed
 *    useful while studios add their own rooms, and never carry a price,
 *    because nobody built them for that money.
 *
 * Pure and tested. No `server-only`: the feed ranks in the browser.
 */

import { STYLE_TAGS, type StyleTag } from '@/modules/brief/types';
import { ROOM_STYLE_PHOTOS, STYLE_PHOTOS, stylePhotoUrl } from '@/data/style-photos';
import type { PortfolioProject } from '@/modules/studio/types';
import { tierForPerSqft, type Tier } from '@/modules/quotation/tiers';
import { readImageTags } from './tags';

/** The boards a save lands on. */
export const DISCOVER_ROOMS = ['living', 'kitchen', 'bedroom', 'mandir', 'other'] as const;
export type DiscoverRoom = (typeof DISCOVER_ROOMS)[number];

export interface Pin {
  /** `b:<project>:<image>` for a built room, `x:<style>:<room>` for an example. */
  id: string;
  kind: 'built' | 'example';
  src: string;
  /** Describes the room, never the style or the studio. */
  alt: string;
  room: DiscoverRoom;
  /** Strongest first. Never empty. */
  styles: StyleTag[];
  /** Built pins only: whose work it is, never shown, used for matching. */
  studioId: string | null;
  /** Built pins only: what the home cost per sq ft of carpet, all-in. */
  perSqft: number | null;
  /** The band that cost falls in. Null when we don't know the cost. */
  tier: Tier | null;
  /** Built pins only: the materials our team tagged. */
  materials: string[];
  /** Example pins only: the photographer, for the credit. */
  credit: string | null;
  /** Example pins only: the photo's Unsplash page. */
  creditUrl: string | null;
}

/** A studio's room names (portfolio `imageRooms`) onto our five boards. */
export function boardFor(room: string | null | undefined): DiscoverRoom {
  const r = (room ?? '').toUpperCase();
  if (r === 'LIVING' || r === 'DINING' || r === 'FOYER') return 'living';
  if (r === 'KITCHEN') return 'kitchen';
  if (r.includes('BEDROOM') || r === 'KIDS' || r === 'GUEST') return 'bedroom';
  if (r === 'POOJA' || r === 'MANDIR' || r === 'PUJA') return 'mandir';
  return 'other';
}

const ROOM_WORDS: Record<DiscoverRoom, string> = {
  living: 'living room',
  kitchen: 'kitchen',
  bedroom: 'bedroom',
  mandir: 'mandir corner',
  other: 'room',
};

function isStyle(tag: string): tag is StyleTag {
  return (STYLE_TAGS as readonly string[]).includes(tag);
}

/**
 * Every consented, real photograph on the roster, one pin per image.
 *
 * A project with no style tag we know is left out: a pin that teaches us
 * nothing about taste only wastes a scroll.
 */
export function builtPins(studios: readonly { id: string; portfolio: readonly PortfolioProject[] }[]): Pin[] {
  const out: Pin[] = [];
  for (const studio of studios) {
    for (const project of studio.portfolio) {
      if (project.pickerConsent !== true || project.isRender) continue;
      const styles = project.styleTags.filter(isStyle);
      if (styles.length === 0) continue;
      const area = project.carpetAreaSqft ?? null;
      const value = project.valuePaise ?? null;
      const perSqft = area && area > 0 && value && value > 0 ? Math.round(Number(value) / 100 / area) : null;
      const tags = readImageTags(project.imageTags, project.images.length);
      project.images.forEach((src, i) => {
        // Only a photo our team has checked (ops/discover-photos).
        if (!src || !tags[i]!.checked) return;
        const room = boardFor(project.imageRooms?.[i]);
        out.push({
          id: `b:${project.id}:${i}`,
          kind: 'built',
          src,
          alt: `A finished ${ROOM_WORDS[room]} in a Pune home`,
          room,
          styles,
          studioId: studio.id,
          perSqft,
          tier: perSqft === null ? null : tierForPerSqft(perSqft),
          materials: tags[i]!.materials,
          credit: null,
          creditUrl: null,
        });
      });
    }
  }
  return out;
}

/** The style picker's photographs, as labelled examples: up to three per style. */
export function examplePins(): Pin[] {
  const out: Pin[] = [];
  for (const tag of STYLE_TAGS) {
    const photos = [
      { room: 'living' as const, photo: STYLE_PHOTOS[tag] },
      { room: 'bedroom' as const, photo: ROOM_STYLE_PHOTOS[tag]?.BEDROOM },
      { room: 'kitchen' as const, photo: ROOM_STYLE_PHOTOS[tag]?.KITCHEN },
    ];
    for (const { room, photo } of photos) {
      if (!photo) continue;
      out.push({
        id: `x:${tag}:${room}`,
        kind: 'example',
        src: stylePhotoUrl(photo, 640),
        alt: photo.alt,
        room,
        styles: [tag],
        studioId: null,
        perSqft: null,
        tier: null,
        materials: [],
        credit: photo.photographer,
        creditUrl: photo.page,
      });
    }
  }
  return out;
}

/**
 * The whole feed: real rooms first, then the examples. Rooms in a style the
 * customer ruled out are never shown — the same rule as the Home Profile.
 */
export function discoverPins(
  studios: readonly { id: string; portfolio: readonly PortfolioProject[] }[],
  dislikes: readonly StyleTag[] = [],
): Pin[] {
  const banned = new Set(dislikes);
  return [...builtPins(studios), ...examplePins()].filter((p) => !banned.has(p.styles[0]!));
}
