/**
 * The benefits pass — every benefit of booking through One Interiors, with its
 * honest state for this customer (plan §17.2): available now, or unlocks when
 * a named step happens.
 *
 * ## A benefit without terms is not shown
 *
 * Plan §17.3: copy that promises money needs a rule behind it — how much,
 * for what, when it is paid, what cancels it. A benefit with `terms: null`
 * appears on no screen; adding the sentence is the whole of turning one on.
 * Every benefit below has the owner's terms as of 30 Sep 2026.
 *
 * Pure, and tested.
 */

/** Where the customer is, in order. Each is a fact we hold, not a promise. */
export const STAGES = ['START', 'BRIEF_DONE', 'CALL_BOOKED', 'INTRODUCED', 'SIGNED', 'HANDOVER'] as const;
export type Stage = (typeof STAGES)[number];

const STAGE_WORDS: Record<Stage, string> = {
  START: 'now',
  BRIEF_DONE: 'once your brief is finished',
  CALL_BOOKED: 'once your expert call is booked',
  INTRODUCED: 'once we introduce you to a studio',
  SIGNED: 'when you sign with a studio through us',
  HANDOVER: 'when your home is handed over',
};

export interface Benefit {
  id: string;
  title: string;
  /** The sentence the customer reads — the terms. Null: not shown until written. */
  terms: string | null;
  unlocksAt: Stage;
  /**
   * The few words for a strip — "Up to ₹50,000 cashback". Rupees first
   * where there are rupees: that is what makes going direct feel like a loss.
   */
  short?: string;
}

export const BENEFITS: Benefit[] = [
  {
    id: 'verified',
    title: 'Verified studios',
    terms: 'Every studio you are shown has cleared our checks, each with its source and date.',
    unlocksAt: 'START',
    short: 'Verified studios only',
  },
  {
    id: 'instant-quote',
    title: 'A quote in seconds',
    terms: 'Every studio that fits prices your home the moment you see them, on the same lines.',
    unlocksAt: 'BRIEF_DONE',
  },
  {
    id: 'plain-compare',
    title: 'Comparison in plain words',
    terms: 'Put quotes side by side by room and by material, with a summary whose every figure is checked.',
    unlocksAt: 'BRIEF_DONE',
  },
  {
    id: 'unbiased-expert',
    title: 'An expert who is not selling',
    terms: 'No studio pays our experts. They are there to help you choose, not to sell you one.',
    unlocksAt: 'BRIEF_DONE',
    short: 'An architect who is not selling',
  },
  {
    id: 'curated-discount',
    title: 'One Interiors curated discount',
    terms: 'Studios that offer one show it as its own line on your quote — the same for every customer, never a struck-through price.',
    unlocksAt: 'SIGNED',
    short: 'Negotiated studio discounts',
  },
  // Terms written by the owner, 30 Sep 2026 (§17.3).
  {
    id: 'cashback',
    title: 'Cashback',
    terms:
      'Up to ₹50,000 back once you have signed with a studio through us and paid its first payment phase. If the project is cancelled before 20% of its value has been paid to the studio, the cashback is cancelled.',
    unlocksAt: 'SIGNED',
    short: 'Up to ₹50,000 cashback',
  },
  {
    id: 'referral',
    title: 'OneReferrals',
    terms:
      'Refer a friend. When their project with a studio chosen through us has its 20% advance paid, you get ₹10,000 — for every project that closes.',
    unlocksAt: 'START',
    short: '₹10,000 for every friend who builds',
  },
  {
    id: 'free-cab',
    title: 'Free cab to a studio',
    terms: 'After your expert call, when a studio meeting is scheduled, we book your cab to the studio — the first trip, from anywhere in Pune.',
    unlocksAt: 'INTRODUCED',
    short: 'Free cab to the studio',
  },
  {
    id: 'tracker',
    title: 'Project tracker',
    terms: 'Every stage of your home here, with its planned date, what is done and what has happened on site.',
    unlocksAt: 'SIGNED',
    short: 'Your project tracked, stage by stage',
  },
  {
    id: 'cinematic-shoot',
    title: 'Cinematic video of your home',
    terms:
      'When a studio chosen through us completes your home, we film it — a cinematic video, with a testimonial from you if you would like to give one, both yours to keep.',
    unlocksAt: 'HANDOVER',
    short: 'A cinematic film of your finished home',
  },
  {
    id: 'onehamper',
    title: 'OneHamper',
    terms: 'At handover, every home built through us gets OneHamper — a gift from us.',
    unlocksAt: 'HANDOVER',
    short: 'OneHamper at handover',
  },
];

/**
 * What booking through One Interiors gets you, for the surfaces a customer
 * sees before they have decided — the home page, the studio cards, the quote,
 * the compare page, a studio's profile. Money first, then the service.
 */
export const SHOWCASE_ORDER = [
  'cashback',
  'curated-discount',
  'free-cab',
  'unbiased-expert',
  'tracker',
  'cinematic-shoot',
  'onehamper',
  'referral',
] as const;

export interface ShowcaseItem {
  id: string;
  short: string;
  title: string;
  terms: string;
}

/** The showcase list: benefits with terms and a short label, in `SHOWCASE_ORDER`. */
export function showcase(benefits: Benefit[] = BENEFITS): ShowcaseItem[] {
  return SHOWCASE_ORDER.flatMap((id) => {
    const b = benefits.find((x) => x.id === id);
    return b && b.terms && b.short ? [{ id: b.id, short: b.short, title: b.title, terms: b.terms }] : [];
  });
}

export interface BenefitState {
  id: string;
  title: string;
  terms: string;
  state: 'available' | 'unlocks';
  /** "once your expert call is booked" — only when not yet available. */
  when: string | null;
}

/** The pass for a customer at this stage: shown benefits only, available first. */
export function benefitsPass(stage: Stage, benefits: Benefit[] = BENEFITS): BenefitState[] {
  const at = STAGES.indexOf(stage);
  return benefits
    .filter((b): b is Benefit & { terms: string } => b.terms !== null)
    .map((b) => {
      const open = STAGES.indexOf(b.unlocksAt) <= at;
      return {
        id: b.id,
        title: b.title,
        terms: b.terms,
        state: open ? ('available' as const) : ('unlocks' as const),
        when: open ? null : STAGE_WORDS[b.unlocksAt],
      };
    })
    .sort((a, b) => (a.state === b.state ? 0 : a.state === 'available' ? -1 : 1));
}

/** The furthest stage the facts support. */
export function stageOf(facts: {
  briefDone: boolean;
  callBooked: boolean;
  introduced: boolean;
  signed: boolean;
  /** The tracker's HANDOVER stage is marked done. */
  handedOver?: boolean;
}): Stage {
  if (facts.handedOver) return 'HANDOVER';
  if (facts.signed) return 'SIGNED';
  if (facts.introduced) return 'INTRODUCED';
  if (facts.callBooked) return 'CALL_BOOKED';
  if (facts.briefDone) return 'BRIEF_DONE';
  return 'START';
}

/** Is OneReferrals on? Only once its terms are written (referral.ts). */
export function referralsLive(benefits: Benefit[] = BENEFITS): boolean {
  return Boolean(benefits.find((b) => b.id === 'referral')?.terms);
}
