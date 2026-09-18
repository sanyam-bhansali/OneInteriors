/**
 * Stock photography — pre-launch only.
 *
 * ## Read this before using any of it
 *
 * Every image here is somebody else's home, photographed somewhere that is not
 * Pune. The site's entire argument is that the studios on it are real, local
 * and checked. Illustrating that argument with stock is a small lie propping
 * up a large claim, and it is exactly the thing a customer feels without being
 * able to name.
 *
 * So these are here to make the layout judgeable, and they carry an explicit
 * expiry: **replace every one with photographs of real work before launch.**
 * Hauspire and Urbanline both have galleries of their own projects; those are
 * the images this site should ship with.
 *
 * Licensing: Unsplash's licence permits commercial use without attribution,
 * and their guidelines expect hot-linking to this CDN rather than
 * re-hosting — which is also how both studios we are onboarding serve their
 * own site images.
 *
 * `alt` text is written as though the photograph were real work, because that
 * is what will replace it, and an alt attribute nobody rewrites is how a
 * placeholder survives to production.
 */

export interface Photo {
  src: string;
  alt: string;
}

function unsplash(id: string, width = 1600): string {
  // `auto=format` serves AVIF/WebP where supported; `q=72` is where these
  // stop getting visibly better and start getting slower.
  return `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${width}&q=72`;
}

export const PHOTOS = {
  /** The hero. Warm, lived-in, and light enough to sit beside cream. */
  hero: {
    src: unsplash('photo-1615529182904-14819c35db37', 1400),
    alt: 'A finished living room with a linen sofa, rattan pendants and an old rug',
  },

  /** Tier cards. Each has to look like the band it names. */
  essential: {
    src: unsplash('photo-1586023492125-27b2c045efd7', 900),
    alt: 'A simply finished bedroom with laminate wardrobes and a plain ceiling',
  },
  premium: {
    src: unsplash('photo-1600607686527-6fb886090705', 900),
    alt: 'A kitchen in oak veneer with a stone counter and designed lighting',
  },
  luxury: {
    src: unsplash('photo-1616594039964-ae9021a400a0', 900),
    alt: 'A living room with custom joinery, stone and layered lighting',
  },

  /** The verification section. A site being worked on, not a finished shot. */
  verification: {
    src: unsplash('photo-1503387762-592deb58ef4e', 1200),
    alt: 'A designer checking work on site during a project',
  },

  /** The expert section. A conversation, not a call centre. */
  expert: {
    src: unsplash('photo-1600880292203-757bb62b4baf', 1200),
    alt: 'Two people going through drawings and quotes at a table',
  },

  // ── Landing page ──────────────────────────────────────────────
  // The same expiry applies to every one of these. The hero in
  // particular is a placeholder for the bare-flat-to-finished-home
  // film; until that MP4 exists, this still is what the section is
  // judged on, so it has to be a room somebody could plausibly have
  // finished in Kothrud.

  /** Behind the frosted frame on the how-it-works spine. */
  spine: {
    src: unsplash('photo-1616486338812-3dadae4b4ace', 1400),
    alt: 'A finished living room, looking through to the dining area',
  },

  /** The architect section. Dark enough for a glass card to sit on. */
  architect: {
    src: unsplash('photo-1616594039964-ae9021a400a0', 1400),
    alt: 'A finished bedroom at dusk with layered lighting',
  },

  /** Why we built this. Somebody reading a drawing, not a stock handshake. */
  film: {
    src: unsplash('photo-1581094794329-c8112a89af12', 1400),
    alt: 'A person going through a working drawing at a desk',
  },
} as const satisfies Record<string, Photo>;

/**
 * Finished work, with what it cost printed on it.
 *
 * Studio names here are INVENTED and must stay that way — Teakline Studio,
 * Chitra & Co., Maya Workshop. Never a real partner's name on a marketing
 * surface: a real studio's name beside an invented project and an invented
 * figure is a claim about a real business that we made up.
 *
 * The photographs are the usual placeholders. The costs are illustrative of
 * the published ₹5.95 L–₹27.2 L range and become real project figures when
 * the photographs do.
 */
export interface FinishedProject {
  /** Stable key, and the fragment a real project page would live at. */
  slug: string;
  locality: string;
  areaSqft: number;
  title: string;
  note: string;
  studio: string;
  /** "3 BHK". Mono on the card. */
  config: string;
  /** The building. Invented, like the studio names — see above. */
  building: string;
  /** Essential / Premium / Luxury, as `tiers.ts` names them. Sage on the card. */
  band: string;
  /** Display string, already in lakh. Mono, never wrapped. */
  cost: string;
  photo: Photo;
}

export const FINISHED_WORK: FinishedProject[] = [
  {
    slug: 'kotah-and-cane',
    locality: 'Kothrud',
    areaSqft: 1180,
    config: '3 BHK',
    building: 'Sanskriti Towers',
    band: 'Premium',
    title: 'Kotah & cane',
    note: 'Kotah stone floors kept, cane shutters through the living room, everything else new.',
    studio: 'Teakline Studio',
    cost: '₹18.4 L',
    photo: {
      src: unsplash('photo-1615529182904-14819c35db37', 900),
      alt: 'A living room with cane shutters, a linen sofa and rattan pendants',
    },
  },
  {
    slug: 'oak-and-stone-kitchen',
    locality: 'Baner',
    areaSqft: 960,
    config: '2 BHK',
    building: 'Amaltas Residences',
    band: 'Premium',
    title: 'Oak & stone kitchen',
    note: 'Quartz counter, 18mm BWP carcass, branded channels rated for ten years of use.',
    studio: 'Chitra & Co.',
    cost: '₹11.2 L',
    photo: {
      src: unsplash('photo-1600607686527-6fb886090705', 900),
      alt: 'An oak kitchen with a quartz counter and black pendants',
    },
  },
  {
    slug: 'joinery-and-layered-light',
    locality: 'Wakad',
    areaSqft: 1420,
    config: '4 BHK',
    building: 'Veda Vista',
    band: 'Luxury',
    title: 'Joinery & layered light',
    note: 'Full custom joinery, four lighting circuits, stone through the living and dining.',
    studio: 'Teakline Studio',
    cost: '₹27.2 L',
    photo: {
      src: unsplash('photo-1616594039964-ae9021a400a0', 900),
      alt: 'A bedroom with full-height joinery and layered lighting',
    },
  },
  {
    slug: 'laminate-done-well',
    locality: 'Hinjawadi',
    areaSqft: 640,
    config: '1 BHK',
    building: 'Nirvana Greens',
    band: 'Essential',
    title: 'Laminate, done well',
    note: 'Honest laminate, good hinges, no false ceiling. The lowest quote we have compared.',
    studio: 'Maya Workshop',
    cost: '₹5.95 L',
    photo: {
      src: unsplash('photo-1586023492125-27b2c045efd7', 900),
      alt: 'A compact bedroom with plain laminate wardrobes and a simple ceiling',
    },
  },
  {
    slug: 'quiet-art-deco',
    locality: 'Aundh',
    areaSqft: 1050,
    config: '3 BHK',
    building: 'Ashirwad Park',
    band: 'Premium',
    title: 'Quiet Art Deco',
    note: 'Fluted teak, brass inlay kept to three rooms, and a client who wanted no gloss anywhere.',
    studio: 'Chitra & Co.',
    cost: '₹16.8 L',
    photo: {
      src: unsplash('photo-1600880292203-757bb62b4baf', 900),
      alt: 'A dining room with fluted panelling, brass fittings and layered light',
    },
  },
  {
    slug: 'built-for-three-generations',
    locality: 'Kothrud',
    areaSqft: 880,
    config: '2 BHK',
    building: 'Shreeji Elite',
    band: 'Premium',
    title: 'Built for three generations',
    note: 'Grab rails that do not look like grab rails, no thresholds, every switch at 900mm.',
    studio: 'Maya Workshop',
    cost: '₹9.6 L',
    photo: {
      src: unsplash('photo-1503387762-592deb58ef4e', 900),
      alt: 'A living room with built-in seating, open shelving and wide clear floor',
    },
  },
];
