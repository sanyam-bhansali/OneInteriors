/**
 * One photograph per style for the style picker — "Which of these feel like
 * your home?".
 *
 * ## Where they come from, and why not Pinterest
 *
 * From Unsplash, under the Unsplash License: free for commercial use, no
 * permission or attribution required (we credit anyway). Each was chosen by
 * searching for the style, checked by eye against our definition of it
 * (modules/inspiration/reading.ts carries the same definitions), and
 * confirmed as a free photo, not an Unsplash+ one, on 30 Sep 2026.
 *
 * Not Pinterest: pins are other people's photographs, and neither copyright
 * nor Pinterest's terms allow lifting them into our product. The owner's own
 * Pinterest account (checked through Windsor.ai) held no interiors.
 *
 * These are placeholders in the honest sense: the plan (§5.2) is studio
 * portfolio photos with picker consent, plus licensed images, and when a
 * studio's consented photo of a style exists it should take this one's place.
 * Hotlinked from images.unsplash.com, as Unsplash asks, which the CSP in
 * next.config.ts already allows.
 */

import type { StyleTag } from '@/modules/brief/types';

export interface StylePhoto {
  /** images.unsplash.com base URL; sized with query parameters at render. */
  src: string;
  alt: string;
  photographer: string;
  /** The photo's Unsplash page — credit and provenance. */
  page: string;
}

export const STYLE_PHOTOS: Record<StyleTag, StylePhoto> = {
  'contemporary-minimal': {
    src: 'https://images.unsplash.com/photo-1705321963943-de94bb3f0dd3',
    alt: 'A white living room with a low grey sofa, round wooden tables and globe pendants',
    photographer: 'Pipcke',
    page: 'https://unsplash.com/photos/a-living-room-with-a-couch-and-a-table-g_5UyVBIX_k',
  },
  'warm-modern': {
    src: 'https://images.unsplash.com/photo-1780257562925-d78de6cb6612',
    alt: 'A tan leather armchair beside built-in wooden shelves and a round lamp',
    photographer: 'Poojan Thanekar',
    page: 'https://unsplash.com/photos/elegant-interior-with-an-armchair-round-lamp-and-filled-bookshelves-8uPc8gPtVbo',
  },
  'indian-contemporary': {
    src: 'https://images.unsplash.com/photo-1717140370275-7d847544b27b',
    alt: 'A jaali screen wall behind two cream armchairs, a round wooden table and a patterned rug',
    photographer: 'Jejo Jose',
    page: 'https://unsplash.com/photos/a-living-room-filled-with-furniture-and-a-large-window-p2oz7Bkk5t4',
  },
  scandinavian: {
    src: 'https://images.unsplash.com/photo-1631679706909-1844bbd07221',
    alt: 'A pale living room with a bouclé chair, light wood and round rattan mirrors',
    photographer: 'Spacejoy',
    page: 'https://unsplash.com/photos/a-living-room-filled-with-furniture-and-a-mirror-c0JoR_-2x3E',
  },
  industrial: {
    src: 'https://images.unsplash.com/photo-1785917835430-f1617b7d68ff',
    alt: 'A sunlit room with an exposed brick wall, concrete and black pendant lights',
    photographer: 'Szcze hoo',
    page: 'https://unsplash.com/photos/empty-industrial-room-with-sunlight-brick-wall-and-hanging-lights-wdlFqI0s_Kg',
  },
  'mid-century': {
    src: 'https://images.unsplash.com/photo-1618221381711-42ca8ab6e908',
    alt: 'An orange sofa against a green wall hung with bold framed prints',
    photographer: 'Spacejoy',
    page: 'https://unsplash.com/photos/orange-and-black-sofa-with-throw-pillows-q3Qd86sfaoU',
  },
  'classical-ornate': {
    src: 'https://images.unsplash.com/photo-1778731525357-25c95792c27c',
    alt: 'A symmetrical living room with an arch, chandeliers, mouldings and a fireplace',
    photographer: 'Franco Debartolo',
    page: 'https://unsplash.com/photos/elegant-living-room-with-fireplace-and-modern-furniture-PLzmRgWGC5E',
  },
  'art-deco': {
    src: 'https://images.unsplash.com/photo-1757618977945-2d924c31ab2b',
    alt: 'Olive velvet armchairs, brass details and geometric panelling',
    photographer: 'mdreza jalali',
    page: 'https://unsplash.com/photos/elegant-living-room-with-vintage-furniture-and-decor-lmleTtfln1Q',
  },
  'rustic-earthy': {
    src: 'https://images.unsplash.com/photo-1726090401458-7abb00f7450c',
    alt: 'A living room with wooden ceiling beams, a stone fireplace and a woven pouf',
    photographer: 'Clay Banks',
    page: 'https://unsplash.com/photos/a-living-room-filled-with-furniture-and-a-fire-place-PAoispQVHNI',
  },
  'luxe-glam': {
    src: 'https://images.unsplash.com/photo-1593987314040-8e0ac84ae724',
    alt: 'A white living room with a chandelier, wall sconces and a glossy tufted sofa',
    photographer: 'Amira Aboalnaga',
    page: 'https://unsplash.com/photos/living-room-with-white-sofa-and-brown-wooden-coffee-table-1LGiB1BDz5M',
  },
  japandi: {
    src: 'https://images.unsplash.com/photo-1623903800664-a840b8be323b',
    alt: 'A low wooden dining table and chairs beneath a single pendant, by a wall of windows',
    photographer: 'Don Kaveen',
    page: 'https://unsplash.com/photos/brown-wooden-table-with-chairs-DsH3VOZanYA',
  },
  'coastal-light': {
    src: 'https://images.unsplash.com/photo-1600493505873-cddd69453072',
    alt: 'A bright white living room with a sea-green sofa and a round wooden coffee table',
    photographer: 'Collov Home Design',
    page: 'https://unsplash.com/photos/brown-wooden-round-table-near-white-sofa-SrioT6tdWII',
  },
};

/** The URL for a picker tile: cropped to the tile's 4:3, small enough for a phone. */
export function stylePhotoUrl(photo: StylePhoto, width = 600): string {
  return `${photo.src}?auto=format&fit=crop&w=${width}&h=${Math.round((width * 3) / 4)}&q=70`;
}
