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

import {
  EMPTY_BRIEF,
  PUNE_LOCALITIES,
  STYLE_TAGS,
  type Brief,
  type Involvement,
  type PropertyType,
  type ScopeType,
  type StyleTag,
} from '@/modules/brief/types';

const PROPERTY_TYPES: PropertyType[] = ['BHK_1', 'BHK_2', 'BHK_3', 'BHK_4_PLUS', 'VILLA'];
const SCOPES: ScopeType[] = ['FULL_HOME', 'KITCHEN_WARDROBE', 'SINGLE_ROOM', 'RENOVATION'];
const INVOLVEMENTS: Involvement[] = ['DECIDE_FOR_ME', 'COLLABORATE', 'APPROVE_EVERYTHING'];

type Locality = (typeof PUNE_LOCALITIES)[number]['slug'];
const LOCALITY_SLUGS = new Set<string>(PUNE_LOCALITIES.map((l) => l.slug));
const TAGS = new Set<string>(STYLE_TAGS);

/** ₹1 to ₹10 crore, in paise. Anything outside is a typo or a probe. */
const MIN_PAISE = 100;
const MAX_PAISE = 10_00_00_000_00;

function oneOf<T extends string>(value: unknown, allowed: T[]): T | null {
  return typeof value === 'string' && (allowed as string[]).includes(value) ? (value as T) : null;
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
 * A brief containing only what we recognise.
 *
 * Returns a real `Brief`, so callers keep their types — the fields that
 * matter to the prompt are the ones rebuilt here, and everything else falls
 * back to `EMPTY_BRIEF`.
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
  };
}
