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
  locality: string;
  areaSqft: number;
  title: string;
  note: string;
  studio: string;
  /** Display string, already in lakh. Mono, never wrapped. */
  cost: string;
  photo: Photo;
}

export const FINISHED_WORK: FinishedProject[] = [
  {
    locality: 'Kothrud',
    areaSqft: 1180,
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
    locality: 'Baner',
    areaSqft: 960,
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
    locality: 'Wakad',
    areaSqft: 1420,
    title: 'Joinery & layers',
    note: 'Full custom joinery, five lighting circuits, stone through the living and dining.',
    studio: 'Teakline Studio',
    cost: '₹24.6 L',
    photo: {
      src: unsplash('photo-1616594039964-ae9021a400a0', 900),
      alt: 'A bedroom with full-height joinery and layered lighting',
    },
  },
  {
    locality: 'Kharadi',
    areaSqft: 1050,
    title: 'Plaster & teak',
    note: 'Lime plaster walls, teak edging on every shutter, peripheral ceiling only.',
    studio: 'Maya Workshop',
    cost: '₹14.8 L',
    photo: {
      src: unsplash('photo-1586023492125-27b2c045efd7', 900),
      alt: 'A bedroom with lime plaster walls and teak-edged wardrobes',
    },
  },
  {
    locality: 'Baner',
    areaSqft: 780,
    title: 'One-bedroom, done once',
    note: 'A 1 BHK finished to the top band rather than a 2 BHK finished to the bottom one.',
    studio: 'Chitra & Co.',
    cost: '₹9.4 L',
    photo: {
      src: unsplash('photo-1503387762-592deb58ef4e', 900),
      alt: 'A compact living room with built-in seating and open shelving',
    },
  },
  {
    locality: 'Aundh',
    areaSqft: 1610,
    title: 'Stone, brass and light',
    note: 'Marine ply throughout, imported hardware, a site that ran four and a half months.',
    studio: 'Maya Workshop',
    cost: '₹27.2 L',
    photo: {
      src: unsplash('photo-1600880292203-757bb62b4baf', 900),
      alt: 'A dining room with a stone table, brass fittings and layered light',
    },
  },
];
