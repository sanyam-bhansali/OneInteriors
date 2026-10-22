import type { Metadata } from 'next';
import Link from 'next/link';
import { LineIcon } from '../../ui/icons';
import '../clients.css';
import { myStages } from '@/modules/studio-practice/stages';
import { myFields } from '@/modules/studio-practice/fields';
import { myLeadScope } from '@/modules/studio/lead-scope';
import { myLeadSources } from '@/modules/studio-sales/settings';
import { countMatching, headTeam, leadKpis, poolTabsFor, tagAndGroupFacets, viewPage } from '@/modules/studio-sales/leads-list';
import { can, hasSalesRole } from '@/modules/studio/roles';
import { reachOf } from '@/modules/studio/sales-access';
import { mayOpen } from '@/modules/studio/surfaces';
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
 *
 * Sales roles and teams (owner, 22 Oct 2026): tabs for the studio pool and
 * each team pool this person may see (studio-sales/leads-list.ts
 * `poolTabsFor`, inside their pool fence). Whoever may assign hands leads
 * out from here; from a head's team pool, someone whose reach is their team
 * is offered only that head's team. Leads can also be moved into a pool.
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
  const filters = showingAll ? without(asked, 'poolTeam') : { ...asked, owner: 'pool' };
  const query = leadFiltersToQuery(filters);
  const groupKey = one('group') ?? '';
  const [stages, fields, sources, allPeople, tabs] = await Promise.all([myStages(), myFields(), myLeadSources(), taskPeople(), poolTabsFor(scope, asked)]);
  const me = scope.member;
  const assigner = can(me, 'lead.assign');
  const assignReach = hasSalesRole(me) ? reachOf(me.sales, 'leads.assign') : 'all';
  /* From one head's team pool, a team-reach assigner offers only that head's team. */
  const headPool = filters.poolTeam && filters.poolTeam !== 'studio' ? filters.poolTeam : null;
  const narrowTo = headPool && assignReach === 'team' ? await headTeam(scope, headPool) : null;
  const people = narrowTo ? allPeople.filter((p) => narrowTo.includes(p.id)) : allPeople;
  /* "Move to a pool": the studio pool needs studio-wide assigning; a team pool, one within their team. */
  const moveTo = assigner
    ? tabs
        .filter((t) => (t.key === 'studio' ? assignReach === 'all' : assignReach === 'all' || (hasSalesRole(me) && me.sales.subtree.includes(t.key))))
        .map((t) => ({ key: t.key, label: t.label }))
    : [];
  const tabHref = (key: string | null) => {
    const p = new URLSearchParams(leadFiltersToQuery(without(filters, 'poolTeam')));
    p.delete('owner');
    if (key) p.set('pool', key);
    const s = p.toString();
    return `/studio/clients/pool${s ? `?${s}` : ''}`;
  };
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
            <p className="muted">{assigner ? 'Unassigned leads — nobody is working these yet. Give them out, or take them.' : 'Leads nobody has yet. Claim the ones you will work.'}</p>
          </div>
          {mayOpen(me, '/studio/clients/import') ? (
            <Link href="/studio/clients/import" className="btn sec">
              <LineIcon name="upload" size={17} />
              Import CSV
            </Link>
          ) : null}
        </div>

        {!showingAll && tabs.length > 1 ? (
          <nav className="tabs st-tabs" aria-label="Pools" style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <Link href={tabHref(null)} aria-current={!filters.poolTeam ? 'page' : undefined} className="btn sec sm">
              All my pools
            </Link>
            {tabs.map((t) => (
              <Link key={t.key} href={tabHref(t.key)} aria-current={filters.poolTeam === t.key ? 'page' : undefined} className={filters.poolTeam === t.key ? 'btn pri sm' : 'btn sec sm'}>
                {t.label} <span className="mono">{t.n.toLocaleString('en-IN')}</span>
              </Link>
            ))}
          </nav>
        ) : null}

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
          assigner={assigner}
          team={scope.team ? [...scope.team] : null}
          meId={me.id}
          moveTo={moveTo}
          showingAll={showingAll}
          groups={groupFields.map((g) => ({ key: g.key, label: g.label, values: facets.groups[g.key] ?? [] }))}
          groupKey={groupKey}
          stages={stages.map((s) => ({ id: s.id, name: s.name, kind: s.kind }))}
        />
    </main>
  );
}
