import 'server-only';

/**
 * The introduction → board bridge.
 *
 * `docs/STUDIO-CRM.md` promised this and never built it:
 *
 * > Clients that came through us are created automatically at the
 * > introduction, pre-filled from the brief. **That is the hook.**
 *
 * The columns have existed the whole time. `StudioClient.briefId`,
 * `introductionId`, the `@@unique([studioId, introductionId])` constraint and
 * the `ONE_INTERIORS` source value were all in the schema, and nothing wrote
 * any of them — the only code reading them was a display badge. A studio's
 * board could therefore only ever hold leads they typed themselves, which is
 * every other CRM they could buy, without the one thing we have.
 *
 * ## Why this file breaks the folder rule, deliberately
 *
 * `clients.ts` opens by stating the rule for `studio-practice`:
 *
 * > every query is scoped by the studio id from the session, and nothing here
 * > takes one as an argument.
 *
 * That rule is what makes the rest of the folder safe to review: a function
 * that cannot be told which studio to act on cannot be tricked into acting on
 * the wrong one.
 *
 * This file is the exception, and it has to be, because the actor is OPS
 * making an introduction on a studio's behalf — there is no studio session to
 * read from. So it takes a `studioId`, and in exchange:
 *
 * - it is not exported from `clients.ts` and nothing in `src/app/studio/`
 *   imports it;
 * - every function takes a transaction client, so it only ever runs inside a
 *   caller that has already established the right to act;
 * - it has no read path at all. Nothing here can return a studio's data; it
 *   can only write a row the studio was already entitled to.
 *
 * ## The contact promise decides when a card is created
 *
 * The landing page says, in these words:
 *
 * > no studio receives them until you tell an expert which introduction you
 * > want
 *
 * and `introduction-access.ts` exists to enforce exactly that. An introduction
 * can stand with contact unreleased — the studio is told a brief is coming and
 * nothing about who.
 *
 * `StudioClient.name` is required and is the card's label. So creating a card
 * at introduction time would mean either putting a real name on a board the
 * customer has not agreed to, or writing a placeholder name that is a lie on
 * the one surface where a leaked name is invisible to everybody except the
 * person it belongs to.
 *
 * **So the card is created at the moment of RELEASE, never at introduction.**
 * Both callers — `createIntroduction` when `releaseContact` is true, and
 * `releaseContactDetails` when it is not — call the same function here. A
 * studio with an unreleased introduction sees it on the introductions surface
 * and nothing lands on the board, which is correct: they are not yet allowed
 * to act.
 *
 * ## Failure is never fatal to the introduction
 *
 * Every entry point here swallows its own errors and reports them. An
 * introduction that did not save is a business event that did not happen; a
 * board card that did not appear is a row we can backfill. Letting the second
 * failure roll back the first would trade a recoverable problem for an
 * unrecoverable one — the same argument `resolveDefaultAssignee` makes in
 * AxLeads, for the same reason.
 */

import type { Prisma } from '@prisma/client';
import { paiseToLakhs, fromDb } from '@/lib/money';
import { cardFacts, FIRST_ACTION, firstActionOn, type BriefFacts } from './bridge-facts';
import { DEFAULT_STAGES } from './vocabulary';

/** What a bridge attempt did, for the audit trail. Never thrown. */
export type BridgeOutcome =
  | { kind: 'created'; clientId: string }
  /** The card already existed — a re-release, or a re-introduction. */
  | { kind: 'existing'; clientId: string }
  /** Nothing to put on a card: an anonymous brief with no consultation. */
  | { kind: 'no_contact' }
  | { kind: 'failed'; reason: string };

/** Anything that can run a query — `prisma` or a transaction client. */
type Db = Prisma.TransactionClient;

/**
 * Put an introduced customer on the studio's board.
 *
 * Safe to call more than once: the second call finds the row and reports
 * `existing`. That matters because `createIntroduction` upserts — re-introducing
 * after a withdrawal is a deliberate act — and a second card for the same
 * relationship would be two people to ring and one of them stale.
 */
export async function bridgeIntroduction(db: Db, introductionId: string): Promise<BridgeOutcome> {
  try {
    const intro = await db.introduction.findUnique({
      where: { id: introductionId },
      select: {
        id: true,
        studioId: true,
        briefId: true,
        consultationId: true,
        contactReleasedAt: true,
        withdrawnAt: true,
        introducedAt: true,
        brief: {
          select: {
            propertyType: true,
            carpetAreaSqft: true,
            locality: true,
            scope: true,
            tier: true,
            budgetMinPaise: true,
            budgetMaxPaise: true,
            moveInBy: true,
            possessionOn: true,
            user: { select: { name: true, phone: true, email: true } },
          },
        },
      },
    });

    if (!intro) return { kind: 'failed', reason: 'No such introduction.' };

    /* Both guards, not one. `canSeeContact` reads these two columns in this
       order for a reason — a withdrawn introduction that was previously
       released must come back false, and an `||` here would put a customer
       who asked to be removed onto the board of the studio they asked to be
       removed from. Re-derived rather than imported only because this needs
       to refuse, not explain. */
    if (intro.withdrawnAt) return { kind: 'failed', reason: 'Withdrawn.' };
    if (intro.contactReleasedAt === null) {
      return { kind: 'failed', reason: 'Contact not released — nothing may go on a board yet.' };
    }

    /* The constraint is the idempotency. Checking first is a courtesy that
       avoids a caught unique violation in the normal case; the constraint is
       what makes it correct under a double-submit. */
    const already = await db.studioClient.findUnique({
      where: {
        studioId_introductionId: { studioId: intro.studioId, introductionId: intro.id },
      },
      select: { id: true },
    });
    if (already) return { kind: 'existing', clientId: already.id };

    /* Identity comes from the consultation first, the account second.
       `Introduction.consultationId` is a plain column with no relation, so it
       cannot be nested and has to be a second query — the same shape
       `introduction-ops.ts` already uses. The consultation wins because an
       expert typed it while on the phone; the account's name may be whatever
       somebody entered to sign in. */
    const consultation = intro.consultationId
      ? await db.consultation.findUnique({
          where: { id: intro.consultationId },
          select: { contactName: true, contactPhone: true, contactEmail: true },
        })
      : null;

    const name = (consultation?.contactName ?? intro.brief?.user?.name ?? '').trim();
    const phone = (consultation?.contactPhone ?? intro.brief?.user?.phone ?? '').trim() || null;
    const email = (consultation?.contactEmail ?? intro.brief?.user?.email ?? '').trim() || null;

    /* An anonymous brief introduced without a consultation has nobody to put
       on a card. Not an error — a state. Reported so ops can see the
       introduction stands and the card does not, rather than a card appearing
       called "Unknown contact", which is what AxLeads' board is full of. */
    if (name.length < 2) return { kind: 'no_contact' };

    const facts: BriefFacts = {
      propertyType: intro.brief?.propertyType ?? null,
      carpetAreaSqft: intro.brief?.carpetAreaSqft ?? null,
      locality: intro.brief?.locality ?? null,
      scope: intro.brief?.scope ?? null,
      tier: intro.brief?.tier ?? null,
      budgetMinLakhs: lakhs(intro.brief?.budgetMinPaise),
      budgetMaxLakhs: lakhs(intro.brief?.budgetMaxPaise),
      moveInBy: intro.brief?.moveInBy ?? null,
      possessionOn: intro.brief?.possessionOn ?? null,
    };
    const card = cardFacts(facts);

    const stageId = await intakeStageFor(db, intro.studioId);
    if (!stageId) return { kind: 'failed', reason: 'That studio has no pipeline to land in.' };

    const created = await db.studioClient.create({
      data: {
        studioId: intro.studioId,
        stageId,
        name,
        phone,
        email,
        locality: card.locality,
        config: card.config,
        carpetSqft: card.carpetSqft,
        /* Written here and nowhere else. `addClient` rewrites this value to
           OTHER on purpose, so a studio cannot mark its own walk-in as one of
           ours — which is what keeps the one report that says whether the
           roster is worth paying for meaningful. */
        source: 'ONE_INTERIORS',
        sourceNote: `Introduced ${intro.introducedAt.toLocaleDateString('en-IN', {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
        })}`,
        notes: card.summary,
        /* Arrives with work attached. A card with no `nextActionOn` never
           appears on "waiting on you" — that list is ordered by it — so a
           lead created without one sinks the moment a second arrives. */
        nextAction: FIRST_ACTION,
        nextActionOn: firstActionOn(intro.introducedAt),
        briefId: intro.briefId,
        introductionId: intro.id,
        /* The pool, deliberately. We have no per-studio default assignee, and
           guessing one would hand a lead to somebody who is not expecting it.
           Unassigned is the same choice imports already make. */
        assignedToId: null,
      },
      select: { id: true },
    });

    return { kind: 'created', clientId: created.id };
  } catch (error) {
    console.error('[bridge] introduction → board failed', introductionId, error);
    return { kind: 'failed', reason: 'That did not save.' };
  }
}

/**
 * Take a withdrawn customer's identity off the studio's board.
 *
 * `withdrawIntroduction` already cancels future appointments, because leaving
 * a confirmed meeting standing against a withdrawn introduction is how a
 * studio turns up at a door they are no longer welcome at. The board card is
 * the same argument with more on it: a name, a phone number and an email.
 *
 * ## Why this redacts rather than bins
 *
 * The bin is a 30-day holding area with a restore button, and it renders the
 * name. Binning a withdrawn customer would leave their details one click away
 * from the studio that was asked to forget them, for a month.
 *
 * Deleting is not available either: `binClients` already refuses a client
 * carrying quotes or projects, and `StudioQuote` points at this row with
 * `onDelete: Restrict`. A studio that has done real work against this lead
 * would silently lose it.
 *
 * So: strip the identity, keep the row, and say what happened. The studio
 * learns the relationship ended and keeps their own work; the customer's
 * details are gone from every surface that could show them.
 *
 * The name has to be *something* — the column is required. "Withdrawn
 * enquiry" is a true statement, which a placeholder name is not.
 */
export async function redactWithdrawn(db: Db, introductionId: string): Promise<BridgeOutcome> {
  try {
    /* `updateMany` rather than `update`: an introduction with no card is the
       ordinary case — contact was never released — and that should be a
       no-op, not a thrown `RecordNotFound`. */
    const result = await db.studioClient.updateMany({
      where: { introductionId },
      data: {
        name: 'Withdrawn enquiry',
        phone: null,
        email: null,
        /* The next action goes too. A task called "Call and introduce
           yourself" against a customer who asked not to be called is the
           exact instruction this function exists to withdraw. */
        nextAction: null,
        nextActionOn: null,
        notes:
          'This customer asked One Interiors to withdraw the introduction. ' +
          'Their details have been removed. Anything you recorded is still here.',
      },
    });

    return result.count > 0 ? { kind: 'existing', clientId: '' } : { kind: 'no_contact' };
  } catch (error) {
    console.error('[bridge] redact on withdrawal failed', introductionId, error);
    return { kind: 'failed', reason: 'That did not save.' };
  }
}

/**
 * Where a bridged card lands, for a studio that is not the caller.
 *
 * `stages.ts` has `intakeStageId()`, and it reads the studio from the session
 * — correct for that whole file and useless here. This is the same decision
 * (`isIntake`, else the first column) against a studio id, including the
 * first-read seeding, because a studio introduced to before they have ever
 * opened their own board has no stages at all and the card has to land
 * somewhere.
 */
async function intakeStageFor(db: Db, studioId: string): Promise<string | null> {
  const pick = (rows: { id: string; isIntake: boolean }[]) =>
    rows.find((s) => s.isIntake)?.id ?? rows[0]?.id ?? null;

  const existing = await db.studioStage.findMany({
    where: { studioId },
    orderBy: { sortOrder: 'asc' },
    select: { id: true, isIntake: true },
  });
  if (existing.length > 0) return pick(existing);

  await db.studioStage.createMany({
    data: DEFAULT_STAGES.map((s, i) => ({
      studioId,
      name: s.name,
      kind: s.kind,
      colour: s.colour,
      isIntake: s.isIntake,
      sortOrder: (i + 1) * 10,
    })),
    skipDuplicates: true,
  });

  const seeded = await db.studioStage.findMany({
    where: { studioId },
    orderBy: { sortOrder: 'asc' },
    select: { id: true, isIntake: true },
  });
  return pick(seeded);
}

/** Paise (BigInt from Prisma) to lakh, or null. */
function lakhs(paise: bigint | null | undefined): number | null {
  return paise === null || paise === undefined ? null : paiseToLakhs(fromDb(paise));
}
