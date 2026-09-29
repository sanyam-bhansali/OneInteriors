/**
 * The benefits pass — every benefit of booking through One Interiors, with its
 * honest state for this customer (plan §17.2): available now, or unlocks when
 * a named step happens.
 *
 * ## A benefit without terms is not shown
 *
 * Plan §17.3, and the reason several benefits below have `terms: null`: copy
 * that promises money needs a rule behind it — how much, for what, when it is
 * paid, what cancels it. Until the owner writes those terms here, the benefit
 * does not appear on any screen. Adding the sentence is the whole of turning
 * one on.
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
  HANDOVER: 'at handover',
};

export interface Benefit {
  id: string;
  title: string;
  /** The sentence the customer reads — the terms. Null: not shown until written. */
  terms: string | null;
  unlocksAt: Stage;
}

export const BENEFITS: Benefit[] = [
  {
    id: 'verified',
    title: 'Verified studios',
    terms: 'Every studio you are shown has cleared our checks, each with its source and date.',
    unlocksAt: 'START',
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
  },
  {
    id: 'curated-discount',
    title: 'One Interiors curated discount',
    terms: 'Studios that offer one show it as its own line on your quote — the same for every customer, never a struck-through price.',
    unlocksAt: 'SIGNED',
  },
  // Terms to be written by the owner (§17.3) before these appear anywhere.
  { id: 'cashback', title: 'Cashback', terms: null, unlocksAt: 'SIGNED' },
  { id: 'referral', title: 'OneReferrals', terms: null, unlocksAt: 'START' },
  { id: 'free-cab', title: 'Free cab to a studio', terms: null, unlocksAt: 'CALL_BOOKED' },
  {
    id: 'tracker',
    title: 'Project tracker',
    terms: 'Every stage of your home here, with its planned date, what is done and what has happened on site.',
    unlocksAt: 'SIGNED',
  },
  { id: 'cinematic-shoot', title: 'Cinematic video of your home', terms: null, unlocksAt: 'HANDOVER' },
  { id: 'onehamper', title: 'OneHamper', terms: null, unlocksAt: 'HANDOVER' },
];

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
}): Stage {
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
