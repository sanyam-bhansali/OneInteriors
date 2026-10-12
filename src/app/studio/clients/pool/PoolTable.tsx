'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { SELECT_FIRST, type BulkAction } from '@/modules/studio-sales/bulk-rules';
import { NOT_SET } from '@/modules/studio-sales/lead-filters';
import { relTime, sourceLabel, type LeadView } from '@/modules/studio-sales/lead-view';
import { Avatar, SelectMenu, StageBadge, btnOutline } from '../ax-ui';
import { BulkBar, ClaimOne } from '../LeadList';
import { bulkAssignAction, viewPageAction } from '../list-actions';
import { Said, useAct } from '../../SalesUi';

/**
 * The pool, as AxLeads lays it out (12 Oct 2026): "N unassigned", All leads,
 * grouping by your fields, Select (all / first 100 / 500 / 1,000), Filters,
 * search, Import CSV; rows of Lead, Stage, Source, Age and the action —
 * owner and PM give a lead to someone, a salesperson claims it. Fifty at a
 * time as you scroll.
 */
export function PoolTable({
  rows: first,
  next: firstNext,
  total,
  query,
  people,
  actions,
  seesAll,
  showingAll,
  groups,
  groupKey,
  stages,
}: {
  rows: LeadView[];
  next: string | null;
  total: number;
  query: string;
  people: { id: string; name: string }[];
  actions: BulkAction[];
  seesAll: boolean;
  showingAll: boolean;
  groups: { key: string; label: string; values: { value: string; n: number }[] }[];
  groupKey: string;
  stages: { id: string; name: string; kind: string }[];
}) {
  const router = useRouter();
  const [rows, setRows] = useState(first);
  const [next, setNext] = useState(firstNext);
  const [loading, setLoading] = useState(false);
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => setNow(new Date()), []);
  useEffect(() => {
    setRows(first);
    setNext(firstNext);
  }, [first, firstNext]);

  const sentinel = useRef<HTMLDivElement>(null);
  const busy = useRef(false);
  useEffect(() => {
    const el = sentinel.current;
    if (!el || !next) return;
    const io = new IntersectionObserver(async (entries) => {
      if (!entries[0]?.isIntersecting || busy.current || !next) return;
      busy.current = true;
      setLoading(true);
      const page = await viewPageAction(query, next);
      setRows((rs) => {
        const seen = new Set(rs.map((r) => r.id));
        return [...rs, ...page.rows.filter((r) => !seen.has(r.id))];
      });
      setNext(page.next);
      setLoading(false);
      busy.current = false;
    });
    io.observe(el);
    return () => io.disconnect();
  }, [next, query]);

  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [matching, setMatching] = useState<number | null | false>(false);
  const [said, setSaid] = useState<string | null>(null);
  const selected = matching !== false ? Math.min(matching ?? total, total) : picked.size;
  const poolActions: BulkAction[] = seesAll ? actions.filter((a) => a === 'assign' || a === 'claim' || a === 'split' || a === 'bin') : actions.filter((a) => a === 'claim');
  const clear = () => {
    setPicked(new Set());
    setMatching(false);
  };
  const group = groups.find((g) => g.key === groupKey) ?? null;
  const goGroup = (key: string) => {
    const p = new URLSearchParams(query);
    if (key) p.set('group', key);
    else p.delete('group');
    router.push(`/studio/clients/pool?${p.toString()}`);
  };
  const pickGroupValue = (value: string) => {
    const p = new URLSearchParams(query);
    p.delete(`cf.${groupKey}`);
    p.append(`cf.${groupKey}`, value);
    router.push(`/studio/clients/pool?${p.toString()}`);
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-[15px] font-semibold">
          <span className="s-num">{total.toLocaleString('en-IN')}</span> {showingAll ? 'leads' : 'unassigned'}
        </span>
        {seesAll ? (
          <label className="flex items-center gap-2 text-[13px]" title="Include leads that already have an owner">
            <input
              type="checkbox"
              checked={showingAll}
              onChange={(e) => {
                const p = new URLSearchParams(query);
                if (e.target.checked) p.set('all', '1');
                else p.delete('all');
                router.push(`/studio/clients/pool?${p.toString()}`);
              }}
            />
            All leads
          </label>
        ) : null}
        {groups.length > 0 ? (
          <SelectMenu value={groupKey} options={[{ value: '', label: 'No grouping' }, ...groups.map((g) => ({ value: g.key, label: `Group by ${g.label.toLowerCase()}` }))]} onChange={goGroup} />
        ) : null}
        {total > 0 && poolActions.length > 0 ? (
          <SelectMenu
            value=""
            label="Select"
            options={[{ value: 'all', label: `All ${total.toLocaleString('en-IN')}` }, ...SELECT_FIRST.filter((n) => n < total).map((n) => ({ value: String(n), label: `First ${n.toLocaleString('en-IN')}` }))]}
            onChange={(v) => {
              setPicked(new Set());
              setMatching(v === 'all' ? null : Number(v));
            }}
          />
        ) : null}
      </div>

      {group ? (
        <div className="s-card flex flex-wrap gap-2 p-3">
          {group.values.map((v) => (
            <button key={v.value} type="button" onClick={() => pickGroupValue(v.value)} className={btnOutline} title={`Show only these, then select and give them out`}>
              {v.value === NOT_SET ? `No ${group.label.toLowerCase()}` : v.value}
              <span className="s-num text-[var(--s-ink-3)]">{v.n.toLocaleString('en-IN')}</span>
            </button>
          ))}
        </div>
      ) : null}

      {said && selected === 0 ? (
        <p role="status" className="m-0 text-[13.5px] text-[var(--s-good)]">
          {said}
        </p>
      ) : null}
      {selected > 0 ? (
        <BulkBar
          count={selected}
          actions={poolActions}
          target={() => (matching !== false ? { query, limit: matching } : { ids: [...picked] })}
          people={people}
          stages={stages}
          matching={matching !== false}
          onDone={(m) => {
            clear();
            setSaid(m ?? null);
          }}
        />
      ) : null}

      <div className="s-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[44rem] border-collapse text-[13.5px]">
            <thead>
              <tr className="text-left">
                {poolActions.length > 0 ? (
                  <th scope="col" className={TH} style={{ width: 36 }}>
                    <input
                      type="checkbox"
                      aria-label="Select every loaded lead"
                      checked={matching !== false || (rows.length > 0 && rows.every((r) => picked.has(r.id)))}
                      onChange={(e) => {
                        setMatching(false);
                        setPicked(e.target.checked ? new Set(rows.map((r) => r.id)) : new Set());
                      }}
                    />
                  </th>
                ) : null}
                {['Lead', 'Stage', 'Source', 'Age', 'Action'].map((h) => (
                  <th key={h} scope="col" className={TH}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((l) => {
                const ticked = matching !== false || picked.has(l.id);
                return (
                  <tr key={l.id} className={`h-[52px] border-t border-[var(--s-rule)] hover:bg-[var(--s-surface-2)] ${ticked ? 'bg-[var(--s-accent-wash)]' : ''}`}>
                    {poolActions.length > 0 ? (
                      <td className={TD}>
                        <input
                          type="checkbox"
                          aria-label={`Select ${l.name}`}
                          checked={ticked}
                          disabled={matching !== false}
                          onChange={() =>
                            setPicked((p) => {
                              const n = new Set(p);
                              if (n.has(l.id)) n.delete(l.id);
                              else n.add(l.id);
                              return n;
                            })
                          }
                        />
                      </td>
                    ) : null}
                    <td className={TD}>
                      <div className="flex items-center gap-2.5">
                        <Avatar name={l.name} />
                        <div className="min-w-0">
                          {seesAll ? (
                            <Link href={`/studio/clients/${l.id}`} className="font-semibold text-[var(--s-ink)] no-underline hover:underline">
                              {l.name}
                            </Link>
                          ) : (
                            <span className="font-semibold">{l.name}</span>
                          )}
                          <div className="text-[12px] text-[var(--s-ink-3)]">{[l.society, l.locality, l.city].filter(Boolean).join(', ') || '—'}</div>
                        </div>
                      </div>
                    </td>
                    <td className={TD}>
                      <StageBadge name={l.stageName} colour={l.stageColour} />
                    </td>
                    <td className={`${TD} text-[12.5px]`}>{sourceLabel(l)}</td>
                    <td className={`${TD} text-[12.5px] text-[var(--s-ink-3)]`}>{now ? relTime(l.createdAt, now) : ''}</td>
                    <td className={TD}>{seesAll ? <AssignRow id={l.id} people={people} current={l.assignedToName} /> : <ClaimOne id={l.id} />}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {rows.length === 0 ? <p className="m-0 px-4 py-8 text-center text-[13.5px]">{showingAll ? 'No leads here.' : 'Nothing in the pool — every lead has an owner.'}</p> : null}
      </div>
      {next ? <div ref={sentinel} style={{ height: 1 }} aria-hidden /> : null}
      {loading ? <p className="m-0 text-[12px] text-[var(--s-ink-3)]">Loading…</p> : null}
    </div>
  );
}

const TH = 'whitespace-nowrap border-b border-[var(--s-rule)] bg-[var(--s-surface)] px-3.5 py-2.5 text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--s-ink-3)]';
const TD = 'px-3.5 py-2 align-middle';

/** Owner and PM: give this lead to someone, in one choice. */
function AssignRow({ id, people, current }: { id: string; people: { id: string; name: string }[]; current: string | null }) {
  const { pending, result, run } = useAct();
  return (
    <div className="flex flex-col">
      <SelectMenu
        value=""
        label={pending ? 'Assigning…' : (current ?? 'Assign to…')}
        options={people.map((p) => ({ value: p.id, label: p.name }))}
        onChange={(v) => run(() => bulkAssignAction({ ids: [id] }, v))}
      />
      <Said result={result} />
    </div>
  );
}
