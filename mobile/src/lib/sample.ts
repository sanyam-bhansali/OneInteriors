import { Asset } from 'expo-asset';
import type { Result } from './api';
import { SAMPLE_JOURNEY } from './journey/sample';
import type { GeioReply, Notice, Profile, Project, TrackerStep } from './types';

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
/** A day, 'YYYY-MM-DD', `days` from today. */
const dayAt = (days: number) => at(days).slice(0, 10);
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
const photo = (name: keyof typeof PHOTOS) => Asset.fromModule(PHOTOS[name]).uri;

/*
 * The step tracker as the server sends it (portal/tracker-view.ts): Hauspire's
 * steps per stage with their share of the project in %, the first `done` of
 * them ticked a day apart from `from` days ago, the rest planned a few days apart.
 */
const steps = (group: string, rows: [string, number][], done: number, from: number): TrackerStep[] =>
  rows.map(([label, pct], i) => ({
    label,
    group,
    pct,
    done: i < done,
    doneOn: i < done ? dayAt(from + i) : null,
    plannedOn: dayAt(from + i * 2),
  }));
/*
 * Customer milestones (docs/studio-os/CUSTOMER-MILESTONES.md): the server
 * sends only the steps the studio starred. The lists below are the studio's
 * whole plan; `ms` keeps the starred ones (the template's default stars).
 */
const STARRED = new Set([
  'Final design and drawings signed off',
  'POP, civil, fabrication and electrical work started',
  'POP sheets',
  'Materials delivered from the factory',
  'Carcass complete with hardware',
  'Shutters delivered',
  'Painting started',
  'Painting complete',
  'Snags listed',
  'Handover',
]);
const ms = (list: TrackerStep[]): TrackerStep[] => list.filter((s) => STARRED.has(s.label));
const cl = (list: TrackerStep[]) => ({ done: ms(list).filter((s) => s.done).length, total: ms(list).length });
const DESIGN_STEPS = steps('Design', [['Final design and drawings signed off', 2]], 1, -50);
const CIVIL_STEPS = steps(
  'Execution stage 1',
  [
    ['POP, civil, fabrication and electrical work started', 1],
    ['POP framing', 4],
    ['POP wiring', 3],
    ['POP sheets', 4],
    ['POP lights', 2],
    ['PVC POP work', 2],
    ['Fabrication work', 3],
    ['Civil work', 4],
  ],
  8,
  -40,
);
const CARPENTRY_STEPS = [
  ...steps(
    'Execution stage 2A',
    [
      ['Site inspection of POP and civil work by the designer', 1],
      ['Material at site: moulding, safety-door jali, ply', 2],
      ['Site discussion and carpentry started', 1],
      ['Materials delivered from the factory', 3],
      ['Hardware stage 1 ordered (tandems, channels, folding mechanisms)', 1],
      ['CNC work and PU material ordered', 1],
      ['Carcass complete with hardware', 10],
      ['Shutters measured and ordered', 1],
      ['Hardware stage 2 ordered (hinges, handles, push magnets, hydraulics)', 1],
      ['Handles, knobs and locks ordered', 1],
      ['Site inspection at carcass stage by the designer', 1],
    ],
    5,
    -18,
  ),
  ...steps(
    'Execution stage 2B',
    [
      ['Name plate ordered', 0.5],
      ['Manual carpentry work complete', 6],
      ['Shutters delivered', 4],
      ['Handles and locks installed', 3],
      ['Safety door installed', 2],
      ['Carpentry complete and site cleaned', 3],
    ],
    0,
    2,
  ),
];
const FINISH_STEPS = steps(
  'Finishing',
  [
    ['Profile door and mirror installed', 3],
    ['Painting started', 2],
    ['Painting complete', 8],
    ['Cleaning complete', 2],
  ],
  0,
  14,
);
const HANDOVER_STEPS = steps(
  'Handover',
  [
    ['Snag list closed', 2],
    ['Final inspection with the client', 1],
    ['Handover', 2],
  ],
  0,
  56,
);

export const SAMPLE_USER = { id: 'sample', name: 'Priya', phone: '+919822041736' };

/*
 * The sample starts on Basic so the locked GEIO tab and the upgrade can be
 * seen; asking for Assured in the sample switches it at once, as if our
 * team had already confirmed, so the Assured screens can be seen too.
 */
export const SAMPLE_PROFILE: Profile = {
  plan: { plan: 'basic', assuredRequested: false, expertCalls: null },
  home: { label: 'Flat 1204, Baner', locality: 'Baner', bhk: '2 BHK', carpetSqft: 960, tier: 'premium', fullHome: true },
  coins: { balance: 1410, streak: 6 },
  expert: { name: 'Meera' },
  unread: 3,
  locale: 'en',
};

export const SAMPLE_PROJECT: Project = {
  id: 'sample-project',
  role: 'owner',
  plan: 'basic',
  studio: 'Teakline Studio',
  startOn: at(-48),
  overallLateDays: 4,
  stageStatus: { key: 'PRODUCTION', label: 'Carpentry', status: 'on-track', lateDays: 0 },
  // The tracker as the server sends it (portal/tracker-view.ts): civil moved for a supplier, which pushed
  // handover 4 days (the studio's delay), and carpentry moved 2 days waiting on Priya's pick (hers, labelled).
  // The step tracker (a shortened list of steps): design, POP and civil done, five carpentry steps ticked.
  progressPct: 38,
  tracker: {
    progressPct: 38,
    stages: [
      { key: 'DESIGN', kind: 'DESIGN', label: 'Design sign-off', plannedStart: dayAt(-60), plannedEnd: dayAt(-48), originalEnd: dayAt(-48), actualEnd: dayAt(-50), forecastEnd: dayAt(-50), state: 'done', status: 'done', lateDays: 0, earlyDays: 2, checklist: cl(DESIGN_STEPS), moved: null, progressPct: 100, steps: ms(DESIGN_STEPS) },
      {
        key: 'SITE', kind: 'CIVIL', label: 'POP, civil and electricals', plannedStart: dayAt(-48), plannedEnd: dayAt(-20), originalEnd: dayAt(-26), actualEnd: dayAt(-20), forecastEnd: dayAt(-20), state: 'done', status: 'done', lateDays: 5, earlyDays: 0, checklist: cl(CIVIL_STEPS),
        moved: { from: dayAt(-26), to: dayAt(-20), reason: 'SUPPLIER', customer: false, words: '' },
        progressPct: 100,
        steps: ms(CIVIL_STEPS),
      },
      {
        key: 'PRODUCTION', kind: 'CARPENTRY', label: 'Carpentry', plannedStart: dayAt(-20), plannedEnd: dayAt(12), originalEnd: dayAt(10), actualEnd: null, forecastEnd: dayAt(12), state: 'now', status: 'on-track', lateDays: 0, earlyDays: 0, checklist: cl(CARPENTRY_STEPS),
        moved: { from: dayAt(10), to: dayAt(12), reason: 'CUSTOMER_CHANGE', customer: true, words: '' },
        progressPct: 19,
        steps: ms(CARPENTRY_STEPS),
      },
      { key: 'FINISH', kind: 'FINISH', label: 'Finishing', plannedStart: dayAt(12), plannedEnd: dayAt(55), originalEnd: dayAt(51), actualEnd: null, forecastEnd: dayAt(55), state: 'next', status: 'upcoming', lateDays: 0, earlyDays: 0, checklist: cl(FINISH_STEPS), moved: null, progressPct: 0, steps: ms(FINISH_STEPS) },
      { key: 'HANDOVER', kind: 'HANDOVER', label: 'Handover', plannedStart: dayAt(55), plannedEnd: dayAt(64), originalEnd: dayAt(60), actualEnd: null, forecastEnd: dayAt(64), state: 'later', status: 'upcoming', lateDays: 0, earlyDays: 0, checklist: cl(HANDOVER_STEPS), moved: null, progressPct: 0, steps: ms(HANDOVER_STEPS) },
    ],
    current: {
      key: 'PRODUCTION',
      label: 'Carpentry',
      rooms: [
        { room: 'Execution stage 2A', items: ms(CARPENTRY_STEPS).filter((s) => s.group === 'Execution stage 2A').map((s) => ({ label: s.label, done: s.done })) },
        { room: 'Execution stage 2B', items: ms(CARPENTRY_STEPS).filter((s) => s.group === 'Execution stage 2B').map((s) => ({ label: s.label, done: s.done })) },
      ],
    },
    moves: [
      { at: at(-6), stage: 'Carpentry', field: 'end', from: dayAt(10), to: dayAt(12), reason: 'CUSTOMER_CHANGE', customer: true, byDecision: true, handoverTo: null, words: '' },
      { at: at(-24), stage: 'Civil', field: 'end', from: dayAt(-26), to: dayAt(-20), reason: 'SUPPLIER', customer: false, byDecision: false, handoverTo: dayAt(64), words: '' },
    ],
    overall: { plannedHandover: dayAt(60), forecastHandover: dayAt(64), handedOver: false, lateDays: 4, earlyDays: 0, customerDays: 0, studioDays: 4 },
  },
  stages: [
    { key: 'DESIGN', label: 'Design sign-off', targetOn: at(-48), state: 'done', late: false },
    { key: 'SITE', label: 'POP, civil and electricals', targetOn: at(-20), state: 'done', late: true },
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
  /* Phase 2: the last few days come from the site log (siteLogs below); this older note is from before site mode. */
  updates: [
    {
      id: 'u3',
      note: 'Plywood for the wardrobes delivered and checked against the quote: 18 mm BWP.',
      stage: 'Carpentry',
      at: at(-3, 12),
      byStudio: true,
      photos: [photo('carcass')],
    },
  ],
  /* Phase 2: the daily site log, as the server sends it (portal/site-feed-view.ts). */
  siteLogs: [
    {
      id: 'sl1',
      day: dayAt(0),
      kind: 'update',
      postedAt: at(0, 17),
      reason: null,
      reasonText: null,
      countsAgainstStudio: null,
      text: null,
      photos: [
        { url: photo('wardrobe'), text: 'Wardrobe carcasses in both bedrooms are up, with their hardware.', takenAt: at(0, 16), fromGallery: false, doneStep: 'Carcass complete with hardware' },
        { url: photo('bedroom'), text: 'Bedroom 2 wardrobe frame is done too.', takenAt: at(0, 16), fromGallery: false, doneStep: null },
        { url: photo('living'), text: 'Living room TV unit frame marked on the wall.', takenAt: at(0, 17), fromGallery: false, doneStep: null },
      ],
      crew: [
        { name: 'Ramesh', role: 'Carpenter', arrivedAt: at(0, 9) },
        { name: 'Sunil', role: 'Helper', arrivedAt: at(0, 10) },
      ],
      done: [{ room: 'Execution stage 2A', label: 'Carcass complete with hardware' }],
      corrections: [
        {
          id: 'sl1c',
          kind: 'correction',
          postedAt: at(0, 18),
          reason: null,
          reasonText: null,
          countsAgainstStudio: null,
          text: 'The loft shutters for bedroom 1 are cut and ready to fit.',
          photos: [],
          crew: [],
          done: [],
        },
      ],
    },
    {
      id: 'sl2',
      day: dayAt(-1),
      kind: 'update',
      postedAt: at(-1, 17),
      reason: null,
      reasonText: null,
      countsAgainstStudio: null,
      text: null,
      photos: [{ url: photo('kitchen'), text: 'Kitchen hardware for the drawers and lofts is on site.', takenAt: at(-1, 16), fromGallery: false, doneStep: null }],
      crew: [{ name: 'Ramesh', role: 'Carpenter', arrivedAt: at(-1, 9) }],
      done: [],

      corrections: [],
    },
    {
      id: 'sl3',
      day: dayAt(-2),
      kind: 'nobody',
      postedAt: at(-2, 9),
      reason: 'waiting-material',
      reasonText: 'Waiting for material',
      countsAgainstStudio: true,
      text: null,
      photos: [],
      crew: [],
      done: [],
      corrections: [],
    },
  ],
  siteMissedDays: [],
  // Studio OS Phase 2: design is done and closed, so the card shows what changed against the first quotation.
  design: {
    designer: 'Meera',
    pct: 100,
    done: true,
    closedOn: dayAt(-50),
    steps: [
      // Only the starred design steps (the milestones) cross to the customer.
      { label: 'Site visit and measurement', done: true, doneOn: dayAt(-58), plannedOn: dayAt(-58), yours: false, waitingFor: null, moved: null },
      { label: 'First 3D and renders', done: true, doneOn: dayAt(-52), plannedOn: dayAt(-52), yours: false, waitingFor: null, moved: 'Moved to a day that suits you.' },
      { label: 'Design closure', done: true, doneOn: dayAt(-50), plannedOn: dayAt(-50), yours: false, waitingFor: null, moved: null },
    ],
    next: null,
    waitingFor: null,
    yourStep: null,
    moodBoard: { shared: true, sharedOn: dayAt(-57), note: 'Pick two looks you like for the living room.' },
    visits: [{ at: at(-58, 11), purpose: 'Measurement', status: 'done' }],
    measurements: [
      { room: 'Living', size: "15' × 12'", height: `9' 6"` },
      { room: 'Kitchen', size: "10' × 8'", height: null },
    ],
    drawings: [
      { id: 'sample-dr1', kind: 'LAYOUT_2D', kindLabel: '2D layout', room: 'Living', title: '2D layout, Living', version: 2, state: 'approved', answeredOn: dayAt(-55), comment: null },
      { id: 'sample-dr2', kind: 'RENDER_3D', kindLabel: '3D render', room: 'Kitchen', title: '3D render, Kitchen', version: 1, state: 'approved', answeredOn: dayAt(-52), comment: null },
    ],
    changes: {
      salesTotalPaise: 18_40_000_00,
      designTotalPaise: 18_72_500_00,
      lines: [
        { kind: 'ADDED', room: 'Living', product: 'TV unit with back panel', wasPaise: 0, nowPaise: 42_500_00 },
        { kind: 'REMOVED', room: 'Kitchen', product: 'Loft shutters', wasPaise: 10_000_00, nowPaise: 0 },
      ],
    },
  },
  // The project lifecycle: on site, carpentry under way, and the sample customer has a decision to make.
  lifecycle: {
    phase: 'execution',
    current: { kind: 'stage', label: 'Carpentry' },
    next: { kind: 'stage', label: 'Finishing' },
    blocker: { kind: 'decide', label: 'Kitchen shutter finish', amountPaise: null, count: null },
    studioDoing: 'site',
    openSnags: 1,
    warrantyEndsOn: null,
    canSignOff: false,
  },
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
      votes: [
        { name: 'Rahul', optionIndex: 0, note: null, mine: false },
        { name: 'Aai', optionIndex: 1, note: 'Walnut will not show turmeric stains.', mine: false },
      ],
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
      progress: { state: 'accepted', fixBy: at(2), fixedAt: null, fixSentence: null, studioReason: null, notFixedReason: null, closedAt: null, closedBy: null, autoClosesOn: null, daysToFix: null, canAnswer: false },
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
      progress: { state: 'raised', fixBy: null, fixedAt: null, fixSentence: null, studioReason: null, notFixedReason: null, closedAt: null, closedBy: null, autoClosesOn: null, daysToFix: null, canAnswer: false },
    },
    // Phase 4: a fix waiting for Priya — before and after side by side, Confirm / Not fixed.
    {
      id: 's4',
      title: 'Shutter rubbing at the top',
      room: 'Kitchen',
      note: null,
      status: 'FIXED',
      line: null,
      raisedAt: at(-5),
      raisedByStudio: false,
      photos: [photo('kitchen')],
      fixedNote: 'Hinge adjusted; the shutter closes without touching.',
      fixedPhotos: [photo('kitchen')],
      progress: { state: 'fixed', fixBy: at(-2), fixedAt: at(-1), fixSentence: 'Hinge adjusted; the shutter closes without touching.', studioReason: null, notFixedReason: null, closedAt: null, closedBy: null, autoClosesOn: at(6), daysToFix: null, canAnswer: true },
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
      progress: { state: 'closed', fixBy: at(-7), fixedAt: at(-7), fixSentence: 'Moved 4 cm left and re-plastered.', studioReason: null, notFixedReason: null, closedAt: at(-6), closedBy: 'you', autoClosesOn: null, daysToFix: 2, canAnswer: false },
    },
  ],
  documents: [
    { id: 'doc1', kind: 'AGREEMENT', title: 'Agreement with Teakline Studio', meta: 'Signed, PDF', url: 'https://oneinteriors.in/privacy' },
    { id: 'doc2', kind: 'QUOTATION', title: 'Final quote, ₹18,40,000', meta: '40 lines, PDF', url: 'https://oneinteriors.in/privacy' },
    { id: 'doc3', kind: 'DRAWINGS', title: 'Design drawings', meta: '12 sheets', url: 'https://oneinteriors.in/privacy' },
    { id: 'doc4', kind: 'RECEIPT', title: 'Receipt, ₹7,36,000', meta: 'At signing', url: 'https://oneinteriors.in/privacy' },
  ],
};

/*
 * Phase 5 (studio workspace): the decision's options as rows (one takes money
 * off), the money from the studio's payment entries (the booking recorded
 * before confirmations started, and today's entry waiting for Priya's yes),
 * and what the home is made of, as the server sends them
 * (portal/money-locker-view.ts).
 */
Object.assign(SAMPLE_PROJECT.decisions[0]!, {
  pickedOptionId: null,
  choices: [
    { id: 'o1', label: 'Sage matte', detail: 'In your quote', photo: null, swatch: '#9AA58C', deltaPaise: 0 },
    { id: 'o2', label: 'Walnut grain', detail: 'Warmer, hides marks', photo: null, swatch: '#6B4A33', deltaPaise: 14_500_00 },
    { id: 'o3', label: 'Plain white laminate', detail: 'Simpler, a little cheaper', photo: null, swatch: '#F4F2EC', deltaPaise: -3_200_00 },
  ],
});
SAMPLE_PROJECT.payments = {
  signedPaise: L(18.4),
  changesPaise: 0,
  totalPaise: L(18.4),
  paidPaise: L(7.36),
  waitingPaise: L(2),
  balancePaise: L(11.04),
  stages: [
    { index: 0, label: 'At signing', amountPaise: L(7.36), changesPaise: 0, paidPaise: L(7.36), waitingPaise: 0, state: 'paid', dueOn: dayAt(-48) },
    { index: 1, label: 'When finishing starts', amountPaise: L(7.36), changesPaise: 0, paidPaise: 0, waitingPaise: L(2), state: 'part', dueOn: dayAt(21) },
    { index: 2, label: 'At handover, after snags close', amountPaise: L(3.68), changesPaise: 0, paidPaise: 0, waitingPaise: 0, state: 'later', dueOn: null },
  ],
  entries: [
    { id: 'pay2', stageIndex: 1, stage: 'When finishing starts', amountPaise: L(2), receivedOn: dayAt(0), mode: 'UPI', status: 'waiting', receiptDocumentId: null, canAnswer: true },
    { id: 'pay1', stageIndex: 0, stage: 'At signing', amountPaise: L(7.36), receivedOn: dayAt(-48), mode: null, status: 'earlier', receiptDocumentId: 'doc4', canAnswer: true },
  ],
};
SAMPLE_PROJECT.materials = [
  { id: 'm1', room: 'Kitchen', item: 'Shutters', spec: 'Sage matte laminate, 1 mm', productCode: null, ordered: false },
  { id: 'm2', room: 'Kitchen', item: 'Hinges', spec: 'Soft-close, full overlay', productCode: 'HET-SC-110', ordered: true },
  { id: 'm3', room: 'Master bedroom', item: 'Wardrobe carcass', spec: '18 mm BWP plywood', productCode: 'CENT-BWP-18', ordered: true },
];

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

/* Asking for a person, or about money, hands over to the expert (GeioHuman, #33). */
const SAMPLE_HANDOVER: GeioReply = {
  paragraphs: ['That is one for Meera, your expert. She has your quote and site record in front of her.'],
  see: [],
  handover: 'Priya wants to talk about the kitchen shutter finish and whether Walnut grain (+₹14,500) is worth it.',
  follow: [],
  sources: [],
};

let read = new Set<string>();

/** Answers a call as the server would, for the sample customer. */
export async function sampleCall<T>(method: string, path: string, body?: unknown): Promise<Result<T>> {
  await new Promise((r) => setTimeout(r, 250));
  const ok = (data: unknown) => ({ ok: true, data: data as T }) as const;
  const route = `${method} ${path.split('?')[0]}`;
  // The first visit's answers (matches, quotes, expert, choose and sign), one file per area.
  const journey = SAMPLE_JOURNEY.find((h) => h.match(route));
  if (journey) return ok(journey.answer(route, body));
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
  if (route === 'POST /plan') {
    SAMPLE_PROFILE.plan = { plan: 'assured', assuredRequested: true, expertCalls: { used: 1, total: 5 } };
    SAMPLE_PROJECT.plan = 'assured';
    return ok({ assuredRequested: true });
  }
  if (route === 'POST /geio') {
    if (SAMPLE_PROFILE.plan?.plan !== 'assured') return { ok: false, status: 403, error: 'plan' } as Result<T>;
    const q = String((body as { question?: string } | undefined)?.question ?? '').toLowerCase();
    return ok({ reply: /talk|meera|price|pay|discount/.test(q) ? SAMPLE_HANDOVER : SAMPLE_REPLY });
  }
  if (route === 'POST /coins/opened') return ok({ earned: 10 });
  if (route === 'POST /snags') return ok({ id: `s${Date.now()}` });
  // Phase 5: a pick changes the last payment and the locker; a payment is confirmed or disputed.
  const pickRoute = /^POST \/decisions\/([^/]+)$/.exec(route);
  if (pickRoute) {
    samplePick(decodeURIComponent(pickRoute[1]!), (body as { optionId?: string } | undefined)?.optionId);
    return ok({ message: null });
  }
  const payRoute = /^POST \/payments\/([^/]+)\/(confirm|dispute)$/.exec(route);
  if (payRoute) {
    sampleAnswer(decodeURIComponent(payRoute[1]!), payRoute[2] === 'confirm');
    return ok({});
  }
  // Phase 4: the customer's answer to a fix, remembered for the session.
  const answer = /^POST \/snags\/([^/]+)\/(confirm|not-fixed)$/.exec(route);
  if (answer) {
    const snag = SAMPLE_PROJECT.snags.find((x) => x.id === decodeURIComponent(answer[1]!));
    if (!snag?.progress?.canAnswer) return { ok: false, status: 400, error: 'There is no fix to answer yet.' } as Result<T>;
    snag.progress =
      answer[2] === 'confirm'
        ? { ...snag.progress, state: 'closed', closedBy: 'you', closedAt: new Date().toISOString(), autoClosesOn: null, canAnswer: false, daysToFix: 4 }
        : { ...snag.progress, state: 'reopened', notFixedReason: String((body as { reason?: string } | undefined)?.reason ?? '') || null, fixedAt: null, autoClosesOn: null, canAnswer: false };
    snag.status = answer[2] === 'confirm' ? 'FIXED' : 'OPEN';
    return ok({ id: snag.id });
  }
  // Choosing, locale, devices, sign-out, delete: accepted and forgotten.
  return ok({});
}

/** Phase 5, sample only: what the server does on a pick, in the sample project. */
function samplePick(decisionId: string, optionId: string | undefined) {
  const d = SAMPLE_PROJECT.decisions.find((x) => x.id === decisionId);
  const i = d?.choices?.findIndex((c) => c.id === optionId) ?? -1;
  if (!d || !d.choices || i < 0) return;
  const choice = d.choices[i]!;
  Object.assign(d, { pickedOptionId: optionId, chosenIndex: i, chosenAt: new Date().toISOString(), state: 'chosen' });
  const pay = SAMPLE_PROJECT.payments;
  if (pay) {
    const last = pay.stages[pay.stages.length - 1]!;
    const move = choice.deltaPaise - last.changesPaise;
    last.changesPaise = choice.deltaPaise;
    last.amountPaise += move;
    pay.changesPaise = choice.deltaPaise;
    pay.totalPaise += move;
    pay.balancePaise += move;
  }
  SAMPLE_PROJECT.changes = {
    totalPaise: choice.deltaPaise,
    items: [{ decisionId: d.id, title: d.title, option: choice.label, extraPaise: choice.deltaPaise, chosenAt: new Date().toISOString() }],
  };
  const m = SAMPLE_PROJECT.materials?.find((x) => x.id === 'm1');
  if (m) m.spec = choice.label;
}

/** Phase 5, sample only: "Yes, I paid" or "I didn't pay this". */
function sampleAnswer(paymentId: string, confirm: boolean) {
  const pay = SAMPLE_PROJECT.payments;
  const e = pay?.entries.find((x) => x.id === paymentId);
  if (!pay || !e) return;
  const counted = e.status === 'earlier';
  const st = pay.stages[e.stageIndex];
  e.status = confirm ? 'confirmed' : 'disputed';
  e.canAnswer = false;
  if (confirm && !counted) {
    pay.paidPaise += e.amountPaise;
    pay.waitingPaise -= e.amountPaise;
    pay.balancePaise -= e.amountPaise;
    if (st) {
      st.paidPaise += e.amountPaise;
      st.waitingPaise -= e.amountPaise;
    }
  }
  if (!confirm && st) {
    if (counted) {
      pay.paidPaise -= e.amountPaise;
      pay.balancePaise += e.amountPaise;
      st.paidPaise -= e.amountPaise;
    } else {
      pay.waitingPaise -= e.amountPaise;
      st.waitingPaise -= e.amountPaise;
    }
  }
}
