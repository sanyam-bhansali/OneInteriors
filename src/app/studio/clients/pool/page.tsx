import type { Metadata } from 'next';
import { PageHead, PageBody } from '../../StudioShell';
import { myClients } from '@/modules/studio-practice/clients';
import { assignableMembers, myMembershipId } from '@/modules/studio-practice/team';
import { BOARD_KINDS } from '@/modules/studio-practice/vocabulary';
import { PoolList } from './Pool';

export const metadata: Metadata = {
  title: 'Pool — leads nobody has taken',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

/**
 * The pool: every open lead with no owner.
 *
 * ## Why this is a page now, and was not before
 *
 * The pool was built as a filter on the board — `Board.tsx` says so in as
 * many words: *"The pool is a filter on this board, not a second screen."*
 * That was a reasonable call for one person working alone, and it stopped
 * being one the moment a studio had a team.
 *
 * The giveaway was already in the code. `clients/actions.ts` has revalidated
 * `/studio/clients/pool` since the day assignment shipped, against a route
 * that did not exist. Somebody expected this screen to be here.
 *
 * The real argument for a page rather than a dropdown option: **the pool is
 * a different question.** The board asks "how is my work going"; the pool
 * asks "what is going undone". A studio owner checks the second one when
 * they arrive in the morning and again before they leave, and a question you
 * ask twice a day should not be three clicks into a filter menu that resets.
 *
 * ## Open columns only
 *
 * An unassigned client parked in "Handed over" is finished work, not a gap.
 * Counting it would put a number on the rail that can never reach zero, and a
 * badge that never clears is a badge a studio stops reading — which costs us
 * the one on Leads that does mean something.
 */
export default async function PoolPage() {
  const [all, members, me] = await Promise.all([
    myClients(),
    assignableMembers(),
    myMembershipId(),
  ]);

  const rows = all.filter(
    (c) => c.assignedToId === null && BOARD_KINDS.includes(c.stageKind),
  );

  /* Oldest first, which is the opposite of the board.
     The board leads with what is due; the pool leads with what has been
     waiting longest, because the cost of an untaken lead is entirely in how
     long it has sat there. */
  rows.sort((a, b) => a.updatedAt.getTime() - b.updatedAt.getTime());

  return (
    <>
      <PageHead
        title="Pool"
        sub={
          rows.length === 0
            ? 'Everything open has an owner.'
            : `${rows.length} ${rows.length === 1 ? 'lead has' : 'leads have'} nobody working on ${rows.length === 1 ? 'it' : 'them'}`
        }
      />
      <PageBody>
        <PoolList rows={rows} members={members} myMemberId={me} />
      </PageBody>
    </>
  );
}
