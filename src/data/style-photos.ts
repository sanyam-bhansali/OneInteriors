/**
 * Photographs for the style picker — "Which of these feel like your home?" —
 * one per style in a living room, and where a good one exists, the same
 * style in a bedroom and a kitchen (build queue item 10).
 *
 * ## Chosen against the owner's Pinterest boards, not taken from them
 *
 * The owner's team made three boards (living, bedroom, kitchen; 30 Sep 2026)
 * of what each style should look like: premium Indian flats — cove-lit
 * ceilings, marble, warm wood, panelled TV walls, some dark and moody. The
 * pins are other people's photographs and renders, so they are the brief,
 * not the pictures: each photo here is a free Unsplash photograph (Unsplash
 * License, commercial use allowed; credited anyway), searched for and chosen
 * by eye to match the boards, and checked as free rather than Unsplash+.
 *
 * Studio portfolio photos with picker consent replace these in the living
 * room (brief/picker-photos.ts). Hotlinked from images.unsplash.com, as
 * Unsplash asks; next.config.ts allows it.
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
    src: 'https://images.unsplash.com/photo-1724582586529-62622e50c0b3',
    alt: 'A grey living room with a low sofa and plain, clean walls',
    photographer: 'Prydumano Design',
    page: 'https://unsplash.com/photos/a-modern-living-room-with-a-large-window-vIbxvHj9m9g',
  },
  'warm-modern': {
    src: 'https://images.unsplash.com/photo-1720247520862-7e4b14176fa8',
    alt: 'A living room with a cove-lit ceiling, a wooden TV wall and tan sofas',
    photographer: 'Naksha Banwao',
    page: 'https://unsplash.com/photos/a-living-room-filled-with-furniture-and-a-flat-screen-tv-nAFuA8t5K9Y',
  },
  'indian-contemporary': {
    src: 'https://images.unsplash.com/photo-1713192706971-03900dcf5706',
    alt: 'A sunlit living room with a cane pendant, wooden chairs and warm yellow walls',
    photographer: 'Sanju Pandita',
    page: 'https://unsplash.com/photos/a-living-room-filled-with-furniture-and-a-window-8ysM3GxuknE',
  },
  scandinavian: {
    src: 'https://images.unsplash.com/photo-1776673687936-65e63a5a3e05',
    alt: 'A white living room with a grey sofa, a light rug and a large plant',
    photographer: 'Margo Evardson',
    page: 'https://unsplash.com/photos/modern-living-room-with-gray-sofa-and-large-plant-6Rc6qfJraLI',
  },
  industrial: {
    src: 'https://images.unsplash.com/photo-1650091009622-4cbe6def4d2e',
    alt: 'A living room with an exposed brick wall, a black sofa and framed art',
    photographer: 'MAHZA D\'BRATA',
    page: 'https://unsplash.com/photos/a-living-room-filled-with-furniture-and-a-brick-wall-G88ehihe6wQ',
  },
  'mid-century': {
    src: 'https://images.unsplash.com/photo-1541085929911-dea736e9287b',
    alt: 'A living room with a walnut sideboard, round tables and a retro armchair',
    photographer: 'Phebe Tan',
    page: 'https://unsplash.com/photos/flat-screen-tv-turned-off-jqFpFBzz0Tg',
  },
  'classical-ornate': {
    src: 'https://images.unsplash.com/photo-1782365413737-afddac42efa4',
    alt: 'A formal living room with chandeliers, carved furniture and a patterned rug',
    photographer: 'LISK OBE',
    page: 'https://unsplash.com/photos/a-formal-living-room-with-dark-sofas-chandeliers-and-artwork-3d_9MQDHVGE',
  },
  'art-deco': {
    src: 'https://images.unsplash.com/photo-1757618977945-2d924c31ab2b',
    alt: 'Olive velvet armchairs, brass details and geometric panelling',
    photographer: 'mdreza jalali',
    page: 'https://unsplash.com/photos/elegant-living-room-with-vintage-furniture-and-decor-lmleTtfln1Q',
  },
  'rustic-earthy': {
    src: 'https://images.unsplash.com/photo-1782346056252-c3699920bf19',
    alt: 'A living room with wooden ceiling beams, a stone wall and a wood stove',
    photographer: 'Clay Banks',
    page: 'https://unsplash.com/photos/cozy-living-room-with-lit-wood-stove-and-gray-sectional-rFpEHzGB37w',
  },
  'luxe-glam': {
    src: 'https://images.unsplash.com/photo-1758448755778-90ebf4d0f1e7',
    alt: 'A living room with a crystal chandelier, a marble floor and a large cream sectional',
    photographer: 'Aalo Lens',
    page: 'https://unsplash.com/photos/luxurious-modern-living-room-with-large-sectional-sofa-jkwKXLxTY_4',
  },
  japandi: {
    src: 'https://images.unsplash.com/photo-1715639116465-92add34d121f',
    alt: 'A neutral living room with arched wall niches, a low sofa and a round wooden table',
    photographer: 'Andre Portolesi',
    page: 'https://unsplash.com/photos/a-living-room-with-a-couch-and-a-table-AMIqdp54tJA',
  },
  'coastal-light': {
    src: 'https://images.unsplash.com/photo-1600493505873-cddd69453072',
    alt: 'A bright white living room with a sea-green sofa and a round wooden coffee table',
    photographer: 'Collov Home Design',
    page: 'https://unsplash.com/photos/brown-wooden-round-table-near-white-sofa-SrioT6tdWII',
  },
};

/**
 * The same style in a bedroom and a kitchen (build queue item 10), so a
 * kitchen customer picks between kitchens and a bedroom customer between
 * bedrooms. A style with no good free photograph of a room is left out and
 * falls back to its living room.
 */
export const ROOM_STYLE_PHOTOS: Partial<Record<StyleTag, Partial<Record<'BEDROOM' | 'KITCHEN', StylePhoto>>>> = {
  'contemporary-minimal': {
    BEDROOM: {
      src: 'https://images.unsplash.com/photo-1595526051245-4506e0005bd0',
      alt: 'A white and grey bedroom with a lit headboard wall and crisp bedding',
      photographer: 'Lotus Design N Print',
      page: 'https://unsplash.com/photos/white-bed-linen-on-bed-7jlVQPX8PLE',
    },
    KITCHEN: {
      src: 'https://images.unsplash.com/photo-1638541363822-6f4c189b5cf7',
      alt: 'A grey handleless kitchen with white counters',
      photographer: 'Lotus Design N Print',
      page: 'https://unsplash.com/photos/a-kitchen-with-white-cabinets-and-stainless-steel-appliances-eq2v_CdFlSA',
    },
  },
  'warm-modern': {
    BEDROOM: {
      src: 'https://images.unsplash.com/photo-1750420556288-d0e32a6f517b',
      alt: 'A bedroom with an arched wooden headboard wall under a cove-lit ceiling',
      photographer: 'Spl Interiors',
      page: 'https://unsplash.com/photos/a-modern-bedroom-with-a-stylish-neutral-aesthetic-0tVimluL_ls',
    },
    KITCHEN: {
      src: 'https://images.unsplash.com/photo-1788910385096-929d5aab90eb',
      alt: 'A kitchen with a wood-panelled wall, a white island and four bar stools',
      photographer: 'Clay Banks',
      page: 'https://unsplash.com/photos/modern-kitchen-with-wood-cabinets-Mj3JSq-_7OI',
    },
  },
  scandinavian: {
    BEDROOM: {
      src: 'https://images.unsplash.com/photo-1722942723511-11c7603d003c',
      alt: 'A pale bedroom with a linen headboard and soft peach bedding',
      photographer: 'Alex Tyson',
      page: 'https://unsplash.com/photos/a-bedroom-with-a-large-bed-and-a-plant-in-the-corner-3ZwreGz4cRQ',
    },
    KITCHEN: {
      src: 'https://images.unsplash.com/photo-1722942115349-78d5fb3fc484',
      alt: 'A white kitchen with light oak and a wooden dining table',
      photographer: 'Lisa Anna',
      page: 'https://unsplash.com/photos/a-kitchen-with-a-table-and-chairs-in-it-mk3AYC_hleo',
    },
  },
  industrial: {
    BEDROOM: {
      src: 'https://images.unsplash.com/photo-1721146609543-491c1ec04240',
      alt: 'A bedroom with dark painted walls, a brick corner and an orange bedspread',
      photographer: 'Clay Banks',
      page: 'https://unsplash.com/photos/a-bed-sitting-in-a-bedroom-next-to-a-window-W3s4E7qM2uQ',
    },
    KITCHEN: {
      src: 'https://images.unsplash.com/photo-1696986681436-f5ee12981bc9',
      alt: 'A matte black kitchen with a black tap and a dark stone counter',
      photographer: 'Clay Banks',
      page: 'https://unsplash.com/photos/a-kitchen-with-a-sink-and-a-stove-top-oven-C-FqIffctHI',
    },
  },
  'mid-century': {
    BEDROOM: {
      src: 'https://images.unsplash.com/photo-1633944095397-878622ebc01c',
      alt: 'A bedroom with a low walnut platform bed and framed prints',
      photographer: 'laura adai',
      page: 'https://unsplash.com/photos/a-bed-sitting-in-a-bedroom-next-to-a-window-J60bPeDiR8A',
    },
    KITCHEN: {
      src: 'https://images.unsplash.com/photo-1560562125-ab512e4d9d29',
      alt: 'A kitchen with walnut cabinets and a red range cooker',
      photographer: 'André François McKenzie',
      page: 'https://unsplash.com/photos/kitchen-island-near-gas-range-beside-base-cabinets-sZ5CteK2r6E',
    },
  },
  'classical-ornate': {
    BEDROOM: {
      src: 'https://images.unsplash.com/photo-1772563214602-3c6434766700',
      alt: 'A bedroom with a tufted headboard, a tray ceiling and a pendant light',
      photographer: 'Elias Storm',
      page: 'https://unsplash.com/photos/a-well-decorated-bedroom-with-a-large-window-lhCZDbbP7Hw',
    },
    KITCHEN: {
      src: 'https://images.unsplash.com/photo-1721742607087-54dde1875370',
      alt: 'A kitchen with raised-panel white cabinets and a patterned backsplash',
      photographer: 'Lisa Anna',
      page: 'https://unsplash.com/photos/a-kitchen-with-white-cabinets-and-black-counter-tops-jYbg8TQp5fU',
    },
  },
  'art-deco': {
    BEDROOM: {
      src: 'https://images.unsplash.com/photo-1680503146454-04ac81a63550',
      alt: 'A bedroom with a teal tufted headboard, mustard throws and patterned wallpaper',
      photographer: 'Albero Furniture Bratislava',
      page: 'https://unsplash.com/photos/a-bed-room-with-a-neatly-made-bed-and-a-chair-bTkrfRHpL1U',
    },
    KITCHEN: {
      src: 'https://images.unsplash.com/photo-1631048500354-c7b943a930ea',
      alt: 'A kitchen with brass globe pendants, a marble island and black cabinets',
      photographer: 'Point3D Commercial Imaging Ltd.',
      page: 'https://unsplash.com/photos/white-and-blue-floral-table-cloth-5M5NGUZEpjs',
    },
  },
  'rustic-earthy': {
    BEDROOM: {
      src: 'https://images.unsplash.com/photo-1727706572437-4fcda0cbd66f',
      alt: 'A bedroom clad in warm wood under a pitched ceiling',
      photographer: 'Clay Banks',
      page: 'https://unsplash.com/photos/a-bedroom-with-two-beds-and-a-desk-rP0OTFdVaak',
    },
    KITCHEN: {
      src: 'https://images.unsplash.com/photo-1768486143865-342d8cc12c90',
      alt: 'A kitchen under wooden ceiling beams, with a wooden island and pendant lights',
      photographer: 'Clay Banks',
      page: 'https://unsplash.com/photos/modern-kitchen-with-island-and-pendant-lights-i6SOaGYmNOA',
    },
  },
  'luxe-glam': {
    BEDROOM: {
      src: 'https://images.unsplash.com/photo-1758448755969-8791367cf5c5',
      alt: 'A bedroom with a ceiling chandelier, pale panelling and a large upholstered bed',
      photographer: 'Aalo Lens',
      page: 'https://unsplash.com/photos/luxurious-bedroom-with-modern-decor-and-large-windows-Xph_EJ-22vE',
    },
    KITCHEN: {
      src: 'https://images.unsplash.com/photo-1758448755927-e5c5ae14790c',
      alt: 'A kitchen island with marble slabs, gold trim and a sculptural pendant',
      photographer: 'Aalo Lens',
      page: 'https://unsplash.com/photos/modern-kitchen-island-with-marble-accents-and-pendant-light-UlIj_qKpgCw',
    },
  },
  japandi: {
    BEDROOM: {
      src: 'https://images.unsplash.com/photo-1677568551049-21a2237201da',
      alt: 'A calm bedroom with a low bed, warm wood and a paper lamp',
      photographer: 'rawkkim',
      page: 'https://unsplash.com/photos/a-bedroom-with-a-bed-and-a-plant-in-the-corner-tjgrifCKjwo',
    },
  },
  'coastal-light': {
    BEDROOM: {
      src: 'https://images.unsplash.com/photo-1770414173168-f6c666501225',
      alt: 'A bright bedroom with pale blue walls, a white bed and a ceiling fan',
      photographer: 'amelia elite',
      page: 'https://unsplash.com/photos/a-bright-coastal-themed-bedroom-with-a-large-bed-d6jN8t0GUF4',
    },
    KITCHEN: {
      src: 'https://images.unsplash.com/photo-1495433324511-bf8e92934d90',
      alt: 'A white kitchen with a blue island and glass pendant lights',
      photographer: 'Quilia',
      page: 'https://unsplash.com/photos/kitchen-with-island-and-table-kdwahpWYfQo',
    },
  },
};

export type PickerRoom = 'LIVING' | 'BEDROOM' | 'KITCHEN';

/**
 * Which room the picker shows, from the scope: kitchens for a kitchen job,
 * bedrooms for a job that is only bedrooms, living rooms otherwise.
 */
export function pickerRoomFor(scope: string | null, scopeRooms: readonly string[] = []): PickerRoom {
  if (scope === 'KITCHEN_WARDROBE') return 'KITCHEN';
  if (scope === 'SINGLE_ROOM' || scope === 'RENOVATION') {
    const rooms = scopeRooms.filter((r) => r !== 'BATHROOMS');
    if (rooms.length > 0 && rooms.every((r) => r === 'KITCHEN')) return 'KITCHEN';
    if (rooms.length > 0 && rooms.every((r) => r.endsWith('BEDROOM'))) return 'BEDROOM';
  }
  return 'LIVING';
}

/** The photo for a style in a room, or its living room when there is none. */
export function stylePhotoFor(tag: StyleTag, room: PickerRoom): StylePhoto {
  return (room === 'LIVING' ? undefined : ROOM_STYLE_PHOTOS[tag]?.[room]) ?? STYLE_PHOTOS[tag];
}

/** The URL for a picker tile: cropped to the tile's 4:3, small enough for a phone. */
export function stylePhotoUrl(photo: StylePhoto, width = 600): string {
  return `${photo.src}?auto=format&fit=crop&w=${width}&h=${Math.round((width * 3) / 4)}&q=70`;
}
