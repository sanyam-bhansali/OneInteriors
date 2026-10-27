import type { Metadata } from 'next';
import Link from 'next/link';
import { deletedProjects } from '@/modules/studio/project-delete';
import { RestoreProject } from '../DeleteProject';

export const metadata: Metadata = { title: 'Deleted projects', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

/**
 * Deleted projects, newest first, with Restore (owner and design head, 27 Oct 2026;
 * studio/project-delete.ts). A booking refunded is listed too, without
 * Restore: money went back on it.
 */
export default async function DeletedProjectsPage() {
  const rows = await deletedProjects();
  if (!rows) {
    return (
      <div className="content oi-proj">
        <p className="m-0 text-[15px] text-[var(--text2)]">Only the studio owner and the design head see deleted projects.</p>
      </div>
    );
  }
  return (
    <div className="content oi-proj">
      <div className="phead">
        <div>
          <h1>Deleted projects</h1>
          <p className="muted" style={{ margin: '6px 0 0' }}>
            Nothing here is erased: payments and history stay. Restore puts a project back in your lists and its client&rsquo;s app.
          </p>
        </div>
        <div className="hstack">
          <Link href="/studio/projects" className="btn ghost">
            Back to projects
          </Link>
        </div>
      </div>
      {rows.length === 0 ? (
        <div className="empty">
          <p className="m-0">No deleted projects.</p>
        </div>
      ) : (
        <ul className="card m-0 list-none p-0">
          {rows.map((r, i) => (
            <li key={r.id} className={`flex flex-wrap items-start justify-between gap-3 px-4 py-3 ${i ? 'border-t border-[var(--line)]' : ''}`}>
              <div style={{ minWidth: 0 }}>
                <b>{r.client}</b>
                <span className="muted sm" style={{ display: 'block' }}>
                  {r.home} · {r.deletedOn.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' })}
                  {r.reason ? ` · ${r.reason}` : ''}
                </span>
              </div>
              {r.restorable ? <RestoreProject projectId={r.id} /> : <span className="muted sm">Booking refunded: not restored here</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
