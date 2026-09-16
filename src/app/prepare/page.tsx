import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Container, Eyebrow } from '@/components/ui';
import { SiteHeader, SiteFooter } from '@/components/chrome';
import { BriefRescue } from '@/components/BriefRescue';
import { getCurrentUser } from '@/modules/auth/session';
import { loadPrepPack } from '@/modules/prepare/prep';
import { floorPlanUploadEnabled } from '@/modules/storage/floor-plan';
import { formatINRCompact } from '@/lib/money';
import { FloorPlanStep } from './FloorPlanStep';
import { PrepClient } from './PrepClient';

export const metadata: Metadata = {
  title: 'Before your call',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

/**
 * The prep pack — what a customer does between booking the expert call and
 * taking it.
 *
 * ## The problem this solves
 *
 * The old confirmation screen said "we'll call you" and then stopped. That is
 * a dead end at the single highest-intent moment in the whole funnel: they have
 * just given us a phone number and asked for help, and we hand them a page with
 * nothing on it. They go and fill in two more forms elsewhere, because sitting
 * still is not an option when you are about to spend nine lakh rupees.
 *
 * ## Why it is not a 3D planner
 *
 * That was the obvious answer and it is the wrong one — the reasoning is in
 * `rooms.ts`, and the short version is that a free canvas produces a home the
 * customer cannot afford, so the expert's first job on the call becomes taking
 * it away from them. Every room here carries its share of the budget from the
 * first screen, so the taste and the arithmetic arrive together.
 *
 * ## What it is not allowed to become
 *
 * A gate. Nobody has to do any of this to get their call, nothing here is
 * scored, and a customer who does none of it must not be treated differently
 * from one who does it all. The moment this page decides who gets served first,
 * it stops being preparation and becomes a qualification test.
 */
export default async function PreparePage() {
  const user = await getCurrentUser();
  if (!user) redirect('/sign-in?next=/prepare&reason=expert');

  const pack = await loadPrepPack();

  if (!pack || !pack.brief.completedAt) {
    return (
      <>
        <SiteHeader />
        <BriefRescue destination="your prep pack" />
        <SiteFooter />
      </>
    );
  }

  const { brief, plan, boards, spread } = pack;
  const touched = boards.filter(
    (b) =>
      b.state.chosenOption !== null ||
      b.state.note.trim() !== '' ||
      b.state.shuffle > 0 ||
      b.state.items.length > 0,
  ).length;

  return (
    <>
      <SiteHeader />

      <main className="py-10 sm:py-14">
        <Container size="wide">
          <Eyebrow>Before your call</Eyebrow>
          <h1 className="display mb-5 max-w-[22ch] text-[clamp(2rem,4.5vw,3rem)] leading-[1.02]">
            Half an hour of this is worth an hour on the call.
          </h1>
          {/* Capped at a readable measure inside a wide container, rather than
              the container being narrowed to cap it — the boards below need the
              width that this text does not. */}
          <p className="lede mb-4 max-w-[58ch]">
            Someone will ring within a working day. Until then, this is your home, room by room,
            with what each one costs already attached. Change what you like.
          </p>
          <p className="m-0 mb-10 max-w-[58ch] text-[15px] leading-relaxed text-[var(--color-ink-2)]">
            None of it is required and none of it is a test. It exists because the calls that go
            well are the ones where the customer already knows which three decisions they are
            actually making — and those are the ones below.
          </p>

          <FloorPlanStep
            existingName={brief.floorPlanName}
            knownArea={brief.carpetAreaSqft}
            spread={spread}
            uploadEnabled={floorPlanUploadEnabled()}
          />

          <div className="mb-6 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2">
            <h2 className="m-0 font-[family-name:var(--font-display)] text-[26px] leading-tight">
              Your rooms
            </h2>
            {touched > 0 ? (
              <span className="font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.1em] text-[var(--color-ink-3)]">
                {touched} of {boards.length} started
              </span>
            ) : null}
          </div>

          {/* The split is a planning figure and is labelled as one. Presenting
              it without this line would let it read as a quote, which it is
              not — no studio has priced a single room here. */}
          {plan.budgetSplit && brief.budgetMaxPaise !== null ? (
            <p className="m-0 mb-6 max-w-[58ch] text-[14.5px] leading-relaxed text-[var(--color-ink-3)]">
              We have split {formatINRCompact(brief.budgetMaxPaise)} across these rooms the way a
              Pune fit-out usually falls. It is a planning split, not a quote — the kitchen share
              surprises almost everyone, which is exactly why it is better to see it now than on the
              call.
            </p>
          ) : brief.scope === 'SINGLE_ROOM' ? (
            <p className="m-0 mb-6 max-w-[58ch] text-[14.5px] leading-relaxed text-[var(--color-ink-3)]">
              You told us one room, so we have not split your budget across the home — we know what
              you have, not which wall it belongs to. Work on whichever of these you meant.
            </p>
          ) : (
            /* No budget yet. Two different silences — a single-room scope and a
               missing budget both suppress the split — and telling someone they
               said "one room" when they did not is exactly the kind of small
               wrongness that makes a person stop trusting the rest of a page. */
            <p className="m-0 mb-6 max-w-[58ch] text-[14.5px] leading-relaxed text-[var(--color-ink-3)]">
              You have not set a budget yet, so there is nothing to split across these rooms. The
              taste part still works, and the expert can do the arithmetic with you on the call.
            </p>
          )}

          {/* The cards and the assembled board are one client island, because
              the board has to move the moment a card is shuffled. See
              PrepClient. */}
          <PrepClient
            rooms={plan.rooms.map((room) => ({
              key: room.key,
              label: room.label,
              indicativePaise: room.indicativePaise,
            }))}
            likes={brief.styleLikes}
            dislikes={brief.styleDislikes}
            tier={brief.tier}
            initial={Object.fromEntries(
              boards.map((board) => [
                board.proposal.room,
                {
                  shuffle: board.state.shuffle,
                  chosenOption: board.state.chosenOption,
                  note: board.state.note,
                  items: board.state.items,
                },
              ]),
            )}
          />

          <div className="mt-12 rounded-[14px] border-l-[3px] border-[var(--color-brass)] bg-[var(--color-paper-2)] p-6">
            <p className="label m-0 mb-2">What happens to all this</p>
            <p className="m-0 text-[15px] leading-relaxed text-[var(--color-ink-2)]">
              The expert reads it before they ring, so the call starts at the interesting part.
              Nothing here is shared with any studio until you have chosen one, and nothing you
              write is binding — a room you have marked one way today is a conversation on the
              call, not a decision you are held to.
            </p>
          </div>
        </Container>
      </main>

      <SiteFooter />
    </>
  );
}
