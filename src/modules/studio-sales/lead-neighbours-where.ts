import 'server-only';

/**
 * The keyset BEFORE a row (improvement 8, owner 22 Oct 2026): "← Previous"
 * on the lead page. lead-where.ts `keysetWhere` is the rows after a cursor
 * in the list's order; this is the rows before it, read in the reverse
 * order, so the first row is the one just above. Nulls mirror `orderByFor`:
 * the follow-up date sorts nulls last (so reversed, first), "longest since a
 * call" nulls first (so reversed, last). Tested in
 * tests/studio-lead-context.test.ts against the forward keyset.
 */

import type { Prisma } from '@prisma/client';
import type { Cursor, SortKey } from './lead-filters';

/** The list's order, reversed (nulls on the other side too). */
export function reverseOrderBy(sort: SortKey): Prisma.StudioClientOrderByWithRelationInput[] {
  switch (sort) {
    case 'oldest':
      return [{ createdAt: 'desc' }, { id: 'desc' }];
    case 'lastactive':
      return [{ updatedAt: 'asc' }, { id: 'asc' }];
    case 'followup':
      return [{ nextActionOn: { sort: 'desc', nulls: 'first' } }, { id: 'desc' }];
    case 'contacted':
      return [{ lastContactedAt: { sort: 'desc', nulls: 'last' } }, { id: 'desc' }];
    case 'name':
      return [{ name: 'desc' }, { id: 'desc' }];
    default:
      return [{ createdAt: 'asc' }, { id: 'asc' }];
  }
}

/** Rows before the cursor in the sort's order (read them with `reverseOrderBy`). */
export function keysetBeforeWhere(sort: SortKey, c: Cursor): Prisma.StudioClientWhereInput {
  if (sort === 'newest' || sort === 'lastactive') {
    const field = sort === 'newest' ? 'createdAt' : 'updatedAt';
    if (c.v === null) return { id: { gt: c.id } };
    const at = new Date(c.v);
    return { OR: [{ [field]: { gt: at } }, { [field]: at, id: { gt: c.id } }] } as Prisma.StudioClientWhereInput;
  }
  if (sort === 'followup') {
    /* Nulls last: before a null row are the earlier nulls and every dated row. */
    if (c.v === null) return { OR: [{ nextActionOn: null, id: { lt: c.id } }, { nextActionOn: { not: null } }] };
    const at = new Date(c.v);
    return { OR: [{ nextActionOn: { lt: at } }, { nextActionOn: at, id: { lt: c.id } }] };
  }
  if (sort === 'contacted') {
    /* Nulls first: before a null row are only the earlier nulls. */
    if (c.v === null) return { lastContactedAt: null, id: { lt: c.id } };
    const at = new Date(c.v);
    return { OR: [{ lastContactedAt: { lt: at } }, { lastContactedAt: at, id: { lt: c.id } }, { lastContactedAt: null }] };
  }
  if (c.v === null) return { id: { lt: c.id } };
  if (sort === 'name') return { OR: [{ name: { lt: c.v } }, { name: c.v, id: { lt: c.id } }] };
  const at = new Date(c.v);
  return { OR: [{ createdAt: { lt: at } }, { createdAt: at, id: { lt: c.id } }] };
}
