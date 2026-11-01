import Link from 'next/link';
import type { Metadata } from 'next';
import { documentFolders } from '@/modules/studio-design/documents-store';
import { KpiRow } from '../ui/KpiRow';
import { documentKpis } from '@/modules/studio/app-kpis';
import { PHASE_LABEL, isPhase } from '@/modules/project/lifecycle-rules';
import '../projects/projects.css';

export const metadata: Metadata = { title: 'Documents', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

/**
 * Documents (owner and Hauspire's design team, 24 Oct 2026;
 * docs/studio-os/DESIGN-PROCESS-PLAN.md §3.4): one folder per project you
 * can see, each opening every version of every document, with the handover
 * pack a click away.
 */
export default async function DocumentsPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const [folders, { q }] = await Promise.all([documentFolders(), searchParams]);
  if (!folders) {
    return (
      <div className="content oi-proj">
        <p className="m-0 text-[15px] text-[var(--text2)]">This page is for the studio&rsquo;s team.</p>
      </div>
    );
  }
  const query = (q ?? '').trim().toLowerCase();
  const shown = query ? folders.filter((f) => `${f.client} ${f.home}`.toLowerCase().includes(query)) : folders;
  return (
    <div className="content oi-proj">
      <div className="phead">
        <div>
          <h1>
            Documents <span className="mono muted" style={{ fontSize: 18 }}>{folders.length}</span>
          </h1>
          <p className="muted" style={{ margin: '6px 0 0' }}>
            A folder per project: every version of every drawing and sheet, named and numbered for you, and the handover pack.
          </p>
        </div>
        <form className="hstack" action="/studio/documents">
          <input name="q" defaultValue={q ?? ''} placeholder="Find a client or society" aria-label="Find a project" className="fld" />
        </form>
      </div>
      {/* The app's numbers first (owner, 1 Nov 2026; studio/app-kpis.ts). */}
      <KpiRow label="Documents at a glance" items={documentKpis(folders)} />
      {shown.length === 0 ? (
        <div className="empty">
          <p className="m-0">{query ? 'No project matches that.' : 'No projects yet.'}</p>
        </div>
      ) : (
        <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))' }}>
          {shown.map((f) => (
            <Link key={f.projectId} href={`/studio/projects/${f.projectId}/documents`} className="card flex flex-col gap-1 p-4">
              <span className="text-[15px] font-semibold">📁 {f.client}</span>
              <span className="muted sm">{f.home}</span>
              <span className="sm">
                {f.documents === 0 ? 'Nothing uploaded yet' : `${f.documents} file${f.documents === 1 ? '' : 's'} · ${f.approved} approved`}
                <span className="muted"> · {isPhase(f.phase) ? PHASE_LABEL[f.phase] : f.phase}</span>
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
