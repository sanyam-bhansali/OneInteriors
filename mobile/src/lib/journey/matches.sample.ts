import { Asset } from 'expo-asset';
import type { Brief } from '../brief-types';
import type { StudioProfile } from './matches';
import type { SampleHandler } from './sample';
import type { ApiMatch, ApiQuote, MatchesView, StudioCard } from './types';

/**
 * The sample customer's matches, all studios and studio profiles
 * (docs/app-handover/SAMPLE-DATA.md; the other tiers and studios from
 * designs/Matches.dc.html and Studios.dc.html). Ten studios, the number
 * lib/claims.ts lets the app claim. Like the server, the bands are empty and
 * nothing is scored until the brief is finished. Every name and figure is a
 * placeholder: only a test build (EXPO_PUBLIC_SAMPLE=1) reads this.
 */

type Tier = 'essential' | 'premium' | 'luxury';

const PHOTOS = {
  living: require('../../../assets/sample/living.webp'),
  kitchen: require('../../../assets/sample/kitchen.webp'),
  bedroom: require('../../../assets/sample/bedroom-1.webp'),
  wardrobe: require('../../../assets/sample/wardrobe-top.webp'),
  carcass: require('../../../assets/sample/kitchen-carcass.webp'),
} as const;
type Photo = keyof typeof PHOTOS;
const uri = (name: Photo) => Asset.fromModule(PHOTOS[name]).uri;

interface Row {
  slug: string;
  name: string;
  area: string;
  since: number;
  team: number;
  band: Tier;
  localities: string[];
  /** Average days past the committed date; null when there is not enough record. */
  lateDays: number | null;
  homes: number;
  passed: number;
  score: number;
  photo: Photo;
  /** Their other two photos, for Past homes. */
  more: [Photo, Photo];
  about: string;
  reasons: string[];
  /** Their first quote for the sample flat, in lakh, with GST (matched studios only). */
  quoteLakh?: number;
}

const ROWS: Row[] = [
  {
    slug: 'teakline-studio',
    name: 'Teakline Studio',
    area: 'Baner',
    since: 2014,
    team: 11,
    band: 'premium',
    localities: ['baner', 'balewadi', 'aundh'],
    lateDays: 4,
    homes: 48,
    passed: 15,
    score: 92,
    photo: 'living',
    more: ['kitchen', 'wardrobe'],
    about: 'Warm modern homes, mostly in Baner and Balewadi. Their own carpentry unit is in Hinjewadi.',
    reasons: [
      'You picked warm modern and Scandinavian. 7 of their last 10 homes look like that.',
      'Finishing on time is your first priority. They have the best delivery record of the three.',
      'A parent lives with you. They have built 6 elderly-friendly homes.',
    ],
    quoteLakh: 18.4,
  },
  {
    slug: 'atelier-rao',
    name: 'Atelier Rao',
    area: 'Aundh',
    since: 2009,
    team: 16,
    band: 'luxury',
    localities: ['aundh', 'baner', 'pashan'],
    lateDays: 5,
    homes: 31,
    passed: 15,
    score: 89,
    photo: 'bedroom',
    more: ['living', 'wardrobe'],
    about: 'Custom joinery, made to drawings. Solid wood and veneer, finished by hand.',
    reasons: ['Every piece drawn for your flat, in solid wood and veneer.', 'They have done 4 homes with parents living in.'],
    quoteLakh: 31.2,
  },
  {
    slug: 'chitra-co',
    name: 'Chitra & Co.',
    area: 'Wakad',
    since: 2012,
    team: 14,
    band: 'premium',
    localities: ['wakad', 'hinjewadi', 'pimple-saudagar'],
    lateDays: 2,
    homes: 37,
    passed: 15,
    score: 87,
    photo: 'kitchen',
    more: ['carcass', 'bedroom'],
    about: 'An in-house carpentry workshop in Wakad, so every shutter is made and checked under one roof.',
    reasons: ['Their own workshop in Wakad makes your wardrobes and kitchen, and you can visit it.'],
    quoteLakh: 19.6,
  },
  {
    slug: 'studio-kaavya',
    name: 'Studio Kaavya',
    area: 'Koregaon Park',
    since: 2011,
    team: 12,
    band: 'luxury',
    localities: ['koregaon-park', 'kalyani-nagar', 'viman-nagar'],
    lateDays: 2,
    homes: 26,
    passed: 15,
    score: 85,
    photo: 'living',
    more: ['bedroom', 'kitchen'],
    about: 'Indian classic with a modern eye. Brass, cane and teak in quiet rooms.',
    reasons: ['Warm woods and soft light, close to your warm modern picks.'],
    quoteLakh: 33.4,
  },
  {
    slug: 'oakline-interiors',
    name: 'Oakline Interiors',
    area: 'Wakad',
    since: 2016,
    team: 9,
    band: 'essential',
    localities: ['wakad', 'tathawade', 'punawale'],
    lateDays: 3,
    homes: 22,
    passed: 15,
    score: 84,
    photo: 'carcass',
    more: ['kitchen', 'wardrobe'],
    about: 'Practical builds that last. Kitchens, wardrobes and storage done well.',
    reasons: ['Warm modern is half of their recent work.', 'They hand over in 10 weeks on average.'],
    quoteLakh: 11.8,
  },
  {
    slug: 'nest-co',
    name: 'Nest & Co.',
    area: 'Balewadi',
    since: 2017,
    team: 7,
    band: 'essential',
    localities: ['balewadi', 'baner'],
    lateDays: 0,
    homes: 19,
    passed: 15,
    score: 81,
    photo: 'wardrobe',
    more: ['kitchen', 'carcass'],
    about: 'Kitchens and wardrobes first, then the rest of the home.',
    reasons: ['Kitchens and wardrobes are most of your quote, and most of their work.'],
    quoteLakh: 11.2,
  },
  {
    slug: 'maya-workshop',
    name: 'Maya Workshop',
    area: 'Baner',
    since: 2023,
    team: 5,
    band: 'premium',
    localities: ['baner', 'sus'],
    lateDays: null,
    homes: 2,
    passed: 14,
    score: 80,
    photo: 'bedroom',
    more: ['wardrobe', 'living'],
    about: 'A newer, material-led studio. They show you every board and finish before it is ordered.',
    reasons: ['They show you every board and finish before it is ordered, which suits a material-quality priority.'],
    quoteLakh: 16.9,
  },
  {
    slug: 'form-grain',
    name: 'Form & Grain',
    area: 'Kalyani Nagar',
    since: 2013,
    team: 13,
    band: 'luxury',
    localities: ['kalyani-nagar', 'koregaon-park'],
    lateDays: 6,
    homes: 28,
    passed: 15,
    score: 79,
    photo: 'living',
    more: ['bedroom', 'kitchen'],
    about: 'Quiet luxury in stone and oak.',
    reasons: ['Oak and pale stone, a calm take on Scandinavian.'],
    quoteLakh: 28.6,
  },
  {
    slug: 'linea-interiors',
    name: 'Linea Interiors',
    area: 'Hinjewadi',
    since: 2015,
    team: 8,
    band: 'premium',
    localities: ['hinjewadi', 'wakad'],
    lateDays: 0,
    homes: 24,
    passed: 15,
    score: 78,
    photo: 'kitchen',
    more: ['living', 'wardrobe'],
    about: 'Minimal, light rooms with hidden storage.',
    reasons: ['Light, minimal rooms; Scandinavian is 40% of your picks.'],
  },
  {
    slug: 'habitat-works',
    name: 'Habitat Works',
    area: 'Ravet',
    since: 2022,
    team: 6,
    band: 'essential',
    localities: ['ravet', 'punawale'],
    lateDays: null,
    homes: 1,
    passed: 14,
    score: 76,
    photo: 'wardrobe',
    more: ['carcass', 'bedroom'],
    about: 'A young team, newer studio, with time for every job.',
    reasons: ['A young team with time for a smaller job.'],
    quoteLakh: 12.1,
  },
];

const TIER_ORDER: Record<Tier, string[]> = {
  essential: ['oakline-interiors', 'nest-co', 'habitat-works'],
  premium: ['teakline-studio', 'chitra-co', 'maya-workshop'],
  luxury: ['atelier-rao', 'studio-kaavya', 'form-grain'],
};

/** journey.ts lateness(), as the server words it. */
function lateness(r: Row): string | null {
  if (r.lateDays === null || r.homes === 0) return null;
  if (r.lateDays <= 0) return 'Usually on time';
  return `Usually ${r.lateDays} day${r.lateDays === 1 ? '' : 's'} late`;
}

function card(r: Row, scored: boolean): StudioCard {
  return {
    slug: r.slug,
    name: r.name,
    area: r.area,
    since: r.since,
    team: r.team,
    score: scored ? r.score : null,
    reasons: scored ? r.reasons : [],
    photo: uri(r.photo),
    rating: null,
    homes: r.homes,
    checks: { passed: r.passed, total: 15 },
    lateness: lateness(r),
    band: r.band,
    localities: r.localities,
  };
}

/** What each tier's studios fit, room by room, for the sample 2 BHK of 960 sq ft. */
const SPEC: Record<Tier, { board: string; shutter: string; top: string; ceiling: string }> = {
  essential: { board: '18 mm BWR ply', shutter: 'matte laminate', top: 'granite', ceiling: 'gypsum, plain' },
  premium: { board: '18 mm BWP ply', shutter: 'sage matte laminate', top: 'quartz', ceiling: 'gypsum with cove lights' },
  luxury: { board: '18 mm BWP ply, oak veneer', shutter: 'veneer with PU polish', top: 'Italian marble', ceiling: 'gypsum with cove and profile lights' },
};

/** The quote's lines and their share of the before-GST figure; they always sum to it. */
function quote(r: Row, tier: Tier): ApiQuote {
  const s = SPEC[tier];
  const totalPaise = Math.round((r.quoteLakh ?? 15) * 100_000) * 100;
  const beforeGstPaise = Math.round(totalPaise / 1.18);
  const gstPaise = totalPaise - beforeGstPaise;
  const lines: [string, string, string | null, string, number][] = [
    ['Kitchen', 'Modular kitchen, base and wall units', `${s.board}, ${s.shutter}`, '10 ft + 8 ft', 0.22],
    ['Kitchen', 'Countertop', s.top, '18 ft run', 0.05],
    ['Master bedroom', 'Sliding wardrobe', `${s.board}, ${s.shutter}`, '7 × 8 ft', 0.12],
    ['Master bedroom', 'Bed with storage', s.board, 'Queen, 5 × 6.5 ft', 0.07],
    ['Second bedroom', 'Hinged wardrobe', `${s.board}, ${s.shutter}`, '6 × 7 ft', 0.09],
    ['Second bedroom', 'Study table and shelves', s.board, '4 ft', 0.04],
    ['Living & dining', 'TV unit with back panel', s.shutter, '9 ft', 0.07],
    ['Living & dining', 'Shoe and crockery units', s.board, '4 ft + 5 ft', 0.05],
    ['Whole home', 'False ceiling', s.ceiling, '960 sq ft', 0.1],
    ['Whole home', 'Painting, putty and two coats', 'Washable emulsion', '960 sq ft', 0.08],
    ['Whole home', 'Electrical points and lights', null, '38 points', 0.06],
    ['Bathrooms', 'Vanity units and mirrors', s.board, '2 bathrooms', 0.05],
  ];
  let left = beforeGstPaise;
  const priced = lines.map(([room, item, spec, size, share], i) => {
    // Rounded to ₹100, the last line takes what is left so the sum is exact.
    const amountPaise = i === lines.length - 1 ? left : Math.round((beforeGstPaise * share) / 10_000) * 10_000;
    left -= amountPaise;
    return { room, item, spec, size, amountPaise };
  });
  const band = (f: number) => Math.round((totalPaise * f) / 1_000_000) * 1_000_000;
  const validTill = new Date(Date.now() + 28 * 86_400_000).toISOString();
  return { totalPaise, beforeGstPaise, gstPaise, lowPaise: band(0.95), highPaise: band(1.05), validTill, lines: priced };
}

const bySlug = (slug: string) => ROWS.find((r) => r.slug === slug)!;
const finished = (body: unknown) => Boolean((body as { brief?: Brief } | undefined)?.brief?.completedAt);
const ownTier = (body: unknown): Tier => {
  const t = (body as { brief?: Brief } | undefined)?.brief?.tier;
  return t ? (t.toLowerCase() as Tier) : 'premium';
};

function matches(body: unknown): MatchesView & { ok: true; ratesReal: boolean } {
  const done = finished(body);
  const tier = (t: Tier): ApiMatch[] =>
    done ? TIER_ORDER[t].map((slug) => ({ ...card(bySlug(slug), true), score: bySlug(slug).score, quote: quote(bySlug(slug), t) })) : [];
  return {
    ok: true,
    studioCount: ROWS.length,
    tiers: { essential: tier('essential'), premium: tier('premium'), luxury: tier('luxury') },
    tier: ownTier(body),
    style: {
      primary: { tag: 'warm-modern', label: 'Warm Modern', pct: 60 },
      secondary: { tag: 'scandinavian', label: 'Scandinavian', pct: 40 },
    },
    ratesReal: true,
  };
}

const CHECKS: [string, string][] = [
  ['PAN name match', 'Income tax portal'],
  ['Identity of the principal', 'DigiLocker'],
  ['Business address visited', 'Our team, in person'],
  ['Phone and email reachable', 'Our team'],
  ['Code of conduct signed', 'Signed copy on file'],
  ['GST registration active', 'GST public register'],
  ['12 months of GST filings', 'GST public register'],
  ['Company filings current', 'Ministry of Corporate Affairs'],
  ['Udyam / MSME registration', 'Udyam portal'],
  ['Past clients contacted', 'Our team, by phone'],
  ['Completed sites inspected', 'Our team, in person'],
  ['Litigation and consumer forum search', 'eCourts and consumer forums'],
  ['Rate card filed and locked', 'Filed with One Interiors'],
  ['Workmanship warranty on paper', 'Signed copy on file'],
  ['Labour insurance and site safety', 'Policy on file'],
];

const CAPTIONS = ['3 BHK, Balewadi', '2 BHK, Baner', 'Kitchen and wardrobes, Aundh'];

function profile(slug: string): StudioProfile | null {
  const r = ROWS.find((x) => x.slug === slug);
  if (!r) return null;
  const checkedAt = '2026-09-02T10:00:00.000Z';
  const delivery =
    r.lateDays === null
      ? `${r.homes} project${r.homes === 1 ? '' : 's'} completed with us — not yet enough to state a reliable average.`
      : r.lateDays <= 0
        ? `${r.homes} projects completed on or ahead of the committed date.`
        : `${r.homes} projects completed, averaging ${r.lateDays} days past the committed date.`;
  return {
    slug: r.slug,
    name: r.name,
    area: r.area,
    since: r.since,
    team: r.team,
    photo: uri(r.photo),
    about: r.about,
    verified: true,
    portfolio: [r.photo, ...r.more].map((p, i) => ({ photo: uri(p), caption: CAPTIONS[i], isRender: false })),
    // A newer studio has not had a finished home inspected yet.
    checks: CHECKS.map(([label, source]) => {
      const passed = r.passed === 15 || label !== 'Completed sites inspected';
      return { label, passed, source: passed ? source : null, checkedAt: passed ? checkedAt : null };
    }),
    delivery: { completed: r.homes, avgLateDays: r.lateDays, line: delivery },
    reviews: [],
  };
}

export const MATCHES_SAMPLES: SampleHandler[] = [
  { match: (route) => route === 'POST /journey/matches', answer: (_route, body) => matches(body) },
  {
    match: (route) => route === 'POST /journey/studios',
    answer: (_route, body) => ({
      ok: true,
      studios: [...ROWS].sort((a, b) => b.score - a.score).map((r) => card(r, finished(body))),
    }),
  },
  {
    match: (route) => route.startsWith('GET /studios/'),
    answer: (route) => {
      const studio = profile(decodeURIComponent(route.slice('GET /studios/'.length)));
      return studio ? { ok: true, studio } : { ok: false, studio: null };
    },
  },
];
