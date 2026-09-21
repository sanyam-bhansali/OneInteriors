/**
 * The Brief — output of the 9-question quiz.
 *
 * These types are the contract between the quiz, the matching engine and the
 * quotation engine. They deliberately do NOT import from @prisma/client: domain
 * logic must stay independent of the ORM so it runs in the browser, on the
 * server, and inside the Capacitor build without change.
 */

import type { Paise } from '@/lib/money';

export type PropertyType = 'BHK_1' | 'BHK_2' | 'BHK_3' | 'BHK_4_PLUS' | 'VILLA';

export type ScopeType = 'FULL_HOME' | 'KITCHEN_WARDROBE' | 'SINGLE_ROOM' | 'RENOVATION';

export type Involvement = 'DECIDE_FOR_ME' | 'COLLABORATE' | 'APPROVE_EVERYTHING';

export type PriorityFactor = 'BUDGET' | 'SPEED' | 'DESIGN_AMBITION' | 'MATERIAL_QUALITY';

/**
 * Style vocabulary. This list is shared by the quiz picker and portfolio
 * tagging — if the two ever diverge, matching silently degrades and nobody
 * notices, because a zero overlap looks like a legitimate low score.
 *
 * Deliberately no style NAMES are shown during Q4. The customer picks images;
 * the name is revealed after, which is how the quiz teaches vocabulary.
 */
export const STYLE_TAGS = [
  'contemporary-minimal',
  'warm-modern',
  'indian-contemporary',
  'scandinavian',
  'industrial',
  'mid-century',
  'classical-ornate',
  'art-deco',
  'rustic-earthy',
  'luxe-glam',
  'japandi',
  'coastal-light',
] as const;

export type StyleTag = (typeof STYLE_TAGS)[number];

export const STYLE_LABELS: Record<StyleTag, string> = {
  'contemporary-minimal': 'Contemporary Minimal',
  'warm-modern': 'Warm Modern',
  'indian-contemporary': 'Indian Contemporary',
  scandinavian: 'Scandinavian',
  industrial: 'Industrial',
  'mid-century': 'Mid-Century',
  'classical-ornate': 'Classical Ornate',
  'art-deco': 'Art Deco',
  'rustic-earthy': 'Rustic Earthy',
  'luxe-glam': 'Luxe Glam',
  japandi: 'Japandi',
  'coastal-light': 'Coastal Light',
};

export interface Household {
  adults: number;
  children: number;
  elderly: number;
  pets: boolean;
  worksFromHome: boolean;
}

export interface Brief {
  // Q1 — property
  propertyType: PropertyType | null;
  carpetAreaSqft: number | null;
  locality: string | null;
  possessionOn: string | null; // ISO date

  // Q2 — scope
  scope: ScopeType | null;

  /**
   * Essential / Premium / Luxury. Chosen after the nine questions rather than
   * inside them: the bands are shown with real costs for this customer's own
   * home, which is only possible once we know the size.
   */
  tier: BudgetTier | null;

  // Q3 — budget, integer paise
  budgetMinPaise: Paise | null;
  budgetMaxPaise: Paise | null;

  // Q4 / Q5 — likes are a weight, dislikes are a HARD FILTER
  styleLikes: StyleTag[];
  styleDislikes: StyleTag[];

  // Q6 — household
  household: Household | null;

  // Q7 — ranked, index 0 is most important. Does most of the matching work.
  priorityRanking: PriorityFactor[];

  // Q8 — working style. The #1 cause of client/studio breakdown.
  involvement: Involvement | null;

  // Q9 — timeline
  moveInBy: string | null; // ISO date

  /**
   * The builder's floor plan, by display name, once uploaded.
   *
   * Read-only in the domain type: uploading is its own action and the quiz must
   * never write this back. Never the storage path — that stays server-side, and
   * the file itself is reachable only through a short signed URL.
   */
  floorPlanName: string | null;

  // Progress
  lastStep: number;
  completedAt: string | null;
}

export const EMPTY_BRIEF: Brief = {
  propertyType: null,
  carpetAreaSqft: null,
  locality: null,
  possessionOn: null,
  scope: null,
  tier: null,
  budgetMinPaise: null,
  budgetMaxPaise: null,
  styleLikes: [],
  styleDislikes: [],
  household: null,
  priorityRanking: [],
  involvement: null,
  moveInBy: null,
  floorPlanName: null,
  lastStep: 0,
  completedAt: null,
};

export type BudgetTier = 'ESSENTIAL' | 'PREMIUM' | 'LUXURY';

export const TOTAL_STEPS = 9;

/** Pune localities we currently have verified supply in. */
/**
 * Where we work, grouped the way Pune actually thinks about itself.
 *
 * ## The zone is not decoration
 *
 * Locality is a HARD FILTER in matching — a studio that has not ticked the
 * customer's area is removed from the results entirely (see `passesFilters` in
 * modules/matching/score.ts). That was safe while this list had twelve entries
 * and a studio ticking six covered half the city. It is not safe now: with
 * sixty, ticking six covers a tenth, and most customers would see an empty
 * match page while perfectly good studios sat one road away.
 *
 * So the filter matches on the zone, and the exact locality becomes a scoring
 * bonus instead. A studio working in Baner is shown to somebody in Pashan; a
 * studio working in Kharadi is not.
 *
 * ## Adding to this list
 *
 * Add freely, never rename or remove. These slugs are stored on briefs, on
 * studio rows and on portfolio projects — a renamed slug silently stops
 * matching and the symptom is a studio quietly getting less work.
 */
export type PuneZone = 'west' | 'pcmc' | 'south-west' | 'central' | 'east' | 'south';

export const ZONE_LABELS: Record<PuneZone, string> = {
  west: 'West — Baner, Aundh, Pashan',
  pcmc: 'Pimpri-Chinchwad & Hinjewadi',
  'south-west': 'Kothrud, Warje & Sinhagad Road',
  central: 'Central Pune',
  east: 'East — Kharadi, Viman Nagar, Hadapsar',
  south: 'South — Kondhwa, NIBM, Bibwewadi',
};

export const PUNE_LOCALITIES = [
  // ── West ──
  { slug: 'baner', label: 'Baner', zone: 'west' },
  { slug: 'balewadi', label: 'Balewadi', zone: 'west' },
  { slug: 'aundh', label: 'Aundh', zone: 'west' },
  { slug: 'pashan', label: 'Pashan', zone: 'west' },
  { slug: 'sus', label: 'Sus', zone: 'west' },
  { slug: 'bavdhan', label: 'Bavdhan', zone: 'west' },
  { slug: 'mahalunge', label: 'Mahalunge', zone: 'west' },
  { slug: 'baner-pashan-link', label: 'Baner–Pashan Link Road', zone: 'west' },

  // ── Pimpri-Chinchwad & Hinjewadi ──
  { slug: 'wakad', label: 'Wakad', zone: 'pcmc' },
  { slug: 'hinjewadi', label: 'Hinjewadi', zone: 'pcmc' },
  { slug: 'punawale', label: 'Punawale', zone: 'pcmc' },
  { slug: 'tathawade', label: 'Tathawade', zone: 'pcmc' },
  { slug: 'ravet', label: 'Ravet', zone: 'pcmc' },
  { slug: 'thergaon', label: 'Thergaon', zone: 'pcmc' },
  { slug: 'kalewadi', label: 'Kalewadi', zone: 'pcmc' },
  { slug: 'pimple-saudagar', label: 'Pimple Saudagar', zone: 'pcmc' },
  { slug: 'pimple-nilakh', label: 'Pimple Nilakh', zone: 'pcmc' },
  { slug: 'pimple-gurav', label: 'Pimple Gurav', zone: 'pcmc' },
  { slug: 'chinchwad', label: 'Chinchwad', zone: 'pcmc' },
  { slug: 'pimpri', label: 'Pimpri', zone: 'pcmc' },
  { slug: 'nigdi', label: 'Nigdi', zone: 'pcmc' },
  { slug: 'akurdi', label: 'Akurdi', zone: 'pcmc' },
  { slug: 'chikhali', label: 'Chikhali', zone: 'pcmc' },
  { slug: 'moshi', label: 'Moshi', zone: 'pcmc' },
  { slug: 'talawade', label: 'Talawade', zone: 'pcmc' },
  { slug: 'dehu-road', label: 'Dehu Road', zone: 'pcmc' },

  // ── Kothrud, Warje & Sinhagad Road ──
  { slug: 'kothrud', label: 'Kothrud', zone: 'south-west' },
  { slug: 'warje', label: 'Warje', zone: 'south-west' },
  { slug: 'karve-nagar', label: 'Karve Nagar', zone: 'south-west' },
  { slug: 'shivane', label: 'Shivane', zone: 'south-west' },
  { slug: 'dhayari', label: 'Dhayari', zone: 'south-west' },
  { slug: 'narhe', label: 'Narhe', zone: 'south-west' },
  { slug: 'nanded-city', label: 'Nanded City', zone: 'south-west' },
  { slug: 'sinhagad-road', label: 'Sinhagad Road', zone: 'south-west' },
  { slug: 'ambegaon', label: 'Ambegaon', zone: 'south-west' },
  { slug: 'katraj', label: 'Katraj', zone: 'south-west' },

  // ── Central ──
  { slug: 'shivajinagar', label: 'Shivajinagar', zone: 'central' },
  { slug: 'deccan', label: 'Deccan Gymkhana', zone: 'central' },
  { slug: 'erandwane', label: 'Erandwane', zone: 'central' },
  { slug: 'prabhat-road', label: 'Prabhat Road', zone: 'central' },
  { slug: 'model-colony', label: 'Model Colony', zone: 'central' },
  { slug: 'camp', label: 'Camp', zone: 'central' },
  { slug: 'swargate', label: 'Swargate', zone: 'central' },
  { slug: 'sadashiv-peth', label: 'Sadashiv Peth & the Peths', zone: 'central' },

  // ── East ──
  { slug: 'kharadi', label: 'Kharadi', zone: 'east' },
  { slug: 'viman-nagar', label: 'Viman Nagar', zone: 'east' },
  { slug: 'kalyani-nagar', label: 'Kalyani Nagar', zone: 'east' },
  { slug: 'koregaon-park', label: 'Koregaon Park', zone: 'east' },
  { slug: 'yerawada', label: 'Yerawada', zone: 'east' },
  { slug: 'dhanori', label: 'Dhanori', zone: 'east' },
  { slug: 'vishrantwadi', label: 'Vishrantwadi', zone: 'east' },
  { slug: 'wagholi', label: 'Wagholi', zone: 'east' },
  { slug: 'mundhwa', label: 'Mundhwa', zone: 'east' },
  { slug: 'keshav-nagar', label: 'Keshav Nagar', zone: 'east' },
  { slug: 'hadapsar', label: 'Hadapsar', zone: 'east' },
  { slug: 'magarpatta', label: 'Magarpatta', zone: 'east' },
  { slug: 'amanora', label: 'Amanora', zone: 'east' },

  // ── South ──
  { slug: 'kondhwa', label: 'Kondhwa', zone: 'south' },
  { slug: 'nibm', label: 'NIBM Road', zone: 'south' },
  { slug: 'undri', label: 'Undri', zone: 'south' },
  { slug: 'mohammadwadi', label: 'Mohammadwadi', zone: 'south' },
  { slug: 'wanowrie', label: 'Wanowrie', zone: 'south' },
  { slug: 'bibwewadi', label: 'Bibwewadi', zone: 'south' },
  { slug: 'salisbury-park', label: 'Salisbury Park', zone: 'south' },
] as const;

/**
 * Label for a stored locality slug.
 *
 * Same contract as `propertyLabel` and `scopeLabel` above: tolerate a value
 * this build does not know about rather than rendering `undefined` into the
 * page. A brief written before a locality was renamed, or after one was
 * retired, should read as the slug rather than as a blank.
 */
export function localityLabel(slug: string | null | undefined): string | null {
  if (!slug) return null;
  return PUNE_LOCALITIES.find((l) => l.slug === slug)?.label ?? titleCaseSlug(slug);
}

function titleCaseSlug(slug: string): string {
  return slug
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

/** Zone for a locality slug, or null if we do not know it. */
export function zoneOf(slug: string | null | undefined): PuneZone | null {
  if (!slug) return null;
  return PUNE_LOCALITIES.find((l) => l.slug === slug)?.zone ?? null;
}

/** The list grouped for a UI that cannot reasonably show sixty checkboxes flat. */
export const LOCALITIES_BY_ZONE = (Object.keys(ZONE_LABELS) as PuneZone[]).map((zone) => ({
  zone,
  label: ZONE_LABELS[zone],
  localities: PUNE_LOCALITIES.filter((l) => l.zone === zone),
}));

export const PROPERTY_LABELS: Record<PropertyType, string> = {
  BHK_1: '1 BHK',
  BHK_2: '2 BHK',
  BHK_3: '3 BHK',
  BHK_4_PLUS: '4+ BHK',
  VILLA: 'Villa / Row house',
};

/**
 * Label lookups that tolerate a value the UI does not know about.
 *
 * The Prisma enums are wider than these TS unions — `PropertyType` carries an
 * `OTHER` the quiz never writes, and a future migration can add more. Indexing
 * the Record directly with a database value therefore renders `undefined` into
 * the page, silently, on exactly the rows that are unusual enough to matter.
 * Everything that displays a stored enum goes through these.
 */
export function propertyLabel(value: string | null | undefined): string | null {
  if (!value) return null;
  return PROPERTY_LABELS[value as PropertyType] ?? 'Other';
}

export function scopeLabel(value: string | null | undefined): string | null {
  if (!value) return null;
  return SCOPE_LABELS[value as ScopeType] ?? 'Other';
}

export const SCOPE_LABELS: Record<ScopeType, string> = {
  FULL_HOME: 'Full home',
  KITCHEN_WARDROBE: 'Kitchen & wardrobes',
  SINGLE_ROOM: 'One room',
  RENOVATION: 'Renovation',
};

export const INVOLVEMENT_LABELS: Record<Involvement, string> = {
  DECIDE_FOR_ME: 'Decide most things for me',
  COLLABORATE: 'Work through it together',
  APPROVE_EVERYTHING: 'I want to approve every detail',
};

export const PRIORITY_LABELS: Record<PriorityFactor, string> = {
  BUDGET: 'Staying in budget',
  SPEED: 'Finishing on time',
  DESIGN_AMBITION: 'Design ambition',
  MATERIAL_QUALITY: 'Material quality',
};

export function isBriefComplete(brief: Brief): boolean {
  return (
    brief.propertyType !== null &&
    brief.scope !== null &&
    brief.budgetMinPaise !== null &&
    brief.styleLikes.length > 0 &&
    brief.involvement !== null &&
    brief.priorityRanking.length > 0
  );
}
