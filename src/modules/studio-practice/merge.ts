import 'server-only';

/**
 * Two cards, one person.
 *
 * ## How they get there
 *
 * `addClient` now refuses a duplicate phone and offers an override, and the
 * import path skips one. So the remaining routes are the ones no check can
 * close: the same person enquiring twice with two numbers, a spreadsheet
 * imported before the check existed, and an override somebody was right to
 * take at the time and wrong about afterwards.
 *
 * Which means merging is not a failure of the duplicate check. It is the tool
 * for the cases the check was never going to catch, and it has to exist for
 * the check to be allowed to be lenient.
 *
 * ## Nothing is ever deleted
 *
 * The loser is soft-deleted and stamped with `mergedIntoId`. Its timeline
 * stays attached to it rather than being copied over, because a history is a
 * record of what happened to THAT row and rewriting it onto another one would
 * make both accounts wrong.
 *
 * The survivor gets a line saying what was merged in and what came with it.
 * Between the two, the whole event is reconstructable — which is the test,
 * because a merge is the only operation here that makes two things into one
 * and somebody will ask about it in six months.
 *
 * ## What moves, and what does not
 *
 * Quotes and projects move, because they are work the studio did for a person
 * and the person is now one row. Events do not, for the reason above. The
 * survivor keeps its own name, stage and owner — a merge should not silently
 * change who is working a lead or where it sits on the board.
 *
 * Contact details are filled in only where the survivor is BLANK. Overwriting
 * a number somebody has been ringing successfully, with one from a card
 * nobody touched, is how a merge loses a customer.
 */

import { prisma } from '@/lib/prisma';
import { myStudioId } from '@/modules/studio-quote/store';
import { LIVE } from './demo-lead';
import { record } from './events';
import { normalisePhone } from './csv';

export interface DuplicateCandidate {
  id: string;
  name: string;
  phone: string | null;
  stageName: string;
  assignedToName: string | null;
  quoteCount: number;
  /** So the screen can say which one has more behind it. */
  eventCount: number;
  createdAt: Date;
}

export type MergeResult = { ok: true } | { ok: false; error: string };

/**
 * Other cards that might be the same person.
 *
 * Phone-exact only. Name matching sounds obvious and is a trap: "Sharma" is
 * not a person, and a fuzzy match that offers to merge two unrelated families
 * is a feature nobody will ever trust again after the first time.
 *
 * Includes binned rows, because a duplicate somebody already deleted is
 * exactly the one they would want to merge rather than restore.
 */
export async function duplicatesOf(clientId: string): Promise<DuplicateCandidate[]> {
  const studioId = await myStudioId();
  if (!studioId) return [];

  try {
    const me = await prisma.studioClient.findFirst({
      where: { id: clientId, studioId },
      select: { phone: true },
    });
    if (!me?.phone) return [];

    const digits = normalisePhone(me.phone);
    if (!digits) return [];

    const rows = await prisma.studioClient.findMany({
      where: {
        studioId,
        phone: digits,
        id: { not: clientId },
        isDemo: false,
        /* Not already merged away — offering to merge a row that has already
           been merged into a third card is how somebody creates a chain
           nobody can follow. */
        mergedIntoId: null,
      },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        name: true,
        phone: true,
        createdAt: true,
        stage: { select: { name: true } },
        assignedTo: { select: { user: { select: { name: true, email: true } } } },
        _count: { select: { quotes: true, events: true } },
      },
    });

    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      phone: r.phone,
      stageName: r.stage.name,
      assignedToName: r.assignedTo
        ? (r.assignedTo.user?.name?.trim() ||
          r.assignedTo.user?.email?.split('@')[0] ||
          'Someone')
        : null,
      quoteCount: r._count.quotes,
      eventCount: r._count.events,
      createdAt: r.createdAt,
    }));
  } catch (error) {
    console.error('[merge] duplicates read failed', error);
    return [];
  }
}

/**
 * Fold `loserId` into `keepId`.
 *
 * One transaction. A half-done merge — quotes moved, loser still live — is a
 * worse state than either card on its own, because the work now hangs off a
 * row the studio is not looking at.
 */
export async function mergeClients(keepId: string, loserId: string): Promise<MergeResult> {
  const studioId = await myStudioId();
  if (!studioId) return { ok: false, error: 'No studio on this account.' };
  if (keepId === loserId) return { ok: false, error: 'That is the same card.' };

  try {
    /* Both read under the studio scope before anything moves. Two ids from a
       form prove nothing, and a merge that trusted them could fold another
       studio's client into this one. */
    const [keep, loser] = await Promise.all([
      prisma.studioClient.findFirst({
        where: { id: keepId, studioId, ...LIVE },
        select: { id: true, name: true, phone: true, email: true, society: true, locality: true, config: true, carpetSqft: true, notes: true },
      }),
      prisma.studioClient.findFirst({
        where: { id: loserId, studioId, deletedAt: null, isDemo: false },
        select: { id: true, name: true, phone: true, email: true, society: true, locality: true, config: true, carpetSqft: true, notes: true, _count: { select: { quotes: true, projects: true } } },
      }),
    ]);

    if (!keep) return { ok: false, error: 'The card you are keeping is not available.' };
    if (!loser) return { ok: false, error: 'The other card is not yours, or is already gone.' };

    await prisma.$transaction(async (tx) => {
      /* Fill the gaps only. Overwriting a number somebody has been ringing
         successfully with one from a card nobody touched is how a merge
         loses a customer. */
      await tx.studioClient.update({
        where: { id: keep.id },
        data: {
          phone: keep.phone ?? loser.phone,
          email: keep.email ?? loser.email,
          society: keep.society ?? loser.society,
          locality: keep.locality ?? loser.locality,
          config: keep.config ?? loser.config,
          carpetSqft: keep.carpetSqft ?? loser.carpetSqft,
          /* Notes are APPENDED, not replaced. Both were written by somebody
             about the same person and picking one at random discards work. */
          notes: mergeNotes(keep.notes, loser.notes, loser.name),
        },
      });

      /* Work moves. A quotation belongs to the person, and the person is now
         one row. */
      await tx.studioQuote.updateMany({
        where: { clientId: loser.id, studioId },
        data: { clientId: keep.id },
      });
      await tx.studioProject.updateMany({
        where: { clientId: loser.id, studioId },
        data: { clientId: keep.id },
      });

      /* The loser goes to the bin, pointing at where it went. Its own events
         stay with it — a history is the record of what happened to THAT row,
         and rewriting it onto another would make both accounts wrong. */
      await tx.studioClient.update({
        where: { id: loser.id },
        data: {
          deletedAt: new Date(),
          mergedIntoId: keep.id,
          nextAction: null,
          nextActionOn: null,
        },
      });
    });

    const carried: string[] = [];
    if (loser._count.quotes > 0) {
      carried.push(`${loser._count.quotes} quotation${loser._count.quotes === 1 ? '' : 's'}`);
    }
    if (loser._count.projects > 0) {
      carried.push(`${loser._count.projects} project${loser._count.projects === 1 ? '' : 's'}`);
    }

    await Promise.all([
      record({
        studioId,
        clientId: keep.id,
        kind: 'NOTE',
        summary:
          `Merged in the duplicate card for ${loser.name}` +
          (carried.length > 0 ? `, bringing ${carried.join(' and ')}` : ''),
        meta: { mergedFrom: loser.id },
      }),
      /* Written on the loser too, so opening the old card explains itself
         rather than looking like a mysterious deletion. */
      record({
        studioId,
        clientId: loser.id,
        kind: 'NOTE',
        summary: `Merged into ${keep.name}. Everything recorded here was kept.`,
        meta: { mergedInto: keep.id },
      }),
    ]);

    return { ok: true };
  } catch (error) {
    console.error('[merge] failed', error);
    return { ok: false, error: 'That did not save.' };
  }
}

/**
 * Both sets of notes, attributed.
 *
 * Appended rather than replaced because both were written by somebody about
 * the same person, and choosing one discards work somebody did. The heading
 * says where the second half came from, so a studio reading it later can tell
 * two conversations apart.
 */
function mergeNotes(keep: string | null, loser: string | null, loserName: string): string | null {
  const a = keep?.trim();
  const b = loser?.trim();

  if (!b) return a ?? null;
  if (!a) return b;
  if (a === b) return a;
  return `${a}\n\n— from the merged card for ${loserName} —\n${b}`;
}
