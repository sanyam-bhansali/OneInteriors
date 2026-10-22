import Link from 'next/link';
import type { Metadata } from 'next';
import { bringInContext } from '@/modules/studio-bring-in/bring-in';
import { BringInFlow } from './BringInFlow';
import '../projects.css';

export const metadata: Metadata = { title: 'Bring in a running project', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

/**
 * "Add an existing project" (owner, 15 and 20 Oct 2026;
 * docs/studio-os/BRING-IN-PROJECTS.md): one step per screen — the client,
 * the quotation (imported from the Hauspire quotation app, or built in our
 * builder), where the project is now, payments already received, the team,
 * the client's invite — then a summary and "Bring it in". Owner, PM or
 * designer on the Max plan (`project.bringIn`).
 */
export default async function BringInPage({ searchParams }: { searchParams: Promise<{ quote?: string }> }) {
  const [{ quote }, ctx] = await Promise.all([searchParams, bringInContext()]);
  return (
    <div className="content oi-proj">
      <div className="flex flex-col gap-2">
        <Link href={ctx?.me.role === 'DESIGNER' ? '/studio/design' : '/studio/projects'} className="back">
          ← {ctx?.me.role === 'DESIGNER' ? 'My design work' : 'Projects'}
        </Link>
        <h1 className="m-0 text-[32px] font-medium leading-[1.1] tracking-[-0.035em]">Bring in a running project</h1>
        <span className="max-w-[64ch] text-[15px] text-[var(--muted)]">
          A project already in design or on site: its client, the quotation they agreed, where it is now and what they have paid. It then runs here like
          every project booked in the app, and your client follows it in the One Interiors app.
        </span>
      </div>
      {!ctx ? (
        <p className="m-0 text-[15px] text-[var(--text2)]">Only the studio owner, a project manager or a designer can bring in a running project, on the Max plan.</p>
      ) : (
        <BringInFlow ctx={ctx} initialQuoteId={quote ?? null} />
      )}
    </div>
  );
}
