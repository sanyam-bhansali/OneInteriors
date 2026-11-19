/**
 * What an empty pool says (sales walkthrough, 19 Nov 2026): a search or a
 * filter that matched nothing said "every lead has an owner", which reads as
 * "the pool is empty" while it was full. Only an unfiltered pool says that.
 */
export function emptyPoolMessage(query: string, showingAll: boolean): string {
  const narrowed = [...new URLSearchParams(query).keys()].some((k) => !['owner', 'pool', 'sort', 'all', 'group'].includes(k));
  if (narrowed) return 'No pool leads match this search or these filters.';
  return showingAll ? 'No leads here.' : 'Nothing in the pool — every lead has an owner.';
}
