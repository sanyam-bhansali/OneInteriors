import Link from 'next/link';
import type { Metadata } from 'next';
import { can, currentMember } from '@/modules/studio/access';
import { istToday, startableQuotes } from '@/modules/project/own-project';
import { StartProjectForm } from './StartProjectForm';
import '../projects.css';

export const metadata: Metadata = { title: 'Start a project', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

/**
 * Start a project for one of the studio's OWN clients (owner decision,
 * 11 Oct 2026; docs/studio-workspace/OWN-CLIENTS.md): pick the quotation the
 * client accepted, confirm the start date and their mobile number (both
 * filled in already), start. The plan is built from the quotation exactly as
 * when a customer signs in the app, and the client is invited to follow it.
 * Owner or PM (`project.create`).
 */
export default async function StartProjectPage({ searchParams }: { searchParams: Promise<{ quote?: string }> }) {
  const [{ quote }, member] = await Promise.all([searchParams, currentMember()]);
  const allowed = member !== null && can(member, 'project.create');
  const quotes = allowed ? await startableQuotes(member) : [];

  return (
    <div className="content oi-proj">
      <div className="flex flex-col gap-2">
        <Link href="/studio/projects" className="back">
          ← Projects
        </Link>
        <h1 className="m-0 text-[32px] font-medium leading-[1.1] tracking-[-0.035em]">Start a project</h1>
        <span className="max-w-[64ch] text-[15px] text-[var(--muted)]">
          For a client of your own who has accepted your quotation. The plan, the room checklists, the payment stages and the materials
          come from the quotation, and your client follows it in the One Interiors app.
        </span>
      </div>
        {!allowed ? (
          <p className="m-0 text-[15px] text-[var(--text2)]">Only your studio owner or a project manager can start a project.</p>
        ) : quotes.length === 0 ? (
          <div className="empty max-w-[640px]">
            <b>No accepted quotation to start from yet.</b>
            <p className="m-0 text-[14.5px] leading-relaxed text-[var(--text2)]">
              A project starts from a quotation you have sent or that the client has accepted. Open it in{' '}
              <Link href="/studio/quotations" className="acc-t">
                Quotations
              </Link>{' '}
              and mark it as sent or won, then come back here.
            </p>
          </div>
        ) : (
          <StartProjectForm
            quotes={quotes.map((q) => ({ ...q, date: q.date.toISOString() }))}
            initialQuoteId={quotes.some((q) => q.id === quote) ? quote! : quotes[0]!.id}
            today={istToday()}
          />
        )}
    </div>
  );
}
