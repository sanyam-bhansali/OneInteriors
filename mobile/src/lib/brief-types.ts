/**
 * The brief: what the first-visit quiz writes, sent to the server as-is.
 *
 * COPIED from the website, because React Native cannot import from src/:
 *   - `Brief`, `EMPTY_BRIEF` and the unions from src/modules/brief/types.ts
 *   - `STYLE_TAGS`, `STYLE_LABELS`, `PUNE_LOCALITIES` from the same file
 *   - `TIER` per-sq-ft bands and `tierRangeFor` from src/modules/quotation/tiers.ts
 *   - `TYPICAL_CARPET_SQFT`, `BEDROOMS` from src/modules/quotation/estimate.ts
 *   - `carpetAreaFor` from src/modules/brief/steps.ts
 *   - `PICKABLE_ROOMS` / `roomsFor` from src/modules/quotation/scope.ts (the catalogue's
 *     second bedroom needs 2 BHK, the third 3 BHK)
 * Field names and values must stay identical to the website's: change one, change the other.
 * Never rename a slug or a tag; they are stored on briefs.
 */

/** Integer paise. */
export type Paise = number;

export type PropertyType = 'BHK_1' | 'BHK_2' | 'BHK_3' | 'BHK_4_PLUS' | 'VILLA';
export type ScopeType = 'FULL_HOME' | 'KITCHEN_WARDROBE' | 'SINGLE_ROOM' | 'RENOVATION';
export type Involvement = 'DECIDE_FOR_ME' | 'COLLABORATE' | 'APPROVE_EVERYTHING';
export type PriorityFactor = 'BUDGET' | 'SPEED' | 'DESIGN_AMBITION' | 'MATERIAL_QUALITY';
export type PossessionStatus = 'HAVE_KEYS' | 'EXPECTED' | 'NOT_SURE';
export type HomeNeed = 'VASTU' | 'POOJA_ROOM' | 'EXTRA_STORAGE' | 'SMART_HOME' | 'LOW_MAINTENANCE' | 'ENTERTAINING';
export type Language = 'EN' | 'HI' | 'MR';
export type BudgetTier = 'ESSENTIAL' | 'PREMIUM' | 'LUXURY';

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

/** Style names stay English in every language. */
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

export interface PlanRoomSize {
  name: string;
  code: 'KITCHEN' | 'BEDROOM' | 'LIVING' | 'DINING' | 'STUDY' | 'TOILET' | 'BALCONY' | 'UTILITY' | 'OTHER';
  widthMm: number;
  depthMm: number;
}

export interface PlanUse {
  kitchenRunMm: number | null;
  bathrooms: number;
  hasStudy: boolean;
  areaSource: 'printed' | 'computed' | 'customer' | 'society' | null;
  rooms?: PlanRoomSize[];
}

export interface Brief {
  contactName: string | null;
  propertyType: PropertyType | null;
  carpetAreaSqft: number | null;
  locality: string | null;
  society: string | null;
  possessionStatus: PossessionStatus | null;
  possessionOn: string | null;
  scope: ScopeType | null;
  scopeRooms: string[];
  excludedItems: string[];
  tier: BudgetTier | null;
  budgetMinPaise: Paise | null;
  budgetMaxPaise: Paise | null;
  styleLikes: StyleTag[];
  styleDislikes: StyleTag[];
  styleStudioPicks?: string[];
  household: Household | null;
  needs: HomeNeed[];
  priorityRanking: PriorityFactor[];
  involvement: Involvement | null;
  language: Language | null;
  moveInBy: string | null;
  floorPlanName: string | null;
  planReading: PlanUse | null;
  lastStep: number;
  completedAt: string | null;
}

export const EMPTY_BRIEF: Brief = {
  contactName: null,
  propertyType: null,
  carpetAreaSqft: null,
  locality: null,
  society: null,
  possessionStatus: null,
  possessionOn: null,
  scope: null,
  scopeRooms: [],
  excludedItems: [],
  tier: null,
  budgetMinPaise: null,
  budgetMaxPaise: null,
  styleLikes: [],
  styleDislikes: [],
  styleStudioPicks: [],
  household: null,
  needs: [],
  priorityRanking: [],
  involvement: null,
  language: null,
  moveInBy: null,
  floorPlanName: null,
  planReading: null,
  lastStep: 0,
  completedAt: null,
};

/** Every locality the website knows (src/modules/brief/types.ts PUNE_LOCALITIES). Labels stay English. */
export const PUNE_LOCALITIES: readonly { slug: string; label: string }[] = [
  { slug: 'baner', label: 'Baner' },
  { slug: 'balewadi', label: 'Balewadi' },
  { slug: 'aundh', label: 'Aundh' },
  { slug: 'pashan', label: 'Pashan' },
  { slug: 'sus', label: 'Sus' },
  { slug: 'bavdhan', label: 'Bavdhan' },
  { slug: 'mahalunge', label: 'Mahalunge' },
  { slug: 'baner-pashan-link', label: 'Baner–Pashan Link Road' },
  { slug: 'wakad', label: 'Wakad' },
  { slug: 'hinjewadi', label: 'Hinjewadi' },
  { slug: 'punawale', label: 'Punawale' },
  { slug: 'tathawade', label: 'Tathawade' },
  { slug: 'ravet', label: 'Ravet' },
  { slug: 'thergaon', label: 'Thergaon' },
  { slug: 'kalewadi', label: 'Kalewadi' },
  { slug: 'pimple-saudagar', label: 'Pimple Saudagar' },
  { slug: 'pimple-nilakh', label: 'Pimple Nilakh' },
  { slug: 'pimple-gurav', label: 'Pimple Gurav' },
  { slug: 'chinchwad', label: 'Chinchwad' },
  { slug: 'pimpri', label: 'Pimpri' },
  { slug: 'nigdi', label: 'Nigdi' },
  { slug: 'akurdi', label: 'Akurdi' },
  { slug: 'chikhali', label: 'Chikhali' },
  { slug: 'moshi', label: 'Moshi' },
  { slug: 'talawade', label: 'Talawade' },
  { slug: 'dehu-road', label: 'Dehu Road' },
  { slug: 'kothrud', label: 'Kothrud' },
  { slug: 'warje', label: 'Warje' },
  { slug: 'karve-nagar', label: 'Karve Nagar' },
  { slug: 'shivane', label: 'Shivane' },
  { slug: 'dhayari', label: 'Dhayari' },
  { slug: 'narhe', label: 'Narhe' },
  { slug: 'nanded-city', label: 'Nanded City' },
  { slug: 'sinhagad-road', label: 'Sinhagad Road' },
  { slug: 'ambegaon', label: 'Ambegaon' },
  { slug: 'katraj', label: 'Katraj' },
  { slug: 'shivajinagar', label: 'Shivajinagar' },
  { slug: 'deccan', label: 'Deccan Gymkhana' },
  { slug: 'erandwane', label: 'Erandwane' },
  { slug: 'prabhat-road', label: 'Prabhat Road' },
  { slug: 'model-colony', label: 'Model Colony' },
  { slug: 'camp', label: 'Camp' },
  { slug: 'swargate', label: 'Swargate' },
  { slug: 'sadashiv-peth', label: 'Sadashiv Peth & the Peths' },
  { slug: 'kharadi', label: 'Kharadi' },
  { slug: 'viman-nagar', label: 'Viman Nagar' },
  { slug: 'kalyani-nagar', label: 'Kalyani Nagar' },
  { slug: 'koregaon-park', label: 'Koregaon Park' },
  { slug: 'yerawada', label: 'Yerawada' },
  { slug: 'dhanori', label: 'Dhanori' },
  { slug: 'vishrantwadi', label: 'Vishrantwadi' },
  { slug: 'wagholi', label: 'Wagholi' },
  { slug: 'mundhwa', label: 'Mundhwa' },
  { slug: 'keshav-nagar', label: 'Keshav Nagar' },
  { slug: 'hadapsar', label: 'Hadapsar' },
  { slug: 'magarpatta', label: 'Magarpatta' },
  { slug: 'amanora', label: 'Amanora' },
  { slug: 'kondhwa', label: 'Kondhwa' },
  { slug: 'nibm', label: 'NIBM Road' },
  { slug: 'undri', label: 'Undri' },
  { slug: 'mohammadwadi', label: 'Mohammadwadi' },
  { slug: 'wanowrie', label: 'Wanowrie' },
  { slug: 'bibwewadi', label: 'Bibwewadi' },
  { slug: 'salisbury-park', label: 'Salisbury Park' },
];

/** The twelve shown first on Q1, in the design's order (website src/app/app/q/[n]/page.tsx POPULAR). */
export const POPULAR_LOCALITIES = [
  'kharadi',
  'baner',
  'wakad',
  'hinjewadi',
  'kothrud',
  'viman-nagar',
  'aundh',
  'hadapsar',
  'balewadi',
  'undri',
  'ravet',
  'magarpatta',
];

/** Label for a stored slug; tolerates one this build does not know. */
export function localityLabel(slug: string | null | undefined): string | null {
  if (!slug) return null;
  const known = PUNE_LOCALITIES.find((l) => l.slug === slug)?.label;
  if (known) return known;
  return slug
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

export const TYPICAL_CARPET_SQFT: Record<PropertyType, number> = {
  BHK_1: 550,
  BHK_2: 850,
  BHK_3: 1150,
  BHK_4_PLUS: 1650,
  VILLA: 2200,
};

export const BEDROOMS: Record<PropertyType, number> = {
  BHK_1: 1,
  BHK_2: 2,
  BHK_3: 3,
  BHK_4_PLUS: 4,
  VILLA: 4,
};

/** The area to use for this brief: theirs, or the typical one for the home type. */
export function carpetAreaFor(brief: Pick<Brief, 'carpetAreaSqft' | 'propertyType'>): { sqft: number; assumed: boolean } {
  if (brief.carpetAreaSqft && brief.carpetAreaSqft > 0) return { sqft: brief.carpetAreaSqft, assumed: false };
  return { sqft: TYPICAL_CARPET_SQFT[brief.propertyType ?? 'BHK_2'], assumed: true };
}

export const TIERS: readonly BudgetTier[] = ['ESSENTIAL', 'PREMIUM', 'LUXURY'];

/** Rupees per sq ft; Luxury has no ceiling. Tier names stay English. */
export const TIER: Record<BudgetTier, { label: string; perSqftFrom: number; perSqftTo: number | null }> = {
  ESSENTIAL: { label: 'Essential', perSqftFrom: 1200, perSqftTo: 1800 },
  PREMIUM: { label: 'Premium', perSqftFrom: 1800, perSqftTo: 2500 },
  LUXURY: { label: 'Luxury', perSqftFrom: 2500, perSqftTo: null },
};

export function tierRangeFor(tier: BudgetTier, carpetAreaSqft: number): { lowPaise: Paise; highPaise: Paise | null } {
  const d = TIER[tier];
  return {
    lowPaise: Math.round(d.perSqftFrom * carpetAreaSqft * 100),
    highPaise: d.perSqftTo === null ? null : Math.round(d.perSqftTo * carpetAreaSqft * 100),
  };
}

export type Room = 'KITCHEN' | 'MASTER_BEDROOM' | 'SECOND_BEDROOM' | 'THIRD_BEDROOM' | 'LIVING_DINING' | 'BATHROOMS';

/** The rooms a single-room job or a renovation can pick, for this many bedrooms. */
export function roomsFor(bhk: number): Room[] {
  const all: { room: Room; minBhk: number }[] = [
    { room: 'KITCHEN', minBhk: 0 },
    { room: 'MASTER_BEDROOM', minBhk: 0 },
    { room: 'SECOND_BEDROOM', minBhk: 2 },
    { room: 'THIRD_BEDROOM', minBhk: 3 },
    { room: 'LIVING_DINING', minBhk: 0 },
    { room: 'BATHROOMS', minBhk: 0 },
  ];
  return all.filter((r) => r.minBhk <= bhk).map((r) => r.room);
}
