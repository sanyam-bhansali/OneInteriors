import type { Metadata } from 'next';
import { Container } from '@/components/ui';
import { requireRole } from '@/modules/auth/session';
import { prisma } from '@/lib/prisma';
import { OpsHeader } from '../ui';
import { ChallengeForm } from './ChallengeForm';

export const metadata: Metadata = { title: 'Spot the mistake', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

/** The customer app's weekly "Spot the mistake": one real site photo, the mistake marked, what it teaches. */
export default async function ChallengePage() {
  await requireRole('OPS');
  const recent = await prisma.weeklyChallenge.findMany({
    orderBy: { weekOf: 'desc' },
    take: 8,
    select: { id: true, weekOf: true, answer: true, _count: { select: { answers: true } } },
  });
  return (
    <>
      <OpsHeader />
      <Container size="wide">
        <div className="grid gap-8 py-8 lg:grid-cols-[1fr_320px]">
          <section>
            <h1 className="m-0 text-[26px] font-semibold">Spot the mistake</h1>
            <p className="mt-2 max-w-[60ch] text-[14.5px] leading-[1.6] text-[var(--color-ink-2)]">
              One real Pune site photo a week, with one thing that needs fixing before handover. Use a photo from a live project with
              the studio&rsquo;s agreement, and nothing that shows a person&rsquo;s face or a flat number.
            </p>
            <ChallengeForm />
          </section>
          <aside>
            <h2 className="m-0 mb-3 text-[15px] font-semibold">Recent weeks</h2>
            <ul className="m-0 flex list-none flex-col gap-2 p-0 text-[14px]">
              {recent.map((c) => (
                <li key={c.id}>
                  <b>{c.weekOf.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: 'UTC' })}</b> · {c.answer} ·{' '}
                  {c._count.answers} answered
                </li>
              ))}
              {recent.length === 0 ? <li className="text-[var(--color-ink-2)]">None yet.</li> : null}
            </ul>
          </aside>
        </div>
      </Container>
    </>
  );
}
