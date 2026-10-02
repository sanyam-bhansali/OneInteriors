/**
 * A real close-up for the materials a quote names (build queue item 23),
 * shown at the top of the material panel above the "good / worse / what it
 * moves" lesson. Free Unsplash photographs, credited; a material without a
 * photo that truly shows it keeps its drawing rather than a near miss.
 */

export interface MaterialPhoto {
  src: string;
  alt: string;
  photographer: string;
  page: string;
}

export const MATERIAL_PHOTOS: Partial<Record<string, MaterialPhoto>> = {
  bwp: {
    src: 'https://images.unsplash.com/photo-1690768162439-7ca7a1813038',
    alt: 'The edge of stacked plywood sheets, showing the layers',
    photographer: 'LUCIA LU',
    page: 'https://unsplash.com/photos/a-stack-of-wooden-boards-stacked-on-top-of-each-other-F6cL5B7Gnz8',
  },
  bwr: {
    src: 'https://images.unsplash.com/photo-1692313208941-4f1c9cdcc7c3',
    alt: 'A stack of plywood boards seen from the side',
    photographer: 'LUCIA LU',
    page: 'https://unsplash.com/photos/a-stack-of-wooden-planks-stacked-on-top-of-each-other-Rx00j17pZbM',
  },
  mdf: {
    src: 'https://images.unsplash.com/photo-1558051815-0f18e64e6280',
    alt: 'The smooth, even brown face of a fibre board',
    photographer: 'Josephine Barham',
    page: 'https://unsplash.com/photos/a-close-up-view-of-a-brown-surface-KsAo8ouBn8A',
  },
  mm18: {
    src: 'https://images.unsplash.com/photo-1672591426156-048f5ca1c0b0',
    alt: 'Plywood shelving, showing the board thickness at every edge',
    photographer: 'David Guarino',
    page: 'https://unsplash.com/photos/a-shelf-made-out-of-plywood-in-a-garage-I1twoR-zrsQ',
  },
  laminate: {
    src: 'https://images.unsplash.com/photo-1655457397686-4dd23e78a918',
    alt: 'A fan of laminate samples in wood and plain finishes',
    photographer: 'Penny Lim',
    page: 'https://unsplash.com/photos/a-stack-of-wood-7m3ReTvWFKk',
  },
  edgeband: {
    src: 'https://images.unsplash.com/photo-1639593051524-3dc5dcfd7a27',
    alt: 'The finished white edges of cabinet panels',
    photographer: 'Hanindito Prabandaru',
    page: 'https://unsplash.com/photos/a-close-up-of-a-white-object-on-a-table-3Os1Z_tGzuo',
  },
  softclose: {
    src: 'https://images.unsplash.com/photo-1668893973066-95b14ce86e71',
    alt: 'A concealed cabinet hinge on an open door',
    photographer: 'Olya P',
    page: 'https://unsplash.com/photos/a-door-with-a-glass-door-Oy02tIb9Pp8',
  },
  tandem: {
    src: 'https://images.unsplash.com/photo-1676907228185-6869277a9f8f',
    alt: 'A deep kitchen drawer pulled fully open, with an organiser inside',
    photographer: 'Orgalux',
    page: 'https://unsplash.com/photos/an-open-drawer-in-a-kitchen-filled-with-dishes-BngKr53ZvR4',
  },
  gypsum: {
    src: 'https://images.unsplash.com/photo-1746439307632-cba0f8effbed',
    alt: 'A false ceiling with a lit cove around a living room',
    photographer: 'iKshana Productions',
    page: 'https://unsplash.com/photos/a-modern-living-room-features-decorative-ceiling-lights-i5UA8CfAD34',
  },
  mirror: {
    src: 'https://images.unsplash.com/photo-1656646523527-f7db786e767b',
    alt: 'Wall mirrors above a bathroom vanity',
    photographer: 'Point3D Commercial Imaging Ltd.',
    page: 'https://unsplash.com/photos/a-bathroom-with-a-couple-of-mirrors-CIjoEjyENDc',
  },
  primer: {
    src: 'https://images.unsplash.com/photo-1693985120993-e9b203ce7631',
    alt: 'A roller putting a coat of paint on a primed wall',
    photographer: 'Andrew Itaga',
    page: 'https://unsplash.com/photos/a-person-using-a-paint-roller-to-paint-a-wall-rMVjOX8nm2U',
  },
};
