import type { Metadata } from 'next';
import '../projects/projects.css';
import { projectsForStudio } from '@/modules/portal/tracker-store';
import { projectWork } from '@/modules/portal/project-store';
import { ProjectWork } from '@/components/project-work/ProjectWork';
import { UpdateForm } from './UpdateForm';
import { StageTicks } from './StageTicks';

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
    <div className="content oi-proj">
      <div className="phead">
        <div>
          <h1>
            Client projects <span className="mono muted" style={{ fontSize: 18 }}>{projects.length}</span>
          </h1>
          <p className="muted" style={{ margin: '6px 0 0', maxWidth: '72ch' }}>
            Homes introduced through One Interiors that have started. Post what happened on site, ask your client for decisions, and keep the snag
            list moving. Your client sees it in their app, and on their phone.
          </p>
        </div>
      </div>
        {projects.length === 0 ? (
          <p className="empty m-0 text-[15px] text-[var(--text2)]">
            Nothing yet. A project appears here once a client introduced through us has signed with you
            and the tracker is started.
          </p>
        ) : (
          <ul className="m-0 flex list-none flex-col gap-5 p-0">
            {projects.map((p, i) => (
              <li key={p.id} className="card">
                <p className="m-0 text-[17px] font-semibold">{p.label || 'A home'}</p>
                <p className="m-0 text-[13px] text-[var(--muted)]">
                  Started {p.startOn.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })} ·{' '}
                  {p.stages.filter((s) => s.state === 'done').length} of {p.stages.length} stages done
                </p>
                <div className="mt-3">
                  <StageTicks projectId={p.id} stages={p.stages.map((s) => ({ key: s.key, label: s.label, state: s.state }))} />
                </div>
                <UpdateForm projectId={p.id} />
                {work[i] ? <ProjectWork projectId={p.id} work={work[i]!} /> : null}
                {p.updates.length > 0 ? (
                  <ul className="m-0 flex list-none flex-col gap-1.5 border-t border-[var(--fill2)] p-0 pt-3">
                    {p.updates.map((u, i) => (
                      <li key={i} className="text-[13.5px] text-[var(--text2)]">
                        <span className="mr-2 mono text-[12px] text-[var(--muted)]">
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
    </div>
  );
}
