import type { Metadata } from 'next';
import { PageHead, PageBody } from '../StudioShell';
import { projectsForStudio } from '@/modules/portal/tracker-store';
import { projectWork } from '@/modules/portal/project-store';
import { ProjectWork } from '@/components/project-work/ProjectWork';
import { UpdateForm } from './UpdateForm';

export const metadata: Metadata = { title: 'Client projects', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

/**
 * The homes introduced through One Interiors (build queue item 22, and
 * docs/CUSTOMER-PLATFORM-PLAN.md step 2). What a studio posts here — a site
 * update with photos, a decision for the client, a snag's date and its fix —
 * reaches the client's app and phone the moment it is saved.
 */
export default async function StudioUpdatesPage() {
  const projects = await projectsForStudio();
  const work = await Promise.all(projects.map((p) => projectWork(p.id)));
  return (
    <>
      <PageHead
        title="Client projects"
        sub="Homes introduced through One Interiors that have started. Post what happened on site, ask your client for decisions, and keep the snag list moving. Your client sees it in their app, and on their phone."
      />
      <PageBody>
        {projects.length === 0 ? (
          <p className="m-0 text-[15px] text-[var(--color-ink-2)]">
            Nothing yet. A project appears here once a client introduced through us has signed with you
            and the tracker is started.
          </p>
        ) : (
          <ul className="m-0 flex list-none flex-col gap-5 p-0">
            {projects.map((p, i) => (
              <li key={p.id} className="rounded-[12px] border border-[var(--color-rule)] p-5">
                <p className="m-0 text-[16px] font-semibold">{p.label || 'A home'}</p>
                <p className="m-0 mt-1 text-[13px] text-[var(--color-ink-3)]">
                  Started {p.startOn.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })} ·{' '}
                  {p.stages.filter((s) => s.state === 'done').length} of {p.stages.length} stages done
                </p>
                <UpdateForm projectId={p.id} />
                {work[i] ? <ProjectWork projectId={p.id} work={work[i]!} /> : null}
                {p.updates.length > 0 ? (
                  <ul className="m-0 mt-4 flex list-none flex-col gap-1.5 border-t border-[var(--color-rule)] p-0 pt-3">
                    {p.updates.map((u, i) => (
                      <li key={i} className="text-[13.5px] text-[var(--color-ink-2)]">
                        <span className="mr-2 font-[family-name:var(--font-mono)] text-[11px] text-[var(--color-ink-3)]">
                          {u.at.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                        </span>
                        {u.note}
                        {u.photos ? ` · ${u.photos} photo${u.photos === 1 ? '' : 's'}` : ''}
                        {u.byStudio ? '' : ' · from One Interiors'}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </PageBody>
    </>
  );
}
