/**
 * Which parts of the studio software are open.
 *
 * ## Why this exists
 *
 * Six half-ready surfaces judged together are worse than two finished ones.
 * A pilot studio does not grade each screen separately — they open whatever is
 * in the sidebar, find the weakest one, and form a view of the whole product
 * from it. So for the pilot only Leads and Quotations are open, along with the
 * two screens the quotation builder cannot function without.
 *
 * ## Labelling is not enough
 *
 * A "soon" pill beside a link that still works is a sign on an unlocked door.
 * Old bookmarks, a typed URL, a link in a support email — all of them reach
 * the real screen. So the flag does two things: the rail stops linking, and
 * the route itself renders a coming-soon page. See `ComingSoon.tsx`.
 *
 * ## Nothing is deleted
 *
 * Every gated feature still has its full implementation — the projects board,
 * the vendor ledger, the calendar, the listing hub all work and all still have
 * their tests. Shipping one is flipping the boolean below. That is deliberate:
 * a feature ripped out to hide it is a feature rewritten to bring back.
 *
 * Pure, per CONTRIBUTING §9.5 — no `server-only`, so the nav, the route guards
 * and the tests all read the same object.
 */

export const STUDIO_FEATURES = {
  /** The client board. The pilot's first pillar. */
  leads: true,
  /** The quotation builder. The pilot's second pillar. */
  quotations: true,

  /**
   * Prerequisites, not features in their own right.
   *
   * A quotation carries the studio's registered name and is priced from their
   * own catalogue, so neither can be gated without the builder stopping work.
   * They are open, but they are no longer separate destinations in the rail —
   * the walkthrough walks people through them in the order they need them.
   * See `guide.ts`.
   */
  products: true,
  settings: true,

  /** Not in the pilot. */
  projects: false,
  vendors: false,
  calendar: false,
  listing: false,
} as const;

export type StudioFeature = keyof typeof STUDIO_FEATURES;

export function isLive(feature: StudioFeature): boolean {
  return STUDIO_FEATURES[feature];
}

/**
 * What a gated route says for itself.
 *
 * Written per feature rather than one generic line, because "coming soon" on
 * its own tells somebody nothing about whether to wait for it or go and find
 * another tool. Each of these says what the thing will do and, where it is
 * true, what to use in the meantime.
 */
export const COMING_SOON: Record<
  Exclude<StudioFeature, 'leads' | 'quotations' | 'products' | 'settings'>,
  { title: string; what: string; meanwhile: string | null }
> = {
  projects: {
    title: 'Project tracker',
    what: 'Every job you have won, with its contract figure, its dates and the work orders raised against the site.',
    meanwhile:
      'A client marked as booked on your board already holds the figure you agreed. Nothing is lost by waiting.',
  },
  vendors: {
    title: 'Vendors and payments',
    what: 'Your trades, what each is owed, and every work order against a running site.',
    meanwhile: null,
  },
  calendar: {
    title: 'Calendar',
    what: 'Meetings and site visits arranged after an expert call, with the times to confirm.',
    meanwhile: 'Until this opens we will ring you to fix a time, so nothing waits on this screen.',
  },
  listing: {
    title: 'Your listing',
    what: 'Your public profile, your portfolio and the rate card customers are matched against.',
    meanwhile: 'Your listing is live and unchanged. Tell us what you want edited and we will do it.',
  },
};
