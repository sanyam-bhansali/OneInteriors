/**
 * The example project the app's after-signing screens show (the owner's v1
 * screens, 8 Oct 2026) until a customer has a signed project of their own.
 *
 * Every screen that reads this says "Example project" on it. The studio, the
 * people and the flat are invented; the photos are the home page's own
 * empty-room film, not anyone's site.
 */

import type { LayoutRoomKey } from '@/modules/brief/flat-layout';

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

/** A frame of the home page's empty-room film: 0 is dark, 32 fully lit. */
export const photo = (i: number) => `/landing/seq/f${String(i).padStart(2, '0')}.webp`;

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
    { title: 'Gap between wardrobe and ceiling', where: 'Bedroom 1, raised Wed 7 Oct', status: 'Fix by Sat 10 Oct', img: 30, late: false },
    { title: 'Scratch on kitchen side panel', where: 'Kitchen, raised Mon 5 Oct', status: 'Studio: replacing panel Mon 12 Oct', img: 26, late: false },
  ],
  fixed: [{ title: 'Switchboard not level', where: 'Living room, raised 24 Sep', status: 'Fixed 26 Sep, photo from site', img: 24, late: false }],
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

export const ROOMS_3D: { key: LayoutRoomKey; label: string; state: 'done' | 'now' | 'next'; note: string }[] = [
  { key: 'LIVING_DINING', label: 'Living & dining', state: 'next', note: 'TV unit and false ceiling start 19 Oct.' },
  { key: 'MASTER_BEDROOM', label: 'Bedroom 1', state: 'now', note: 'Wardrobe frames fitted today. Shutters follow the kitchen.' },
  { key: 'KITCHEN', label: 'Kitchen', state: 'now', note: 'Carcass fixed to the wall today. Shutters wait on your finish choice, due Fri 16 Oct.' },
  { key: 'BATHROOMS', label: 'Bath & utility', state: 'done', note: 'Vanity and utility storage fitted 2 Oct.' },
  { key: 'SECOND_BEDROOM', label: 'Bedroom 2', state: 'now', note: 'Wardrobe frames fitted. Study table next week.' },
];
