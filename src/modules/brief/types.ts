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
  budgetMinPaise: null,
  budgetMaxPaise: null,
  styleLikes: [],
  styleDislikes: [],
  household: null,
  priorityRanking: [],
  involvement: null,
  moveInBy: null,
  lastStep: 0,
  completedAt: null,
};

export const TOTAL_STEPS = 9;

/** Pune localities we currently have verified supply in. */
export const PUNE_LOCALITIES = [
  { slug: 'kharadi', label: 'Kharadi' },
  { slug: 'baner', label: 'Baner' },
  { slug: 'wakad', label: 'Wakad' },
  { slug: 'hinjewadi', label: 'Hinjewadi' },
  { slug: 'kothrud', label: 'Kothrud' },
  { slug: 'viman-nagar', label: 'Viman Nagar' },
  { slug: 'aundh', label: 'Aundh' },
  { slug: 'hadapsar', label: 'Hadapsar' },
  { slug: 'balewadi', label: 'Balewadi' },
  { slug: 'undri', label: 'Undri' },
  { slug: 'ravet', label: 'Ravet' },
  { slug: 'magarpatta', label: 'Magarpatta' },
] as const;

export const PROPERTY_LABELS: Record<PropertyType, string> = {
  BHK_1: '1 BHK',
  BHK_2: '2 BHK',
  BHK_3: '3 BHK',
  BHK_4_PLUS: '4+ BHK',
  VILLA: 'Villa / Row house',
};

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
