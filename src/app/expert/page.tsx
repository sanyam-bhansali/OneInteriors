import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { Container, Eyebrow } from '@/components/ui';
import { SiteHeader, SiteFooter } from '@/components/chrome';
import { JourneyNav } from '@/components/JourneyNav';
import { prisma } from '@/lib/prisma';
import { loadBrief, readAnonKey } from '@/modules/brief/repository';
import { getCurrentUser } from '@/modules/auth/session';
import { studioRepository } from '@/modules/studio/repository';
import { rankStudios } from '@/modules/matching/score';
import { quoteBrief } from '@/modules/quotation/generate';
import { MIN_STUDIOS, MAX_STUDIOS } from '@/modules/consultation/request';
import { ExpertForm } from './ExpertForm';

export const metadata: Metadata = {
  title: 'Talk to an expert',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

export default async function ExpertPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/sign-in?next=/expert&reason=expert');

  const { brief, found } = await loadBrief();
  if (!found || !brief.completedAt) redirect('/quiz');

  const id = await briefId();
  if (!id) redirect('/quiz');

  const studios = await studioRepository.list({ activeOnly: true });
  const ranked = rankStudios(brief, studios).slice(0, MAX_STUDIOS);
  const result = await quoteBrief(brief, ranked.map((r) => r.studioId));
  if (!result.ok) redirect('/quotes');

  return (
    <>
      <SiteHeader />
      <JourneyNav />

      <main className="py-10 sm:py-14">
        <Container size="narrow">
          <Eyebrow>OneExpert</Eyebrow>
          <h1 className="display mb-5 max-w-[20ch] text-[clamp(2rem,4.5vw,3rem)] leading-[1.02]">
            One call, and then we introduce you.
          </h1>
          <p className="lede mb-4">
            Someone who has read your brief, your quotes and every studio&rsquo;s delivery record
            spends half an hour helping you choose. Then we set up the meeting or site visit with
            that studio ourselves.
          </p>
          <p className="m-0 mb-10 max-w-[58ch] text-[15px] leading-relaxed text-[var(--color-ink-2)]">
            This is the only way to reach a studio through us. It is slower than a contact button,
            and it is the reason people do not end up in a meeting with a studio that was never
            going to suit them.
          </p>

          <ExpertForm
            briefId={id}
            minStudios={MIN_STUDIOS}
            maxStudios={MAX_STUDIOS}
            defaultName={user.name}
            defaultEmail={user.email}
            studios={result.quotes.map((q) => ({
              id: q.studioId,
              name: q.studioName,
              lowPaise: q.quote.lowPaise,
              highPaise: q.quote.highPaise,
            }))}
          />
        </Container>
      </main>

      <SiteFooter />
    </>
  );
}

async function briefId(): Promise<string | null> {
  const user = await getCurrentUser();
  if (user) {
    const row = await prisma.brief.findUnique({ where: { userId: user.id }, select: { id: true } });
    if (row) return row.id;
  }
  const anonKey = await readAnonKey();
  if (!anonKey) return null;
  const row = await prisma.brief.findUnique({ where: { anonKey }, select: { id: true } });
  return row?.id ?? null;
}
