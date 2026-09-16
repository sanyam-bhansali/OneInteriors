/**
 * The studio funnel.
 *
 * ## Why this is the centrepiece of the analytics page
 *
 * A studio pays between ₹25,000 and ₹1,00,000 a month and the only question
 * they actually have is whether it is working. "Working" is not one number, and
 * the useful thing we can tell them is not a total — it is *where the drop is*.
 *
 * A studio shown forty times and introduced twice has a profile problem: people
 * see them and do not choose them. A studio introduced eight times and signing
 * none has a sales problem: people choose them and then do not sign. Those two
 * need opposite conversations, and until this existed neither we nor they could
 * tell which was happening.
 *
 * ## Why rates go null rather than zero
 *
 * The same rule the rest of the product follows. Two introductions out of three
 * briefs is not a 67% conversion rate, it is three data points — and a studio
 * shown a percentage computed from three events will plan against it. Below the
 * threshold the honest output is "not enough yet", which is also the answer
 * that stops us being asked to explain a number that means nothing.
 *
 * Pure and tested. No `server-only` — see CONTRIBUTING §9.5.
 */

export const FUNNEL_STAGES = [
  'shown',
  'opened',
  'compared',
  'namedInCall',
  'introduced',
  'signed',
] as const;

export type FunnelStage = (typeof FUNNEL_STAGES)[number];

export const STAGE_LABELS: Record<FunnelStage, string> = {
  shown: 'Shown in results',
  opened: 'Profile opened',
  compared: 'Taken to comparison',
  namedInCall: 'Named in an expert call',
  introduced: 'Introduced',
  signed: 'Signed',
};

export const STAGE_BLURBS: Record<FunnelStage, string> = {
  shown: 'A customer’s matches included you. This is what the subscription buys.',
  opened: 'They opened your profile and read it.',
  compared: 'They put you side by side with another studio.',
  namedInCall: 'They asked our expert to talk about you specifically.',
  introduced: 'We handed them to you, with their details.',
  signed: 'A contract exists.',
};

export type FunnelCounts = Record<FunnelStage, number>;

/**
 * Below this many at a stage, we do not compute a rate from it.
 *
 * Five is low, and deliberately so — a studio in month two should get *some*
 * signal. It is high enough that a single event cannot produce a headline
 * percentage, which is the failure this guards against.
 */
export const MIN_FOR_RATE = 5;

export interface FunnelStep {
  stage: FunnelStage;
  label: string;
  blurb: string;
  count: number;
  /** Share of the PREVIOUS stage, or null when there is not enough to say. */
  rateFromPrevious: number | null;
  /** Share of the first stage, or null. */
  rateFromShown: number | null;
}

export function buildFunnel(counts: FunnelCounts): FunnelStep[] {
  const shown = counts.shown;

  return FUNNEL_STAGES.map((stage, i) => {
    const count = counts[stage];
    const previous = i === 0 ? null : counts[FUNNEL_STAGES[i - 1]];

    return {
      stage,
      label: STAGE_LABELS[stage],
      blurb: STAGE_BLURBS[stage],
      count,
      rateFromPrevious:
        previous === null || previous < MIN_FOR_RATE
          ? null
          : capped(round1((count / previous) * 100)),
      rateFromShown: i === 0 || shown < MIN_FOR_RATE ? null : capped(round1((count / shown) * 100)),
    };
  });
}

export interface Diagnosis {
  /** The stage where the largest share is lost, or null when we cannot say. */
  stage: FunnelStage | null;
  /** What that most likely means, in the studio's own terms. */
  message: string | null;
}

/**
 * Where the drop is, and what it probably means.
 *
 * One diagnosis, not six. A page that annotates every stage says nothing; the
 * useful output is the single sentence a studio can act on this month.
 *
 * The messages are written to be *usable*, not encouraging. A studio told
 * "profile needs work" and given nothing to do will conclude we are managing
 * them rather than helping.
 */
export function diagnose(counts: FunnelCounts): Diagnosis {
  if (counts.shown < MIN_FOR_RATE) {
    return {
      stage: null,
      message:
        'Not enough has happened yet to say anything useful. Come back once you have appeared in a few more briefs.',
    };
  }

  const drops: { stage: FunnelStage; lost: number; message: string }[] = [];

  const push = (stage: FunnelStage, from: number, to: number, message: string) => {
    if (from < MIN_FOR_RATE) return;
    drops.push({ stage, lost: (from - to) / from, message });
  };

  push(
    'opened',
    counts.shown,
    counts.opened,
    'People are seeing you in results and not opening your profile. That is a first-impression problem — the headline and the first project image are doing the work, and neither is currently doing it.',
  );
  push(
    'compared',
    counts.opened,
    counts.compared,
    'People read your profile and do not take you further. Usually this is the price band reading wrong for the work shown, or a profile that does not say who you are NOT for.',
  );
  push(
    'namedInCall',
    counts.compared,
    counts.namedInCall,
    'You reach the comparison and then get left out of the call. That is where your quote sits against the others — worth going through your rate card with us.',
  );
  push(
    'introduced',
    counts.namedInCall,
    counts.introduced,
    'Customers ask about you on the call and then choose someone else. We can tell you what came up — it is the most useful half hour available to you.',
  );
  push(
    'signed',
    counts.introduced,
    counts.signed,
    'You are being introduced and not converting. Nothing upstream is wrong; this is what happens after we hand over, and it is yours to fix.',
  );

  if (drops.length === 0) return { stage: null, message: null };

  const worst = drops.reduce((a, b) => (b.lost > a.lost ? b : a));

  // A drop of less than a third is normal at every stage of a funnel like this,
  // and calling it out would manufacture a problem.
  if (worst.lost < 0.34) return { stage: null, message: null };

  return { stage: worst.stage, message: worst.message };
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

/**
 * These stages are a journey, not a strict nesting, so a rate can legitimately
 * exceed 100 and must not be shown that way.
 *
 * The comparison page can be reached from the match list without opening a
 * studio's profile first, so `compared` really can be larger than `opened` for
 * an honest reason. The shape of the funnel is still the useful thing; a studio
 * reading "126% of the step before" would only conclude the page is broken, and
 * would be right to wonder what else is.
 */
function capped(rate: number): number {
  return Math.min(rate, 100);
}
