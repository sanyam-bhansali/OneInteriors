import type { Metadata } from 'next';
import Link from 'next/link';
import '../clients.css';
import './societies.css';
import { listSocieties, mySocietyAccess, societyLocalities, societyPeople, type SocietyFilters } from '@/modules/studio-practice/societies';
import { HEAT_LABEL, PRIORITY_LABEL, monthLabel, type Heat, type Priority } from '@/modules/studio-practice/society-rules';
import { AddSociety } from './SocietyForms';
import { HeatChip, PriorityChip } from './Chips';

export const metadata: Metadata = {
  title: 'Societies',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

const PRIORITIES = ['P1', 'P2', 'P3'] as const;
const HEATS = ['HOT', 'WARM', 'COLD'] as const;

/**
 * Societies (owner, 11 Nov 2026; Max plan): every society the studio works,
 * P1 first. Priority comes from the nearest wing's possession; Hot, Warm or
 * Cold from the last 60 days of calls (studio-practice/society-rules.ts).
 */
export default async function SocietiesPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const access = await mySocietyAccess();
  if (!access) {
    return (
      <main className="content cl-page">
        <div className="empty">
          <b>Societies are part of the Max plan.</b>
        </div>
      </main>
    );
  }
  const sp = await searchParams;
  const one = (k: string) => (Array.isArray(sp[k]) ? sp[k]![0] : (sp[k] as string | undefined)) ?? '';
  const filters: SocietyFilters = {
    q: one('q'),
    priority: (PRIORITIES as readonly string[]).includes(one('priority')) ? (one('priority') as Priority) : null,
    heat: one('heat') === 'NONE' || (HEATS as readonly string[]).includes(one('heat')) ? (one('heat') as Heat | 'NONE') : null,
    owner: one('owner') || null,
    locality: one('locality') || null,
  };
  const [rows, people, localities] = await Promise.all([listSocieties(access, filters), societyPeople(access.scope.studioId), societyLocalities(access)]);
  const counts = { P1: 0, P2: 0, P3: 0 } as Record<Priority, number>;
  for (const r of rows) counts[r.priority]++;
  const filtered = Object.values(filters).some(Boolean);

  return (
    <main className="content cl-page soc-page">
      <div className="phead">
        <div>
          <h1>
            Societies <span className="mono n">{rows.length.toLocaleString('en-IN')}</span>
          </h1>
          <p className="muted">
            {counts.P1} P1 · {counts.P2} P2 · {counts.P3} P3. Possession sets the priority; the last 60 days of calls set Hot, Warm or Cold.
          </p>
        </div>
        <div className="hstack" style={{ gap: 8 }}>
          {access.mayImport ? (
            <Link href="/studio/clients/societies/import" className="btn ghost">
              Import a sheet
            </Link>
          ) : null}
          {access.mayAdd ? <AddSociety /> : null}
        </div>
      </div>

      <form className="soc-filters" method="get" aria-label="Filter societies">
        <input name="q" defaultValue={filters.q} placeholder="Search society or locality" aria-label="Search" />
        <select name="priority" defaultValue={filters.priority ?? ''} aria-label="Priority">
          <option value="">Any priority</option>
          {PRIORITIES.map((p) => (
            <option key={p} value={p}>
              {PRIORITY_LABEL[p]}
            </option>
          ))}
        </select>
        <select name="heat" defaultValue={filters.heat ?? ''} aria-label="Response">
          <option value="">Any response</option>
          {HEATS.map((h) => (
            <option key={h} value={h}>
              {HEAT_LABEL[h]}
            </option>
          ))}
          <option value="NONE">Too early</option>
        </select>
        {access.scope.seesAll || access.scope.reach === 'team' ? (
          <select name="owner" defaultValue={filters.owner ?? ''} aria-label="Owner">
            <option value="">Anyone</option>
            <option value="none">Nobody yet</option>
            {people.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        ) : null}
        {localities.length > 1 ? (
          <select name="locality" defaultValue={filters.locality ?? ''} aria-label="Locality">
            <option value="">Every locality</option>
            {localities.map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
          </select>
        ) : null}
        <button type="submit" className="btn sec sm">
          Show
        </button>
        {filtered ? (
          <Link href="/studio/clients/societies" className="linkbtn">
            Clear
          </Link>
        ) : null}
      </form>

      <section className="card flush" style={{ overflow: 'hidden' }}>
        <div className="tscroll">
          <table className="tbl cl-tbl soc-tbl">
            <thead>
              <tr>
                <th>Priority</th>
                <th>Society</th>
                <th>Possession</th>
                <th>Response</th>
                <th>Owner</th>
                <th className="num">Leads</th>
                <th className="soc-notecol">Latest note</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>
                    <PriorityChip p={r.priority} byHand={r.priorityByHand} />
                  </td>
                  <td>
                    <Link href={`/studio/clients/societies/${r.id}`} className="soc-name">
                      {r.name}
                    </Link>
                    <div className="sub">{[r.locality, `${r.wings} wing${r.wings === 1 ? '' : 's'}`].filter(Boolean).join(' · ')}</div>
                  </td>
                  <td>{r.possessionOn ? monthLabel(r.possessionOn) : <span className="chip xs warn">Date missing</span>}</td>
                  <td>
                    <HeatChip h={r.heat} byHand={r.heatByHand} />
                    {r.calls.reached ? <div className="sub">{r.calls.good}/{r.calls.reached} good</div> : null}
                  </td>
                  <td>{r.assignedTo ?? <span className="muted">Nobody</span>}</td>
                  <td className="num mono">{r.leads.toLocaleString('en-IN')}</td>
                  <td className="soc-notecol">
                    {r.lastNote ? <span className="soc-clip" title={r.lastNote.body}>{r.lastNote.body}</span> : <span className="muted">—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {rows.length === 0 ? (
          <p className="muted" style={{ margin: 0, padding: '32px 16px', textAlign: 'center' }}>
            {filtered ? 'No society matches these filters.' : 'No societies yet. Add one, or import a society sheet.'}
          </p>
        ) : null}
      </section>
    </main>
  );
}
