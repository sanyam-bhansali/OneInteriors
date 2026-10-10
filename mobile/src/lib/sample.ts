import { Image } from 'react-native';
import type { Result } from './api';
import type { GeioReply, Notice, Profile, Project } from './types';

/**
 * The sample customer (docs/app-handover/SAMPLE-DATA.md): Priya, flat 1204
 * in Baner, signed with Teakline. Only a test build turns this on
 * (`EXPO_PUBLIC_SAMPLE=1`), and then every call in api.ts is answered from
 * here instead of the server, so each screen can be seen with no backend.
 * A real customer never sees it. Dates are set around today so "day 18 of
 * 30" and "due in 5 days" stay true whenever the build is opened.
 */
export const SAMPLE = process.env.EXPO_PUBLIC_SAMPLE === '1';

const DAY = 86_400_000;
const at = (days: number, hour = 10) => {
  const d = new Date(Date.now() + days * DAY);
  d.setHours(hour, 0, 0, 0);
  return d.toISOString();
};
const L = (lakh: number) => Math.round(lakh * 100_000 * 100);
/* The website's own site photos, bundled, so the sample works offline. */
const PHOTOS = {
  wardrobe: require('../../assets/sample/wardrobe-top.webp'),
  bedroom: require('../../assets/sample/bedroom-1.webp'),
  carcass: require('../../assets/sample/kitchen-carcass.webp'),
  kitchen: require('../../assets/sample/kitchen.webp'),
  living: require('../../assets/sample/living.webp'),
  switchboard: require('../../assets/sample/switchboard.webp'),
} as const;
const photo = (name: keyof typeof PHOTOS) => Image.resolveAssetSource(PHOTOS[name]).uri;

export const SAMPLE_USER = { id: 'sample', name: 'Priya', phone: '+919822041736' };

export const SAMPLE_PROFILE: Profile = {
  home: { label: 'Flat 1204, Baner', locality: 'Baner', bhk: '2 BHK', carpetSqft: 960, tier: 'premium', fullHome: true },
  coins: { balance: 1410, streak: 6 },
  expert: { name: 'Meera' },
  unread: 3,
  locale: 'en',
};

export const SAMPLE_PROJECT: Project & { overallLateDays: number } = {
  id: 'sample-project',
  role: 'owner',
  studio: 'Teakline Studio',
  startOn: at(-48),
  overallLateDays: 4,
  stages: [
    { key: 'DESIGN', label: 'Design sign-off', targetOn: at(-48), state: 'done', late: false },
    { key: 'SITE', label: 'Civil', targetOn: at(-20), state: 'done', late: true },
    { key: 'PRODUCTION', label: 'Carpentry', targetOn: at(12), state: 'now', late: false },
    { key: 'FINISH', label: 'Finishing', targetOn: at(55), state: 'next', late: false },
    { key: 'HANDOVER', label: 'Handover', targetOn: at(64), state: 'later', late: false },
  ],
  phases: null,
  money: {
    contractPaise: L(18.4),
    paidPaise: L(7.36),
    laterPaise: L(3.68),
    next: { index: 1, label: 'When finishing starts', pct: 40, amountPaise: L(7.36), dueOn: at(21), paidOn: null, state: 'next' },
    stages: [
      { index: 0, label: 'At signing', pct: 40, amountPaise: L(7.36), dueOn: at(-48), paidOn: at(-48), state: 'paid' },
      { index: 1, label: 'When finishing starts', pct: 40, amountPaise: L(7.36), dueOn: at(21), paidOn: null, state: 'next' },
      { index: 2, label: 'At handover, after snags close', pct: 20, amountPaise: L(3.68), dueOn: at(64), paidOn: null, state: 'later' },
    ],
  },
  changes: { totalPaise: 0, items: [] },
  updates: [
    {
      id: 'u1',
      note: 'Ramesh (carpenter) and 1 helper on site from 9:40 am. Wardrobe frames fitted in both bedrooms.',
      stage: 'Carpentry',
      at: at(0, 9),
      byStudio: true,
      photos: [photo('wardrobe'), photo('bedroom'), photo('living')],
    },
    {
      id: 'u2',
      note: 'Kitchen carcasses levelled and fixed to the wall.',
      stage: 'Carpentry',
      at: at(-1, 17),
      byStudio: true,
      photos: [photo('kitchen')],
    },
    {
      id: 'u3',
      note: 'Plywood for the wardrobes delivered and checked against the quote: 18 mm BWP.',
      stage: 'Carpentry',
      at: at(-3, 12),
      byStudio: true,
      photos: [photo('carcass')],
    },
  ],
  decisions: [
    {
      id: 'd1',
      title: 'Kitchen shutter finish',
      why: 'The factory cuts the shutters next week, so the finish has to be fixed now.',
      dueOn: at(5),
      daysLeft: 5,
      state: 'open',
      chosenIndex: null,
      chosenAt: null,
      options: [
        { name: 'Sage matte', note: 'In your quote', extraPaise: 0, swatch: '#9AA58C' },
        { name: 'Walnut grain', note: 'Warmer, hides marks', extraPaise: 14_500_00, swatch: '#6B4A33' },
        { name: 'Off-white gloss', note: 'Brighter, shows fingerprints', extraPaise: 8_200_00, swatch: '#EFEBE3' },
      ],
    },
  ],
  snags: [
    {
      id: 's1',
      title: 'Gap between wardrobe and ceiling',
      room: 'Master bedroom',
      note: null,
      status: 'OPEN',
      line: 'Fix by Sat',
      raisedAt: at(-2),
      raisedByStudio: false,
      photos: [photo('wardrobe')],
      fixedNote: null,
      fixedPhotos: [],
    },
    {
      id: 's2',
      title: 'Scratch on the kitchen side panel',
      room: 'Kitchen',
      note: null,
      status: 'OPEN',
      line: null,
      raisedAt: at(-1),
      raisedByStudio: false,
      photos: [photo('carcass')],
      fixedNote: null,
      fixedPhotos: [],
    },
    {
      id: 's3',
      title: 'Switchboard off-centre',
      room: 'Living room',
      note: null,
      status: 'FIXED',
      line: null,
      raisedAt: at(-9),
      raisedByStudio: false,
      photos: [photo('switchboard')],
      fixedNote: 'Moved 4 cm left and re-plastered.',
      fixedPhotos: [photo('switchboard')],
    },
  ],
  documents: [
    { id: 'doc1', kind: 'AGREEMENT', title: 'Agreement with Teakline Studio', meta: 'Signed, PDF', url: 'https://oneinteriors.in/privacy' },
    { id: 'doc2', kind: 'QUOTATION', title: 'Final quote, ₹18,40,000', meta: '40 lines, PDF', url: 'https://oneinteriors.in/privacy' },
    { id: 'doc3', kind: 'DRAWINGS', title: 'Design drawings', meta: '12 sheets', url: 'https://oneinteriors.in/privacy' },
    { id: 'doc4', kind: 'RECEIPT', title: 'Receipt, ₹7,36,000', meta: 'At signing', url: 'https://oneinteriors.in/privacy' },
  ],
};

const SAMPLE_NOTICES: Notice[] = [
  { id: 'n1', template: 'update', payload: { title: 'Teakline posted today’s update', body: 'Wardrobe frames fitted in both bedrooms.', url: '/site' }, readAt: null, createdAt: at(0, 9) },
  { id: 'n2', template: 'decision-due', payload: { title: 'Kitchen shutter finish, due in 5 days', body: 'Pick one of three finishes.', url: '/decision/d1' }, readAt: null, createdAt: at(0, 8) },
  { id: 'n3', template: 'snag-raised', payload: { title: 'Snag sent to Teakline', body: 'Scratch on the kitchen side panel.', url: '/snags' }, readAt: null, createdAt: at(-1, 18) },
  { id: 'n4', template: 'payment-recorded', payload: { title: 'Payment recorded', body: '₹7,36,000 at signing. Receipt in your locker.', url: '/locker' }, readAt: at(-40), createdAt: at(-48) },
];

const SAMPLE_REPLY: GeioReply = {
  paragraphs: [
    'Today Ramesh and a helper fitted the wardrobe frames in both bedrooms. That is on plan: carpentry is on day 18 of 30.',
    'The one thing waiting on you is the kitchen shutter finish, due in 5 days.',
  ],
  see: [],
  handover: null,
  follow: ['What happens after carpentry?', 'Is 18 mm BWP ply good?', 'Why is the project 4 days late?'],
  sources: [],
};

let read = new Set<string>();

/** Answers a call as the server would, for the sample customer. */
export async function sampleCall<T>(method: string, path: string, body?: unknown): Promise<Result<T>> {
  await new Promise((r) => setTimeout(r, 250));
  const ok = (data: unknown) => ({ ok: true, data: data as T }) as const;
  const route = `${method} ${path.split('?')[0]}`;
  if (route === 'POST /auth/otp/request') return ok({ devCode: '123456' });
  if (route === 'POST /auth/otp/verify') return ok({ token: 'sample' });
  if (route === 'GET /me') return ok({ user: SAMPLE_USER, ...SAMPLE_PROFILE, unread: SAMPLE_NOTICES.filter((n) => !n.readAt && !read.has(n.id)).length });
  if (route === 'GET /project') return ok({ projects: [SAMPLE_PROJECT] });
  if (route === 'GET /notifications') {
    const notifications = SAMPLE_NOTICES.map((n) => (read.has(n.id) ? { ...n, readAt: n.readAt ?? new Date().toISOString() } : n));
    return ok({ unread: notifications.filter((n) => !n.readAt).length, notifications });
  }
  if (route === 'POST /notifications') {
    const b = body as { all?: boolean; ids?: string[] } | undefined;
    read = new Set([...read, ...(b?.all ? SAMPLE_NOTICES.map((n) => n.id) : (b?.ids ?? []))]);
    return ok({});
  }
  if (route === 'POST /geio') return ok({ reply: SAMPLE_REPLY });
  if (route === 'POST /coins/opened') return ok({ earned: 10 });
  if (route === 'POST /snags') return ok({ id: `s${Date.now()}` });
  // Choosing, locale, devices, sign-out, delete: accepted and forgotten.
  return ok({});
}
