/**
 * A note on a quotation line (owner's team, 15 Oct 2026): "each individual
 * element could have a note ... whenever they are printing the PDF, it should
 * be printed with that particular comment". Written in the builder, kept on
 * the line (`StudioQuoteLine.note`), carried into revisions and copies, and
 * printed under the line's details on the quotation PDF and the Final PDF.
 * Client-facing: it prints.
 *
 * Pure: the builder, the save and the tests share it.
 */

/** Longest note a line keeps: a few sentences for the client, not a document. */
export const LINE_NOTE_MAX = 1_000;

/** The field's label in the builder. */
export const LINE_NOTE_LABEL = 'Note for the client (prints on the PDF)';

/** A line's note as stored: trimmed, at most `LINE_NOTE_MAX` characters, blank as none. */
export function cleanNote(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const t = raw.replace(/\r/g, '').trim().slice(0, LINE_NOTE_MAX).trim();
  return t.length > 0 ? t : null;
}
