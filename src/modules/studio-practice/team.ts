import 'server-only';

/**
 * Who works at a studio, and what each of them is carrying.
 *
 * ## What this is for today
 *
 * One thing: knowing who a client can be assigned to. A studio with one
 * person does not need this screen at all, and the software should not make
 * them look at it — but the moment there are two, "who is chasing this one"
 * becomes the question the whole list is organised around.
 *
 * ## What it is not, yet
 *
 * Not seats, not invites, not billing. Members exist because somebody created
 * a `StudioMember` row; there is no way to invite from the interface and no
 * limit on how many there can be. That is the next piece of work and it sits
 * on top of this one.
 *
 * ## The counts
 *
 * Each member carries three numbers, and they are the three a studio owner
 * actually asks about on a Monday: how much is open, how much is overdue, and
 * how much has gone quiet. "Quiet" is the interesting one — a client with no
 * follow-up date at all never appears on an overdue list, so without this
 * number the busiest-looking person can be the one who has stopped booking
 * anything.
 *
 * Every query is scoped by the studio id from the session. Same rule as the
 * rest of this folder.
 */

import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/modules/auth/session';
import { myStudioId } from '@/modules/studio-quote/store';
import { BOARD_KINDS, QUIET_AFTER_DAYS } from './vocabulary';

// Defined in the pure module and re-exported here, so the board — a client
// component — can draw the same line this file counts on without importing
// a `server-only` module. CONTRIBUTING §9.5.
export { QUIET_AFTER_DAYS };

export interface MemberRow {
  id: string;
  /** Their name, or the local part of their email when they have not set one. */
  name: string;
  email: string | null;
  isOwner: boolean;
  /** Open clients assigned to them. */
  open: number;
  /** Of those, how many are past their follow-up date. */
  overdue: number;
  /** Of those, how many have had no contact in a week — or none ever. */
  quiet: number;
}

export interface TeamSnapshot {
  members: MemberRow[];
  /** Open clients nobody has taken. The pool. */
  unassigned: number;
}

function endOfToday(): Date {
  const d = new Date();
  d.setHours(23, 59, 59, 999);
  return d;
}

function quietBefore(): Date {
  const d = new Date();
  d.setDate(d.getDate() - QUIET_AFTER_DAYS);
  return d;
}

/**
 * A display name that is never blank.
 *
 * A studio member who signed in by magic link and never filled in a profile
 * has no name, and "undefined" or an empty chip in an assignment menu is
 * unusable. The local part of the email is what everybody calls each other in
 * a small office anyway.
 */
function displayName(name: string | null, email: string | null): string {
  if (name && name.trim().length > 0) return name.trim();
  if (email) return email.split('@')[0] ?? email;
  return 'Someone';
}

export async function myTeam(): Promise<TeamSnapshot> {
  const studioId = await myStudioId();
  if (!studioId) return { members: [], unassigned: 0 };

  try {
    const members = await prisma.studioMember.findMany({
      where: { studioId },
      orderBy: [{ isOwner: 'desc' }, { createdAt: 'asc' }],
      select: {
        id: true,
        isOwner: true,
        user: { select: { name: true, email: true } },
      },
    });

    // One pass over the open clients rather than three counts per member.
    // With a handful of people and a few hundred clients either is instant,
    // but the query count grows with the team and this one does not.
    const open = await prisma.studioClient.findMany({
      where: {
        studioId,
        deletedAt: null,
        stage: { kind: { in: BOARD_KINDS } },
      },
      select: { assignedToId: true, nextActionOn: true, lastContactedAt: true },
    });

    const today = endOfToday();
    const quietLine = quietBefore();

    const tally = new Map<string, { open: number; overdue: number; quiet: number }>();
    let unassigned = 0;

    for (const client of open) {
      if (!client.assignedToId) {
        unassigned += 1;
        continue;
      }

      const row = tally.get(client.assignedToId) ?? { open: 0, overdue: 0, quiet: 0 };
      row.open += 1;
      if (client.nextActionOn !== null && client.nextActionOn <= today) row.overdue += 1;
      // Never contacted counts as quiet. An imported list is entirely this,
      // and that is exactly the number somebody needs to see.
      if (client.lastContactedAt === null || client.lastContactedAt < quietLine) row.quiet += 1;
      tally.set(client.assignedToId, row);
    }

    return {
      unassigned,
      members: members.map((m) => {
        const counts = tally.get(m.id) ?? { open: 0, overdue: 0, quiet: 0 };
        return {
          id: m.id,
          name: displayName(m.user.name, m.user.email),
          email: m.user.email,
          isOwner: m.isOwner,
          ...counts,
        };
      }),
    };
  } catch (error) {
    console.error('[studio-practice] myTeam failed', error);
    return { members: [], unassigned: 0 };
  }
}

/** Just the names, for an assignment menu. */
export async function assignableMembers(): Promise<{ id: string; name: string }[]> {
  const { members } = await myTeam();
  return members.map((m) => ({ id: m.id, name: m.name }));
}

/**
 * The signed-in person's own membership row.
 *
 * Needed for "take it" — assigning something to yourself is the single most
 * common assignment and should not require picking your own name out of a
 * list of one.
 */
export async function myMembershipId(): Promise<string | null> {
  const studioId = await myStudioId();
  if (!studioId) return null;

  try {
    const user = await getCurrentUser();
    if (!user) return null;

    const member = await prisma.studioMember.findFirst({
      where: { studioId, userId: user.id },
      select: { id: true },
    });
    return member?.id ?? null;
  } catch {
    return null;
  }
}
