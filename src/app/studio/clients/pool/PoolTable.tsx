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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, minWidth: 0 }}>
      <div className="hstack">
        <span style={{ fontSize: 15, fontWeight: 600 }}>
          <span className="mono">{total.toLocaleString('en-IN')}</span> {showingAll ? 'leads' : 'unassigned'}
        </span>
        {seesAll ? (
          <label className="hstack sm" style={{ gap: 6 }} title="Include leads that already have an owner">
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
        <div className="card" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, padding: 12 }}>
          {group.values.map((v) => (
            <button key={v.value} type="button" onClick={() => pickGroupValue(v.value)} className={btnOutline} title={`Show only these, then select and give them out`}>
              {v.value === NOT_SET ? `No ${group.label.toLowerCase()}` : v.value}
              <span className="mono muted">{v.n.toLocaleString('en-IN')}</span>
            </button>
          ))}
        </div>
      ) : null}

      {said && selected === 0 ? (
        <p role="status" className="cl-ok">
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

      <section className="card flush" style={{ overflow: 'hidden' }}>
        <div className="tscroll" style={{ minHeight: 280 }}>
          <table className="tbl cl-tbl cl-pooltbl">
            <thead>
              <tr>
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
                  <tr key={l.id} className={ticked ? 'pick' : ''}>
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
                      <div className="hstack" style={{ gap: 10, flexWrap: 'nowrap' }}>
                        <Avatar name={l.name} />
                        <div style={{ minWidth: 0 }}>
                          {seesAll ? (
                            <Link href={`/studio/clients/${l.id}`} style={{ fontWeight: 600 }}>
                              {l.name}
                            </Link>
                          ) : (
                            <span style={{ fontWeight: 600 }}>{l.name}</span>
                          )}
                          <div className="sub">{[l.society, l.locality, l.city].filter(Boolean).join(', ') || '—'}</div>
                        </div>
                      </div>
                    </td>
                    <td className={TD}>
                      <StageBadge name={l.stageName} colour={l.stageColour} />
                    </td>
                    <td className={TD}>
                      <span className={`chip xs ${l.source === 'ONE_INTERIORS' ? 'oi' : ''}`}>{sourceLabel(l)}</span>
                    </td>
                    <td className={`${TD} sub`}>{now ? relTime(l.createdAt, now) : ''}</td>
                    <td className={TD}>{seesAll ? <AssignRow id={l.id} people={people} current={l.assignedToName} /> : <ClaimOne id={l.id} />}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {rows.length === 0 ? <p className="muted" style={{ margin: 0, padding: '32px 16px', textAlign: 'center' }}>{showingAll ? 'No leads here.' : 'Nothing in the pool — every lead has an owner.'}</p> : null}
      </section>
      {next ? <div ref={sentinel} style={{ height: 1 }} aria-hidden /> : null}
      {loading ? <p className="cl-foot">Loading…</p> : null}
    </div>
  );
}

/* The design's table (tbl) draws the cells. */
const TH = '';
const TD = '';

/** Owner and PM: give this lead to someone, in one choice. */
function AssignRow({ id, people, current }: { id: string; people: { id: string; name: string }[]; current: string | null }) {
  const { pending, result, run } = useAct();
  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
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
