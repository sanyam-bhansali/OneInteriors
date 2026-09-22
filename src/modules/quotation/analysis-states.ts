/**
 * Where a studio's archive is, and where each rate derived from it is.
 *
 * Pure — no database, no `server-only` — so the screens can import the copy
 * and the tests can assert the progression without a connection.
 *
 * ## Two axes, deliberately
 *
 * `ArchiveState` (in the schema) says what OPS has done with an archive:
 * received, reading, filed, rejected. `AnalysisState` here says what the
 * MACHINE has done with it. They move independently, and the normal case is
 * the one that needs both: an archive fully read by the extractor and still
 * waiting on a person. Collapsing them into one column would make "read" and
 * "approved" the same fact, which is the specific thing this feature must
 * never do.
 */

export const ANALYSIS_STATES = [
  'NOT_STARTED',
  'READING',
  'READ',
  'FAILED',
  'UNAVAILABLE',
] as const;

export type AnalysisState = (typeof ANALYSIS_STATES)[number];

export function isAnalysisState(v: string): v is AnalysisState {
  return (ANALYSIS_STATES as readonly string[]).includes(v);
}

/**
 * What the studio is told, in their words rather than ours.
 *
 * Note that `READ` does not say "done" or "your rates are set". Reading the
 * documents and pricing a customer's home at those numbers are two different
 * events with a person in between, and a studio who believes the second has
 * happened will not answer when we ring about the first.
 */
export const ANALYSIS_COPY: Record<AnalysisState, { label: string; detail: string }> = {
  NOT_STARTED: {
    label: 'Not read yet',
    detail: 'Your files are with us. Reading starts on its own.',
  },
  READING: {
    label: 'Reading them now',
    detail: 'This takes a few minutes. You can close the page — it carries on without you.',
  },
  READ: {
    label: 'Read — waiting on us',
    detail:
      'We have pulled the line items out and worked out your rates. Somebody here checks them against your documents before they price anything.',
  },
  FAILED: {
    label: 'We could not read them',
    detail: 'Somebody here will look at these by hand. It does not hold your application up.',
  },
  UNAVAILABLE: {
    label: 'Being read by hand',
    detail: 'Automatic reading is switched off on this deployment. Somebody here reads them.',
  },
};

/**
 * A single rate's life.
 *
 * `SUPERSEDED` rather than deleting: a studio files a second archive a year
 * later and the old rate is what an existing quote was built on. Removing it
 * would make a quote we have already shown a customer untraceable.
 */
export const RATE_STATES = ['PENDING', 'LIVE', 'REJECTED', 'SUPERSEDED'] as const;
export type RateState = (typeof RATE_STATES)[number];

export function isRateState(v: string): v is RateState {
  return (RATE_STATES as readonly string[]).includes(v);
}

/**
 * How much weight one derived rate can carry.
 *
 * `MIN_QUOTATIONS_FOR_RATES` is 100 and the reasoning beside it stands: a
 * rate from a handful is one designer's mood. But the bar to *start* is now
 * twenty, so the honest arrangement is not to lower the threshold and say
 * nothing — it is to derive the rate anyway and mark how thin the evidence
 * under it is, on the screen where somebody approves it.
 *
 * Counted per RATE, never per archive. A studio can file forty quotations of
 * which three mention a mandir; the kitchen rate is solid and the mandir rate
 * is not, and one number for the whole archive cannot say that.
 */
export const MIN_QUOTATIONS_TO_START = 20;

/** Below this, a single unusual quote moves the median visibly. */
const THIN = 5;
/** At or above this, the median is doing real work. */
const SOLID = 20;

export type Confidence = 'thin' | 'fair' | 'solid';

export function confidenceOf(fromQuotations: number): Confidence {
  if (fromQuotations < THIN) return 'thin';
  if (fromQuotations < SOLID) return 'fair';
  return 'solid';
}

export const CONFIDENCE_COPY: Record<Confidence, string> = {
  thin: 'One or two quotes — check this one against the documents',
  fair: 'A handful of quotes. Reasonable, worth a glance',
  solid: 'Enough quotes for the median to mean something',
};

/**
 * One derived rate, as a screen sees it.
 *
 * Here rather than beside the store that builds it, for the reason
 * CONTRIBUTING §9.5 gives and `tests/server-only-boundary.test.ts` enforces:
 * a client component that needs this shape must be able to reach it without
 * importing from a `server-only` module. A type import is erased and would
 * survive, but the moment somebody reaches for `CONFIDENCE_COPY` beside it
 * the route stops building — so the vocabulary and the shape live together,
 * in the file with no I/O in it.
 *
 * No storage key and no archive id: this is what a rate looks like to
 * somebody reading it, and neither of those is theirs to know.
 */
export interface FiledRateView {
  id: string;
  code: string;
  ratePaise: number;
  fromQuotations: number;
  confidence: Confidence;
  spec: string | null;
  state: string;
  note: string | null;
}
