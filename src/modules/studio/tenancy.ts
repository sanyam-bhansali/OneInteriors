import 'server-only';
import { opensFullSoftware, planOf } from './software-plan';

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
import { OFFICE_MEMBER } from './surfaces';
import { isWriteRequest, staffViewFor } from './view-as';

export async function myStudioId(): Promise<string | null> {
  const user = await getCurrentUser();
  if (!user || !hasRole(user, 'STUDIO') || !hasDatabase()) return null;

  try {
    /* `StudioMember.userId` is unique — one studio per user. That uniqueness
       is the whole tenancy model, and it is enforced by the database rather
       than by this function.

       `OFFICE_MEMBER`: only an ACTIVE owner or project manager gets the
       studio id. Everything in studio-practice/ and studio-quote/ starts
       here, so a site supervisor, an accounts member, or anyone invited or
       suspended finds no studio in any office module (studio/surfaces.ts). */
    /* Developer access (owner, 22 Oct 2026; docs/studio-os/VIEW-AS.md): OPS
       or ADMIN with a live view gets the viewed member's studio, by the same
       OFFICE_MEMBER rule, on a read only. On a write request (a server
       action, or any method but GET/HEAD) they get no studio, so no office
       module has anywhere to write. Not viewing: exactly as before. */
    const view = await staffViewFor(user);
    if (view && (await isWriteRequest())) return null;
    const member = await prisma.studioMember.findUnique({
      where: view ? { id: view.memberId, studioId: view.studioId, ...OFFICE_MEMBER } : { userId: user.id, ...OFFICE_MEMBER },
      select: { studioId: true, role: true, studio: { select: { fullSoftware: true, softwarePlan: true } } },
    });
    /* The pilot switch (studio/pilot.ts): a project manager's office is the
       full software's, so in a studio without it they find no studio. */
    if (member && member.role === 'PM' && member.studio && !opensFullSoftware(planOf(member.studio))) return null;
    return member?.studioId ?? null;
  } catch {
    return null;
  }
}
