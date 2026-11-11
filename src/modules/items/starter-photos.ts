/**
 * Starter photos for the starter items (owner, 10 Nov 2026: "find photos and add it yourself").
 *
 * Example photos from Unsplash, free to use under the Unsplash License
 * (https://unsplash.com/license: commercial use allowed, no permission or
 * credit needed). Saved in public/items/ as 1200 x 900 WebP, so they are
 * served by this site and need no storage bucket. Credits are kept here for
 * our records; the pages say "Example photo" and name no one, because some
 * of these photographers are brands or design firms.
 *
 * Replace any of them with real photos of work done in Pune from /ops/items.
 * Pure data.
 */

export interface StarterPhoto {
  /** Served from the site: /items/<file>. */
  file: string;
  /** The photo's page on Unsplash. */
  source: string;
  /** Who Unsplash credits. */
  by: string;
}

export const STARTER_PHOTOS: Record<string, StarterPhoto[]> = {
  'modular-kitchen-base-cabinets': [
    { file: 'modular-kitchen-base-cabinets-1.webp', source: 'https://unsplash.com/photos/white-and-brown-kitchen-cabinet--aDGbdTsBZg', by: 'Collov Home Design' },
    { file: 'modular-kitchen-base-cabinets-2.webp', source: 'https://unsplash.com/photos/modern-kitchen-with-grey-cabinets-RwXneIyqxAw', by: 'Lotus Design N Print' },
  ],
  'kitchen-wall-cabinets': [
    { file: 'kitchen-wall-cabinets-1.webp', source: 'https://unsplash.com/photos/a-kitchen-with-white-cabinets-and-marble-counter-tops-rjjAKAp0KSw', by: 'Stephen Owen' },
    { file: 'kitchen-wall-cabinets-2.webp', source: 'https://unsplash.com/photos/a-kitchen-with-white-cabinets-and-stainless-steel-appliances-eq2v_CdFlSA', by: 'Lotus Design N Print' },
  ],
  'loft-storage': [
    { file: 'loft-storage-1.webp', source: 'https://unsplash.com/photos/woman-placing-woven-basket-into-cabinet-j4rDt1pF6ug', by: 'American Cleaning Institute' },
    { file: 'loft-storage-2.webp', source: 'https://unsplash.com/photos/modern-wooden-kitchen-with-marble-backsplash-8XoRVYP9R6Y', by: 'Caroline Badran' },
  ],
  'tandem-drawers-and-baskets': [
    { file: 'tandem-drawers-and-baskets-1.webp', source: 'https://unsplash.com/photos/an-open-drawer-in-a-kitchen-filled-with-dishes-BngKr53ZvR4', by: 'Orgalux' },
    { file: 'tandem-drawers-and-baskets-2.webp', source: 'https://unsplash.com/photos/a-person-opens-a-modern-kitchen-drawer-1jBY2qf7-MM', by: 'Caroline Badran' },
  ],
  'kitchen-tall-unit': [
    { file: 'kitchen-tall-unit-1.webp', source: 'https://unsplash.com/photos/modern-pantry-with-open-shelving-and-drawers-f68di4CQUEo', by: 'Franco Debartolo' },
    { file: 'kitchen-tall-unit-2.webp', source: 'https://unsplash.com/photos/modern-kitchen-pantry-with-organized-shelves-and-appliances-_1tT95nCC3w', by: 'Caroline Badran' },
  ],
  'kitchen-countertop': [
    { file: 'kitchen-countertop-1.webp', source: 'https://unsplash.com/photos/modern-white-kitchen-with-marble-island-and-dining-area-kF3KNcoXQXY', by: 'Brian Zajac' },
    { file: 'kitchen-countertop-2.webp', source: 'https://unsplash.com/photos/white-countertop-with-subtle-brown-veining-QWTubRKv_Ag', by: 'Rosemary Media' },
  ],
  'wardrobe': [
    { file: 'wardrobe-1.webp', source: 'https://unsplash.com/photos/a-bedroom-with-a-bed-and-a-wooden-closet-6Y3avYzs6os', by: 'Lisa Anna' },
    { file: 'wardrobe-2.webp', source: 'https://unsplash.com/photos/modern-bedroom-with-white-built-in-wardrobe-and-bed-VKcAq1_PlYY', by: 'Aleksandra Dementeva' },
  ],
  'walk-in-wardrobe': [
    { file: 'walk-in-wardrobe-1.webp', source: 'https://unsplash.com/photos/a-walk-in-closet-with-a-mirror-and-a-stool-SseNV6Ycb1c', by: 'Billy Jo Catbagan' },
    { file: 'walk-in-wardrobe-2.webp', source: 'https://unsplash.com/photos/a-walk-in-closet-filled-with-lots-of-clothes-9KVtDmNnFP4', by: 'Ali Moradi' },
  ],
  'bed-with-storage': [
    { file: 'bed-with-storage-1.webp', source: 'https://unsplash.com/photos/beige-bed-with-white-mattress-ghPHKipv790', by: 'Francesca Tosolini' },
    { file: 'bed-with-storage-2.webp', source: 'https://unsplash.com/photos/a-cozy-bedroom-with-a-neatly-made-bed-UvVHCAz9mFY', by: 'Clay Banks' },
  ],
  'dresser-with-mirror': [
    { file: 'dresser-with-mirror-1.webp', source: 'https://unsplash.com/photos/a-modern-vanity-with-a-mirror-and-stool--8wesvEJE2E', by: 'Royaloak India' },
    { file: 'dresser-with-mirror-2.webp', source: 'https://unsplash.com/photos/a-modern-vanity-table-with-a-large-mirror-and-decor-iJzFeQfP6hI', by: 'Franco Debartolo' },
  ],
  'study-unit': [
    { file: 'study-unit-1.webp', source: 'https://unsplash.com/photos/modern-home-office-desk-setup-with-computer-and-plants-xqh-RlfJVx4', by: 'Faizur Rehman' },
    { file: 'study-unit-2.webp', source: 'https://unsplash.com/photos/a-chair-and-desk-by-a-window-with-a-lamp-QWaV-Wp_GkQ', by: 'Clay Banks' },
  ],
  'tv-unit': [
    { file: 'tv-unit-1.webp', source: 'https://unsplash.com/photos/modern-living-room-with-tv-and-decorative-shelving-7i5MMVBeQ2E', by: 'Studio Archifiction' },
    { file: 'tv-unit-2.webp', source: 'https://unsplash.com/photos/a-living-room-with-a-flat-screen-tv-mounted-on-a-wall-mJk3xEjXnBU', by: 'sheela sahani' },
  ],
  'crockery-unit': [
    { file: 'crockery-unit-1.webp', source: 'https://unsplash.com/photos/a-wooden-cabinet-with-glass-doors-in-a-room-olbKi34CXOU', by: 'Arturo Añez' },
    { file: 'crockery-unit-2.webp', source: 'https://unsplash.com/photos/wooden-cabinet-with-glassware-illuminated-by-sunlight-hCjGmJSnU2c', by: 'William Ducret' },
  ],
  'console-and-shoe-rack': [
    { file: 'console-and-shoe-rack-1.webp', source: 'https://unsplash.com/photos/a-round-mirror-above-a-wooden-console-table-with-decor-ZKV6qY_arM8', by: 'Franco Debartolo' },
    { file: 'console-and-shoe-rack-2.webp', source: 'https://unsplash.com/photos/black-console-table-with-decorative-mirrors-and-a-potted-plant-5_gZQHUZb_c', by: 'McFollis' },
  ],
  'pooja-unit': [
    { file: 'pooja-unit-1.webp', source: 'https://unsplash.com/photos/modern-wall-with-niches-statues-and-lotus-designs-jQZlYr3JKLw', by: 'Ashish R. Mishra' },
    { file: 'pooja-unit-2.webp', source: 'https://unsplash.com/photos/collection-of-brass-hindu-deities-and-figures-UZW5SxrZCb4', by: 'Lens Fables' },
  ],
  'safety-door': [
    { file: 'safety-door-1.webp', source: 'https://unsplash.com/photos/a-locked-metal-gate-with-ornate-glass-panels-aFD83x0DRjI', by: 'Zoshua Colah' },
  ],
  'false-ceiling': [
    { file: 'false-ceiling-1.webp', source: 'https://unsplash.com/photos/a-modern-living-room-features-decorative-ceiling-lights-i5UA8CfAD34', by: 'iKshana Productions' },
    { file: 'false-ceiling-2.webp', source: 'https://unsplash.com/photos/white-ceiling-with-light-fixture-M8LiVogRPAE', by: 'SJ' },
  ],
  'painting': [
    { file: 'painting-1.webp', source: 'https://unsplash.com/photos/a-person-using-a-paint-roller-to-paint-a-wall-rMVjOX8nm2U', by: 'Andrew Itaga' },
    { file: 'painting-2.webp', source: 'https://unsplash.com/photos/a-man-painting-a-wall-with-a-paint-roller-57ldq9age5U', by: 'Ernys' },
  ],
  'electrical-work': [
    { file: 'electrical-work-1.webp', source: 'https://unsplash.com/photos/brass-toggle-light-switch-against-a-clean-white-wall-K-OfJf85gsg', by: 'Lunyon' },
    { file: 'electrical-work-2.webp', source: 'https://unsplash.com/photos/a-white-light-switch-sitting-on-top-of-a-wall-9BEVufrkTi0', by: 'Linus Belanger' },
  ],
  'bathroom-vanity': [
    { file: 'bathroom-vanity-1.webp', source: 'https://unsplash.com/photos/a-bathroom-with-a-sink-and-a-mirror-JwbcapNDF2o', by: 'Royale Stones Ireland' },
    { file: 'bathroom-vanity-2.webp', source: 'https://unsplash.com/photos/a-bathroom-with-marble-counter-tops-and-green-cabinets-FPim6ZLM6fc', by: 'Zac Gudakov' },
  ],
  'flooring-relay': [
    { file: 'flooring-relay-1.webp', source: 'https://unsplash.com/photos/photo-of-gray-floor-tiles-n3GDA7mZVyU', by: 'Carl Raw' },
    { file: 'flooring-relay-2.webp', source: 'https://unsplash.com/photos/white-and-brown-floor-tiles-yg-nrRoZcw0', by: 'Glen Ardi' },
  ],
  'bathroom-renovation': [
    { file: 'bathroom-renovation-1.webp', source: 'https://unsplash.com/photos/white-ceramic-sink-with-mirror-1AF5hP6F4tI', by: 'Steven Ungermann' },
    { file: 'bathroom-renovation-2.webp', source: 'https://unsplash.com/photos/a-white-subway-tile-wall-forms-a-clean-uniform-background-1l8QmHqT-F0', by: 'bady abbas' },
  ],
  'kitchen-civil-work': [
    { file: 'kitchen-civil-work-1.webp', source: 'https://unsplash.com/photos/empty-sink-euBmypOZUZA', by: 'Christian Mackie' },
    { file: 'kitchen-civil-work-2.webp', source: 'https://unsplash.com/photos/a-grid-of-white-textured-tiles-LtZlxlngn98', by: 'Tasha Kostyuk' },
  ],
  'sink-and-plumbing-fittings': [
    { file: 'sink-and-plumbing-fittings-1.webp', source: 'https://unsplash.com/photos/stainless-steel-sink-with-faucet-CmW1uWURB18', by: 'Callum Hill' },
    { file: 'sink-and-plumbing-fittings-2.webp', source: 'https://unsplash.com/photos/stainless-steel-faucet-turned-off-IcNpBCQS3fk', by: 'Steven Ungermann' },
  ],
  'bedside-tables': [
    { file: 'bedside-tables-1.webp', source: 'https://unsplash.com/photos/a-bedroom-with-a-bed-nightstand-and-lamp-hdLHMTlvOZE', by: 'Suzanne Rushton' },
    { file: 'bedside-tables-2.webp', source: 'https://unsplash.com/photos/modern-bedroom-with-beige-bed-and-floating-white-nightstand-E-z8iE6LSgg', by: 'Caroline Badran' },
  ],
  'sofa-and-upholstery': [
    { file: 'sofa-and-upholstery-1.webp', source: 'https://unsplash.com/photos/green-fabric-sofa-fZuleEfeA1Q', by: 'Phillip Goldsberry' },
    { file: 'sofa-and-upholstery-2.webp', source: 'https://unsplash.com/photos/a-gray-couch-with-four-pillows-on-it-KEGGJPKxcSc', by: 'Ambo Ampeng' },
  ],
  'pu-polish': [
    { file: 'pu-polish-1.webp', source: 'https://unsplash.com/photos/dark-mahogany-wood-grain-texture-1mn0msNwU1U', by: 'Simulacra Workshop' },
    { file: 'pu-polish-2.webp', source: 'https://unsplash.com/photos/a-close-up-of-a-light-brown-wood-grain-texture-0yfG1HXRN5U', by: 'Colin Watts' },
  ],
  'civil-breaking-and-making': [
    { file: 'civil-breaking-and-making-1.webp', source: 'https://unsplash.com/photos/room-renovation-with-metal-support-poles-biRt6RXejuk', by: 'Stefan Lehner' },
    { file: 'civil-breaking-and-making-2.webp', source: 'https://unsplash.com/photos/hands-applying-plaster-to-a-wall-with-trowels-Re1O5byZ8bY', by: 'Sasun Bughdaryan' },
  ],
  'glass-partition': [
    { file: 'glass-partition-1.webp', source: 'https://unsplash.com/photos/modern-frosted-glass-room-divider-with-black-frame-o0aygXDzegs', by: 'Marina Nazina' },
    { file: 'glass-partition-2.webp', source: 'https://unsplash.com/photos/modern-bathroom-with-glass-shower-and-artistic-frosted-door-kGg--6h1zOc', by: 'Aphrodites daughter' },
  ],
  'wall-mirror': [
    { file: 'wall-mirror-1.webp', source: 'https://unsplash.com/photos/black-framed-wall-mounted-mirror-xnLHz7NJzRA', by: 'Elena Kloppenburg' },
  ],
  'wallpaper': [
    { file: 'wallpaper-1.webp', source: 'https://unsplash.com/photos/a-bedroom-with-a-green-wall-and-a-white-bed-RnAo-ha4bpM', by: 'Lotus Design N Print' },
    { file: 'wallpaper-2.webp', source: 'https://unsplash.com/photos/white-and-brown-floral-textile-lDsLt5qfwjE', by: 'Varad Murti' },
  ],
  'curtains-and-blinds': [
    { file: 'curtains-and-blinds-1.webp', source: 'https://unsplash.com/photos/modern-living-room-with-minimalist-furniture-and-white-curtains-0zEfS8Ar4es', by: 'EZcurtain Life' },
    { file: 'curtains-and-blinds-2.webp', source: 'https://unsplash.com/photos/curtains-frame-a-window-in-a-bright-room-j_J2JvXTe7M', by: 'EZcurtain Life' },
  ],
  'site-supervision': [
    { file: 'site-supervision-1.webp', source: 'https://unsplash.com/photos/man-reviews-blueprints-at-construction-site-9gCRnfwSkwo', by: 'GN Group' },
    { file: 'site-supervision-2.webp', source: 'https://unsplash.com/photos/a-couple-of-men-working-on-a-house-ut6gWxh3oqQ', by: 'Jessica Hearn' },
  ],
};

/** The site paths of an item's starter photos, in order. */
export function starterPhotoPaths(slug: string): string[] {
  return (STARTER_PHOTOS[slug] ?? []).map((p) => `/items/${p.file}`);
}

/** Is this one of our starter example photos (rather than a real photo our team uploaded)? */
export function isStarterPhoto(url: string): boolean {
  return /\/items\/[a-z0-9-]+-\d+\.webp$/.test(url);
}
