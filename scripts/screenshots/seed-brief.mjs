/**
 * A completed brief, for the screenshot run only.
 *
 * Why this exists: /match, /quotes and /compare render from `cachedRoster()`
 * and rank in the browser — no database needed, fixture studios are enough.
 * What they DO need is a brief. Without one, MatchClient's `briefed` guard is
 * false and every one of those pages renders the same "Tell us about your flat
 * first" gate.
 *
 * That gate returns HTTP 200, so the capture script counted it as a pass and
 * filed three identical pictures of an empty state under three different
 * names. A page that 200s with nothing in it is worse than a 404 — nobody
 * looks twice.
 *
 * The brief lives in sessionStorage (`oi.brief.v1`, see
 * src/modules/brief/store.ts), so it is injected per page via addInitScript
 * rather than seeded into any database.
 *
 * Keep the shape in sync with src/modules/brief/types.ts. If a field is added
 * there and not here, `isBriefComplete` may still pass while the page renders
 * a blank where that value should be.
 */

export const BRIEF_KEY = 'oi.brief.v1';

/** Deliberately a realistic Pune brief — this is what ends up in the pictures. */
export const DEMO_BRIEF = {
  // Q1 · property
  propertyType: 'BHK_2',
  carpetAreaSqft: 910,
  locality: 'baner',
  possessionOn: '2026-08-15',

  // Q2 · scope
  scope: 'FULL_HOME',
  tier: 'PREMIUM',

  // Q3 · budget, integer paise (₹6.4L – ₹8L)
  budgetMinPaise: 64_00_000 * 100,
  budgetMaxPaise: 80_00_000 * 100,

  // Q4 / Q5 · likes weight the score, dislikes are a hard filter
  styleLikes: ['warm-modern', 'japandi'],
  styleDislikes: ['classical-ornate', 'luxe-glam'],

  // Q6 · household
  household: { adults: 3, children: 0, elderly: 1, pets: false, worksFromHome: true },

  // Q7 · ranked, index 0 matters most
  priorityRanking: ['BUDGET', 'MATERIAL_QUALITY', 'SPEED', 'DESIGN_AMBITION'],

  // Q8 · working style
  involvement: 'COLLABORATE',

  // Q9 · timeline
  moveInBy: '2026-12-01',

  floorPlanName: null,
  lastStep: 9,
  completedAt: '2026-09-20T09:12:00.000Z',
};

/**
 * Routes that render an empty state without a brief.
 * /quiz is excluded on purpose — it should be photographed mid-question, not
 * already answered.
 */
export const NEEDS_BRIEF = new Set(['/tier', '/match', '/quotes', '/compare', '/expert']);

/**
 * Install the brief so it is present before any page script runs.
 * addInitScript re-runs on every navigation in the context, which is what we
 * want: sessionStorage is per-origin and survives within the context anyway,
 * but this makes the state explicit rather than order-dependent.
 */
export async function installBrief(page) {
  await page.addInitScript(
    ([key, brief]) => {
      try {
        window.sessionStorage.setItem(key, JSON.stringify(brief));
      } catch {
        /* Private mode. The page still renders its empty state, and the
           capture script's own guard will report it. */
      }
    },
    [BRIEF_KEY, DEMO_BRIEF],
  );
}
