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
} as const satisfies Record<string, Photo>;
