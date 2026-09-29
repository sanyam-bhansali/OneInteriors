import 'server-only';

/**
 * Rebuilding a brief from only values we recognise.
 *
 * ## Why a posted brief cannot be trusted
 *
 * The customer's brief lives in their browser — it has to, there is no account
 * until much later — so `explainAction` receives it from the client. TypeScript
 * says `Brief`; the wire says whatever the caller sent.
 *
 * That matters here more than it usually would, because this particular brief
 * is interpolated into a **prompt**. `locality` is typed `string | null` and a
 * crafted client can post a paragraph of instructions in it. The output is
 * shown only back to the sender, so nobody else is harmed — but the product
 * would be printing arbitrary text under the words "Read by our AI", and a
 * screenshot of that is a problem whoever wrote it.
 *
 * So nothing is sanitised in place. The brief is **rebuilt** from a whitelist:
 * every enum checked against its own list, every number clamped, every string
 * either recognised or dropped. Anything unrecognised becomes null, and null is
 * a case the prompt already handles ("locality not given").
 */

import { cleanSociety } from '@/modules/brief/mapping';
import { ITEM, ROOMS, type Room } from '@/modules/quotation/catalogue';
import { TIERS } from '@/modules/quotation/tiers';
import {
  EMPTY_BRIEF,
  HOME_NEEDS,
  LANGUAGES,
  type PlanUse,
  PUNE_LOCALITIES,
  STYLE_TAGS,
  type Brief,
  type HomeNeed,
  type Household,
  type Involvement,
  type PossessionStatus,
  type PriorityFactor,
  type PropertyType,
  type ScopeType,
  type StyleTag,
} from '@/modules/brief/types';

const PROPERTY_TYPES: PropertyType[] = ['BHK_1', 'BHK_2', 'BHK_3', 'BHK_4_PLUS', 'VILLA'];
const SCOPES: ScopeType[] = ['FULL_HOME', 'KITCHEN_WARDROBE', 'SINGLE_ROOM', 'RENOVATION'];
const INVOLVEMENTS: Involvement[] = ['DECIDE_FOR_ME', 'COLLABORATE', 'APPROVE_EVERYTHING'];
const PRIORITIES = new Set<string>(['BUDGET', 'SPEED', 'DESIGN_AMBITION', 'MATERIAL_QUALITY']);
const POSSESSION: PossessionStatus[] = ['HAVE_KEYS', 'EXPECTED', 'NOT_SURE'];
const NEEDS = new Set<string>(HOME_NEEDS);
const ROOM_SET = new Set<string>(ROOMS);

/** A small count, or null. A household of 400 is a probe, not a family. */
function count(value: unknown, max = 12): number | null {
  if (typeof value !== 'number' || !Number.isInteger(value)) return null;
  return value >= 0 && value <= max ? value : null;
}

function household(value: unknown): Household | null {
  if (!value || typeof value !== 'object') return null;
  const h = value as Partial<Household>;
  const adults = count(h.adults);
  if (adults === null || adults < 1) return null;
  return {
    adults,
    children: count(h.children) ?? 0,
    elderly: count(h.elderly) ?? 0,
    pets: h.pets === true,
    worksFromHome: h.worksFromHome === true,
  };
}

type Locality = (typeof PUNE_LOCALITIES)[number]['slug'];
const LOCALITY_SLUGS = new Set<string>(PUNE_LOCALITIES.map((l) => l.slug));
const TAGS = new Set<string>(STYLE_TAGS);

/** ₹1 to ₹10 crore, in paise. Anything outside is a typo or a probe. */
const MIN_PAISE = 100;
const MAX_PAISE = 10_00_00_000_00;

function oneOf<T extends string>(value: unknown, allowed: readonly T[]): T | null {
  return typeof value === 'string' && (allowed as readonly string[]).includes(value) ? (value as T) : null;
}

function money(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  const rounded = Math.round(value);
  return rounded >= MIN_PAISE && rounded <= MAX_PAISE ? rounded : null;
}

function tags(value: unknown): StyleTag[] {
  if (!Array.isArray(value)) return [];
  // Capped as well as filtered: a thousand valid tags is still a prompt the
  // caller wrote.
  return [...new Set(value.filter((t): t is StyleTag => typeof t === 'string' && TAGS.has(t)))].slice(
    0,
    STYLE_TAGS.length,
  );
}

/**
 * The ranking, in order, with anything unrecognised or repeated dropped.
 *
 * Order is the whole meaning of this field — index 0 is what matters most — so
 * it is filtered in place rather than rebuilt from the allowed list.
 */
function priorities(value: unknown): PriorityFactor[] {
  if (!Array.isArray(value)) return [];
  return [
    ...new Set(value.filter((p): p is PriorityFactor => typeof p === 'string' && PRIORITIES.has(p))),
  ];
}

/**
 * A brief containing only what we recognise.
 *
 * Returns a real `Brief`, so callers keep their types — the fields that
 * matter to the prompt are the ones rebuilt here, and everything else falls
 * back to `EMPTY_BRIEF`.
 *
 * **Every field the matching engine reads must survive this.** The server
 * re-scores the brief it rebuilds here, and the card beside it was scored in
 * the browser on the brief as the customer wrote it. `priorityRanking` used to
 * be dropped, so the server scored a different brief: the card said 55% and
 * the sentence under it said 53%, on the same studio, on the same screen.
 * `tests/match-summary.test.ts` now scores both and requires them to agree.
 */
export function sanitiseBrief(input: unknown): Brief {
  const raw = (input ?? {}) as Partial<Brief>;

  const carpet =
    typeof raw.carpetAreaSqft === 'number' &&
    Number.isFinite(raw.carpetAreaSqft) &&
    raw.carpetAreaSqft > 50 &&
    raw.carpetAreaSqft < 20_000
      ? Math.round(raw.carpetAreaSqft)
      : null;

  return {
    ...EMPTY_BRIEF,
    propertyType: oneOf(raw.propertyType, PROPERTY_TYPES),
    scope: oneOf(raw.scope, SCOPES),
    involvement: oneOf(raw.involvement, INVOLVEMENTS),
    // The only free-text field that reaches the prompt, and it is checked
    // against the list of Pune localities we actually serve.
    locality:
      typeof raw.locality === 'string' && LOCALITY_SLUGS.has(raw.locality)
        ? (raw.locality as Locality)
        : null,
    carpetAreaSqft: carpet,
    budgetMinPaise: money(raw.budgetMinPaise),
    budgetMaxPaise: money(raw.budgetMaxPaise),
    styleLikes: tags(raw.styleLikes),
    styleDislikes: tags(raw.styleDislikes),
    priorityRanking: priorities(raw.priorityRanking),
    // The rest of the brief, for the written read (29 Sep): the engine does not
    // score these yet, but the read speaks to them. Rebuilt like everything
    // else here — the name and the number are deliberately NOT carried: the
    // privacy notice promises the model never receives them.
    household: household(raw.household),
    needs: Array.isArray(raw.needs)
      ? [...new Set(raw.needs.filter((n): n is HomeNeed => typeof n === 'string' && NEEDS.has(n)))]
      : [],
    possessionStatus: oneOf(raw.possessionStatus, POSSESSION),
    possessionOn:
      typeof raw.possessionOn === 'string' && /^\d{4}-\d{2}(-\d{2})?$/.test(raw.possessionOn)
        ? raw.possessionOn.slice(0, 10)
        : null,
    // What match@2.0.0 filters and scores on (29 Sep): the band, the scope's
    // rooms and unticked items, the society (for "a home in your building" —
    // scored here, never put in the prompt), the plan's bathrooms and kitchen,
    // and the language tie-breaker.
    tier: oneOf(raw.tier, TIERS),
    society: cleanSociety(typeof raw.society === 'string' ? raw.society : null),
    scopeRooms: Array.isArray(raw.scopeRooms)
      ? [...new Set(raw.scopeRooms.filter((r): r is Room => typeof r === 'string' && ROOM_SET.has(r)))]
      : [],
    excludedItems: Array.isArray(raw.excludedItems)
      ? [...new Set(raw.excludedItems.filter((c): c is string => typeof c === 'string' && c in ITEM))]
      : [],
    planReading: planUse(raw.planReading),
    language: oneOf(raw.language, LANGUAGES),
  };
}

/** A confirmed plan reading, rebuilt field by field, or null. */
function planUse(value: unknown): PlanUse | null {
  if (!value || typeof value !== 'object') return null;
  const v = value as Partial<PlanUse>;
  const bathrooms = count(v.bathrooms, 8);
  if (bathrooms === null || bathrooms < 1) return null;
  const run =
    typeof v.kitchenRunMm === 'number' && v.kitchenRunMm >= 1500 && v.kitchenRunMm <= 9000
      ? Math.round(v.kitchenRunMm)
      : null;
  const sources = ['printed', 'computed', 'customer'] as const;
  return {
    kitchenRunMm: run,
    bathrooms,
    hasStudy: v.hasStudy === true,
    areaSource: oneOf(v.areaSource, sources),
  };
}
