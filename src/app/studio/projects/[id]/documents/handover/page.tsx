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
  /* Only the versions the designer marked final (owner, 1 Nov 2026); the paper agreement goes in the zip too. */
  const finals = view.finals.filter((f) => f.marked);
  const zipPapers = view.papers.filter((x) => x.url && x.fileName).map((x) => ({ url: x.url!, fileName: x.fileName! }));
  return (
    <div className="content oi-proj">
      <div className="phead">
        <div>
          <h1>Handover documents · {view.client}</h1>
          <p className="muted" style={{ margin: '6px 0 0' }}>
            {view.home}. The version of every document the designer marked final, the quotations and the agreement.
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
          Not ready for handover yet. Still needed: {view.handoverMissing.join(', ')}. Mark the final version of each in All versions.
        </p>
      ) : (
        <p className="m-0 rounded-[10px] bg-[var(--good-bg,rgba(0,128,0,0.08))] p-3 text-[14px]">Every document the handover needs is marked final.</p>
      )}
      {finals.length === 0 && zipPapers.length === 0 ? null : (
        <div>
          <DownloadAll files={[...finals.map((f) => ({ url: f.url, fileName: f.fileName })), ...zipPapers]} zipName={zipName} />
        </div>
      )}
      {finals.length === 0 ? (
        <div className="empty">
          <p className="m-0">{view.finals.length ? 'No document is marked final yet. Open All versions and mark the final of each.' : 'Nothing uploaded yet.'}</p>
        </div>
      ) : (
        <div className="card p-0">
          <ul className="m-0 list-none p-0">
            {finals.map((f) => (
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
      )}
      {view.papers.length ? (
        <section className="card p-0" aria-label="Quotations and agreement">
          <h2 className="m-0 px-4 pt-3 text-[16px]">Quotations and agreement</h2>
          <p className="muted sm m-0 px-4">A quotation opens as a page: print it, or save it as a PDF. The agreement signed on paper is in the zip.</p>
          <ul className="m-0 list-none p-0">
            {view.papers.map((x) => (
              <li key={x.key} className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-[var(--s-rule-soft)] px-4 py-2 text-[13.5px]">
                <span className="font-semibold">{x.label}</span>
                <span className={`chip ${x.done ? 'good' : 'warn'}`}>{x.line}</span>
                <span className="min-w-0 flex-1" />
                {x.url ? (
                  <a href={x.url} className="acc-t">
                    Download
                  </a>
                ) : x.href ? (
                  <Link href={x.href} className="acc-t" target="_blank">
                    Open to print
                  </Link>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
