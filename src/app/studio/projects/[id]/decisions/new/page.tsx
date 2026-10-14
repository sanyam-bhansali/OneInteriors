import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { newDecisionContext } from '@/modules/project/decision-flow';
import { NewDecisionForm } from './NewDecisionForm';
import '../../../projects.css';

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
      <div className="content oi-proj">
        <p className="m-0 text-[15px] text-[var(--text2)]">{ctx.error}</p>
        <Link href={`/studio/projects/${id}`} className="back">
          ← Back to the project
        </Link>
      </div>
    );
  }
  return (
    <div className="content oi-proj">
      <div className="flex flex-col gap-2">
        <Link href={`/studio/projects/${ctx.projectId}`} className="back">
          ← {ctx.home}
        </Link>
        <h1 className="m-0 text-[32px] font-medium leading-[1.1] tracking-[-0.035em]">New decision for {ctx.customerFirst}</h1>
        <span className="text-[15px] text-[var(--muted)]">
          Ask once, with the options and what each costs. {ctx.customerFirst}&rsquo;s pick updates the quote, the final payment and the locker by
          itself.
        </span>
      </div>
      <NewDecisionForm
        projectId={ctx.projectId}
        customer={ctx.customerFirst}
        family={ctx.family}
        lines={ctx.lines}
        suggestedDue={ctx.suggestedDue}
        today={ctx.today}
      />
    </div>
  );
}
