import 'server-only';

/**
 * Which studio the signed-in user belongs to. The tenancy primitive.
 *
 * ## Why this file exists
 *
 * Because there were two of these. One lived in `studio-quote/store.ts` — a
 * quotation module — and was imported by everything in `studio-practice` and
 * `studio-quote`. The other sat in `studio/dashboard.ts`, was a copy of the
 * first with the STUDIO role check missing, and had no callers at all.
 *
 * A second, weaker copy of the function that decides whose data you are
 * looking at is not a duplication worth tolerating. Whichever one a future
 * reader finds first becomes the one they call.
 *
 * So there is one implementation, here, in the module that owns studios.
 * `studio-quote/store.ts` re-exports it, which is why no import had to move.
 *
 * ## Why it returns null rather than throwing
 *
 * `requireRole` throws, and these are render-path reads. Next renders a layout
 * and its page in parallel, so a throw here beats the layout's redirect and
 * produces a 500 where a redirect belongs. The caller gets null and renders
 * nothing; the layout does the sending-home.
 *
 * ## What it does NOT do
 *
 * It does not scope anything. It hands back an id, and every query that uses
 * one still has to put it in a `where`. `tests/tenant-scope.test.ts` is what
 * enforces that, because — see its header — row-level security is not.
 */

import { prisma } from '@/lib/prisma';
import { hasDatabase } from '@/lib/env';
import { getCurrentUser, hasRole } from '@/modules/auth/session';

export async function myStudioId(): Promise<string | null> {
  const user = await getCurrentUser();
  if (!user || !hasRole(user, 'STUDIO') || !hasDatabase()) return null;

  try {
    /* `StudioMember.userId` is unique — one studio per user. That uniqueness
       is the whole tenancy model, and it is enforced by the database rather
       than by this function. */
    const member = await prisma.studioMember.findUnique({
      where: { userId: user.id },
      select: { studioId: true },
    });
    return member?.studioId ?? null;
  } catch {
    return null;
  }
}
