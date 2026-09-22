import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { BOARD_KINDS } from '@/modules/studio-practice/vocabulary';

/**
 * Drag and drop on the board.
 *
 * ## Why these are source assertions
 *
 * Every one of them is a property of how the pieces are wired, and each has a
 * failure mode that compiles, lints, type-checks and looks right on screen:
 *
 * - listeners on the card instead of the handle — every button on the card
 *   stops working, and the board stops scrolling on touch
 * - a bare stage id as the droppable id — grouping silently breaks, because
 *   five columns share one id
 * - no same-column guard — every aborted drag writes a move and a timeline
 *   line saying the card went from Enquiry to Enquiry
 * - a closed column rendered as a column — the drop is refused by
 *   `updateClient` after the card has already flown
 *
 * A rendering test would catch none of them without a full DOM and a
 * simulated pointer, and would still not catch the touch one.
 */

const ROOT = join(__dirname, '..');
const read = (p: string) => readFileSync(join(ROOT, p), 'utf8');
const stripComments = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

const board = stripComments(read('src/app/studio/clients/Board.tsx'));
const dnd = stripComments(read('src/app/studio/clients/Dnd.tsx'));

describe('a drag can never land somewhere the move would be refused', () => {
  it('only OPEN and WON are drawn as columns', () => {
    /**
     * `updateClient` refuses a move into a LOST column without a reason, and
     * a drag cannot supply one. What keeps that from ever happening is not a
     * check in the drag code — it is that closed columns are not rendered as
     * columns at all.
     *
     * So this asserts the thing the drag code depends on. If BOARD_KINDS ever
     * grows to include LOST, the drag layer needs a guard and this fails
     * first.
     */
    expect(BOARD_KINDS).toEqual(['OPEN', 'WON']);
    expect(board).toContain('stages.filter((s) => BOARD_KINDS.includes(s.kind))');
  });

  it('registers exactly one drop target per rendered column', () => {
    /* A second DropColumn anywhere — over the closed section, say — would be
       a drop target for a move that cannot succeed. */
    expect(board.match(/<DropColumn/g)).toHaveLength(1);
  });
});

describe('grouping does not collide', () => {
  it('namespaces the droppable id per group', () => {
    /**
     * When the board is grouped, every group draws the same set of columns. A
     * bare stage id would register five droppables sharing one id, and dnd-kit
     * cannot tell them apart — cards would land in whichever one it resolved
     * first, which is not the one under the cursor.
     */
    expect(board).toMatch(/dropId=\{`\$\{group\.label \|\| 'all'\}::\$\{stage\.id\}`\}/);
  });

  it('reads the real stage id from the droppable data, not from its id', () => {
    expect(dnd).toContain('over.data.current?.stageId');
    /* And refuses anything else, rather than coercing a namespaced id into a
       stage id that does not exist. */
    expect(dnd).toContain("if (typeof stageId !== 'string') return;");
  });
});

describe('the handle is the only draggable thing', () => {
  it('puts the listeners on the handle and the ref on the card', () => {
    /**
     * dnd-kit's `attributes` carry role="button" and tabIndex=0. On the card
     * — which already contains a phone link and four buttons — that is a
     * button wrapping buttons, and it makes the whole card a tab stop ahead
     * of its own controls. On touch it also fights the column's horizontal
     * scroll.
     */
    expect(board).toMatch(/<li\s+ref=\{cardRef\}/);

    /* `handleProps` must appear nowhere except on the DragHandle. */
    const withoutHandle = board.replace(/<DragHandle[\s\S]*?\/>/g, '');
    expect(withoutHandle).not.toContain('{...handleProps}');
  });

  it('opts the handle out of browser touch gestures, and nothing else', () => {
    /* `touch-none` on the card would stop the column scrolling. On the
       handle alone it is what lets a press-and-hold become a drag. */
    expect(dnd).toMatch(/touch-none/);
    expect(board).not.toContain('touch-none');
  });
});

describe('a drag that changes nothing writes nothing', () => {
  it('short-circuits a drop back into the same column', () => {
    /* Without this, every aborted drag writes a move AND a permanent
       timeline line reading "Moved from Enquiry to Enquiry". */
    expect(dnd).toContain('if (from === stageId) return;');
  });

  it('carries the origin stage on the draggable so the check needs no lookup', () => {
    expect(dnd).toMatch(/data: \{ stageId \}/);
  });
});

describe('the optimistic move cannot outlive the truth', () => {
  it('clears the override on success as well as on failure', () => {
    /**
     * The failure case is obvious. The success case is the one that bites:
     * the action revalidates, so the real rows arrive carrying the new stage
     * — and a surviving override would pin the card to OUR guess for as long
     * as the page lives, including if somebody else moved it elsewhere a
     * moment later.
     */
    const move = board.slice(board.indexOf('function moveCard'));
    const body = move.slice(0, move.indexOf('\n  }\n'));

    /* One unconditional clear, not one inside the error branch. */
    expect(body).toContain('delete next[clientId];');
    expect(body.indexOf('delete next[clientId];')).toBeLessThan(
      body.indexOf("if ('error' in result)"),
    );
  });

  it('stops a card being dragged while its own move is in flight', () => {
    /* Two moves racing each other, and the loser silently wins on the next
       refresh. */
    expect(board).toContain('draggable={!inFlight[client.id]}');
  });
});
