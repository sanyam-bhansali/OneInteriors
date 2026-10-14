import type { Metadata } from 'next';
import Link from 'next/link';
import { LineIcon } from '../../ui/icons';
import '../clients.css';
import { myStages } from '@/modules/studio-practice/stages';
import { myFields } from '@/modules/studio-practice/fields';
import { myLeadScope } from '@/modules/studio/lead-scope';
import { myLeadSources } from '@/modules/studio-sales/settings';
import { countMatching, leadKpis, tagAndGroupFacets, viewPage } from '@/modules/studio-sales/leads-list';
import { leadFiltersToQuery, parseLeadFilters, without } from '@/modules/studio-sales/lead-filters';
import { bulkActionsFor } from '@/modules/studio-sales/bulk-rules';
import { taskPeople } from '@/modules/studio-sales/tasks';
import { Toolbar } from '../LeadsControls';
import { PoolTable } from './PoolTable';
import { PoolSearch } from './PoolSearch';

export const metadata: Metadata = {
  title: 'Pool — leads nobody has taken',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

/**
 * The pool (the AxLeads look, 12 Oct 2026): leads nobody has. Owner and PM
 * give them out (one, a selection, the first N, or a group at a time) or
 * take them; a salesperson claims them (owner, 12 Oct 2026). "All leads"
 * (owner and PM) includes the ones somebody has, to hand work back round.
 */
export default async function PoolPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const one = (k: string) => (Array.isArray(sp[k]) ? sp[k]![0] : (sp[k] as string | undefined));
  const scope = await myLeadScope();
  if (!scope) {
    return (
      <main className="content cl-page">
        <div className="empty">
          <b>The pool is for the people who work leads.</b>
        </div>
      </main>
    );
  }
  const showingAll = scope.seesAll && one('all') === '1';
  const asked = without(parseLeadFilters(sp), 'owner');
  const filters = showingAll ? asked : { ...asked, owner: 'pool' };
  const query = leadFiltersToQuery(filters);
  const groupKey = one('group') ?? '';
  const [stages, fields, sources, people] = await Promise.all([myStages(), myFields(), myLeadSources(), taskPeople()]);
  const groupFields = fields.filter((f) => f.groupBy);
  const [page, total, facets, kpis] = await Promise.all([
    viewPage(scope, filters, 'newest', null),
    countMatching(scope, filters),
    tagAndGroupFacets(scope, filters, groupFields.map((f) => f.key)),
    leadKpis(scope, filters),
  ]);
  const listQuery = [query, 'sort=newest', showingAll ? 'all=1' : '', groupKey ? `group=${groupKey}` : ''].filter(Boolean).join('&');

  return (
    <main className="content cl-page">
        <div className="phead">
          <div>
            <h1>
              The pool <span className="mono n">{total.toLocaleString('en-IN')}</span>
            </h1>
            <p className="muted">{scope.seesAll ? 'Unassigned leads — nobody is working these yet.' : 'Leads nobody has yet. Claim the ones you will work.'}</p>
          </div>
          {scope.seesAll ? (
            <Link href="/studio/clients/import" className="btn sec">
              <LineIcon name="upload" size={17} />
              Import CSV
            </Link>
          ) : null}
        </div>

        <div className="hstack" style={{ alignItems: 'flex-start' }}>
          <Toolbar
            query={query}
            view="list"
            sort="newest"
            kpis={kpis}
            stages={stages.map((s) => ({ id: s.id, name: s.name, colour: s.colour }))}
            sources={sources.map((s) => ({ id: s.id, name: s.name }))}
            tags={facets.tags}
            groups={groupFields.map((g) => ({ key: g.key, label: g.label, values: facets.groups[g.key] ?? [] }))}
            views={[]}
            base="/studio/clients/pool"
            keep={{ all: showingAll ? '1' : '', group: groupKey }}
            pool
          />
          <PoolSearch query={listQuery} q={filters.q ?? ''} />
        </div>

        <PoolTable
          rows={page.rows}
          next={page.next}
          total={total}
          query={listQuery}
          people={people}
          actions={bulkActionsFor(scope.member)}
          seesAll={scope.seesAll}
          showingAll={showingAll}
          groups={groupFields.map((g) => ({ key: g.key, label: g.label, values: facets.groups[g.key] ?? [] }))}
          groupKey={groupKey}
          stages={stages.map((s) => ({ id: s.id, name: s.name, kind: s.kind }))}
        />
    </main>
  );
}
