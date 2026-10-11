import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { PageBody } from '../../../../StudioShell';
import { newDecisionContext } from '@/modules/project/decision-flow';
import { NewDecisionForm } from './NewDecisionForm';

export const metadata: Metadata = { title: 'New decision', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

/**
 * New decision (studio workspace Phase 5, design
 * docs/studio-workspace/designs/studio/StudioDecision.dc.html): the form,
 * and beside it what the customer will see, live as it is typed. Owner, or
 * the PM on the project (`decision.create`, checked in the module).
 */
export default async function NewDecisionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await newDecisionContext(id.slice(0, 64));
  if (!ctx.ok) {
    if (ctx.error === 'That project is not one of yours.') notFound();
    return (
      <PageBody>
        <p className="m-0 text-[15px] text-[var(--s-ink-2)]">{ctx.error}</p>
        <Link href={`/studio/projects/${id}`} className="mt-3 inline-block text-[14px] text-[var(--s-accent)]">
          ← Back to the project
        </Link>
      </PageBody>
    );
  }
  return (
    <>
      <div className="border-b border-[var(--s-rule)] bg-[var(--s-rail)]/50 px-5 py-4 sm:px-7">
        <Link href={`/studio/projects/${ctx.projectId}`} className="text-[13px] text-[var(--s-ink-3)] no-underline hover:text-[var(--s-accent)]">
          ← {ctx.home}
        </Link>
        <h1 className="m-0 mt-1 text-[22px] font-semibold tracking-tight">New decision for {ctx.customerFirst}</h1>
        <p className="m-0 mt-1 max-w-[60ch] text-[14px] text-[var(--s-ink-2)]">
          Ask once, with the options and what each costs. {ctx.customerFirst}&rsquo;s pick updates the quote, the final payment and the locker by
          itself.
        </p>
      </div>
      <PageBody>
        <NewDecisionForm
          projectId={ctx.projectId}
          customer={ctx.customerFirst}
          family={ctx.family}
          lines={ctx.lines}
          suggestedDue={ctx.suggestedDue}
          today={ctx.today}
        />
      </PageBody>
    </>
  );
}
