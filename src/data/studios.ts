/**
 * FIXTURE DATA — placeholder studios for v0.1.
 *
 * ⚠️  Every studio here is invented. None of these are real businesses, and no
 *     GSTIN below is a real registration. This exists so the matching engine,
 *     marketplace and profile pages can be built and reviewed before the first
 *     real cohort is onboarded.
 *
 * Replace wholesale in Sprint 3 with the 6–8 real pilot studios. The shape is
 * the contract — `Studio` in src/modules/studio/types.ts.
 *
 * Note how the fixtures deliberately include studios with NO delivery record
 * (completedProjects: 0). That is the real day-one state and the UI has to
 * handle it honestly, so it must be representable in the fixtures too.
 */

import { lakhsToPaise } from '@/lib/money';
import type { Studio, VerificationCheck, PortfolioProject } from '@/modules/studio/types';
import type { StyleTag, PropertyType, ScopeType } from '@/modules/brief/types';
import { EMPTY_PROFILE } from '@/modules/studio/matching-profile';
import { FIXTURE_PROFILES } from './studio-fixture-profiles';

type PortfolioSeed = [
  title: string,
  locality: string,
  property: PropertyType,
  scope: ScopeType,
  tags: StyleTag[],
  lakhs: number,
  days: number,
  completedOn: string,
  /** Matching fields, where the fixture has them: carpet area, society, tags. */
  extra?: { area?: number; society?: string; tags?: string[] },
];

function portfolio(studioId: string, seeds: PortfolioSeed[]): PortfolioProject[] {
  return seeds.map((s, i) => ({
    id: `${studioId}-p${i + 1}`,
    title: s[0],
    locality: s[1],
    propertyType: s[2],
    scope: s[3],
    styleTags: s[4],
    valuePaise: lakhsToPaise(s[5]),
    durationDays: s[6],
    completedOn: s[7],
    images: [],
    isRender: false,
    carpetAreaSqft: s[8]?.area ?? null,
    society: s[8]?.society ?? null,
    tags: s[8]?.tags ?? [],
    imageRooms: [],
    pickerConsent: false,
  }));
}

function checks(
  entries: Array<[VerificationCheck['type'], VerificationCheck['result'], string, string | null, string | null]>,
): VerificationCheck[] {
  return entries.map(([type, result, source, checkedAt, detail]) => ({
    type,
    result,
    source,
    checkedAt,
    detail,
  }));
}

const TIER2_CHECKS = (date: string, gstFrom: string) =>
  checks([
    ['PAN_NAME_MATCH', 'PASS', 'Protean', date, null],
    ['AADHAAR_KYC', 'PASS', 'IDfy', date, 'Principal verified'],
    ['ADDRESS_VISIT', 'PASS', 'Our team', date, null],
    ['CONTACT_REACHABLE', 'PASS', 'Our team', date, null],
    ['CODE_OF_CONDUCT', 'PASS', 'Signed', date, null],
    ['GSTIN_ACTIVE', 'PASS', 'GST portal', date, null],
    ['GST_FILING_HISTORY', 'PASS', 'GST portal', date, `GSTR-1 and 3B filed monthly since ${gstFrom}`],
    ['MCA_STATUS', 'PASS', 'MCA', date, 'Annual filings current'],
    ['UDYAM', 'PASS', 'Udyam portal', date, null],
    ['CLIENT_REFERENCE', 'PASS', 'Our team', date, '3 past clients contacted by phone'],
    ['SITE_INSPECTION', 'PASS', 'Our team', date, '2 completed sites inspected'],
    ['LITIGATION_SEARCH', 'PASS', 'eCourts + NCDRC', date, 'No matters found'],
    ['RATE_CARD_FILED', 'PASS', 'Our pricing team', date, 'Per-sq-ft rates on record'],
    ['WARRANTY_TERMS', 'PASS', 'Legal review', date, 'Duration stated in the contract'],
    ['LABOUR_INSURANCE', 'PASS', 'Insurer certificate', date, 'Current at the last audit'],
  ]);

const TIER1_CHECKS = (date: string) =>
  checks([
    ['PAN_NAME_MATCH', 'PASS', 'Protean', date, null],
    ['AADHAAR_KYC', 'PASS', 'IDfy', date, 'Principal verified'],
    ['ADDRESS_VISIT', 'PASS', 'Our team', date, null],
    ['CONTACT_REACHABLE', 'PASS', 'Our team', date, null],
    ['CODE_OF_CONDUCT', 'PASS', 'Signed', date, null],
    ['GSTIN_ACTIVE', 'PASS', 'GST portal', date, null],
    ['GST_FILING_HISTORY', 'PENDING', 'GST portal', null, 'Awaiting 12-month history'],
    ['MCA_STATUS', 'NOT_APPLICABLE', 'MCA', date, 'Proprietorship — not registered with MCA'],
    ['UDYAM', 'PASS', 'Udyam portal', date, null],
    ['CLIENT_REFERENCE', 'PENDING', 'Our team', null, '1 of 3 references contacted'],
    ['SITE_INSPECTION', 'PENDING', 'Our team', null, 'Scheduled'],
    ['LITIGATION_SEARCH', 'PASS', 'eCourts + NCDRC', date, 'No matters found'],
    ['RATE_CARD_FILED', 'PASS', 'Our pricing team', date, 'Per-sq-ft rates on record'],
    // A Tier 1 studio is mid-verification by definition, and these two are the
    // paperwork that most often lags. PENDING rather than absent, so the
    // profile says which one is outstanding instead of silently showing
    // thirteen of fifteen.
    ['WARRANTY_TERMS', 'PENDING', 'Legal review', null, 'Draft terms received, under review'],
    ['LABOUR_INSURANCE', 'PENDING', 'Insurer certificate', null, 'Certificate requested'],
  ]);

/**
 * The fixtures, without the allocation fields.
 *
 * Allocation is operational state — paused, capacity — and a fixture has none
 * of it by definition: nobody has ever taken one of these out of rotation
 * because none of them is real. Rather than repeat three null defaults across
 * eight literals, they are applied once below, which also means a future
 * allocation field is a one-line change here rather than eight.
 */
type RawStudio = Omit<
  Studio,
  'capacityPerMonth' | 'pausedAt' | 'pausedReason' | 'pauseCause'
>;

const RAW_STUDIOS: RawStudio[] = [
  {
    id: 'st-akara',
    slug: 'akara-design-studio',
    legalName: 'Akara Design Studio Private Limited',
    tradeName: 'Akara Design Studio',
    about:
      'Ten-person studio working mostly in warm, material-led contemporary homes. Runs its own carpentry supervision rather than subcontracting site management.',
    city: 'pune',
    localities: ['kharadi', 'viman-nagar', 'magarpatta', 'hadapsar', 'undri'],
    status: 'ACTIVE',
    tier: 'PROVEN',
    gstin: '27AAKCA1234F1ZP',
    yearsActive: 9,
    teamSize: 11,
    minProjectPaise: lakhsToPaise(6),
    maxProjectPaise: lakhsToPaise(22),
    paymentPhases: [
      { label: 'Booking', pct: 10 },
      { label: 'Design sign-off', pct: 40 },
      { label: 'Material delivery', pct: 40 },
      { label: 'Handover', pct: 10 },
    ],
    completedProjects: 14,
    avgVarianceDays: 6,
    upheldDisputes: 0,
    specComplianceRate: 0.98,
    communicationRating: 4.6,
    autonomyProfile: 0.55,
    checks: TIER2_CHECKS('2026-08-12', 'Aug 2023'),
    portfolio: portfolio('st-akara', [
      ['Teak and lime, Kharadi', 'kharadi', 'BHK_3', 'FULL_HOME', ['warm-modern', 'indian-contemporary'], 14.5, 96, '2026-06-18'],
      ['Quiet 3BHK, Magarpatta', 'magarpatta', 'BHK_3', 'FULL_HOME', ['warm-modern', 'japandi'], 11.2, 88, '2026-04-02'],
      ['Compact 2BHK, Viman Nagar', 'viman-nagar', 'BHK_2', 'FULL_HOME', ['contemporary-minimal', 'warm-modern'], 7.8, 71, '2026-02-14'],
      ['Kitchen rebuild, Hadapsar', 'hadapsar', 'BHK_3', 'KITCHEN_WARDROBE', ['warm-modern'], 4.6, 42, '2025-12-20'],
      ['Family home, Undri', 'undri', 'BHK_4_PLUS', 'FULL_HOME', ['indian-contemporary', 'rustic-earthy'], 21.0, 132, '2025-11-08'],
      ['Renovation, Kharadi', 'kharadi', 'BHK_2', 'RENOVATION', ['warm-modern'], 6.4, 55, '2025-09-30'],
    ]),
  },
  {
    id: 'st-sutradhar',
    slug: 'sutradhar-interiors',
    legalName: 'Sutradhar Interiors LLP',
    tradeName: 'Sutradhar Interiors',
    about:
      'Detail-heavy practice with a strong drawing culture. Clients tend to be people who want to be involved in every decision.',
    city: 'pune',
    localities: ['baner', 'balewadi', 'aundh', 'wakad', 'hinjewadi'],
    status: 'ACTIVE',
    tier: 'PROVEN',
    gstin: '27AAOFS5678K1Z2',
    yearsActive: 7,
    teamSize: 8,
    minProjectPaise: lakhsToPaise(8),
    maxProjectPaise: lakhsToPaise(30),
    paymentPhases: [
      { label: 'Booking', pct: 50 },
      { label: 'Installation start', pct: 40 },
      { label: 'Handover', pct: 10 },
    ],
    completedProjects: 9,
    avgVarianceDays: 14,
    upheldDisputes: 1,
    specComplianceRate: 0.94,
    communicationRating: 4.8,
    autonomyProfile: 0.9,
    checks: TIER2_CHECKS('2026-07-28', 'Jun 2022'),
    portfolio: portfolio('st-sutradhar', [
      ['Line and shadow, Baner', 'baner', 'BHK_3', 'FULL_HOME', ['contemporary-minimal', 'mid-century'], 18.4, 118, '2026-07-11'],
      ['Aundh duplex', 'aundh', 'BHK_4_PLUS', 'FULL_HOME', ['mid-century', 'art-deco'], 27.5, 165, '2026-03-22'],
      ['Balewadi 3BHK', 'balewadi', 'BHK_3', 'FULL_HOME', ['contemporary-minimal'], 13.1, 102, '2026-01-15'],
      ['Wardrobes, Wakad', 'wakad', 'BHK_2', 'KITCHEN_WARDROBE', ['contemporary-minimal'], 5.2, 38, '2025-10-04'],
      ['Hinjewadi apartment', 'hinjewadi', 'BHK_2', 'FULL_HOME', ['scandinavian', 'contemporary-minimal'], 9.6, 84, '2025-08-19'],
    ]),
  },
  {
    id: 'st-northlight',
    slug: 'northlight-studio',
    legalName: 'Northlight Studio Private Limited',
    tradeName: 'Northlight Studio',
    about:
      'Scandinavian-leaning practice, light palettes and built-in storage. Known for finishing early and for saying no to scope creep.',
    city: 'pune',
    localities: ['wakad', 'hinjewadi', 'baner', 'ravet', 'balewadi'],
    status: 'ACTIVE',
    tier: 'PROVEN',
    gstin: '27AABCN9012M1ZQ',
    yearsActive: 5,
    teamSize: 6,
    minProjectPaise: lakhsToPaise(5),
    maxProjectPaise: lakhsToPaise(15),
    completedProjects: 11,
    avgVarianceDays: -2,
    upheldDisputes: 0,
    specComplianceRate: 0.99,
    communicationRating: 4.4,
    autonomyProfile: 0.3,
    checks: TIER2_CHECKS('2026-08-30', 'Jan 2024'),
    portfolio: portfolio('st-northlight', [
      ['White oak, Wakad', 'wakad', 'BHK_2', 'FULL_HOME', ['scandinavian', 'contemporary-minimal'], 8.2, 68, '2026-08-01'],
      ['Ravet starter home', 'ravet', 'BHK_1', 'FULL_HOME', ['scandinavian'], 4.8, 45, '2026-05-16'],
      ['Hinjewadi 2BHK', 'hinjewadi', 'BHK_2', 'FULL_HOME', ['scandinavian', 'japandi'], 7.5, 62, '2026-03-09'],
      ['Baner kitchen', 'baner', 'BHK_3', 'KITCHEN_WARDROBE', ['contemporary-minimal'], 5.9, 40, '2026-01-28'],
      ['Balewadi 3BHK', 'balewadi', 'BHK_3', 'FULL_HOME', ['scandinavian', 'coastal-light'], 12.4, 91, '2025-11-22'],
      ['Wakad renovation', 'wakad', 'BHK_2', 'RENOVATION', ['scandinavian'], 5.1, 48, '2025-09-05'],
    ]),
  },
  {
    id: 'st-mrida',
    slug: 'mrida-interiors',
    legalName: 'Mrida Interiors',
    tradeName: 'Mrida Interiors',
    about:
      'Earth-toned, craft-forward work using local stone and handmade tile. Small team, takes on few projects at a time.',
    city: 'pune',
    localities: ['kothrud', 'aundh', 'baner', 'kharadi'],
    status: 'ACTIVE',
    tier: 'VERIFIED',
    gstin: '27AAJFM3456P1ZR',
    yearsActive: 6,
    teamSize: 5,
    minProjectPaise: lakhsToPaise(7),
    maxProjectPaise: lakhsToPaise(20),
    completedProjects: 2,
    avgVarianceDays: null,
    upheldDisputes: 0,
    specComplianceRate: null,
    communicationRating: 4.5,
    autonomyProfile: 0.6,
    checks: TIER2_CHECKS('2026-08-05', 'Mar 2023'),
    portfolio: portfolio('st-mrida', [
      ['Kotah and cane, Kothrud', 'kothrud', 'BHK_3', 'FULL_HOME', ['rustic-earthy', 'indian-contemporary'], 15.8, 124, '2026-06-30'],
      ['Aundh apartment', 'aundh', 'BHK_2', 'FULL_HOME', ['rustic-earthy', 'warm-modern'], 9.1, 86, '2026-02-11'],
      ['Baner living room', 'baner', 'BHK_3', 'SINGLE_ROOM', ['indian-contemporary'], 3.4, 32, '2025-12-02'],
      ['Kharadi 3BHK', 'kharadi', 'BHK_3', 'FULL_HOME', ['rustic-earthy', 'japandi'], 13.2, 108, '2025-10-14'],
    ]),
  },
  {
    id: 'st-sixthwall',
    slug: 'sixth-wall-design',
    legalName: 'Sixth Wall Design Private Limited',
    tradeName: 'Sixth Wall Design',
    about:
      'Larger practice running several sites at once. Strong on modular and turnkey delivery, less bespoke than others on this list.',
    city: 'pune',
    localities: ['hadapsar', 'magarpatta', 'undri', 'kharadi', 'viman-nagar'],
    status: 'ACTIVE',
    tier: 'PROVEN',
    gstin: '27AAECS7890R1ZS',
    yearsActive: 12,
    teamSize: 24,
    minProjectPaise: lakhsToPaise(4),
    maxProjectPaise: lakhsToPaise(18),
    completedProjects: 21,
    avgVarianceDays: 19,
    upheldDisputes: 2,
    specComplianceRate: 0.89,
    communicationRating: 3.9,
    autonomyProfile: 0.2,
    checks: TIER2_CHECKS('2026-06-19', 'Apr 2021'),
    portfolio: portfolio('st-sixthwall', [
      ['Turnkey 2BHK, Hadapsar', 'hadapsar', 'BHK_2', 'FULL_HOME', ['contemporary-minimal', 'warm-modern'], 6.8, 74, '2026-07-25'],
      ['Magarpatta 3BHK', 'magarpatta', 'BHK_3', 'FULL_HOME', ['contemporary-minimal'], 10.4, 96, '2026-05-30'],
      ['Undri 2BHK', 'undri', 'BHK_2', 'FULL_HOME', ['warm-modern'], 7.2, 80, '2026-04-18'],
      ['Kharadi kitchen + wardrobes', 'kharadi', 'BHK_3', 'KITCHEN_WARDROBE', ['contemporary-minimal'], 5.5, 44, '2026-02-27'],
      ['Viman Nagar 3BHK', 'viman-nagar', 'BHK_3', 'FULL_HOME', ['luxe-glam', 'art-deco'], 16.9, 128, '2025-12-15'],
      ['Hadapsar 1BHK', 'hadapsar', 'BHK_1', 'FULL_HOME', ['contemporary-minimal'], 4.2, 52, '2025-10-08'],
    ]),
  },
  {
    id: 'st-kaarigar',
    slug: 'kaarigar-co',
    legalName: 'Kaarigar & Co.',
    tradeName: 'Kaarigar & Co.',
    about:
      'Traditional joinery and ornate detailing. The right studio for someone who wants carved wood and layered classical interiors.',
    city: 'pune',
    localities: ['kothrud', 'aundh', 'baner'],
    status: 'ACTIVE',
    tier: 'VERIFIED',
    gstin: '27AAGFK2345L1ZT',
    yearsActive: 15,
    teamSize: 9,
    minProjectPaise: lakhsToPaise(10),
    maxProjectPaise: lakhsToPaise(35),
    completedProjects: 0,
    avgVarianceDays: null,
    upheldDisputes: 0,
    specComplianceRate: null,
    communicationRating: null,
    autonomyProfile: null,
    checks: TIER2_CHECKS('2026-08-22', 'Sep 2020'),
    portfolio: portfolio('st-kaarigar', [
      ['Carved teak home, Kothrud', 'kothrud', 'BHK_4_PLUS', 'FULL_HOME', ['classical-ornate', 'indian-contemporary'], 32.0, 186, '2026-05-04'],
      ['Aundh formal living', 'aundh', 'BHK_3', 'SINGLE_ROOM', ['classical-ornate'], 6.2, 54, '2026-01-19'],
      ['Baner 3BHK', 'baner', 'BHK_3', 'FULL_HOME', ['classical-ornate', 'luxe-glam'], 19.5, 148, '2025-09-12'],
    ]),
  },
  {
    id: 'st-openplan',
    slug: 'openplan-studio',
    legalName: 'Openplan Studio',
    tradeName: 'Openplan Studio',
    about:
      'New practice founded by two architects. No completed projects with us yet — their score reflects only what we could verify.',
    city: 'pune',
    localities: ['baner', 'balewadi', 'wakad', 'hinjewadi', 'ravet'],
    status: 'ACTIVE',
    tier: 'LISTED',
    gstin: '27AABFO6789T1ZU',
    yearsActive: 2,
    teamSize: 4,
    minProjectPaise: lakhsToPaise(5),
    maxProjectPaise: lakhsToPaise(14),
    completedProjects: 0,
    avgVarianceDays: null,
    upheldDisputes: 0,
    specComplianceRate: null,
    communicationRating: null,
    autonomyProfile: null,
    checks: TIER1_CHECKS('2026-09-01'),
    portfolio: portfolio('st-openplan', [
      ['Balewadi 2BHK', 'balewadi', 'BHK_2', 'FULL_HOME', ['contemporary-minimal', 'japandi'], 8.9, 78, '2026-06-08'],
      ['Baner studio flat', 'baner', 'BHK_1', 'FULL_HOME', ['japandi', 'scandinavian'], 5.4, 50, '2026-03-14'],
      ['Wakad 2BHK', 'wakad', 'BHK_2', 'FULL_HOME', ['contemporary-minimal'], 7.6, 66, '2025-12-29'],
    ]),
  },
  {
    id: 'st-terrafirma',
    slug: 'terra-firma-interiors',
    legalName: 'Terra Firma Interiors LLP',
    tradeName: 'Terra Firma Interiors',
    about:
      'Coastal and light-forward palettes, lots of glazing and pale timber. Works mostly in the west of the city.',
    city: 'pune',
    localities: ['baner', 'aundh', 'balewadi', 'kothrud', 'wakad'],
    status: 'ACTIVE',
    tier: 'PROVEN',
    gstin: '27AAPFT1357N1ZV',
    yearsActive: 8,
    teamSize: 7,
    minProjectPaise: lakhsToPaise(6),
    maxProjectPaise: lakhsToPaise(19),
    completedProjects: 6,
    avgVarianceDays: 9,
    upheldDisputes: 0,
    specComplianceRate: 0.96,
    communicationRating: 4.2,
    autonomyProfile: 0.5,
    checks: TIER2_CHECKS('2026-07-15', 'Nov 2022'),
    portfolio: portfolio('st-terrafirma', [
      ['Light box, Baner', 'baner', 'BHK_3', 'FULL_HOME', ['coastal-light', 'scandinavian'], 13.8, 104, '2026-07-02'],
      ['Aundh 2BHK', 'aundh', 'BHK_2', 'FULL_HOME', ['coastal-light', 'contemporary-minimal'], 8.4, 76, '2026-04-25'],
      ['Kothrud renovation', 'kothrud', 'BHK_3', 'RENOVATION', ['warm-modern', 'coastal-light'], 9.7, 88, '2026-02-06'],
      ['Balewadi kitchen', 'balewadi', 'BHK_2', 'KITCHEN_WARDROBE', ['contemporary-minimal'], 4.9, 36, '2025-11-30'],
      ['Wakad 3BHK', 'wakad', 'BHK_3', 'FULL_HOME', ['coastal-light', 'japandi'], 11.6, 94, '2025-09-18'],
    ]),
  },

  // ── Added 29 Sep 2026: Premium and Luxury studios, and the zones the first
  // eight left thin (south, central, PCMC), so the band filter and the
  // widenings have something to act on. Same rules: invented, not real.
  {
    id: 'st-vaastu',
    slug: 'vaastu-atelier',
    legalName: 'Vaastu Atelier LLP',
    tradeName: 'Vaastu Atelier',
    about:
      'Family homes planned around vastu and a proper pooja room, finished in veneer and stone. Most clients are three generations under one roof.',
    city: 'pune',
    localities: ['hadapsar', 'amanora', 'magarpatta', 'kharadi', 'mundhwa', 'nibm'],
    status: 'ACTIVE',
    tier: 'PROVEN',
    gstin: '27AAKFV2211Q1Z8',
    yearsActive: 11,
    teamSize: 14,
    minProjectPaise: lakhsToPaise(18),
    maxProjectPaise: lakhsToPaise(55),
    paymentPhases: [
      { label: 'Booking', pct: 10 },
      { label: 'Design sign-off', pct: 30 },
      { label: 'Material at site', pct: 40 },
      { label: 'Handover', pct: 20 },
    ],
    completedProjects: 17,
    avgVarianceDays: 5,
    upheldDisputes: 0,
    specComplianceRate: 0.97,
    communicationRating: 4.7,
    autonomyProfile: 0.6,
    checks: TIER2_CHECKS('2026-08-12', 'Apr 2021'),
    portfolio: portfolio('st-vaastu', [
      ['Three generations, Amanora', 'amanora', 'BHK_4_PLUS', 'FULL_HOME', ['indian-contemporary', 'warm-modern'], 38, 140, '2026-07-20', { area: 1850, society: 'Sapphire Heights', tags: ['VASTU', 'POOJA_ROOM', 'ELDERLY'] }],
      ['Magarpatta 3BHK', 'magarpatta', 'BHK_3', 'FULL_HOME', ['indian-contemporary'], 26, 118, '2026-03-02', { area: 1300, tags: ['VASTU', 'POOJA_ROOM'] }],
      ['Mundhwa family home', 'mundhwa', 'BHK_3', 'FULL_HOME', ['warm-modern', 'indian-contemporary'], 27.5, 122, '2025-12-10', { area: 1350, society: 'Orchid Park', tags: ['ELDERLY', 'CHILDREN'] }],
      ['NIBM kitchen', 'nibm', 'BHK_3', 'KITCHEN_WARDROBE', ['warm-modern'], 9.5, 48, '2025-09-14', { area: 1250 }],
    ]),
  },
  {
    id: 'st-grain',
    slug: 'grain-and-grey',
    legalName: 'Grain and Grey Design Private Limited',
    tradeName: 'Grain & Grey',
    about:
      'Factory-built, quick and exact. Acrylic and lacquer kitchens, full-height wardrobes and home offices for people who would rather not choose every hinge.',
    city: 'pune',
    localities: ['baner', 'balewadi', 'wakad', 'hinjewadi', 'pimple-saudagar', 'aundh'],
    status: 'ACTIVE',
    tier: 'PROVEN',
    gstin: '27AAHCG7788P1ZK',
    yearsActive: 8,
    teamSize: 22,
    minProjectPaise: lakhsToPaise(15),
    maxProjectPaise: lakhsToPaise(45),
    paymentPhases: [
      { label: 'Booking', pct: 10 },
      { label: 'Production start', pct: 50 },
      { label: 'Delivery', pct: 30 },
      { label: 'Handover', pct: 10 },
    ],
    completedProjects: 31,
    avgVarianceDays: -1,
    upheldDisputes: 0,
    specComplianceRate: 0.99,
    communicationRating: 4.5,
    autonomyProfile: 0.2,
    checks: TIER2_CHECKS('2026-08-31', 'Aug 2020'),
    portfolio: portfolio('st-grain', [
      ['Work from home, Baner', 'baner', 'BHK_3', 'FULL_HOME', ['contemporary-minimal', 'japandi'], 24, 82, '2026-08-18', { area: 1200, tags: ['HOME_OFFICE', 'SMART_HOME'] }],
      ['Wakad 2BHK', 'wakad', 'BHK_2', 'FULL_HOME', ['contemporary-minimal'], 17, 70, '2026-05-30', { area: 880, tags: ['EXTRA_STORAGE', 'HOME_OFFICE'] }],
      ['Hinjewadi kitchen', 'hinjewadi', 'BHK_2', 'KITCHEN_WARDROBE', ['contemporary-minimal'], 7.5, 32, '2026-03-11'],
      ['Aundh 4BHK', 'aundh', 'BHK_4_PLUS', 'FULL_HOME', ['japandi', 'warm-modern'], 36, 98, '2025-12-02', { area: 1800, tags: ['SMART_HOME', 'EXTRA_STORAGE'] }],
    ]),
  },
  {
    id: 'st-kosha',
    slug: 'kosha-interiors',
    legalName: 'Kosha Interiors',
    tradeName: 'Kosha Interiors',
    about:
      'Carpenter-led, with its own civil team. Solid wood, hand-finished veneer, and renovations of older bungalows and flats that need walls moved.',
    city: 'pune',
    localities: ['kothrud', 'karve-nagar', 'erandwane', 'deccan', 'prabhat-road', 'model-colony'],
    status: 'ACTIVE',
    tier: 'PROVEN',
    gstin: '27ABKPK4455M1ZD',
    yearsActive: 19,
    teamSize: 12,
    minProjectPaise: lakhsToPaise(16),
    maxProjectPaise: lakhsToPaise(60),
    paymentPhases: [
      { label: 'Booking', pct: 25 },
      { label: 'Civil complete', pct: 25 },
      { label: 'Carpentry complete', pct: 35 },
      { label: 'Handover', pct: 15 },
    ],
    completedProjects: 12,
    avgVarianceDays: 18,
    upheldDisputes: 0,
    specComplianceRate: 0.93,
    communicationRating: 4.6,
    autonomyProfile: 0.85,
    checks: TIER2_CHECKS('2026-07-05', 'Jul 2020'),
    portfolio: portfolio('st-kosha', [
      ['Erandwane bungalow', 'erandwane', 'BHK_4_PLUS', 'RENOVATION', ['classical-ornate', 'indian-contemporary'], 48, 190, '2026-06-01', { tags: ['ELDERLY', 'VASTU'] }],
      ['Kothrud 3BHK', 'kothrud', 'BHK_3', 'FULL_HOME', ['indian-contemporary', 'rustic-earthy'], 25, 150, '2026-01-20', { area: 1250, tags: ['ELDERLY', 'BESPOKE_FURNITURE'] }],
      ['Model Colony flat', 'model-colony', 'BHK_3', 'FULL_HOME', ['classical-ornate'], 28, 160, '2025-09-09', { area: 1400, tags: ['BESPOKE_FURNITURE', 'VASTU'] }],
    ]),
  },
  {
    id: 'st-southlight',
    slug: 'southlight-design',
    legalName: 'Southlight Design Studio',
    tradeName: 'Southlight Design',
    about:
      'Bright, practical homes for young families in the south of the city. Wipeable finishes, rounded corners, and storage that a child can reach.',
    city: 'pune',
    localities: ['kondhwa', 'nibm', 'undri', 'wanowrie', 'bibwewadi', 'katraj'],
    status: 'ACTIVE',
    tier: 'PROVEN',
    gstin: '27AAQFS9090C1ZT',
    yearsActive: 6,
    teamSize: 9,
    minProjectPaise: lakhsToPaise(14),
    maxProjectPaise: lakhsToPaise(32),
    completedProjects: 8,
    avgVarianceDays: 7,
    upheldDisputes: 0,
    specComplianceRate: 0.95,
    communicationRating: 4.5,
    autonomyProfile: 0.5,
    checks: TIER2_CHECKS('2026-08-22', 'Mar 2022'),
    portfolio: portfolio('st-southlight', [
      ['Undri family flat', 'undri', 'BHK_3', 'FULL_HOME', ['scandinavian', 'coastal-light'], 22, 96, '2026-08-05', { area: 1150, tags: ['CHILDREN', 'PETS'] }],
      ['NIBM 2BHK', 'nibm', 'BHK_2', 'FULL_HOME', ['coastal-light'], 17.5, 88, '2026-04-18', { area: 900, tags: ['CHILDREN'] }],
      ["Kondhwa children's rooms", 'kondhwa', 'BHK_3', 'SINGLE_ROOM', ['scandinavian'], 4.2, 30, '2026-02-01', { tags: ['CHILDREN', 'PETS'] }],
    ]),
  },
  {
    id: 'st-marigold',
    slug: 'marigold-house',
    legalName: 'Marigold House Design Private Limited',
    tradeName: 'Marigold House',
    about:
      'Large homes and villas, designed piece by piece — furniture drawn for the room, lighting and automation designed in, civil changes handled by our own team.',
    city: 'pune',
    localities: ['koregaon-park', 'kalyani-nagar', 'viman-nagar', 'baner', 'aundh'],
    status: 'ACTIVE',
    tier: 'PROVEN',
    gstin: '27AAECM3131H1ZW',
    yearsActive: 15,
    teamSize: 26,
    minProjectPaise: lakhsToPaise(40),
    maxProjectPaise: lakhsToPaise(200),
    paymentPhases: [
      { label: 'Booking', pct: 15 },
      { label: 'Design sign-off', pct: 25 },
      { label: 'Civil and services', pct: 25 },
      { label: 'Furniture delivery', pct: 25 },
      { label: 'Handover', pct: 10 },
    ],
    completedProjects: 22,
    avgVarianceDays: 12,
    upheldDisputes: 0,
    specComplianceRate: 0.98,
    communicationRating: 4.9,
    autonomyProfile: 0.25,
    checks: TIER2_CHECKS('2026-08-28', 'Jan 2019'),
    portfolio: portfolio('st-marigold', [
      ['Koregaon Park villa', 'koregaon-park', 'BHK_4_PLUS', 'FULL_HOME', ['luxe-glam', 'art-deco'], 120, 210, '2026-07-01', { area: 3800, society: 'The Banyan Estate', tags: ['SMART_HOME', 'BESPOKE_FURNITURE'] }],
      ['Kalyani Nagar penthouse', 'kalyani-nagar', 'BHK_4_PLUS', 'FULL_HOME', ['luxe-glam', 'contemporary-minimal'], 85, 180, '2026-02-15', { area: 2900, tags: ['SMART_HOME'] }],
      ['Baner duplex', 'baner', 'BHK_4_PLUS', 'FULL_HOME', ['art-deco', 'warm-modern'], 70, 170, '2025-10-20', { area: 2500, society: 'Lakeside Villas', tags: ['BESPOKE_FURNITURE'] }],
    ]),
  },
  {
    id: 'st-stonesill',
    slug: 'stone-and-sill',
    legalName: 'Stone and Sill Interiors LLP',
    tradeName: 'Stone & Sill',
    about:
      'Stone, veneer and lacquer, detailed properly. Kitchens are the centre of every project; we design them first and the rest of the home around them.',
    city: 'pune',
    localities: ['baner', 'balewadi', 'bavdhan', 'aundh', 'pashan'],
    status: 'ACTIVE',
    tier: 'PROVEN',
    gstin: '27AAJFS6060E1ZM',
    yearsActive: 9,
    teamSize: 15,
    minProjectPaise: lakhsToPaise(35),
    maxProjectPaise: lakhsToPaise(120),
    completedProjects: 10,
    avgVarianceDays: 9,
    upheldDisputes: 0,
    specComplianceRate: 0.97,
    communicationRating: 4.6,
    autonomyProfile: 0.5,
    checks: TIER2_CHECKS('2026-08-10', 'Feb 2022'),
    portfolio: portfolio('st-stonesill', [
      ['Bavdhan 4BHK', 'bavdhan', 'BHK_4_PLUS', 'FULL_HOME', ['contemporary-minimal', 'luxe-glam'], 62, 150, '2026-06-20', { area: 2200, tags: ['HOME_OFFICE'] }],
      ['Baner kitchen and living', 'baner', 'BHK_3', 'KITCHEN_WARDROBE', ['contemporary-minimal'], 18, 60, '2026-03-05'],
      ['Aundh 3BHK', 'aundh', 'BHK_3', 'FULL_HOME', ['warm-modern', 'japandi'], 42, 138, '2025-11-12', { area: 1500, tags: ['CHILDREN', 'HOME_OFFICE'] }],
    ]),
  },
  {
    id: 'st-ashrama',
    slug: 'ashrama-studio',
    legalName: 'Ashrama Studio',
    tradeName: 'Ashrama Studio',
    about:
      'A small atelier of master carpenters. Solid teak, hand-carved pooja rooms and jaali, and homes that take their time. We take two projects at once.',
    city: 'pune',
    localities: ['sadashiv-peth', 'deccan', 'shivajinagar', 'kothrud'],
    status: 'ACTIVE',
    tier: 'LISTED',
    gstin: null,
    gstinNotApplicable: true,
    gstinNote: 'Proprietorship below the GST threshold until this year; registration applied for in August.',
    yearsActive: 23,
    teamSize: 7,
    minProjectPaise: lakhsToPaise(30),
    maxProjectPaise: lakhsToPaise(90),
    completedProjects: 0,
    avgVarianceDays: null,
    upheldDisputes: 0,
    specComplianceRate: null,
    communicationRating: null,
    autonomyProfile: null,
    checks: TIER1_CHECKS('2026-08-25'),
    portfolio: portfolio('st-ashrama', [
      ['Teak pooja room, Deccan', 'deccan', 'BHK_3', 'SINGLE_ROOM', ['indian-contemporary', 'classical-ornate'], 9, 55, '2026-05-10', { tags: ['POOJA_ROOM', 'VASTU'] }],
      ['Sadashiv Peth wada flat', 'sadashiv-peth', 'BHK_3', 'FULL_HOME', ['indian-contemporary', 'rustic-earthy'], 40, 170, '2025-12-01', { area: 1350, tags: ['POOJA_ROOM', 'BESPOKE_FURNITURE'] }],
    ]),
  },
];

export const STUDIOS: Studio[] = RAW_STUDIOS.map((s) => ({
  ...s,
  matchingProfile: FIXTURE_PROFILES[s.slug]?.profile ?? EMPTY_PROFILE,
  band: FIXTURE_PROFILES[s.slug]?.band ?? null,
  capacityPerMonth: null,
  pausedAt: null,
  pausedReason: null,
  pauseCause: null,
}));

export function getStudioBySlug(slug: string): Studio | undefined {
  return STUDIOS.find((s) => s.slug === slug);
}

export function getStudioById(id: string): Studio | undefined {
  return STUDIOS.find((s) => s.id === id);
}
