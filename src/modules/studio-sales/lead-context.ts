/**
 * "Next lead →" (improvement 8, owner 22 Oct 2026): which list a lead page
 * was opened from. Pure, no `server-only`: the list, the board and Today
 * (browser) write the link, the lead page (server) reads it. Tested in
 * tests/studio-lead-context.test.ts.
 *
 * ## Why
 *
 * A salesperson working Calling 2 opens a lead, rings, logs the call, and
 * then has to go back, find their place in a list of 3,000 and open the
 * next one: forty times a morning. The lead page now knows the list it came
 * from, so after the call it offers the next lead in that same list.
 *
 * ## The context is the list's own query string
 *
 * `/studio/clients/<id>?from=<the list's query>`: the same filters and sort
 * the leads list puts in its URL (lead-filters.ts), plus which view. It is
 * parsed with the list's own parser and written back in its fixed order, so
 * anything unknown or malformed is dropped, never guessed, and the lead page
 * reads exactly the filters the list did. Nothing in it widens what anybody
 * sees: the server ANDs the person's scope around it (lead-where.ts
 * `scopedLeadWhere`), so a salesperson's next lead is always one of their
 * own, whatever the URL says.
 */

import { leadFiltersToQuery, parseLeadFilters, parseSort, type LeadFilters, type SortKey } from './lead-filters';

/** The lead page's param that carries the list. */
export const CONTEXT_PARAM = 'from';

/** Longer than this is not a list query anybody's browser wrote. */
const MAX_CONTEXT = 2000;

export type ContextView = 'list' | 'board' | 'today';

export interface ListContext {
  filters: LeadFilters;
  sort: SortKey;
  view: ContextView;
  /** The context, cleaned, as it goes back into a link. */
  query: string;
}

const VIEWS: readonly ContextView[] = ['list', 'board', 'today'];

/** Today's lead links: the leads list's Today card (calls and tasks due today, untouched new leads), soonest call first. */
export const TODAY_CONTEXT = 'kpi=today&sort=followup&view=today';

function canonical(filters: LeadFilters, sort: SortKey, view: ContextView): string {
  const q = leadFiltersToQuery(filters);
  return [q, sort !== 'newest' ? `sort=${sort}` : '', `view=${view}`].filter(Boolean).join('&');
}

/**
 * A list query, cleaned: the leads list's filters and sort (unknown params
 * dropped, list cursors like `after` dropped), and the view. Null for
 * nothing usable.
 */
export function readListContext(raw: unknown): ListContext | null {
  if (typeof raw !== 'string' || raw.length === 0 || raw.length > MAX_CONTEXT) return null;
  let params: URLSearchParams;
  try {
    params = new URLSearchParams(raw.startsWith('?') ? raw.slice(1) : raw);
  } catch {
    return null;
  }
  const filters = parseLeadFilters(params);
  const sort = parseSort(params.get('sort'));
  const askedView = params.get('view');
  const view: ContextView = askedView && (VIEWS as readonly string[]).includes(askedView) ? (askedView as ContextView) : 'list';
  return { filters, sort, view, query: canonical(filters, sort, view) };
}

/** A lead's page, remembering the list it was opened from (a bare link when there is none). */
export function leadHrefIn(id: string, listQuery: string | null | undefined): string {
  const base = `/studio/clients/${encodeURIComponent(id)}`;
  const ctx = listQuery ? readListContext(listQuery) : null;
  return ctx ? `${base}?${CONTEXT_PARAM}=${encodeURIComponent(ctx.query)}` : base;
}

/** The list view's context: its filters and sort as the page has them. */
export function listViewContext(listQuery: string): string {
  return withView(listQuery, 'list');
}

/**
 * A board card's context: the board's filters with the stage filter set to
 * this column, newest first — the order the column itself shows.
 */
export function boardColumnContext(boardQuery: string, stageId: string): string {
  const ctx = readListContext(boardQuery);
  const filters: LeadFilters = { ...(ctx?.filters ?? {}), stage: [stageId] };
  return canonical(parseLeadFilters(new URLSearchParams(leadFiltersToQuery(filters))), 'newest', 'board');
}

function withView(query: string, view: ContextView): string {
  const p = new URLSearchParams(query.startsWith('?') ? query.slice(1) : query);
  p.set('view', view);
  return p.toString();
}

/** Where "Back to the list" goes: the list, board or Today it came from. */
export function backHref(ctx: ListContext): string {
  if (ctx.view === 'today') return '/studio/today';
  const p = new URLSearchParams(leadFiltersToQuery(ctx.filters));
  if (ctx.sort !== 'newest') p.set('sort', ctx.sort);
  p.set('view', ctx.view);
  return `/studio/clients?${p.toString()}`;
}

/** The words for the list on the lead page: "Calling 2", "Today", "your list". */
export function contextLabel(ctx: ListContext, stageName: (id: string) => string | null): string {
  if (ctx.view === 'today') return 'Today';
  const stages = ctx.filters.stage ?? [];
  if (stages.length === 1) return stageName(stages[0]!) ?? 'this column';
  return ctx.view === 'board' ? 'the board' : 'the list';
}

/** Whether a key press happened while the person is typing (the N shortcut must not fire then). */
export function isTypingTarget(t: { tagName?: string; isContentEditable?: boolean; type?: string } | null | undefined): boolean {
  if (!t) return false;
  if (t.isContentEditable) return true;
  const tag = (t.tagName ?? '').toUpperCase();
  if (tag === 'TEXTAREA' || tag === 'SELECT') return true;
  if (tag !== 'INPUT') return false;
  /* Buttons and boxes are not typing. */
  return !['button', 'submit', 'reset', 'checkbox', 'radio', 'range', 'color', 'file', 'image'].includes((t.type ?? 'text').toLowerCase());
}
