/**
 * The rules a studio's pipeline has to keep obeying while they edit it.
 *
 * Pure, and deliberately with NO `server-only` — CONTRIBUTING §9.5 — because
 * this is the part worth testing and Vitest cannot import a module that has it.
 *
 * ## Why these rules exist at all
 *
 * A studio can rename, reorder, recolour, add and delete columns. Every one of
 * those is safe except for the two that empty a category:
 *
 *   - Delete the last column that means "won" and no project can ever be
 *     started again. Nothing errors. `NewProject` simply renders a list with
 *     nothing in it, forever, three screens away from the settings page where
 *     the damage was done.
 *   - Delete the last "in play" column and new clients have nowhere to land.
 *
 * The other two kinds are less dramatic and still wrong: with no LOST column a
 * studio cannot close anything off, and with no DONE column finished work
 * stays on the board.
 *
 * So the check runs before the write, and it answers in the sentence a studio
 * owner should read rather than in a boolean.
 */

import type { StageKindName } from './vocabulary';

export interface StageShape {
  id: string;
  kind: StageKindName;
}

/**
 * Would this edit leave a kind with no column?
 *
 * `nextKind` of null means the stage is being deleted. Returns the sentence to
 * show, or null when the edit is safe.
 */
export function wouldStrand(
  stages: StageShape[],
  id: string,
  nextKind: StageKindName | null,
): string | null {
  const after = stages
    .map((s) => (s.id === id ? (nextKind === null ? null : { ...s, kind: nextKind }) : s))
    .filter((s): s is StageShape => s !== null);

  const has = (k: StageKindName) => after.some((s) => s.kind === k);

  if (!has('OPEN')) return 'You need at least one column for work still in play.';
  if (!has('WON')) {
    return 'You need at least one column that means the job was won — projects can only be started from one.';
  }
  if (!has('LOST')) return 'You need somewhere to put the ones that go.';
  if (!has('DONE')) return 'You need at least one column for finished work.';

  return null;
}

/**
 * The next sort order for a column appended to the end.
 *
 * Steps of ten so a future drag-to-reorder can drop something between two
 * columns without renumbering the whole list.
 */
export const STAGE_STEP = 10;

export function nextSortOrder(existing: { sortOrder: number }[]): number {
  return existing.reduce((max, s) => Math.max(max, s.sortOrder), 0) + STAGE_STEP;
}
