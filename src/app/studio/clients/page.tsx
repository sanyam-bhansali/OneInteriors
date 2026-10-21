import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { mayOpen } from '@/modules/studio/surfaces';
import { LineIcon } from '../ui/icons';
import './clients.css';
import { myStages } from '@/modules/studio-practice/stages';
import { myFields } from '@/modules/studio-practice/fields';
import { myViews } from '@/modules/studio-practice/saved-views';
import { myLeadScope } from '@/modules/studio/lead-scope';
import { myLeadSources } from '@/modules/studio-sales/settings';
import { boardPages, leadKpis, stageCounts, tagAndGroupFacets, viewPage, VIEW_PAGE } from '@/modules/studio-sales/leads-list';
import { boardColumnPlan } from '@/modules/studio-sales/lead-view';
import { leadFiltersToQuery, parseCursor, parseLeadFilters, parseSort } from '@/modules/studio-sales/lead-filters';
import { bulkActionsFor } from '@/modules/studio-sales/bulk-rules';
import { taskPeople } from '@/modules/studio-sales/tasks';
import { AddLeadButton } from './Board';
import { AxBoard } from './AxBoard';
import { AxList } from './AxList';
import { KpiCards, OwnerPicker, SourceTabs, Toolbar, ViewToggle } from './LeadsControls';
import { StaleReview } from './StaleReview';

export const metadata: Metadata = {
  title: 'Leads',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

/**
 * The Leads tab, laid out as AxLeads' is (owner, 12 Oct 2026), top to bottom:
 *
 * 1. "Leads" (a salesperson: "My leads") and, for owner and PM, whose leads —
 *    All, My leads, each person; on the right List | Board and + Add lead.
 * 2. "N leads need attention — no contact in 7+ days. Review", and once a
 *    day a popup offering the same.
 * 3. Six KPI cards; four of them are filters.
 * 4. Filters ▾ (the panel, with saved views), then Today (n) and the sort.
 * 5. The board (every column, lazy cards) or the list (infinite scroll).
 *
 * Everything is in the URL and counted in SQL; nothing loads every lead
 * (26,000 at Hauspire). A salesperson sees their own leads, and the pool to
 * claim from — never a colleague's.
 */
export default async function ClientsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const one = (k: string) => (Array.isArray(sp[k]) ? sp[k]![0] : (sp[k] as string | undefined));
  const scope = await myLeadScope();
  if (!scope) {
    return (
      <main className="content cl-page">
        <div className="empty">
          <b>Clients are for the people who work them.</b>
          <span className="muted">Ask your studio owner if you should see them.</span>
        </div>
      </main>
    );
  }

  const views = await myViews();
  /* A fresh visit opens the starred view, as AxLeads does. Any parameter at
     all (even just the view) means the person chose what to see. */
  const starred = views.find((v) => v.isDefault);
  if (Object.keys(sp).length === 0 && starred && (starred.filters.query || starred.filters.view)) {
    const p = new URLSearchParams(starred.filters.query ?? '');
    p.set('view', starred.filters.view ?? 'board');
    redirect(`/studio/clients?${p.toString()}`);
  }

  const seesAll = scope.seesAll;
  const filters = parseLeadFilters(sp);
  const sort = parseSort(one('sort'));
  const poolView = !seesAll && filters.owner === 'pool';
  const asked = one('view');
  const view: 'list' | 'board' = poolView ? 'list' : asked === 'list' ? 'list' : 'board';
  const query = leadFiltersToQuery(filters);
  const listQuery = [query, sort !== 'newest' ? `sort=${sort}` : ''].filter(Boolean).join('&');
  const now = new Date();

  const [stages, fields, sources, people, kpis] = await Promise.all([myStages(), myFields(), myLeadSources(), taskPeople(), leadKpis(scope, filters, now)]);
  const groupFields = fields.filter((f) => f.groupBy);
  const [facets, counts, list, columns] = await Promise.all([
    tagAndGroupFacets(scope, filters, groupFields.map((f) => f.key)),
    stageCounts(scope, filters, now),
    view === 'list' ? viewPage(scope, filters, sort, parseCursor(one('after')), now) : Promise.resolve(null),
    // The board: the stage filter picks the columns; open ones load, won/finished/lost wait until opened.
    view === 'board' ? boardPages(scope, filters, stages, now) : Promise.resolve(null),
  ]);
  const total = kpis.total;
  const listTotal = view === 'list' ? (filters.kpi ? await countFor(kpis, filters.kpi) : total) : total;
  const members = seesAll ? people : [];
  const stageList = stages.map((s) => ({ id: s.id, name: s.name, colour: s.colour, kind: s.kind }));
  /* The call sheet's suggested move reads the column order and flags (calling steps, 21 Oct 2026). */
  const callStages = stages.map((s) => ({ id: s.id, name: s.name, colour: s.colour, kind: s.kind, sortOrder: s.sortOrder, isIntake: s.isIntake, isCallStep: s.isCallStep }));
  const boardStages = boardColumnPlan(stageList, filters.stage).shown;

  const mayImport = mayOpen(scope.member, '/studio/clients/import');
  const title = poolView ? 'The pool' : seesAll ? 'Clients' : 'My leads';
  const sub = poolView
    ? 'Leads nobody has yet. Claim one and it is yours.'
    : seesAll
      ? 'Everyone who has ever called, walked in or come from us, in one list. They stay yours.'
      : 'Only the leads assigned to you. Call, WhatsApp and log the outcome from any card.';

  return (
    <main className="content cl-page">
      <div className="phead">
        <div>
          <h1>
            {title} <span className="mono n">{(view === 'list' ? listTotal : total).toLocaleString('en-IN')}</span>
          </h1>
          <p className="muted">{sub}</p>
        </div>
        <div className="hstack">
          {seesAll ? <OwnerPicker query={query} view={view} sort={sort} members={members} meId={scope.member.id} /> : null}
          {!seesAll ? (
            <Link href={poolView ? '/studio/clients' : '/studio/clients/pool'} className="btn sec">
              {poolView ? 'Back to my leads' : 'The pool, claim leads'}
            </Link>
          ) : null}
          {mayImport ? (
            <Link href="/studio/clients/import" className="btn sec">
              <LineIcon name="upload" size={17} />
              Import CSV
            </Link>
          ) : null}
          <AddLeadButton fields={fields} sources={sources} />
        </div>
      </div>

      {!poolView && kpis.stale > 0 ? <StaleReview count={kpis.stale} query={query} /> : null}

      <KpiCards kpis={kpis} query={query} view={view} sort={sort} />

      <Toolbar
        query={query}
        view={view}
        sort={sort}
        kpis={kpis}
        stages={stageList}
        sources={sources.map((s) => ({ id: s.id, name: s.name }))}
        tags={facets.tags}
        groups={groupFields.map((g) => ({ key: g.key, label: g.label, values: facets.groups[g.key] ?? [] }))}
        views={views}
        lead={
          poolView ? null : (
            <>
              <ViewToggle query={listQuery} view={view} sort={sort} />
              <SourceTabs query={query} view={view} sort={sort} />
            </>
          )
        }
      />

      {list ? (
        <AxList
          rows={list.rows}
          next={list.next}
          total={listTotal}
          query={listQuery}
          stages={callStages}
          fields={fields.map((f) => ({ key: f.key, label: f.label }))}
          actions={bulkActionsFor(scope.member)}
          people={people}
          seesAll={seesAll}
          poolView={poolView}
          meId={scope.member.id}
        />
      ) : null}

      {columns ? (
        <AxBoard
          stages={boardStages}
          counts={counts}
          initial={columns}
          query={query}
          showOwner={seesAll && (!filters.owner || filters.owner === 'anyone')}
          meId={scope.member.id}
          mayMove={!poolView}
          callStages={callStages}
          seesAll={seesAll}
        />
      ) : null}

      {seesAll ? (
        <p className="cl-foot">
          Stages are yours to rename in Settings. <Link href="/studio/clients/bin">Deleted clients</Link> · Board cards load {VIEW_PAGE} at a time per column.
        </p>
      ) : null}
    </main>
  );
}

/** The list's total under a card filter is that card's own count (the cards ignore their own filter). */
async function countFor(k: Awaited<ReturnType<typeof leadKpis>>, kpi: string): Promise<number> {
  switch (kpi) {
    case 'today':
      return k.today;
    case 'pending':
      return k.pending;
    case 'callbacks':
      return k.callbacks;
    case 'tasks':
      return k.tasks;
    case 'needs':
      return k.needs;
    default:
      return k.total;
  }
}
