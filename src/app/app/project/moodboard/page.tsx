import type { Metadata } from 'next';
import Link from 'next/link';
import { Frame } from '@/components/app/ui';
import { loadPrepPack } from '@/modules/prepare/prep';
import { getCurrentUser } from '@/modules/auth/session';
import { hasLiveProject } from '@/modules/portal/project-store';
import { PrepClient } from '@/app/prepare/PrepClient';

export const metadata: Metadata = { title: 'Your mood board', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

/**
 * The customer's mood board inside the app (Studio OS Phase 2): where the
 * design card's "Fill your mood board" goes, on the website and in the phone
 * app's web view (which opens only /app pages). The same room boards as
 * "Your home" (/account#rooms), the ones the designer adds pieces to
 * (studio-design/design-flow.ts `addMoodBoardPieces`). The brief is the
 * signed-in customer's own (prepare/prep.ts `loadPrepPack`); nothing here
 * takes an id.
 */
export default async function AppMoodBoard() {
  const prep = await loadPrepPack();
  /* A studio's own client never fills in the choosing quiz: their project opens the board (owner, 1 Nov 2026). */
  const user = prep && !prep.brief.completedAt ? await getCurrentUser() : null;
  const open = Boolean(prep && (prep.brief.completedAt || (user && (await hasLiveProject(user.id)))));
  return (
    <Frame>
      <header className="oa-page-head">
        <span className="oa-meta">
          <Link href="/app/project">← Your project</Link>
        </span>
        <h1>Your mood board</h1>
      </header>
      <main className="oa-body">
        {prep && open ? (
          <>
            <p className="oa-meta" style={{ margin: 0 }}>
              Pick what you like for each room. Your designer sees it.
            </p>
            <PrepClient
              rooms={prep.plan.rooms.map((room) => ({ key: room.key, label: room.label, indicativePaise: room.indicativePaise }))}
              likes={prep.brief.styleLikes}
              dislikes={prep.brief.styleDislikes}
              tier={prep.brief.tier}
              initial={Object.fromEntries(
                prep.boards.map((board) => [
                  board.proposal.room,
                  { shuffle: board.state.shuffle, chosenOption: board.state.chosenOption, note: board.state.note, items: board.state.items },
                ]),
              )}
            />
          </>
        ) : (
          <p className="oa-meta" style={{ margin: 0 }}>
            Your mood board opens once you are signed in and your home&rsquo;s details are filled in.
          </p>
        )}
      </main>
    </Frame>
  );
}
