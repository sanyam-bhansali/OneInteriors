import 'server-only';

/**
 * Named filters, per person.
 *
 * AxLeads persists the live filter to `sessionStorage` and keeps it out of
 * the URL deliberately — *"a working view, not a shareable address"* — with
 * named presets in a table beside it. Both halves are right and they solve
 * different problems, so both are here:
 *
 * - The **live** filter belongs in the browser. It changes twenty times an
 *   hour, it is nobody else's business, and a round trip to save each change
 *   would make the board feel like a form. That half lives in `Board.tsx`.
 * - A **named** view belongs in the database, because the reason to name one
 *   is to still have it next Tuesday on a different machine.
 *
 * ## Per member
 *
 * `studioId` is stored so reads can be scoped the way everything in this
 * folder is, but the owner is the member. See the model docblock for why
 * these are not shared.
 */

import { prisma } from '@/lib/prisma';
import type { Prisma } from '@prisma/client';
import { myStudioId } from '@/modules/studio-quote/store';
import { myMembershipId } from './team';
import { cleanFilters, MAX_VIEWS, type ViewFilters } from './view-filters';

export type { ViewFilters } from './view-filters';

export interface SavedView {
  id: string;
  name: string;
  filters: ViewFilters;
  isDefault: boolean;
}

export type ViewResult = { ok: true } | { ok: false; error: string };

export async function myViews(): Promise<SavedView[]> {
  const memberId = await myMembershipId();
  if (!memberId) return [];

  try {
    const rows = await prisma.studioSavedView.findMany({
      where: { memberId },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
      select: { id: true, name: true, filters: true, isDefault: true },
    });

    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      /* Cleaned on the way OUT as well as in. A view saved before a filter was
         removed still holds the old key, and the board would otherwise apply
         a filter that no longer means anything — quietly showing the wrong
         rows, which is worse than the view failing to load. */
      filters: cleanFilters(r.filters),
      isDefault: r.isDefault,
    }));
  } catch (error) {
    console.error('[saved-views] read failed', error);
    return [];
  }
}

/**
 * Save the current filter under a name, or overwrite one of the same name.
 *
 * Upsert rather than refuse. Somebody typing a name they already used means
 * "update that one" far more often than it means an accident, and the
 * alternative — an error telling them to pick a different word — leaves them
 * with two views called nearly the same thing.
 */
export async function saveView(name: string, filters: unknown): Promise<ViewResult> {
  const studioId = await myStudioId();
  const memberId = await myMembershipId();
  if (!studioId || !memberId) return { ok: false, error: 'No studio on this account.' };

  const tidy = name.trim();
  if (tidy.length < 2) return { ok: false, error: 'Give it a name you will recognise.' };
  if (tidy.length > 40) return { ok: false, error: 'Shorter than forty characters, please.' };

  /* Cast at the boundary, not in the type. `ViewFilters` is a closed shape
     with named keys; Prisma's InputJsonObject wants an index signature. Widening
     ViewFilters to satisfy it would let any key through and defeat
     `cleanFilters`, which is the only thing standing between a browser and a
     JSONB column. */
  const clean = cleanFilters(filters) as Prisma.InputJsonObject;

  try {
    /* Counted before the write, and only for a NEW name — an overwrite is
       not a new row and should never be refused for a limit. The cap exists
       because every view is a control in a menu somebody has to read past,
       and twenty named filters is a second navigation problem. */
    const existing = await prisma.studioSavedView.findUnique({
      where: { memberId_name: { memberId, name: tidy } },
      select: { id: true },
    });

    if (!existing) {
      const count = await prisma.studioSavedView.count({ where: { memberId } });
      if (count >= MAX_VIEWS) {
        return {
          ok: false,
          error: `That is ${MAX_VIEWS} saved views. Delete one you no longer use first.`,
        };
      }
    }

    await prisma.studioSavedView.upsert({
      where: { memberId_name: { memberId, name: tidy } },
      create: { studioId, memberId, name: tidy, filters: clean },
      /* `isDefault` is untouched on update. Re-saving the view that opens
         your board should not quietly stop it being the one that opens. */
      update: { filters: clean },
    });

    return { ok: true };
  } catch (error) {
    console.error('[saved-views] save failed', error);
    return { ok: false, error: 'That did not save.' };
  }
}

/**
 * The view the board opens with. `null` clears it.
 *
 * At most one per member, enforced here in a transaction rather than by a
 * partial unique index — Prisma cannot express `WHERE isDefault` and a raw
 * index would drift from the schema silently. The transaction is the point:
 * clearing the old default and setting the new one have to be one step, or an
 * interrupted request leaves a member with two defaults and a board that
 * picks whichever sorted first.
 */
export async function setDefaultView(viewId: string | null): Promise<ViewResult> {
  const memberId = await myMembershipId();
  if (!memberId) return { ok: false, error: 'No studio on this account.' };

  try {
    await prisma.$transaction(async (tx) => {
      await tx.studioSavedView.updateMany({
        where: { memberId, isDefault: true },
        data: { isDefault: false },
      });

      if (viewId) {
        /* `updateMany` scoped by memberId: a view id from a form is not proof
           of ownership, and this matches nothing when it is somebody else's
           rather than starring their view. */
        await tx.studioSavedView.updateMany({
          where: { id: viewId, memberId },
          data: { isDefault: true },
        });
      }
    });

    return { ok: true };
  } catch (error) {
    console.error('[saved-views] default failed', error);
    return { ok: false, error: 'That did not save.' };
  }
}

export async function deleteView(viewId: string): Promise<ViewResult> {
  const memberId = await myMembershipId();
  if (!memberId) return { ok: false, error: 'No studio on this account.' };

  try {
    const { count } = await prisma.studioSavedView.deleteMany({
      where: { id: viewId, memberId },
    });
    if (count === 0) return { ok: false, error: 'That view is not yours.' };
    return { ok: true };
  } catch (error) {
    console.error('[saved-views] delete failed', error);
    return { ok: false, error: 'That did not save.' };
  }
}
