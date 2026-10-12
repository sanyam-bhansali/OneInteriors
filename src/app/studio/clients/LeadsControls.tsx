'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  NOT_SET,
  PANEL_DUE,
  DUE_LABELS,
  SORT_LABELS,
  SORT_MENU,
  leadFiltersToQuery,
  parseLeadFilters,
  without,
  withCustom,
  type DueFilter,
  type KpiFilter,
  type LeadFilters,
  type SortKey,
} from '@/modules/studio-sales/lead-filters';
import { QUIET_AFTER_DAYS, SOURCE_LABELS, type ClientSourceName } from '@/modules/studio-practice/vocabulary';
import type { Kpis } from '@/modules/studio-sales/leads-list';
import type { SavedView } from '@/modules/studio-practice/saved-views';
import { MAX_VIEWS } from '@/modules/studio-practice/view-filters';
import { MultiSelect, SelectMenu, btnGhost, btnOutline, btnPrimary } from './ax-ui';
import { deleteViewAction, saveViewAction, setDefaultViewAction } from './view-actions';

/**
 * Push the leads URL with these filters, keeping the view and sort unless
 * told, and any page parameters that are not filters (`keep`: the pool's
 * `all=1` and `group=`), so changing or clearing a filter does not drop them.
 */
function useGo(view: string, sort: SortKey, base = '/studio/clients', keep: Record<string, string> = {}) {
  const router = useRouter();
  return (f: LeadFilters, over: { view?: string; sort?: SortKey } = {}) => {
    const p = new URLSearchParams(leadFiltersToQuery(f));
    p.set('view', over.view ?? view);
    const s = over.sort ?? sort;
    if (s !== 'newest') p.set('sort', s);
    for (const [k, v] of Object.entries(keep)) if (v) p.set(k, v);
    router.push(`${base}?${p.toString()}`);
  };
}

const ChevronDown = () => (
  <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden className="opacity-60">
    <path d="M4 6l4 4 4-4" />
  </svg>
);

/** The header's owner picker (owner and PM): All, My leads, then each person. */
export function OwnerPicker({ query, view, sort, members, meId }: { query: string; view: string; sort: SortKey; members: { id: string; name: string }[]; meId: string | null }) {
  const go = useGo(view, sort);
  const f = parseLeadFilters(new URLSearchParams(query));
  const value = f.owner ?? 'all';
  return (
    <SelectMenu
      value={value}
      options={[
        { value: 'all', label: 'All' },
        { value: 'me', label: 'My leads' },
        ...members.filter((m) => m.id !== meId).map((m) => ({ value: m.id, label: m.name })),
        { value: 'pool', label: 'Unassigned (pool)' },
      ]}
      onChange={(v) => go(v === 'all' ? without(f, 'owner') : { ...f, owner: v })}
    />
  );
}

/** List | Board. */
export function ViewToggle({ query, view, sort }: { query: string; view: 'list' | 'board'; sort: SortKey }) {
  const go = useGo(view, sort);
  const f = parseLeadFilters(new URLSearchParams(query));
  return (
    <div role="group" aria-label="List or board" className="flex overflow-hidden rounded-[9px] border border-[var(--s-rule)] bg-[var(--s-surface)] text-[13px] font-medium">
      {(['list', 'board'] as const).map((v) => (
        <button key={v} type="button" aria-pressed={view === v} onClick={() => go(f, { view: v })} className={`flex items-center gap-1.5 px-3 py-1.5 ${view === v ? 'bg-[var(--s-accent)] text-white' : 'hover:bg-[var(--s-rail-active)]'}`}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
            <path d={v === 'list' ? 'M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01' : 'M4 4h5v16H4zM10 4h5v10h-5zM16 4h4v7h-4z'} />
          </svg>
          {v === 'list' ? 'List' : 'Board'}
        </button>
      ))}
    </div>
  );
}

/**
 * The six KPI cards (AxLeads): Total leads · Pending · Callbacks · Tasks ·
 * Needs action · Converted. The four in the middle are filters: clicking one
 * outlines it and narrows the list and board to those leads; again clears it.
 */
export function KpiCards({ kpis, query, view, sort }: { kpis: Kpis; query: string; view: string; sort: SortKey }) {
  const go = useGo(view, sort);
  const f = parseLeadFilters(new URLSearchParams(query));
  const toggle = (k: KpiFilter) => go(f.kpi === k ? without(f, 'kpi') : { ...f, kpi: k });
  // Distinct leads (an overdue call AND an overdue task is one lead), the same rule the list filters by.
  const needs = kpis.needs;
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
      <Stat label="Total leads" value={kpis.total} note={kpis.newToday ? `+${kpis.newToday.toLocaleString('en-IN')} today` : 'all time'} noteTone="good" />
      <Stat label="Pending" value={kpis.pending} note="untouched — nothing done" noteTone={kpis.pending > 0 ? 'warn' : undefined} icon="M4 13h4l2 3h4l2-3h4M4 13l2-8h12l2 8v6H4z" iconTone={kpis.pending > 0 ? 'warn' : undefined} active={f.kpi === 'pending'} onClick={() => toggle('pending')} />
      <Stat label="Callbacks" value={kpis.callbacks} note={kpis.overdue > 0 ? `${kpis.overdue.toLocaleString('en-IN')} overdue` : 'calls scheduled'} noteTone={kpis.overdue > 0 ? 'bad' : undefined} icon="M4 12a8 8 0 0 1 14-5.3M20 12a8 8 0 0 1-14 5.3M18 3v4h-4M6 21v-4h4" iconTone="violet" active={f.kpi === 'callbacks'} onClick={() => toggle('callbacks')} />
      <Stat label="Tasks" value={kpis.tasks} note={kpis.overdueTasks > 0 ? `${kpis.overdueTasks.toLocaleString('en-IN')} overdue` : 'to follow up'} noteTone={kpis.overdueTasks > 0 ? 'bad' : undefined} icon="M5 4h14v12l-4 4H5zM15 20v-4h4M8 9h8M8 13h5" iconTone="accent" active={f.kpi === 'tasks'} onClick={() => toggle('tasks')} />
      <Stat label="Needs action" value={needs} note="overdue calls + tasks" noteTone={needs > 0 ? 'bad' : undefined} icon="M12 4 2.5 20h19zM12 10v4M12 17h.01" iconTone={needs > 0 ? 'bad' : undefined} active={f.kpi === 'needs'} onClick={() => toggle('needs')} />
      <Stat label="Converted" value={kpis.converted} note="won deals" noteTone="good" icon="M5 12.5l4.5 4.5L19 7.5" iconTone="good" />
    </div>
  );
}

const TONE: Record<string, string> = {
  good: 'text-[var(--s-good)]',
  warn: 'text-[var(--s-warn)]',
  bad: 'text-[var(--s-bad)]',
  violet: 'text-[#6a3f90]',
  accent: 'text-[var(--s-accent)]',
};

function Stat({ label, value, note, noteTone, icon, iconTone, active, onClick }: { label: string; value: number; note: string; noteTone?: string; icon?: string; iconTone?: string; active?: boolean; onClick?: () => void }) {
  const body = (
    <>
      <div className="flex items-center justify-between">
        <span className="text-[12px] font-medium text-[var(--s-ink-3)]">{label}</span>
        {icon ? (
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden className={iconTone ? TONE[iconTone] : 'text-[var(--s-ink-3)]'}>
            <path d={icon} />
          </svg>
        ) : null}
      </div>
      <div className="s-num mt-1 text-[26px] font-semibold tracking-tight">{value.toLocaleString('en-IN')}</div>
      <div className={`text-[12px] font-semibold ${noteTone ? TONE[noteTone] : 'text-[var(--s-ink-3)]'}`}>{note}</div>
    </>
  );
  const cls = `s-card px-[18px] py-4 text-left ${active ? 'border-[var(--s-accent)] shadow-[0_0_0_1px_var(--s-accent)]' : ''}`;
  return onClick ? (
    <button type="button" aria-pressed={active} onClick={onClick} className={`${cls} cursor-pointer transition-colors hover:border-[var(--s-ink-3)]`}>
      {body}
    </button>
  ) : (
    <div className={cls}>{body}</div>
  );
}

interface Facet {
  value: string;
  n: number;
}

/**
 * The toolbar (AxLeads): **Filters ▾** (with how many are on) opening the
 * panel — Stage, Source, Due, Tags, your group-by fields, Cold 7d+; saved
 * views as chips (★ default, ×) and "Save current view as…"; Cancel / Apply
 * — then, on the right, **Today (n)** and the sort.
 */
export function Toolbar({
  query,
  view,
  sort,
  kpis,
  stages,
  sources,
  tags,
  groups,
  views,
  base,
  keep,
  pool = false,
}: {
  query: string;
  view: 'list' | 'board';
  sort: SortKey;
  kpis: Kpis;
  stages: { id: string; name: string; colour: string }[];
  sources: { id: string; name: string }[];
  tags: Facet[];
  groups: { key: string; label: string; values: Facet[] }[];
  views: SavedView[];
  /** Where the controls point (the pool page reuses them). */
  base?: string;
  /** Page parameters to carry through every filter change (the pool's `all`, `group`). */
  keep?: Record<string, string>;
  /** The pool: Stage, Source, Tags and your fields only; no Today, sort or saved views. */
  pool?: boolean;
}) {
  const go = useGo(view, sort, base, keep);
  const f = parseLeadFilters(new URLSearchParams(query));
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<LeadFilters>(f);
  const [name, setName] = useState('');
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const panelCount = (f.stage?.length ?? 0) + (f.source?.length ?? 0) + (f.due?.length ?? 0) + (f.tags?.length ?? 0) + Object.values(f.custom ?? {}).reduce((n, v) => n + v.length, 0) + (f.stale ? 1 : 0);
  const fullQuery = [query, sort !== 'newest' ? `sort=${sort}` : ''].filter(Boolean).join('&');
  const activeView = views.find((v) => (v.filters.query ?? '') === fullQuery && (v.filters.view ?? view) === view) ?? null;
  const defaultOn = activeView?.isDefault ?? false;

  const run = (fn: () => Promise<{ ok: true } | { ok: false; error: string } | { idle: true }>) =>
    start(async () => {
      setError(null);
      const r = await fn();
      if ('error' in r) setError(r.error);
      else router.refresh();
    });

  const openPanel = () => {
    setDraft(f);
    setOpen((o) => !o);
  };
  const applyView = (v: SavedView) => {
    const p = new URLSearchParams(v.filters.query ?? '');
    p.set('view', v.filters.view ?? view);
    router.push(`/studio/clients?${p.toString()}`);
  };

  return (
    <div className="relative">
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={openPanel} aria-expanded={open} className={(panelCount > 0 && !defaultOn) || open ? btnPrimary : btnOutline}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
            <path d="M4 5h16l-6 7.5V19l-4 1v-7.5z" />
          </svg>
          Filters{panelCount > 0 && !defaultOn ? ` (${panelCount})` : ''}
          <ChevronDown />
        </button>
        {views
          .filter((v) => v.isDefault && v.id === activeView?.id)
          .map((v) => (
            <span key={v.id} className="inline-flex items-center gap-1 rounded-full border border-[var(--s-accent)] px-2.5 py-1 text-[12.5px] font-medium text-[var(--s-accent)]">
              ★ {v.name}
              <button type="button" aria-label="Remove this filter" onClick={() => go({}, { sort: 'newest' })} className="px-1">
                ×
              </button>
            </span>
          ))}
        {panelCount > 0 && !defaultOn ? (
          <button type="button" onClick={() => go({ ...(f.owner ? { owner: f.owner } : {}), ...(f.kpi ? { kpi: f.kpi } : {}), ...(f.q ? { q: f.q } : {}) })} className={btnGhost}>
            × Clear
          </button>
        ) : null}
        <span className="flex-1" />
        {pool ? null : (
        <>
        <button type="button" aria-pressed={f.kpi === 'today'} onClick={() => go(f.kpi === 'today' ? without(f, 'kpi') : { ...f, kpi: 'today' })} title="Due today — calls and tasks due today, and new leads nobody has touched (overdue ones are in Needs action)" className={f.kpi === 'today' ? btnPrimary : btnOutline}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
            <path d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v5l3 2" />
          </svg>
          Today{kpis.today > 0 ? ` (${kpis.today.toLocaleString('en-IN')})` : ''}
        </button>
        <SelectMenu value={sort} options={SORT_MENU.map((s) => ({ value: s, label: SORT_LABELS[s] }))} onChange={(v) => go(f, { sort: v as SortKey })} />
        </>
        )}
      </div>

      {open ? (
        <>
          <div className="fixed inset-0 z-40 bg-black/15 backdrop-blur-[1px]" onClick={() => setOpen(false)} aria-hidden />
          <div className="s-card relative z-50 mt-2 bg-[var(--s-surface-2)] p-2.5">
            <div className="flex flex-wrap items-center gap-2">
              <MultiSelect label="Stage" allLabel="All stages" values={draft.stage ?? []} options={stages.map((s) => ({ value: s.id, label: s.name, colour: s.colour }))} onChange={(v) => setDraft((d) => (v.length ? { ...d, stage: v } : without(d, 'stage')))} />
              <MultiSelect
                label="Source"
                allLabel="All sources"
                values={draft.source ?? []}
                options={[...(Object.keys(SOURCE_LABELS) as ClientSourceName[]).map((k) => ({ value: k, label: SOURCE_LABELS[k] })), ...sources.map((s) => ({ value: `own:${s.id}`, label: s.name }))]}
                onChange={(v) => setDraft((d) => (v.length ? { ...d, source: v } : without(d, 'source')))}
              />
              {pool ? null : <MultiSelect label="Due" allLabel="Any time" values={draft.due ?? []} options={PANEL_DUE.map((d) => ({ value: d, label: DUE_LABELS[d] }))} onChange={(v) => setDraft((d) => (v.length ? { ...d, due: v as DueFilter[] } : without(d, 'due')))} /> }
              {tags.length > 0 ? (
                <MultiSelect label="Tags" allLabel="All tags" values={draft.tags ?? []} options={tags.map((t) => ({ value: t.value, label: `${t.value} (${t.n.toLocaleString('en-IN')})` }))} onChange={(v) => setDraft((d) => (v.length ? { ...d, tags: v } : without(d, 'tags')))} />
              ) : null}
              {groups.map((g) => (
                <MultiSelect
                  key={g.key}
                  label={g.label}
                  allLabel={`All ${g.label.toLowerCase()}`}
                  values={draft.custom?.[g.key] ?? []}
                  options={g.values.map((v) => ({ value: v.value, label: `${v.value === NOT_SET ? 'Not set' : v.value} (${v.n.toLocaleString('en-IN')})` }))}
                  onChange={(v) => setDraft((d) => withCustom(d, g.key, v))}
                />
              ))}
              {!pool && (kpis.stale > 0 || draft.stale) ? (
                <button type="button" aria-pressed={draft.stale === true} onClick={() => setDraft((d) => (d.stale ? without(d, 'stale') : { ...d, stale: true }))} title={`Only leads with no contact in ${QUIET_AFTER_DAYS}+ days`} className={draft.stale ? btnPrimary : btnOutline}>
                  Cold {QUIET_AFTER_DAYS}d+ ({kpis.stale.toLocaleString('en-IN')})
                </button>
              ) : null}
            </div>

            <div className={`mt-3 border-t border-[var(--s-rule)] pt-2.5 ${pool ? 'hidden' : ''}`}>
              <div className="flex flex-wrap items-center gap-1.5">
                {views.map((v) => {
                  const on = v.id === activeView?.id;
                  return (
                    <span key={v.id} className={`inline-flex items-center gap-1 rounded-full border py-0.5 pl-2.5 pr-1 text-[12.5px] ${on || v.isDefault ? 'border-[var(--s-accent)]' : 'border-[var(--s-rule)]'} ${on ? 'bg-[var(--s-accent-wash)] font-semibold text-[var(--s-accent)]' : 'bg-[var(--s-surface)]'}`}>
                      <button type="button" onClick={() => (on ? go({}, { sort: 'newest' }) : applyView(v))} title={on ? 'Remove this filter' : 'Apply this filter'}>
                        {v.isDefault ? <span className="text-[var(--s-accent)]">★ </span> : null}
                        {v.name}
                      </button>
                      <button type="button" disabled={pending} onClick={() => run(() => setDefaultViewAction(v.isDefault ? null : v.id))} title={v.isDefault ? 'Unset default' : 'Set as default view'} className={`px-1 ${v.isDefault ? 'text-[var(--s-accent)]' : 'text-[var(--s-ink-3)]'}`}>
                        {v.isDefault ? '★' : '☆'}
                      </button>
                      <button type="button" disabled={pending} onClick={() => run(() => deleteViewAction(v.id))} title="Delete filter" aria-label={`Delete ${v.name}`} className="px-1 text-[var(--s-ink-3)]">
                        ×
                      </button>
                    </span>
                  );
                })}
                {views.length < MAX_VIEWS ? (
                  <span className="flex items-center gap-2">
                    <input
                      value={name}
                      maxLength={40}
                      onChange={(e) => setName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && name.trim()) run(() => saveViewAction(name.trim(), { query: [leadFiltersToQuery(draft), sort !== 'newest' ? `sort=${sort}` : ''].filter(Boolean).join('&'), view }));
                      }}
                      placeholder="Save current view as…"
                      className="h-[30px] w-[170px] rounded-[8px] border border-[var(--s-rule)] bg-[var(--s-surface)] px-2.5 text-[12.5px]"
                    />
                    <button
                      type="button"
                      disabled={!name.trim() || pending}
                      onClick={() => run(async () => {
                        const r = await saveViewAction(name.trim(), { query: [leadFiltersToQuery(draft), sort !== 'newest' ? `sort=${sort}` : ''].filter(Boolean).join('&'), view });
                        if ('ok' in r && r.ok) setName('');
                        return r;
                      })}
                      className={btnOutline}
                    >
                      + Save
                    </button>
                  </span>
                ) : null}
              </div>
              {error ? <p className="m-0 mt-2 text-[12.5px] text-[var(--s-bad)]">{error}</p> : null}
            </div>

            <div className="mt-4 flex items-center justify-end gap-2">
              <button type="button" onClick={() => setDraft({ ...(f.owner ? { owner: f.owner } : {}), ...(f.q ? { q: f.q } : {}) })} className={btnGhost}>
                × Clear all
              </button>
              <button type="button" onClick={() => setOpen(false)} className={btnOutline}>
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  go({ ...draft, ...(f.kpi ? { kpi: f.kpi } : {}) });
                }}
                className={btnPrimary}
              >
                ✓ Apply
              </button>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
