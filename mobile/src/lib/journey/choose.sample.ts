import type { ApiChooseView, ApiChooseVisit, FinalQuoteView } from './choose';
import type { SampleHandler } from './sample';

/**
 * Choose & sign for the sample customer (docs/app-handover/SAMPLE-DATA.md):
 * Teakline's studio visit and measurement are done and its final quote is
 * in, ₹18,40,000 for 40 lines, the same as the first quote; Chitra & Co.
 * has proposed a workshop visit to confirm. Answering the visit changes it
 * for the rest of the session, as the server would.
 */

const DAY = 86_400_000;
const at = (days: number, hour: number) => {
  const d = new Date(Date.now() + days * DAY);
  d.setHours(hour, 0, 0, 0);
  return d.toISOString();
};
const R = (rupees: number) => rupees * 100;

const TEAKLINE_VISITS: ApiChooseVisit[] = [
  {
    id: 'v-teak-1',
    at: at(-6, 11),
    kind: 'first_meeting',
    state: 'completed',
    location: 'Baner office',
  },
  {
    id: 'v-teak-2',
    at: at(-3, 10),
    kind: 'site_visit',
    state: 'completed',
    location: 'Flat 1204',
  },
];
let chitra: ApiChooseVisit | null = {
  id: 'v-chitra-1',
  at: at(2, 16),
  kind: 'first_meeting',
  state: 'proposed',
  location: 'Wakad workshop',
};

/* 40 lines across the rooms; the work adds up to ₹16,79,000; with the fee and a ₹40,000 discount, ₹18,40,000. */
const ROOMS: [string, [string, string | null, number][]][] = [
  [
    'Kitchen',
    [
      ['Base cabinets', 'BWP ply, Sage matte laminate', 152_000],
      ['Wall cabinets', 'BWP ply, Sage matte laminate', 88_000],
      ['Tall unit', 'Pantry pull-out', 46_000],
      ['Kitchen loft', '3 shutters', 26_000],
      ['Quartz counter', '20 mm, 14 ft run', 64_000],
      ['Backsplash tiles', 'Matte ceramic', 22_000],
      ['Hardware', 'Soft-close hinges and channels', 38_000],
      ['Sink and tap', 'Single bowl, pull-out tap', 24_000],
    ],
  ],
  [
    'Living room',
    [
      ['TV unit', 'Walnut veneer, fluted panel', 78_000],
      ['False ceiling', 'Gypsum, 160 sq ft, cove light', 52_000],
      ['Wall panelling', 'Fluted MDF, painted', 48_000],
      ['Shoe cabinet', 'Ventilated shutters', 32_000],
      ['Lights', '6 downlights, 1 profile light', 26_000],
      ['Curtain pelmet', 'With track', 14_000],
      ['Wall paint', 'Premium emulsion', 18_000],
    ],
  ],
  [
    'Master bedroom',
    [
      ['Wardrobe', '8 ft, sliding, BWP ply', 148_000],
      ['Bed with storage', 'Queen, hydraulic', 72_000],
      ['Side tables', 'Pair, one drawer each', 22_000],
      ['Dresser', 'With mirror', 34_000],
      ['False ceiling', 'Gypsum, 140 sq ft', 38_000],
      ['Headboard panel', 'Upholstered', 30_000],
      ['Wall paint', 'Premium emulsion', 14_000],
    ],
  ],
  [
    'Bedroom 2',
    [
      ['Wardrobe', '7 ft 6 in, hinged, BWP ply', 118_500],
      ['Study desk', 'With overhead shelf', 36_000],
      ['Bed with storage', 'Queen, box storage', 58_000],
      ['Side table', 'One drawer', 11_000],
      ['False ceiling', 'Gypsum, 120 sq ft', 32_000],
      ['Wall paint', 'Premium emulsion', 12_000],
    ],
  ],
  [
    'Dining and foyer',
    [
      ['Crockery unit', 'Glass shutters, lit', 58_000],
      ['Foyer console', 'With mirror', 26_000],
      ['Dining pendant', 'Fitting only', 6_000],
      ['Wall paint', 'Premium emulsion', 10_000],
    ],
  ],
  [
    'Bathrooms',
    [
      ['Vanity units', 'Two, wall-hung', 42_000],
      ['Mirror cabinets', 'Two, lit', 26_000],
      ['Shower partitions', 'Two, toughened glass', 38_000],
    ],
  ],
  [
    'Whole flat',
    [
      ['Electrical points', 'New and shifted points', 48_000],
      ['Door laminates', '6 doors', 30_000],
      ['Deep cleaning', 'Before handover', 8_000],
      ['Site protection', 'Floor and window cover', 9_500],
      ['Debris removal', 'Through the project', 24_000],
    ],
  ],
];

const rooms: FinalQuoteView['rooms'] = ROOMS.map(([room, lines]) => ({
  room,
  amountPaise: R(lines.reduce((s, l) => s + l[2], 0)),
  lines: lines.map(([product, details, rupees]) => ({
    product,
    details,
    amountPaise: R(rupees),
  })),
}));
const work = rooms.reduce((s, r) => s + r.amountPaise, 0);
const FEE = R(2_01_000);
const DISCOUNT = work + FEE - R(18_40_000);
const TOTAL = R(18_40_000);

const QUOTE: FinalQuoteView = {
  id: 'fq-teakline',
  studioName: 'Teakline Studio',
  studioSlug: 'teakline-studio',
  number: 'TS-2026-118',
  issuedOn: at(-1, 18),
  accepted: false,
  rooms,
  lineCount: rooms.reduce((s, r) => s + r.lines.length, 0),
  workPaise: work,
  feePaise: FEE,
  discountPaise: DISCOUNT,
  onSpotPaise: 0,
  onSpotLabel: null,
  beforeTaxPaise: TOTAL,
  gstPaise: 0,
  totalPaise: TOTAL,
  terms:
    'Prices hold for 30 days from the quote. Materials are as named on each line; any change is agreed in writing before work on it starts. Carpentry carries a 10-year warranty, hardware and fittings 1 year. Payments are made to Teakline Studio at each stage.',
  handoverDays: 75,
  stages: [
    { label: 'At signing', pct: 40, amountPaise: R(7_36_000) },
    { label: 'When finishing starts', pct: 40, amountPaise: R(7_36_000) },
    {
      label: 'At handover, after snags close',
      pct: 20,
      amountPaise: R(3_68_000),
    },
  ],
  firstBeforeGstPaise: TOTAL,
};

function view(): { view: ApiChooseView } {
  return {
    view: {
      studios: [
        {
          introId: 'i-teakline',
          slug: 'teakline-studio',
          name: 'Teakline Studio',
          visit: TEAKLINE_VISITS[1],
          visits: TEAKLINE_VISITS,
          finalQuoteId: QUOTE.id,
          finalQuote: {
            id: QUOTE.id,
            totalPaise: QUOTE.beforeTaxPaise,
            issuedOn: QUOTE.issuedOn,
            accepted: false,
          },
        },
        {
          introId: 'i-chitra',
          slug: 'chitra-and-co',
          name: 'Chitra & Co.',
          visit: chitra,
          visits: chitra ? [chitra] : [],
          finalQuoteId: null,
          finalQuote: null,
        },
      ],
      expertNote: null,
      call: { scheduledFor: at(-8, 11), status: 'completed' },
      signedWith: null,
    },
  };
}

export const CHOOSE_SAMPLES: SampleHandler[] = [
  { match: (r) => r === 'GET /choose', answer: () => view() },
  {
    match: (r) => r.startsWith('POST /choose/visits/'),
    answer: (_r, body) => {
      const answer = (body as { answer?: string } | undefined)?.answer;
      if (chitra) chitra = answer === 'confirm' ? { ...chitra, state: 'confirmed' } : null;
      return {};
    },
  },
  {
    match: (r) => r.startsWith('GET /choose/quote/'),
    answer: () => ({ quote: QUOTE }),
  },
  {
    match: (r) => /^POST \/choose\/sign\/[^/]+\/code$/.test(r),
    answer: () => ({ devCode: '123456' }),
  },
  {
    match: (r) => /^POST \/choose\/sign\/[^/]+$/.test(r),
    answer: (_r, body) => ({
      projectId: 'sample-project',
      plan: 'basic',
      assuredRequested: (body as { plan?: string } | undefined)?.plan === 'assured',
    }),
  },
];
