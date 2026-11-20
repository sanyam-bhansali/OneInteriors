/**
 * Sort and filter on the Design board (owner, 20 Nov 2026: "Need to add sort
 * as well as filter in Design tab"). Pure: the page reads `?sort=`, `?cat=`
 * and `?show=` and narrows the lifecycle board with them; tested in
 * tests/board-view.test.ts. Every tab and the designer filter keep them.
 */

import type { BoardCard, LifecycleBoard } from './lifecycle-store';

export const BOARD_SORTS = {
  stars: 'Stars first',
  late: 'Most late first',
  ends: 'Design ends soonest',
  newest: 'Newest first',
  client: 'Client A–Z',
  /* Owner, 20 Nov 2026: "percentage completion ascending and descending". */
  'pct-desc': '% complete, highest first',
  'pct-asc': '% complete, lowest first',
} as const;
export type BoardSort = keyof typeof BOARD_SORTS;

export const BOARD_CATEGORIES = {
  Essential: 'Essential',
  Premium: 'Premium',
  Luxe: 'Luxe',
  none: 'No category',
} as const;
export type BoardCategory = keyof typeof BOARD_CATEGORIES;

export const BOARD_SHOWS = {
  late: 'Running late',
  client: 'Waiting on the client',
  us: 'Next move is ours',
  hold: 'On hold',
  carcass: 'On-site carcass',
} as const;
export type BoardShow = keyof typeof BOARD_SHOWS;

export interface BoardView {
  sort: BoardSort;
  cat: BoardCategory | null;
  show: BoardShow | null;
  /** The stage it is at (owner, 20 Nov 2026: "all stages filter"): a design step, an execution stage or a phase, as on the card. */
  stage: string | null;
}

const isKey = <T extends object>(map: T, v: unknown): v is keyof T => typeof v === 'string' && Object.prototype.hasOwnProperty.call(map, v);

/** The view from the address bar; anything unknown is dropped. */
export function readBoardView(q: { sort?: string; cat?: string; show?: string; stage?: string }): BoardView {
  const stage = typeof q.stage === 'string' ? q.stage.trim().slice(0, 120) : '';
  return {
    sort: isKey(BOARD_SORTS, q.sort) ? q.sort : 'stars',
    cat: isKey(BOARD_CATEGORIES, q.cat) ? q.cat : null,
    show: isKey(BOARD_SHOWS, q.show) ? q.show : null,
    stage: stage || null,
  };
}

/** "&sort=late&cat=Luxe" for links, leaving out the defaults. */
export function boardViewQuery(v: BoardView): string {
  return `${v.sort !== 'stars' ? `&sort=${v.sort}` : ''}${v.cat ? `&cat=${v.cat}` : ''}${v.show ? `&show=${v.show}` : ''}${v.stage ? `&stage=${encodeURIComponent(v.stage)}` : ''}`;
}

export const isDefaultView = (v: BoardView) => v.sort === 'stars' && !v.cat && !v.show && !v.stage;

type Card = Pick<BoardCard, 'priority' | 'lateDays' | 'client' | 'category' | 'blocker' | 'onSiteCarcass' | 'onHold' | 'designEndsOn' | 'startedOn' | 'pct' | 'stage' | 'stageOrder'>;

/** Every stage the cards are at, in plan order, with how many are there: the Stage filter's choices. */
export function stageChoices(cards: readonly Pick<BoardCard, 'stage' | 'stageOrder'>[]): { stage: string; count: number }[] {
  const by = new Map<string, { stage: string; count: number; order: number }>();
  for (const c of cards) {
    const e = by.get(c.stage) ?? { stage: c.stage, count: 0, order: c.stageOrder };
    e.count += 1;
    e.order = Math.min(e.order, c.stageOrder);
    by.set(c.stage, e);
  }
  return [...by.values()].sort((a, b) => a.order - b.order || a.stage.localeCompare(b.stage)).map(({ stage, count }) => ({ stage, count }));
}

export function keepCard(c: Card, v: BoardView): boolean {
  if (v.cat && (v.cat === 'none' ? c.category !== null : c.category !== v.cat)) return false;
  if (v.stage && c.stage !== v.stage) return false;
  switch (v.show) {
    case 'late':
      return c.lateDays > 0;
    case 'client':
      return c.blocker?.side === 'client';
    case 'us':
      return c.blocker?.side === 'studio';
    case 'hold':
      return c.onHold;
    case 'carcass':
      return c.onSiteCarcass;
    default:
      return true;
  }
}

const stars = (a: Card, b: Card) => (b.priority ?? 0) - (a.priority ?? 0) || b.lateDays - a.lateDays || a.client.localeCompare(b.client);

export function compareCards(sort: BoardSort): (a: Card, b: Card) => number {
  switch (sort) {
    case 'late':
      return (a, b) => b.lateDays - a.lateDays || stars(a, b);
    case 'ends':
      // Undated last.
      return (a, b) => (a.designEndsOn ?? '9999').localeCompare(b.designEndsOn ?? '9999') || stars(a, b);
    case 'newest':
      return (a, b) => (b.startedOn ?? '').localeCompare(a.startedOn ?? '') || stars(a, b);
    case 'client':
      return (a, b) => a.client.localeCompare(b.client, 'en-IN', { sensitivity: 'base' });
    case 'pct-desc':
      return (a, b) => b.pct - a.pct || stars(a, b);
    case 'pct-asc':
      return (a, b) => a.pct - b.pct || stars(a, b);
    default:
      return stars;
  }
}

/** The board with the view applied to every column. The default view leaves the board exactly as built. */
export function applyBoardView<B extends Pick<LifecycleBoard, 'design' | 'preExecution' | 'execution' | 'snags' | 'closed' | 'closures'>>(b: B, v: BoardView): B {
  if (isDefaultView(v)) return b;
  const by = compareCards(v.sort);
  const pick = (l: BoardCard[], resort = true) => {
    const kept = l.filter((c) => keepCard(c, v));
    return resort && v.sort !== 'stars' ? [...kept].sort(by) : kept;
  };
  // Execution keeps closures on top unless a sort is picked; snags keep most-snags first unless a sort is picked.
  return { ...b, design: pick(b.design), preExecution: pick(b.preExecution), execution: pick(b.execution), snags: pick(b.snags), closed: pick(b.closed), closures: pick(b.closures, false) };
}
