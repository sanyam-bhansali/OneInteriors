/**
 * Which project tables are append-only, and a scanner that finds code
 * breaking the rule (brief §2 and §4: site updates, snag events, payment
 * entries, date changes and the project event log are never edited or
 * deleted; corrections are new rows). Pure; tests/append-only.test.ts runs
 * it over every file in `src/`.
 *
 * Two levels:
 *
 * - `APPEND_ONLY_MODELS`: no `update`, `updateMany`, `updateManyAndReturn`,
 *   `delete`, `deleteMany` or `upsert` at all. A wrong row is corrected by a
 *   new row (`HomeSiteLog.correctsId`, a reversing `HomeQuoteChange`, a
 *   REOPENED snag event).
 * - `NEVER_DELETED_MODELS`: may be filled in after insert — the speech
 *   fields of a photo posted offline, the customer's confirm/dispute on a
 *   payment — but never deleted or upserted. A payment's amount, stage, day
 *   and mode are never changed: a correction is a new row with `correctsId`.
 *
 * Studio OS Phase 1 adds a quotation's sent revisions (`studioQuoteRevision`):
 * the copy a client received is never edited. Phase 2 adds the client's
 * answers to drawings (`homeDesignReview`) and design steps moved
 * (`homeStepDelay`). Phase 3 adds payments to crews (`homeCrewPayment`):
 * a mistake is reversed by a correction row, never edited.
 *
 * Rows still go when their project does (ON DELETE CASCADE): that is
 * erasure of the whole record, not an edit of it.
 */

/** Prisma client property names. */
export const APPEND_ONLY_MODELS = ['homeProjectEvent', 'homeSnagEvent', 'homeProjectDateChange', 'homeSiteLog', 'homeQuoteChange', 'studioQuoteRevision', 'homeDesignReview', 'homeStepDelay', 'homeCrewPayment'] as const;
export const NEVER_DELETED_MODELS = ['homeSiteLogPhoto', 'homeSiteLogCrew', 'homeProjectPayment'] as const;

/** The same, as table names, for raw SQL. */
export const APPEND_ONLY_TABLES = ['home_project_events', 'home_snag_events', 'home_project_date_changes', 'home_site_logs', 'home_quote_changes', 'studio_quote_revisions', 'home_design_reviews', 'home_step_delays', 'home_crew_payments'] as const;
export const NEVER_DELETED_TABLES = ['home_site_log_photos', 'home_site_log_crew', 'home_project_payments'] as const;

const EDITS = ['update', 'updateMany', 'updateManyAndReturn', 'delete', 'deleteMany', 'upsert'] as const;
const REMOVALS = ['delete', 'deleteMany', 'upsert'] as const;

export interface Mutation {
  /** Model or table name. */
  target: string;
  /** The method, or `UPDATE` / `DELETE` for raw SQL. */
  method: string;
  /** 1-based line in the source. */
  line: number;
}

/** Comments out of the way, keeping line numbers (code that explains the rule may quote the forbidden call). */
function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
    .replace(/(^|[^:'"`])\/\/.*$/gm, (_m, lead: string) => lead);
}

const lineAt = (src: string, index: number) => src.slice(0, index).split('\n').length;

function scan(src: string, models: readonly string[], methods: readonly string[], out: Mutation[]): void {
  const m = models.join('|');
  const f = methods.join('|');
  // prisma.homeSiteLog.update(…), tx?.homeSiteLog.deleteMany(…), homeSiteLog\n  .upsert(…)
  const dotted = new RegExp(`\\b(${m})\\b\\s*(?:\\?\\.|\\.)\\s*(${f})\\b\\s*\\(`, 'g');
  // tx['homeSiteLog'].update(…)
  const bracketed = new RegExp(`\\[\\s*['"\`](${m})['"\`]\\s*\\]\\s*(?:\\?\\.|\\.)\\s*(${f})\\b\\s*\\(`, 'g');
  for (const re of [dotted, bracketed]) {
    for (const hit of src.matchAll(re)) out.push({ target: hit[1]!, method: hit[2]!, line: lineAt(src, hit.index ?? 0) });
  }
}

function scanSql(src: string, tables: readonly string[], verbs: readonly ('UPDATE' | 'DELETE')[], out: Mutation[]): void {
  const t = tables.join('|');
  for (const verb of verbs) {
    const re = verb === 'UPDATE' ? new RegExp(`\\bUPDATE\\s+(?:"?public"?\\.)?"?(${t})"?\\b`, 'gi') : new RegExp(`\\bDELETE\\s+FROM\\s+(?:"?public"?\\.)?"?(${t})"?\\b`, 'gi');
    for (const hit of src.matchAll(re)) out.push({ target: hit[1]!, method: verb, line: lineAt(src, hit.index ?? 0) });
  }
}

/** Every edit or removal of an append-only row in this source, and every removal of a never-deleted one. */
export function findMutations(source: string): Mutation[] {
  const src = stripComments(source);
  const out: Mutation[] = [];
  scan(src, APPEND_ONLY_MODELS, EDITS, out);
  scan(src, NEVER_DELETED_MODELS, REMOVALS, out);
  scanSql(src, APPEND_ONLY_TABLES, ['UPDATE', 'DELETE'], out);
  scanSql(src, NEVER_DELETED_TABLES, ['DELETE'], out);
  return out.sort((a, b) => a.line - b.line);
}
