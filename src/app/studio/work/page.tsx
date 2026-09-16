import Link from 'next/link';
import type { Metadata } from 'next';
import { Container } from '@/components/ui';
import { fromDb } from '@/lib/money';
import {
  currentStudio,
  listProjects,
  MIN_PORTFOLIO_PROJECTS,
} from '@/modules/studio/onboarding';
import { PortfolioForm } from '../onboarding/PortfolioForm';

export const metadata: Metadata = {
  title: 'Your work',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

/**
 * The portfolio, outside the onboarding wizard.
 *
 * ## Why a live studio needs this more than a new one does
 *
 * Adding a finished project is the only thing a studio can do that directly
 * improves how it ranks. Two of the six matching factors read the portfolio —
 * style overlap comes from the tags, scope experience from the count of
 * comparable jobs — and a third, budget fit, switches from the range a studio
 * *claimed* to the values it has actually *delivered* once three real projects
 * exist.
 *
 * So the studio with the strongest reason to be here is the one that finished a
 * kitchen last week. And until now, the only route to this form was a setup
 * step they completed months ago and which vanished from their navigation the
 * day they went live.
 *
 * The home page's one line of advice is usually about style overlap or scope.
 * This is the page that lets them do something about it, which is what makes
 * that advice worth giving rather than merely true.
 */
export default async function WorkPage() {
  const context = await currentStudio();

  if (!context) {
    return (
      <main className="py-16">
        <Container size="wide">
          <h1 className="h1 mb-4">No studio on this account</h1>
          <p className="m-0 text-[16px] leading-relaxed text-[var(--color-ink-2)]">
            This sign-in is not linked to a studio yet.
          </p>
        </Container>
      </main>
    );
  }

  const projects = await listProjects();

  return (
    <main className="py-10">
      {/* The rail carries why this page matters; the right column is the list
          of projects and the form that adds one. The argument for adding last
          month's job stays on screen while you add it. */}
      <Container size="wide">
        <div className="grid gap-x-12 gap-y-8 lg:grid-cols-[minmax(0,20rem)_minmax(0,1fr)]">
          <div className="lg:sticky lg:top-8 lg:self-start">
        <p className="label m-0 mb-2">Your work</p>
        <h1 className="h1 mb-3">
          {projects.length === 0
            ? 'Nothing here yet.'
            : `${projects.length} project${projects.length === 1 ? '' : 's'}.`}
        </h1>

        <p className="m-0 mb-4 max-w-[42ch] text-[15.5px] leading-relaxed text-[var(--color-ink-2)]">
          This is what a customer reads before deciding whether to meet you, and it is the only
          thing on this site you can change that moves where you rank.
        </p>

        <p className="m-0 mb-6 max-w-[42ch] text-[14.5px] leading-relaxed text-[var(--color-ink-3)]">
          Style tags decide which briefs you appear in. Project values matter more than you might
          expect — once three are recorded we match on what you have actually delivered rather than
          on the range you declared, and delivered numbers are far more convincing than claimed
          ones. Add the job you finished last month; it is the cheapest thing you can do here.
        </p>

        {projects.length < MIN_PORTFOLIO_PROJECTS ? (
          <p className="m-0 rounded-[12px] border border-[var(--color-brass)] bg-[var(--color-paper-2)] px-5 py-4 text-[14.5px] leading-relaxed text-[var(--color-ink)]">
            {MIN_PORTFOLIO_PROJECTS - projects.length} more needed before your profile can be
            published. Three is the point at which a customer sees a pattern rather than one lucky
            job.
          </p>
        ) : null}
          </div>

          <div className="max-w-[46rem]">
        <PortfolioForm
          minimum={MIN_PORTFOLIO_PROJECTS}
          projects={projects.map((p) => ({
            id: p.id,
            title: p.title,
            locality: p.locality,
            styleTags: p.styleTags,
            // BigInt cannot cross the server/client boundary — convert here.
            valuePaise: p.valuePaise === null ? null : fromDb(p.valuePaise),
            completedOn: p.completedOn ? p.completedOn.toISOString() : null,
            isRender: p.isRender,
          }))}
        />

        <div className="mt-10 rounded-[12px] border border-[var(--color-rule)] bg-[var(--color-paper-3)] p-6">
          <p className="label m-0 mb-2">The one rule</p>
          <p className="m-0 max-w-[64ch] text-[14.5px] leading-relaxed text-[var(--color-ink-2)]">
            A photograph of a real project needs the client&rsquo;s consent, and a render has to be
            marked as a render. Both are asked at the point of adding, and both are the studio&rsquo;s
            declaration rather than ours to check — which is exactly why a customer who finds a
            render presented as a finished room does not blame us, they blame you.
          </p>
        </div>

        <p className="m-0 mt-8 text-[14px] text-[var(--color-ink-3)]">
          <Link href="/studio/listing" className="text-[var(--color-petrol)]">
            Back to your listing
          </Link>
        </p>
          </div>
        </div>
      </Container>
    </main>
  );
}
