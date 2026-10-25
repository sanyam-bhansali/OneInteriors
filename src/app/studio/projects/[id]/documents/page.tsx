import Link from 'next/link';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { projectDocuments } from '@/modules/studio-design/documents-store';
import '../../projects.css';

export const metadata: Metadata = { title: 'All versions', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

/**
 * A project's documents, every version (owner and Hauspire's design team,
 * 24 Oct 2026; docs/studio-os/DESIGN-PROCESS-PLAN.md §3.4): the repository
 * behind the project page's finals. Each type and room, newest version
 * first, with its number, tag, who uploaded it and a download named for you.
 */

const TAG: Record<string, { text: string; cls: string }> = {
  approved: { text: 'Approved', cls: 'good' },
  waiting: { text: 'Waiting for approval', cls: 'warn' },
  changes: { text: 'Changes asked', cls: 'bad' },
  shared: { text: 'Shared', cls: '' },
  draft: { text: 'Draft (team only)', cls: '' },
  replaced: { text: 'Replaced', cls: '' },
};
const dayWords = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });

export default async function AllVersionsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const view = await projectDocuments(id);
  if (!view) notFound();
  return (
    <div className="content oi-proj">
      <div className="phead">
        <div>
          <h1>Documents · {view.client}</h1>
          <p className="muted" style={{ margin: '6px 0 0' }}>
            {view.home}. Every version of every document, newest first. The project page shows only the one that counts.
          </p>
        </div>
        <div className="hstack">
          <Link href={`/studio/projects/${id}/documents/handover`} className="btn sec">
            Handover documents
          </Link>
          <Link href={`/studio/projects/${id}?tab=design`} className="btn ghost">
            Back to the project
          </Link>
        </div>
      </div>
      {view.chains.length === 0 ? (
        <div className="empty">
          <p className="m-0">Nothing uploaded yet. Upload from the project&rsquo;s Design tab.</p>
        </div>
      ) : (
        view.chains.map((c) => (
          <section key={`${c.type}|${c.room}`} className="card p-0" aria-label={`${c.typeLabel}${c.room ? `, ${c.room}` : ''}`}>
            <h2 className="m-0 px-4 pt-3 text-[16px]">
              {c.typeLabel}
              {c.room ? <span className="muted">, {c.room}</span> : null} <span className="muted sm">· {c.versions.length} version{c.versions.length === 1 ? '' : 's'}</span>
            </h2>
            <ul className="m-0 list-none p-0">
              {c.versions.map((v) => (
                <li key={v.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-[var(--s-rule-soft)] px-4 py-2 text-[13.5px]">
                  <span className="mono w-[52px]">v{v.versionLabel}</span>
                  <span className={`chip ${TAG[v.state]!.cls}`}>{TAG[v.state]!.text}</span>
                  <span className="muted">
                    {dayWords(v.on)} · {v.by}
                  </span>
                  {v.comment ? <span className="muted">&ldquo;{v.comment}&rdquo;</span> : null}
                  <span className="min-w-0 flex-1 truncate text-right mono text-[12px] muted" title={v.fileName}>
                    {v.fileName}
                  </span>
                  {v.url ? (
                    <a href={v.url} className="acc-t">
                      Download
                    </a>
                  ) : (
                    <span className="muted sm">Not stored on this machine</span>
                  )}
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
    </div>
  );
}
