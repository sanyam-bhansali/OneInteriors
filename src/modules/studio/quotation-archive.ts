/**
 * The rules around a studio's quotation archive — pure, so they can be tested
 * without a database or a storage bucket. CONTRIBUTING §9.5.
 *
 * ## Two thresholds, not one
 *
 * `MIN_QUOTATIONS_TO_SEND` (20) is how many make it worth sending at all.
 * `MIN_QUOTATIONS_FOR_RATES` (100, in the catalogue) is how many make a
 * derived rate trustworthy on its own.
 *
 * They are different numbers because they answer different questions, and
 * collapsing them into one is how this goes wrong in either direction. Hold
 * the bar at 100 and almost no Pune studio clears it, so everyone types forty
 * numbers from memory and the archive feature never gets used. Drop the bar to
 * 20 and call the result a filed rate card, and we are pricing somebody's home
 * off a median with twenty samples in it — where one unusual project visibly
 * moves the answer.
 *
 * So: twenty is enough for us to read and to draft from. A hundred is enough
 * for the draft to stand without the studio confirming every line. Below
 * twenty, the honest answer is the manual form, and saying so early is kinder
 * than letting somebody upload eight files and then hearing nothing.
 *
 * The manual form is never taken away. At any count, a studio that would
 * rather type can type — this only ever changes what we offer, never what is
 * available.
 */

/**
 * Fewer than this and there is nothing to derive from, so we do not ask.
 *
 * Twenty is a real archive for a young practice and about a quarter's work for
 * an established one. It is also, deliberately, low enough that a studio who
 * has been quoting for a year or two can clear it — the studios most helped by
 * not having to type their own rate card are exactly the ones least likely to
 * have a hundred quotations filed anywhere findable.
 */
export const MIN_QUOTATIONS_TO_SEND = 20;

export type ArchiveState = 'RECEIVED' | 'READING' | 'FILED' | 'REJECTED';

export interface ArchiveSummary {
  state: ArchiveState;
  /** How many quotations ops counted. Null until somebody has opened them. */
  quotationCount: number | null;
  fileCount: number;
  note: string | null;
}

/**
 * How confident a derived rate card can honestly be.
 *
 *  - `none`     — too few to derive anything from.
 *  - `draft`    — derived, but the studio confirms it line by line first.
 *  - `filed`    — enough quotations that the median means something.
 */
export type RateConfidence = 'none' | 'draft' | 'filed';

export function confidenceFor(
  quotationCount: number | null,
  minForRates: number,
): RateConfidence {
  if (quotationCount === null || quotationCount < MIN_QUOTATIONS_TO_SEND) return 'none';
  return quotationCount >= minForRates ? 'filed' : 'draft';
}

/**
 * What the studio is told about the archive they sent, in their words.
 *
 * Every branch says what happens next. A status with no next step is the thing
 * that makes people email asking what is going on, and this whole feature
 * exists to shorten a wait rather than to add one.
 */
export function studioMessage(summary: ArchiveSummary, minForRates: number): string {
  switch (summary.state) {
    case 'RECEIVED':
      return `${summary.fileCount} file${summary.fileCount === 1 ? '' : 's'} received. Somebody here opens these by hand — you will hear back within a few days, and you do not need to wait for us. Fill the rates in below if you would rather not.`;

    case 'READING':
      return 'We are reading through them now. If anything is unreadable or there are fewer quotations than we need, we will tell you exactly what is missing rather than going quiet.';

    case 'FILED': {
      const n = summary.quotationCount;
      if (n === null) return 'Your rates were built from the quotations you sent. Check every line below — they are yours, and you can change any of them.';
      const confidence = confidenceFor(n, minForRates);
      return confidence === 'filed'
        ? `Built from ${n} of your own quotations. Check them anyway — a rate you disagree with is a rate you should change, and nothing here is locked.`
        : `Built from ${n} of your own quotations. That is enough for a good starting point but not enough for us to stand behind it on its own, so please read every line before you send this for review.`;
    }

    case 'REJECTED':
      return summary.note?.trim()
        ? summary.note.trim()
        : 'We could not use what you sent. Fill the rates in below and we will take it from there.';
  }
}

/**
 * Should the manual rate form be the thing the studio is looking at?
 *
 * True in every state except a filed archive — because until rates exist, the
 * form is the only route forward, and hiding it behind "we are reading your
 * files" is how a studio ends up blocked on us for a week. Even when true, the
 * archive panel stays visible: the two are offered together, not swapped.
 */
export function manualFormLeads(summary: ArchiveSummary | null): boolean {
  return summary === null || summary.state !== 'FILED';
}
