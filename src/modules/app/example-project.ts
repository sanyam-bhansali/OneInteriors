/**
 * The example project the app's after-signing screens show (the owner's v1
 * screens, 8 Oct 2026) until a customer has a signed project of their own.
 *
 * Every screen that reads this says "Example project" on it. The studio, the
 * people and the flat are invented; the photos are the owner's, taken from
 * the design file (public/app/photos), not anyone's site
 * empty-room film, not anyone's site.
 */

export const EXAMPLE = {
  flat: 'Flat 1204, Baner',
  studio: 'Teakline Studio',
  since: '3 Aug',
  stage: { name: 'Carpentry', day: 18, of: 30 },
  stages: ['Design', 'Civil', 'Carpentry', 'Finish', 'Handover'] as const,
  stageNow: 2,
  runningLateDays: 4,
  paidLakh: 7.36,
  totalLakh: 18.4,
  handover: '14 Dec',
  today: 'Thu 8 Oct',
};

/** The design file's own photos, one per place the screens show a photo. */
export const PHOTOS = {
  welcome: '/app/photos/welcome-hero.webp',
  homeHero: '/app/photos/home-hero.webp',
  living: '/app/photos/living.webp',
  bedroom1: '/app/photos/bedroom-1.webp',
  kitchenCarcass: '/app/photos/kitchen-carcass.webp',
  kitchen: '/app/photos/kitchen.webp',
  wardrobeTop: '/app/photos/wardrobe-top.webp',
  switchboard: '/app/photos/switchboard.webp',
} as const;

/** Today's three site photos, as Home, On site and GEIO show them. */
export const TODAY = [
  { src: PHOTOS.bedroom1, alt: 'Bedroom 1 on site' },
  { src: PHOTOS.living, alt: 'Bedroom 2 on site' },
  { src: PHOTOS.kitchenCarcass, alt: 'Kitchen on site' },
];

export interface Milestone {
  title: string;
  state: 'done' | 'now' | 'next';
  meta: string;
  note?: string;
  flag?: { head: string; body: string };
}

export const MILESTONES: Milestone[] = [
  { title: 'Design sign-off', state: 'done', meta: 'Planned 24 Aug, done 22 Aug', note: '2 days early. Booking and design paid' },
  {
    title: 'Civil and electrical',
    state: 'done',
    meta: 'Planned 15 Sep, done 21 Sep',
    flag: { head: '6 days late', body: 'Floor tiles reached site late from the supplier. Checked against the delivery note on 18 Sep.' },
  },
  { title: 'Carpentry, now', state: 'now', meta: 'Day 18 of 30, due 31 Oct, on track' },
  { title: 'Painting and finishing', state: 'next', meta: '1 Nov to 5 Dec · ₹3.68 L due at start' },
  { title: 'Handover', state: 'next', meta: '14 Dec · last ₹1.84 L after snags close' },
];

export const CARPENTRY: { item: string; status: string; kind: 'done' | 'choose' | 'next' }[] = [
  { item: 'Wardrobe frames', status: 'Done', kind: 'done' },
  { item: 'Kitchen carcass', status: 'Done', kind: 'done' },
  { item: 'Kitchen shutters', status: 'Your choice', kind: 'choose' },
  { item: 'TV unit, false ceiling', status: 'Next', kind: 'next' },
];

export const WEEK: { day: string; state: 'worked' | 'missed' | 'today' | 'ahead' }[] = [
  { day: 'Mon', state: 'worked' },
  { day: 'Tue', state: 'missed' },
  { day: 'Wed', state: 'worked' },
  { day: 'Thu', state: 'today' },
  { day: 'Fri', state: 'ahead' },
  { day: 'Sat', state: 'ahead' },
];

export const DECISION = {
  title: 'Kitchen shutter finish',
  due: 'Fri 16 Oct',
  why: 'Shutters are cut next week. If this waits past Friday, carpentry moves by about 3 days and so does your handover.',
  options: [
    { name: 'Sage matte laminate', note: 'Soft-touch, hides fingerprints', price: 'In quote', swatch: '#9fb59a' },
    { name: 'Walnut grain', note: 'Warm wood look, textured', price: '+₹14,500', swatch: '#7a4a2c' },
    { name: 'Off-white high gloss', note: 'Reflects light, shows marks', price: '+₹8,200', swatch: '#f4efe6' },
  ],
};

export const SNAGS = {
  open: [
    { title: 'Gap between wardrobe and ceiling', where: 'Bedroom 1, raised Wed 7 Oct', status: 'Fix by Sat 10 Oct', img: PHOTOS.wardrobeTop, late: false },
    { title: 'Scratch on kitchen side panel', where: 'Kitchen, raised Mon 5 Oct', status: 'Studio: replacing panel Mon 12 Oct', img: PHOTOS.kitchen, late: false },
  ],
  fixed: [{ title: 'Switchboard not level', where: 'Living room, raised 24 Sep', status: 'Fixed 26 Sep, photo from site', img: PHOTOS.switchboard, late: false }],
};

export const MATERIALS = [
  { part: 'Kitchen shutters', name: 'Sage matte laminate', note: 'Code added when ordered', swatch: '#9fb59a' },
  { part: 'Floor tiles', name: 'Matt beige, 800 x 800', note: '6 spare boxes in the loft', swatch: '#cdbb98' },
  { part: 'Wardrobe board', name: '18mm BWP ply', note: 'Century, IS 710', swatch: '#c9a77c' },
  { part: 'Hinges', name: 'Soft-close, Hettich', note: '10-year warranty', swatch: '#8d8f93' },
];

export const DOCUMENTS = [
  { name: 'Agreement with Teakline Studio', meta: 'Signed 3 Aug 2026' },
  { name: 'Final quotation, 40 lines', meta: '₹18,40,000, locked 3 Aug' },
  { name: 'Design drawings', meta: '14 files, updated 22 Aug' },
  { name: 'Payment receipts', meta: '2 receipts, ₹7,36,000' },
  { name: 'Warranties and manuals', meta: 'Added at handover, 14 Dec' },
];

export type RoomId = 'living' | 'bed1' | 'kitchen' | 'bath' | 'bed2';

/** The five rooms of the 3D home (the design's own notes), and where each one links. */
export const ROOMS_3D: {
  id: RoomId;
  name: string;
  status: 'Done' | 'In progress' | 'Next up';
  note: string;
  designNote: string;
  photo: string | null;
  link: { href: string; label: string } | null;
}[] = [
  {
    id: 'living',
    name: 'Living & dining',
    status: 'Next up',
    note: 'Walls, floor and wiring done. The TV unit and false ceiling start next week.',
    designNote: 'Linen sofa, oak coffee table and a walnut TV wall, as in your design.',
    photo: null,
    link: { href: '/app/project', label: 'See the timeline' },
  },
  {
    id: 'bed1',
    name: 'Bedroom 1',
    status: 'In progress',
    note: 'Wardrobe frames fitted today. Ramesh, carpenter, on site from 9:40 am.',
    designNote: 'Queen bed with a wood headboard and a full-height wardrobe.',
    photo: PHOTOS.bedroom1,
    link: { href: '/app/site', label: 'See today on site' },
  },
  {
    id: 'kitchen',
    name: 'Kitchen',
    status: 'In progress',
    note: 'Carcass fixed to the wall today. Shutters wait on your finish choice, due Fri 16 Oct.',
    designNote: 'L-shaped kitchen with sage matte shutters and a quartz counter.',
    photo: PHOTOS.kitchenCarcass,
    link: { href: '/app/decision', label: 'Choose the shutter finish' },
  },
  {
    id: 'bath',
    name: 'Bath & utility',
    status: 'Done',
    note: 'Tiling and fittings finished. Checked by your expert on 21 Sep.',
    designNote: 'Grey-blue tiles, a walk-in shower and a wall-hung vanity.',
    photo: null,
    link: null,
  },
  {
    id: 'bed2',
    name: 'Bedroom 2',
    status: 'In progress',
    note: 'Wardrobe frames fitted today by Ramesh’s helper.',
    designNote: 'Second bedroom with a study corner and a full-height wardrobe.',
    photo: PHOTOS.living,
    link: { href: '/app/site', label: 'See today on site' },
  },
];

/** A few lines of the example's signed quote, so GEIO can answer "what did I pay for…". */
export const QUOTE_LINES = [
  { line: 3, item: 'Kitchen, L-shape 11 ft', spec: '18mm BWP ply carcass, laminate shutter, quartz counter', rupees: 385_000 },
  { line: 7, item: 'Wardrobe, bedroom 1', spec: '18mm BWP ply, matt laminate, soft-close hinges', rupees: 210_000 },
  { line: 9, item: 'Wardrobe, bedroom 2', spec: '18mm BWP ply, matt laminate, soft-close hinges', rupees: 210_000 },
  { line: 14, item: 'TV unit', spec: 'Veneer finish, 9 ft wide, concealed wiring', rupees: 86_000 },
  { line: 18, item: 'False ceiling, living', spec: 'Gypsum, cove lighting, 420 sq ft', rupees: 1_26_000 },
];

/** The payment plan: what is paid, and what falls due when. */
export const PAYMENTS = [
  { stage: 'Booking and design', rupees: 1_84_000, state: 'Paid 3 Aug' },
  { stage: 'Civil and electrical start', rupees: 5_52_000, state: 'Paid 25 Aug' },
  { stage: 'Carpentry midway', rupees: 5_52_000, state: 'Due once the midway photos are checked by your expert (this week)' },
  { stage: 'Painting and finishing start', rupees: 3_68_000, state: 'Due 1 Nov' },
  { stage: 'Handover, after snags close', rupees: 1_84_000, state: 'Due after the snag list is closed' },
];
