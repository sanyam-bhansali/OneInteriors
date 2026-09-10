/**
 * What would make this quote's range tighter.
 *
 * ## Why this exists
 *
 * Every quote is shown as a band, never a single number, because nobody has
 * seen the flat. That is the honest thing to do and we are not going to stop
 * doing it — but honesty here has a cost worth naming: people are
 * ambiguity-averse. Faced with "₹8.9L–₹13.4L" and a competitor's confident
 * "₹10,49,000", a lot of readers prefer the confident number even when they
 * know it is less reliable. An unexplained range reads as evasion.
 *
 * The fix is not to narrow the band dishonestly. It is to make the band
 * *actionable*: say how wide it is, and say the one thing that would tighten it
 * most. Ambiguity the reader can do something about stops being a reason to
 * leave and becomes the next step.
 *
 * ## Why only one action
 *
 * The variance model in `estimate.ts` adds a specific amount for each thing we
 * had to guess — property type is worth +15 points, carpet area +10, scope +5.
 * So the actions are not equally valuable, and listing all of them invites the
 * reader to do nothing. We name the largest one, in the same order the
 * estimator penalises them.
 *
 * Pure and tested. No `server-only` — see CONTRIBUTING §9.5.
 */

export interface NarrowingInput {
  /** ± this share, as the estimator produced it. 0.15 = ±15%. */
  variancePct: number;
  propertyTypeKnown: boolean;
  areaKnown: boolean;
  scopeKnown: boolean;
  /** Not yet collected anywhere, but the model already accounts for it. */
  floorPlanUploaded: boolean;
}

export interface Narrowing {
  /** "±22%", for showing beside the range. */
  spread: string;
  /**
   * The single most effective next step, phrased as something the customer
   * does. Null when the only remaining step is the site visit, which they
   * cannot do from here — the caller says that in its own words.
   */
  action: string | null;
  /**
   * True when the band is wide enough that we should be asking for more rather
   * than presenting the number as useful. Mirrors the estimator's own view.
   */
  tooWide: boolean;
}

/**
 * The threshold at which a band stops being informative.
 *
 * `estimate.ts` caps variance at 45% with the comment that past that point we
 * should be asking for more rather than showing a wider band. This is the
 * display side of that same judgement, set lower: by 25% the range spans a
 * third of its own midpoint and a customer cannot plan against it.
 */
const TOO_WIDE = 0.25;

export function narrowing(input: NarrowingInput): Narrowing {
  const spread = `±${Math.round(input.variancePct * 100)}%`;
  const tooWide = input.variancePct > TOO_WIDE;

  // In the estimator's own order of penalty. The biggest guess first, because
  // fixing it moves the number most.
  let action: string | null = null;
  if (!input.propertyTypeKnown) {
    action = 'Telling us your property type would tighten this more than anything else.';
  } else if (!input.areaKnown) {
    action = 'Your actual carpet area would tighten this considerably — we have used a typical figure.';
  } else if (!input.scopeKnown) {
    action = 'Telling us which rooms are in scope would tighten this.';
  } else if (!input.floorPlanUploaded) {
    action = 'A floor plan would tighten this further — it is the last thing we can use without visiting.';
  }

  return { spread, action, tooWide };
}
