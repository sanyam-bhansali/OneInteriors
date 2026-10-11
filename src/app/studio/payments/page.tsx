import type { Metadata } from 'next';
import { PageHead, PageBody } from '../StudioShell';
import { paymentsDesk } from '@/modules/studio/payments-desk';
import { Payments } from '@/components/project-work/ProjectWork';

export const metadata: Metadata = { title: 'Payments', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

/**
 * Where an accounts member lands: every project's payment stages, with
 * "Mark received" and the due date — the same control the office uses on a
 * project (`Payments`), so there is one way to record money. Nothing else of
 * the project is read for this screen.
 */
export default async function PaymentsDeskPage() {
  const projects = await paymentsDesk();
  return (
    <>
      <PageHead title="Payments" sub="Every project’s payment stages. Mark a stage received once the money is in; the client is told." />
      <PageBody>
        {projects.length === 0 ? (
          <p className="m-0 text-[15px] text-[var(--s-ink-2)]">No projects yet. A project appears here once a client signs with your studio.</p>
        ) : (
          <ul className="m-0 flex list-none flex-col gap-4 p-0">
            {projects.map((p) => (
              <li key={p.id} className="s-card p-5">
                <p className="m-0 mb-3 text-[16px] font-semibold">{p.label}</p>
                {p.money ? (
                  <Payments projectId={p.id} money={p.money} />
                ) : (
                  <p className="m-0 text-[14px] text-[var(--s-ink-3)]">No payment stages were signed in the app for this project.</p>
                )}
              </li>
            ))}
          </ul>
        )}
      </PageBody>
    </>
  );
}
