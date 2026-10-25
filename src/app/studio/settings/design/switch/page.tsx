import Link from 'next/link';
import type { Metadata } from 'next';
import { switchView } from '@/modules/studio-design/switch-steps';
import { SwitchRow, UseStandardSteps } from './SwitchRow';

export const metadata: Metadata = { title: 'Move projects to the new steps', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

/**
 * Settings → Design steps → Move projects to the new steps (owner and
 * Hauspire's design team, 24 Oct 2026; docs/studio-os/DESIGN-PROCESS-PLAN.md
 * Decision 12): once, on the day the studio starts the new process. Each
 * project in design: pick where it is now, move it.
 */
export default async function SwitchPage() {
  const view = await switchView();
  if (!view) {
    return <p className="m-0 text-[14.5px] muted">Only the owner or a project manager moves projects to the new steps.</p>;
  }
  const left = view.rows.filter((r) => !r.switched).length;
  return (
    <div className="flex max-w-[72rem] flex-col gap-4">
      <div>
        <h2 className="m-0 text-[18px]">Move projects to the new steps</h2>
        <p className="m-0 mt-1 max-w-[70ch] text-[14px] leading-relaxed muted">
          For each project in design, pick the step it is at now and press Move it. The steps before it are ticked as done before the switch (no photo or file
          needed, and marked so), the step you pick is planned for today, and the rest follow by their days. The old steps are replaced. {left} to move
          {view.rows.length - left ? `, ${view.rows.length - left} done` : ''}.
        </p>
        <p className="m-0 mt-1 text-[13px]">
          <Link href="/studio/settings/design" className="acc-t">
            See the steps
          </Link>
        </p>
      </div>
      {view.oldTemplate ? (
        <div className="flex flex-wrap items-center gap-2 rounded-[10px] bg-[var(--warn-bg)] p-3 text-[13.5px] text-[var(--warn)]">
          Your studio saved its own design steps before the new process, with no pre-execution part.{' '}
          {view.isOwner ? <UseStandardSteps /> : 'Ask the owner to switch to the new standard steps first.'}
        </div>
      ) : null}
      {view.rows.length === 0 ? (
        <div className="empty">
          <p className="m-0">No project is in design now.</p>
        </div>
      ) : (
        <div className="card overflow-x-auto p-0">
          <table className="w-full min-w-[820px] border-collapse text-[13.5px]">
            <thead>
              <tr className="text-left text-[12px] muted">
                <th className="px-3 py-2 font-medium">Client</th>
                <th className="px-2 py-2 font-medium">Designer</th>
                <th className="px-2 py-2 font-medium">Old steps</th>
                <th className="px-2 py-2 font-medium">Where is it now?</th>
              </tr>
            </thead>
            <tbody>
              {view.rows.map((r) => (
                <SwitchRow key={r.projectId} row={r} steps={view.steps} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
