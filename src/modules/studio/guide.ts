/**
 * The walkthrough — what it asks, and how it knows what is done.
 *
 * ## The rule that makes this worth building
 *
 * **Every step is something the studio actually does, and every step ticks
 * itself off from their real data.** Nothing here is "read this and press
 * next". A checklist somebody can complete without touching the product
 * teaches nothing and then lies about it afterwards, and the second time they
 * open the screen they are exactly as lost as the first.
 *
 * So `done` is always derived. There is no "mark as complete" action anywhere,
 * and the stored state holds only two things: which guides somebody has
 * dismissed, and which they have opened. A studio that adds a client through
 * the ordinary form — never noticing the guide — finds step one already ticked
 * when they look, because it is true.
 *
 * ## Why two guides and not one tour of everything
 *
 * A single tour of the whole product is a tour nobody finishes. Each guide
 * lives on the screen it is about, opens on first arrival, and is three steps
 * because three is what somebody will do before deciding they have got the
 * idea.
 *
 * ## Dismissing is not completing
 *
 * "Skip" hides the panel and leaves every step honestly undone, and the header
 * keeps a quiet "Show me again". Somebody who skipped on Monday because they
 * were busy should be able to find it on Thursday.
 *
 * Pure, per CONTRIBUTING §9.5 — no `server-only`, so the screens, the server
 * actions and the tests all read the same definitions.
 */

export type GuideId = 'leads' | 'quotations';

export interface GuideStep {
  id: string;
  /** The instruction, in the imperative. Under ten words. */
  title: string;
  /** One line on why it is worth doing. Not a description of the UI. */
  why: string;
  /** Where the step is done, when it is somewhere else. */
  href?: string;
  /** The label on the link. */
  cta?: string;
}

export interface Guide {
  id: GuideId;
  title: string;
  /** One sentence, shown above the steps. */
  intro: string;
  steps: GuideStep[];
  /** What the panel says once every step is done. */
  done: string;
}

export const GUIDES: Record<GuideId, Guide> = {
  leads: {
    id: 'leads',
    title: 'Three things and this screen starts working',
    intro:
      'Everyone who might become work lives here — your walk-ins and referrals as much as anyone we send you.',
    steps: [
      {
        id: 'add',
        title: 'Add one person',
        why: 'The last one who rang you. Name and number is enough to start.',
      },
      {
        id: 'date',
        title: 'Put a date on what you owe them next',
        why: 'That date is the only reason this screen is worth opening twice — it is what turns a list into a queue.',
      },
      {
        id: 'move',
        title: 'Move somebody along the board',
        why: 'The columns are yours. Rename them in Settings to match how you actually work.',
        href: '/studio/settings/pipeline',
        cta: 'Rename your columns',
      },
    ],
    done: 'That is the whole screen. Everything else here is the same three things at scale.',
  },

  quotations: {
    id: 'quotations',
    title: 'Your first quotation, in three steps',
    intro:
      'A quotation goes out on your letterhead at your prices. Two of these are one-offs — you will never do them again.',
    steps: [
      {
        id: 'branding',
        title: 'Your studio details',
        why: 'Your registered name, address and GSTIN go at the top of every quotation. Once, and it is done.',
        href: '/studio/settings',
        cta: 'Fill in your details',
      },
      {
        id: 'rates',
        title: 'Price a few things in your catalogue',
        why: 'Every rate ships blank because we do not set your prices. Three or four is enough to write a quote — the rest can wait.',
        href: '/studio/products',
        cta: 'Open your catalogue',
      },
      {
        id: 'quote',
        title: 'Build one quotation',
        why: 'Pick from your catalogue room by room. Sizes and rates come across as a starting point and every one is editable.',
      },
    ],
    done: 'Every quotation from here is the third step on its own.',
  },
};

// ── Stored state ────────────────────────────────────────────────

export interface GuideState {
  /** Guides the person pressed Skip on. Hides the panel; completes nothing. */
  dismissed: GuideId[];
  /** Guides they have opened at least once. Used only to stop it auto-opening. */
  seen: GuideId[];
}

export const EMPTY_GUIDE_STATE: GuideState = { dismissed: [], seen: [] };

/**
 * Read the JSON column without trusting it.
 *
 * It is a loose JSON blob edited by successive versions of this file, so a row
 * written a year ago can hold guide ids that no longer exist and fields that
 * were since renamed. Anything unrecognised is dropped rather than crashing a
 * dashboard over a tour.
 */
export function parseGuideState(raw: unknown): GuideState {
  if (raw === null || typeof raw !== 'object') return EMPTY_GUIDE_STATE;
  const o = raw as Record<string, unknown>;
  const ids = (v: unknown): GuideId[] =>
    Array.isArray(v) ? v.filter((x): x is GuideId => x === 'leads' || x === 'quotations') : [];
  return { dismissed: ids(o.dismissed), seen: ids(o.seen) };
}

// ── Progress ────────────────────────────────────────────────────

/**
 * What the studio's real data says about each step.
 *
 * Every field here is a fact read from their own rows. The caller gathers
 * them; this module never queries, so the whole thing stays testable.
 */
export interface StudioFacts {
  clientCount: number;
  clientsWithFollowUp: number;
  /** Clients sitting anywhere other than the intake column. */
  clientsMovedOn: number;
  hasBranding: boolean;
  pricedProducts: number;
  quoteCount: number;
  quotesWithLines: number;
}

export interface Progress {
  stepId: string;
  done: boolean;
}

export function progressFor(guide: GuideId, facts: StudioFacts): Progress[] {
  if (guide === 'leads') {
    return [
      { stepId: 'add', done: facts.clientCount > 0 },
      { stepId: 'date', done: facts.clientsWithFollowUp > 0 },
      { stepId: 'move', done: facts.clientsMovedOn > 0 },
    ];
  }
  return [
    { stepId: 'branding', done: facts.hasBranding },
    { stepId: 'rates', done: facts.pricedProducts > 0 },
    { stepId: 'quote', done: facts.quotesWithLines > 0 },
  ];
}

export function completedCount(progress: Progress[]): number {
  return progress.filter((p) => p.done).length;
}

export function allDone(progress: Progress[]): boolean {
  return progress.length > 0 && progress.every((p) => p.done);
}

/**
 * The step to point at: the first one not yet done.
 *
 * First-undone rather than next-in-order, so somebody who priced their
 * catalogue before filling in their details is pointed at the details rather
 * than at something they have already finished.
 */
export function nextStep(guide: GuideId, facts: StudioFacts): GuideStep | null {
  const progress = progressFor(guide, facts);
  const pending = progress.find((p) => !p.done);
  if (!pending) return null;
  return GUIDES[guide].steps.find((s) => s.id === pending.stepId) ?? null;
}

/**
 * Whether to open the panel without being asked.
 *
 * Only when there is something left to do AND they have not skipped it. Once
 * every step is done the panel stops appearing on its own for good — a
 * completed checklist that keeps greeting you is clutter, and the studio has
 * demonstrably learned the screen.
 */
export function shouldOpen(guide: GuideId, state: GuideState, facts: StudioFacts): boolean {
  if (state.dismissed.includes(guide)) return false;
  return !allDone(progressFor(guide, facts));
}
