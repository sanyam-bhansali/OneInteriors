import Link from 'next/link';
import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { Container, Eyebrow } from '@/components/ui';
import { SiteHeader, SiteFooter } from '@/components/chrome';
import { getCurrentUser } from '@/modules/auth/session';
import { loadDesign } from '@/modules/design-dna/store';
import { loadPrepPack } from '@/modules/prepare/prep';
import { PrepClient } from '@/app/prepare/PrepClient';
import { MockupRooms } from './MockupRooms';

export const metadata: Metadata = {
  title: 'Design your home',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';
/** Drawing three room ideas can take a while. */
export const maxDuration = 60;

/**
 * Design your home (owner, 4 Nov 2026), opened after the Home Profile and the
 * expert call request: 1) build a mood board per room, 2) see the Design DNA
 * it adds up to, 3) react to AI room ideas drawn from it, which reshape the DNA.
 */
export default async function DesignPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/sign-in?next=/account/design');

  const view = await loadDesign();

  return (
    <>
      <SiteHeader />
      <main className="py-10 sm:py-14">
        <Container size="default">
          <Eyebrow>Design your home</Eyebrow>
          <h1 className="display mb-3 text-[clamp(1.9rem,4vw,2.8rem)] leading-[1.03]">Your Design DNA</h1>

          {!view.open ? (
            <p className="lede mb-8 max-w-[58ch]">
              {view.why === 'no_call' ? (
                <>
                  This opens once your free architect call is booked.{' '}
                  <Link href="/expert" className="text-[var(--color-petrol)]">
                    Book your call
                  </Link>
                  .
                </>
              ) : (
                <>
                  First, tell us about your home.{' '}
                  <Link href="/quiz" className="text-[var(--color-petrol)]">
                    Start your Home Profile
                  </Link>
                  .
                </>
              )}
            </p>
          ) : (
            <DesignBody view={view} />
          )}

          <p className="m-0 mt-10 border-t border-[var(--color-rule)] pt-6">
            <Link href="/account/profile" className="text-[14px] text-[var(--color-petrol)]">
              ← My Home Profile
            </Link>
          </p>
        </Container>
      </main>
      <SiteFooter />
    </>
  );
}

async function DesignBody({ view }: { view: Extract<Awaited<ReturnType<typeof loadDesign>>, { open: true }> }) {
  const { dna } = view;
  const prep = await loadPrepPack();

  return (
    <>
      <p className="lede mb-8 max-w-[58ch]">
        Build a mood board for your rooms, and we turn it into your Design DNA. Then say yes or no to room ideas drawn
        in it, and the DNA gets sharper with every answer.
      </p>

      <section aria-label="Your Design DNA" className="mb-12 rounded-[16px] border border-[var(--color-rule)] p-5 sm:p-6">
        <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
          <p className="label m-0">Your Design DNA</p>
          <span className="text-[12.5px] text-[var(--color-ink-3)]">{dna.confidence}</span>
        </div>
        <p className="m-0 mb-4 text-[clamp(1.2rem,2.4vw,1.6rem)] leading-snug text-[var(--color-ink)]">
          {dna.shares.map((s) => `${s.pct}% ${s.label}`).join(' · ')}
        </p>
        <div className="mb-3 flex gap-2" aria-hidden>
          {dna.palette.map((c, i) => (
            <span key={`${c}-${i}`} className="h-9 w-9 rounded-full border border-[var(--color-rule)]" style={{ background: c }} />
          ))}
        </div>
        <p className="m-0 text-[14.5px] text-[var(--color-ink)]">{dna.moods.join(', ')}</p>
        <p className="m-0 mt-1 text-[14px] text-[var(--color-ink-2)]">Materials: {dna.materials.join(', ')}</p>
        {dna.budget.stretching ? (
          <p className="m-0 mt-3 text-[13.5px] text-[var(--color-ink-2)]">
            {dna.budget.aboveBand} of the {dna.budget.total} things on your boards sit above the budget you picked. Worth
            raising on your architect call.
          </p>
        ) : null}
        <p className="m-0 mt-3 text-[12.5px] text-[var(--color-ink-3)]">
          Built from {dna.evidence.likes} liked styles, {dna.evidence.boardItems} things on your mood boards and {dna.evidence.answers} answers
          on room ideas.
        </p>
      </section>

      <section className="mb-12">
        <h2 className="h3 m-0 mb-1">1. Build your mood board</h2>
        <p className="m-0 mb-4 text-[14px] text-[var(--color-ink-2)]">
          Pick the finishes, colours and pieces you like, room by room. Every pick feeds your DNA.
        </p>
        {prep && prep.brief.completedAt ? (
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
        ) : null}
      </section>

      <section>
        <h2 className="h3 m-0 mb-1">2. Room ideas in your DNA</h2>
        <p className="m-0 mb-4 text-[14px] text-[var(--color-ink-2)]">
          Three ideas per room. Say yes or no to each, and the next ones follow your answers.
        </p>
        <MockupRooms rooms={view.rooms} left={view.left} />
      </section>
    </>
  );
}
