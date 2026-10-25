import Link from 'next/link';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { projectDocuments } from '@/modules/studio-design/documents-store';
import { nameWord } from '@/modules/studio-design/documents';
import { DownloadAll } from './DownloadAll';
import '../../../projects.css';

export const metadata: Metadata = { title: 'Handover documents', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

/**
 * The handover pack (owner and Hauspire's design team, 24 Oct 2026;
 * docs/studio-os/DESIGN-PROCESS-PLAN.md §3.5): the final of every document,
 * in one list, with "Download all (.zip)". Working and electrical drawings
 * must be approved, and a material list and cut list there, before the
 * "Final documentation for handover" step can be ticked.
 */

const TAG: Record<string, string> = { approved: 'Approved', waiting: 'Waiting for approval', changes: 'Changes asked', shared: 'Shared', draft: 'Draft (team only)' };

export default async function HandoverPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const view = await projectDocuments(id);
  if (!view) notFound();
  const zipName = `Handover_${nameWord(view.client, 'Client')}_${new Date().toISOString().slice(0, 10)}.zip`;
  return (
    <div className="content oi-proj">
      <div className="phead">
        <div>
          <h1>Handover documents · {view.client}</h1>
          <p className="muted" style={{ margin: '6px 0 0' }}>
            {view.home}. The version that counts of every document: the approved one, else the newest shared.
          </p>
        </div>
        <div className="hstack">
          <Link href={`/studio/projects/${id}/documents`} className="btn ghost">
            All versions
          </Link>
          <Link href={`/studio/projects/${id}?tab=design`} className="btn ghost">
            Back to the project
          </Link>
        </div>
      </div>
      {view.handoverMissing.length ? (
        <p className="m-0 rounded-[10px] bg-[var(--warn-bg)] p-3 text-[14px] text-[var(--warn)]">
          Not ready for handover yet. Still needed: {view.handoverMissing.join(', ')}. Working and electrical drawings count once {view.client} approves them.
        </p>
      ) : (
        <p className="m-0 rounded-[10px] bg-[var(--good-bg,rgba(0,128,0,0.08))] p-3 text-[14px]">Every document the handover needs is here.</p>
      )}
      {view.finals.length === 0 ? (
        <div className="empty">
          <p className="m-0">Nothing uploaded yet.</p>
        </div>
      ) : (
        <>
          <div>
            <DownloadAll files={view.finals.map((f) => ({ url: f.url, fileName: f.fileName }))} zipName={zipName} />
          </div>
          <div className="card p-0">
            <ul className="m-0 list-none p-0">
              {view.finals.map((f) => (
                <li key={f.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-[var(--s-rule-soft)] px-4 py-2 text-[13.5px] first:border-t-0">
                  <span className="font-semibold">
                    {f.typeLabel}
                    {f.room ? `, ${f.room}` : ''}
                  </span>
                  <span className="mono">v{f.versionLabel}</span>
                  <span className={`chip ${f.state === 'approved' ? 'good' : f.state === 'waiting' ? 'warn' : f.state === 'changes' ? 'bad' : ''}`}>{TAG[f.state]}</span>
                  <span className="min-w-0 flex-1 truncate text-right mono text-[12px] muted" title={f.fileName}>
                    {f.fileName}
                  </span>
                  {f.url ? (
                    <a href={f.url} className="acc-t">
                      Download
                    </a>
                  ) : (
                    <span className="muted sm">Not stored on this machine</span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        </>
      )}
    </div>
  );
}
