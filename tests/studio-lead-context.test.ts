import { describe, expect, it } from 'vitest';
import {
  CONTEXT_PARAM,
  TODAY_CONTEXT,
  backHref,
  boardColumnContext,
  contextLabel,
  isTypingTarget,
  leadHrefIn,
  listViewContext,
  readListContext,
} from '@/modules/studio-sales/lead-context';
import { cursorOf, parseCursor, SORTS, type SortKey } from '@/modules/studio-sales/lead-filters';
import { keysetWhere, orderByFor } from '@/modules/studio-sales/lead-where';
import { keysetBeforeWhere, reverseOrderBy } from '@/modules/studio-sales/lead-neighbours-where';

/**
 * "Next lead →" (improvement 8, owner 22 Oct 2026): the list context a lead
 * page carries, cleaned with the list's own parser, and the keysets either
 * side of a lead — checked against an in-memory list in every sort, nulls
 * and ties included.
 */

describe('the list context', () => {
  it('keeps the list’s filters, sort and view, in the list’s fixed order', () => {
    const ctx = readListContext('sort=followup&stage=c2&owner=me&view=list');
    expect(ctx).not.toBeNull();
    expect(ctx!.filters).toEqual({ stage: ['c2'], owner: 'me' });
    expect(ctx!.sort).toBe('followup');
    expect(ctx!.view).toBe('list');
    expect(ctx!.query).toBe('stage=c2&owner=me&sort=followup&view=list');
  });

  it('drops anything unknown or malformed, and list cursors', () => {
    const ctx = readListContext('?evil=1&after=%7B%22v%22%3Anull%7D&stage=c2;drop&kind=nope&sort=hack&due=overdue&view=admin');
    expect(ctx!.filters).toEqual({ due: ['overdue'] });
    expect(ctx!.sort).toBe('newest');
    expect(ctx!.view).toBe('list');
    expect(ctx!.query).toBe('due=overdue&view=list');
  });

  it('nothing usable is null; an empty list is still a list', () => {
    expect(readListContext(undefined)).toBeNull();
    expect(readListContext(['a'])).toBeNull();
    expect(readListContext('')).toBeNull();
    expect(readListContext('x'.repeat(2001))).toBeNull();
    expect(readListContext('view=board')!.query).toBe('view=board');
  });

  it('the same filters in any order read the same', () => {
    expect(readListContext('owner=me&stage=b,a')!.query).toBe(readListContext('stage=a&stage=b&owner=me')!.query);
  });

  it('custom fields and tags survive', () => {
    const ctx = readListContext('cf.bhk=3%20BHK&tag=hot&view=list');
    expect(ctx!.filters.custom).toEqual({ bhk: ['3 BHK'] });
    expect(ctx!.filters.tags).toEqual(['hot']);
  });
});

describe('links', () => {
  it('a lead link carries the cleaned list, encoded', () => {
    const href = leadHrefIn('lead1', listViewContext('stage=c2&sort=followup'));
    expect(href).toBe(`/studio/clients/lead1?${CONTEXT_PARAM}=${encodeURIComponent('stage=c2&sort=followup&view=list')}`);
    const back = new URL(href, 'https://x.test').searchParams.get(CONTEXT_PARAM);
    expect(readListContext(back)!.filters.stage).toEqual(['c2']);
  });

  it('no list, a bare link', () => {
    expect(leadHrefIn('lead1', null)).toBe('/studio/clients/lead1');
    expect(leadHrefIn('lead1', '')).toBe('/studio/clients/lead1');
  });

  it('a board card walks its own column, newest first, with the board’s other filters', () => {
    const ctx = readListContext(boardColumnContext('owner=me&stage=c1,c3&source=FACEBOOK', 'c2'))!;
    expect(ctx.filters).toEqual({ owner: 'me', stage: ['c2'], source: ['FACEBOOK'] });
    expect(ctx.sort).toBe('newest');
    expect(ctx.view).toBe('board');
  });

  it('a board column id that is not an id is dropped, not trusted', () => {
    const ctx = readListContext(boardColumnContext('', 'bad id; drop'))!;
    expect(ctx.filters.stage).toBeUndefined();
  });

  it('Today walks the Today card by next call', () => {
    const ctx = readListContext(TODAY_CONTEXT)!;
    expect(ctx.filters).toEqual({ kpi: 'today' });
    expect(ctx.sort).toBe('followup');
    expect(backHref(ctx)).toBe('/studio/today');
  });

  it('back goes to the list or board it came from', () => {
    expect(backHref(readListContext('stage=c2&sort=followup&view=list')!)).toBe('/studio/clients?stage=c2&sort=followup&view=list');
    expect(backHref(readListContext('view=board')!)).toBe('/studio/clients?view=board');
  });

  it('the label names the column when the list is one column', () => {
    const name = (id: string) => (id === 'c2' ? 'Calling 2' : null);
    expect(contextLabel(readListContext('stage=c2')!, name)).toBe('Calling 2');
    expect(contextLabel(readListContext('stage=zz')!, name)).toBe('this column');
    expect(contextLabel(readListContext('stage=c2,c3')!, name)).toBe('the list');
    expect(contextLabel(readListContext('view=board')!, name)).toBe('the board');
    expect(contextLabel(readListContext(TODAY_CONTEXT)!, name)).toBe('Today');
  });
});

describe('the N shortcut is not for typing', () => {
  it('text inputs, text areas, selects and editable text are typing', () => {
    expect(isTypingTarget({ tagName: 'INPUT', type: 'text' })).toBe(true);
    expect(isTypingTarget({ tagName: 'input' })).toBe(true);
    expect(isTypingTarget({ tagName: 'INPUT', type: 'search' })).toBe(true);
    expect(isTypingTarget({ tagName: 'TEXTAREA' })).toBe(true);
    expect(isTypingTarget({ tagName: 'SELECT' })).toBe(true);
    expect(isTypingTarget({ tagName: 'DIV', isContentEditable: true })).toBe(true);
  });

  it('buttons, boxes and the page are not', () => {
    expect(isTypingTarget({ tagName: 'INPUT', type: 'checkbox' })).toBe(false);
    expect(isTypingTarget({ tagName: 'INPUT', type: 'button' })).toBe(false);
    expect(isTypingTarget({ tagName: 'BUTTON' })).toBe(false);
    expect(isTypingTarget({ tagName: 'BODY' })).toBe(false);
    expect(isTypingTarget(null)).toBe(false);
  });
});

// ── The keysets either side, against an in-memory list ──────────

interface Row {
  id: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
  nextActionOn: Date | null;
  lastContactedAt: Date | null;
}

type Where = Record<string, unknown>;

/** Enough of Prisma's `where` for the keysets: AND, OR, equals (incl. null), lt/gt, not null. */
function matches(row: Row, w: Where): boolean {
  return Object.entries(w).every(([k, v]) => {
    if (k === 'AND') return (v as Where[]).every((x) => matches(row, x));
    if (k === 'OR') return (v as Where[]).some((x) => matches(row, x));
    const field = (row as unknown as Record<string, Date | string | null>)[k] ?? null;
    const val = (x: unknown) => (x instanceof Date ? x.getTime() : x);
    if (v === null) return field === null;
    if (v instanceof Date || typeof v === 'string') return field !== null && val(field) === val(v);
    const op = v as { lt?: unknown; gt?: unknown; not?: unknown };
    if ('not' in op) return op.not === null ? field !== null : val(field) !== val(op.not);
    if (field === null) return false;
    if ('lt' in op) return (val(field) as number | string) < (val(op.lt) as number | string);
    if ('gt' in op) return (val(field) as number | string) > (val(op.gt) as number | string);
    return false;
  });
}

type Order = Record<string, 'asc' | 'desc' | { sort: 'asc' | 'desc'; nulls: 'first' | 'last' }>;

function compare(a: Row, b: Row, order: Order[]): number {
  for (const o of order) {
    const [k, spec] = Object.entries(o)[0]!;
    const dir = typeof spec === 'string' ? spec : spec.sort;
    const nulls = typeof spec === 'string' ? (dir === 'asc' ? 'last' : 'first') : spec.nulls;
    const x = (a as unknown as Record<string, Date | string | null>)[k] ?? null;
    const y = (b as unknown as Record<string, Date | string | null>)[k] ?? null;
    if (x === null && y === null) continue;
    if (x === null) return nulls === 'first' ? -1 : 1;
    if (y === null) return nulls === 'first' ? 1 : -1;
    const xv = x instanceof Date ? x.getTime() : x;
    const yv = y instanceof Date ? y.getTime() : y;
    if (xv === yv) continue;
    return (xv < yv ? -1 : 1) * (dir === 'asc' ? 1 : -1);
  }
  return 0;
}

const d = (h: number | null) => (h === null ? null : new Date(Date.UTC(2026, 9, 20, h)));
const ROWS: Row[] = [
  { id: 'a1', name: 'Anil', createdAt: d(1)!, updatedAt: d(5)!, nextActionOn: d(9), lastContactedAt: null },
  { id: 'a2', name: 'Bela', createdAt: d(1)!, updatedAt: d(3)!, nextActionOn: null, lastContactedAt: d(2) },
  { id: 'a3', name: 'Bela', createdAt: d(2)!, updatedAt: d(5)!, nextActionOn: d(9), lastContactedAt: d(2) },
  { id: 'a4', name: 'Chetan', createdAt: d(3)!, updatedAt: d(1)!, nextActionOn: null, lastContactedAt: null },
  { id: 'a5', name: 'Dev', createdAt: d(3)!, updatedAt: d(7)!, nextActionOn: d(4), lastContactedAt: d(8) },
  { id: 'a6', name: 'Esha', createdAt: d(4)!, updatedAt: d(2)!, nextActionOn: null, lastContactedAt: null },
];

describe('previous and next, in every sort', () => {
  for (const sort of SORTS as readonly SortKey[]) {
    it(`${sort}: next is the row below, previous the row above, for every row`, () => {
      const sorted = [...ROWS].sort((a, b) => compare(a, b, orderByFor(sort) as Order[]));
      sorted.forEach((row, i) => {
        const cursor = parseCursor(cursorOf(sort, row))!;
        const after = sorted.filter((r) => r.id !== row.id && matches(r, keysetWhere(sort, cursor) as Where)).sort((a, b) => compare(a, b, orderByFor(sort) as Order[]));
        const before = sorted.filter((r) => r.id !== row.id && matches(r, keysetBeforeWhere(sort, cursor) as Where)).sort((a, b) => compare(a, b, reverseOrderBy(sort) as Order[]));
        expect(after[0]?.id ?? null, `next of ${row.id}`).toBe(sorted[i + 1]?.id ?? null);
        expect(before[0]?.id ?? null, `previous of ${row.id}`).toBe(sorted[i - 1]?.id ?? null);
        // Every other row is on exactly one side.
        expect(after.length + before.length).toBe(sorted.length - 1);
      });
    });
  }
});
