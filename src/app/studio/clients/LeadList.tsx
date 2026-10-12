'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { ClientRow } from '@/modules/studio-practice/clients';
import { SOURCE_LABELS, LOST_LABELS, colourOf, type LostReasonName } from '@/modules/studio-practice/vocabulary';
import { BULK_LABELS, SELECT_FIRST, type BulkAction } from '@/modules/studio-sales/bulk-rules';
import { PAGE_SIZE } from '@/modules/studio-sales/lead-filters';
import { Said, useAct, quietClass } from '../SalesUi';
import {
  bulkAssignAction,
  bulkBinAction,
  bulkClaimAction,
  bulkFollowUpAction,
  bulkMoveAction,
  bulkSplitAction,
} from './list-actions';

const DAY = 86_400_000;
const fmt = (d: Date) => d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: 'Asia/Kolkata' });

function istDayNumber(d: Date): number {
  return Math.floor((d.getTime() + 330 * 60_000) / DAY);
}

function followLabel(on: Date | null, now: Date): { text: string; late: boolean } | null {
  if (!on) return null;
  const days = istDayNumber(on) - istDayNumber(now);
  if (days < 0) return { text: days === -1 ? 'Yesterday' : `${-days}d late`, late: true };
  if (days === 0) return { text: 'Today', late: false };
  if (days === 1) return { text: 'Tomorrow', late: false };
  return { text: fmt(on), late: false };
}

function spokeLabel(at: Date | null, now: Date): string {
  if (!at) return 'Never';
  const days = istDayNumber(now) - istDayNumber(at);
  if (days <= 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days}d ago`;
  return fmt(at);
}

/** "Everything matching" (optionally the first N), or the ticked rows. */
type Pick = { mode: 'rows'; ids: Set<string> } | { mode: 'matching'; limit: number | null };

/**
 * The leads list (leads at scale, 12 Oct 2026): 50 a page, newest first by
 * default, with the filters in the URL. Tick rows, or select every lead the
 * filters match (or the first 100 / 500 / 1,000), then one action. A
 * salesperson looking at the pool sees Claim; owner and PM give out, split
 * evenly, move, set follow-ups and delete.
 */
export function LeadList({
  rows,
  total,
  next,
  page,
  query,
  sort,
  actions,
  people,
  stages,
  seesAll,
  poolView,
}: {
  rows: ClientRow[];
  total: number;
  next: string | null;
  page: number;
  /** The filters as a query string (no view, sort or page). */
  query: string;
  sort: string;
  actions: BulkAction[];
  /** People leads can be given to (owner, PM, sales). */
  people: { id: string; name: string }[];
  stages: { id: string; name: string; kind: string }[];
  seesAll: boolean;
  /** A salesperson looking at the pool: rows are claimable, not openable. */
  poolView: boolean;
}) {
  const router = useRouter();
  const [now] = useState(() => new Date());
  const [pick, setPick] = useState<Pick>({ mode: 'rows', ids: new Set() });
  const selected = pick.mode === 'matching' ? Math.min(pick.limit ?? total, total) : pick.ids.size;
  const allOnPage = pick.mode === 'rows' && rows.length > 0 && rows.every((r) => pick.ids.has(r.id));
  const shownActions = actions.filter((a) => (poolView ? a === 'claim' : seesAll ? true : a !== 'claim'));

  const fullQuery = () => {
    const p = new URLSearchParams(query);
    if (sort !== 'newest') p.set('sort', sort);
    return p.toString();
  };
  const target = () => (pick.mode === 'matching' ? { query: fullQuery(), limit: pick.limit } : { ids: [...pick.ids] });
  const clear = () => setPick({ mode: 'rows', ids: new Set() });
  const [said, setSaid] = useState<string | null>(null);

  const toggle = (id: string) =>
    setPick((p) => {
      const ids = new Set(p.mode === 'rows' ? p.ids : []);
      if (ids.has(id)) ids.delete(id);
      else ids.add(id);
      return { mode: 'rows', ids };
    });

  const from = (page - 1) * PAGE_SIZE + 1;
  const to = from + rows.length - 1;
  const pageHref = (after: string | null, n: number) => {
    const p = new URLSearchParams(fullQuery());
    p.set('view', 'list');
    if (after) {
      p.set('after', after);
      p.set('page', String(n));
    }
    return `/studio/clients?${p.toString()}`;
  };

  return (
    <div className="flex flex-col gap-3">
      {/* Selecting */}
      {shownActions.length > 0 && total > 0 ? (
        <div className="flex flex-wrap items-center gap-2 text-[13px]">
          <span className="text-[var(--s-ink-2)]">Select:</span>
          <button type="button" className={quietClass} onClick={() => setPick({ mode: 'rows', ids: new Set(rows.map((r) => r.id)) })}>
            This page ({rows.length})
          </button>
          {SELECT_FIRST.filter((n) => n < total).map((n) => (
            <button key={n} type="button" className={quietClass} onClick={() => setPick({ mode: 'matching', limit: n })}>
              First {n.toLocaleString('en-IN')}
            </button>
          ))}
          <button type="button" className={quietClass} onClick={() => setPick({ mode: 'matching', limit: null })}>
            All {total.toLocaleString('en-IN')} matching
          </button>
          {selected > 0 ? (
            <button type="button" className="text-[var(--s-ink-2)] underline" onClick={clear}>
              Clear selection
            </button>
          ) : null}
        </div>
      ) : null}

      {said && selected === 0 ? (
        <p role="status" className="m-0 text-[13.5px] text-[var(--s-good)]">
          {said}
        </p>
      ) : null}

      {selected > 0 ? <BulkBar count={selected} actions={shownActions} target={target} people={people} stages={stages} onDone={(m) => { clear(); setSaid(m ?? null); }} matching={pick.mode === 'matching'} /> : null}

      <div className="s-card overflow-x-auto">
        <table className="w-full min-w-[56rem] border-collapse text-[13.5px]">
          <thead>
            <tr className="bg-[var(--s-surface-2)] text-left">
              {shownActions.length > 0 ? (
                <th scope="col" className="w-9 px-3 py-2">
                  <input
                    type="checkbox"
                    aria-label="Select every lead on this page"
                    checked={allOnPage || pick.mode === 'matching'}
                    onChange={(e) => setPick(e.target.checked ? { mode: 'rows', ids: new Set(rows.map((r) => r.id)) } : { mode: 'rows', ids: new Set() })}
                  />
                </th>
              ) : null}
              {['Name', 'Phone', 'Column', seesAll ? 'Who has it' : null, 'Source', 'Follow-up', 'Last call', 'Added', poolView ? '' : null]
                .filter((h) => h !== null)
                .map((h, i) => (
                  <th key={`${h}-${i}`} scope="col" className="s-label px-3 py-2 font-medium">
                    {h}
                  </th>
                ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const due = followLabel(r.nextActionOn, now);
              const c = colourOf(r.stageColour);
              const ticked = pick.mode === 'matching' || pick.ids.has(r.id);
              return (
                <tr key={r.id} className={`border-t border-[var(--s-rule-soft)] ${ticked ? 'bg-[var(--s-rail-active)]/50' : ''}`}>
                  {shownActions.length > 0 ? (
                    <td className="px-3 py-2">
                      <input type="checkbox" aria-label={`Select ${r.name}`} checked={ticked} disabled={pick.mode === 'matching'} onChange={() => toggle(r.id)} />
                    </td>
                  ) : null}
                  <td className="px-3 py-2 font-medium">
                    {poolView ? (
                      r.name
                    ) : (
                      <Link href={`/studio/clients/${r.id}`} className="text-[var(--s-ink)] no-underline hover:underline">
                        {r.name}
                      </Link>
                    )}
                    {r.society ? <span className="block text-[12px] font-normal text-[var(--s-ink-3)]">{r.society}</span> : null}
                  </td>
                  <td className="s-num whitespace-nowrap px-3 py-2">{r.phone ?? '—'}</td>
                  <td className="px-3 py-2">
                    <span className="s-tag" style={{ background: c.wash, color: c.ink }}>
                      {r.stageName}
                    </span>
                    {r.stageKind === 'LOST' && r.lostReason ? <span className="block text-[12px] text-[var(--s-ink-3)]">{LOST_LABELS[r.lostReason as LostReasonName]}</span> : null}
                  </td>
                  {seesAll ? <td className="px-3 py-2">{r.assignedToName ?? <span className="text-[var(--s-ink-3)]">Pool</span>}</td> : null}
                  <td className="px-3 py-2">{r.leadSourceName ?? SOURCE_LABELS[r.source]}</td>
                  <td className="px-3 py-2" suppressHydrationWarning>
                    {due ? (
                      <span className={due.late ? 'font-medium text-[var(--s-bad)]' : ''}>
                        {due.text}
                        {r.nextAction ? <span className="block text-[12px] font-normal text-[var(--s-ink-3)]">{r.nextAction}</span> : null}
                      </span>
                    ) : (
                      <span className="text-[var(--s-ink-3)]">—</span>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2" suppressHydrationWarning>
                    {spokeLabel(r.lastContactedAt, now)}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2">{fmt(r.createdAt)}</td>
                  {poolView ? (
                    <td className="px-3 py-2 text-right">
                      <ClaimOne id={r.id} />
                    </td>
                  ) : null}
                </tr>
              );
            })}
          </tbody>
        </table>
        {rows.length === 0 ? <p className="m-0 px-4 py-6 text-[14px] text-[var(--s-ink-2)]">{poolView ? 'The pool is empty — every lead has somebody.' : 'Nothing matches these filters.'}</p> : null}
      </div>

      <div className="flex flex-wrap items-center gap-3 text-[13px] text-[var(--s-ink-2)]">
        <span className="s-num">
          {total === 0 ? 'No leads' : `${from.toLocaleString('en-IN')}–${to.toLocaleString('en-IN')} of ${total.toLocaleString('en-IN')}`}
        </span>
        {page > 1 ? (
          <>
            <button type="button" onClick={() => router.back()} className={quietClass}>
              ← Previous
            </button>
            <Link href={pageHref(null, 1)} className={quietClass}>
              First page
            </Link>
          </>
        ) : null}
        {next ? (
          <Link href={pageHref(next, page + 1)} className={quietClass}>
            Next {PAGE_SIZE} →
          </Link>
        ) : null}
      </div>
    </div>
  );
}

export function ClaimOne({ id }: { id: string }) {
  const { pending, result, run } = useAct();
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
      <button type="button" disabled={pending} onClick={() => run(() => bulkClaimAction({ ids: [id] }))} className="btn pri sm">
        {pending ? 'Claiming…' : 'Claim'}
      </button>
      <Said result={result} />
    </div>
  );
}

export function BulkBar({
  count,
  actions,
  target,
  people,
  stages,
  onDone,
  matching,
}: {
  count: number;
  actions: BulkAction[];
  target: () => unknown;
  people: { id: string; name: string }[];
  stages: { id: string; name: string; kind: string }[];
  onDone: (message?: string) => void;
  matching: boolean;
}) {
  const [action, setAction] = useState<BulkAction | ''>(actions.length === 1 ? actions[0]! : '');
  const [sure, setSure] = useState(false);
  const [to, setTo] = useState('');
  const [split, setSplit] = useState<string[]>([]);
  const [stage, setStage] = useState('');
  const [reason, setReason] = useState('');
  const [day, setDay] = useState('');
  const [time, setTime] = useState('');
  const [what, setWhat] = useState('');
  const { pending, result, run } = useAct();
  const n = count.toLocaleString('en-IN');
  const lostStage = stages.find((s) => s.id === stage)?.kind === 'LOST';

  const go = () =>
    run(
      () => {
        const t = target();
        switch (action) {
          case 'claim':
            return bulkClaimAction(t);
          case 'assign':
            return bulkAssignAction(t, to === 'pool' ? null : to);
          case 'split':
            return bulkSplitAction(t, split);
          case 'move':
            return bulkMoveAction(t, stage, lostStage ? reason : null);
          case 'followup':
            return bulkFollowUpAction(t, day, time, what);
          default:
            return bulkBinAction(t);
        }
      },
      (r) => {
        setSure(false);
        if (r.ok) onDone(r.message);
      },
    );

  const ready =
    action === 'claim' ||
    action === 'bin' ||
    (action === 'assign' && to !== '') ||
    (action === 'split' && split.length >= 2) ||
    (action === 'move' && stage !== '' && (!lostStage || reason !== '')) ||
    (action === 'followup' && day !== '');

  const verb: Record<BulkAction, string> = {
    claim: `Claim ${n} for me`,
    assign: to === 'pool' ? `Put ${n} back in the pool` : `Give ${n} to ${people.find((p) => p.id === to)?.name ?? '…'}`,
    split: `Split ${n} among ${split.length} people`,
    move: `Move ${n} to ${stages.find((s) => s.id === stage)?.name ?? '…'}`,
    followup: `Set the follow-up on ${n}`,
    bin: `Delete ${n}`,
  };

  return (
    <div className="card cl-bulk" style={{ padding: 14, gap: 12 }}>
      <div className="hstack">
        <span style={{ fontWeight: 600 }}>
          <span className="mono">{n}</span> selected{matching ? ' (everything the filters show)' : ''}
        </span>
        <select aria-label="What to do with them" value={action} onChange={(e) => { setAction(e.target.value as BulkAction); setSure(false); }} className="fld sm">
          <option value="">Do what…</option>
          {actions.map((a) => (
            <option key={a} value={a}>
              {BULK_LABELS[a]}
            </option>
          ))}
        </select>

        {action === 'assign' ? (
          <select aria-label="Give them to" value={to} onChange={(e) => { setTo(e.target.value); setSure(false); }} className="fld sm">
            <option value="">pick a person…</option>
            {people.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
            <option value="pool">Nobody — back to the pool</option>
          </select>
        ) : null}

        {action === 'move' ? (
          <>
            <select aria-label="Move to" value={stage} onChange={(e) => { setStage(e.target.value); setSure(false); }} className="fld sm">
              <option value="">pick a column…</option>
              {stages.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
            {lostStage ? (
              <select aria-label="Why lost" value={reason} onChange={(e) => setReason(e.target.value)} className="fld sm">
                <option value="">why lost…</option>
                {(Object.keys(LOST_LABELS) as LostReasonName[]).map((k) => (
                  <option key={k} value={k}>
                    {LOST_LABELS[k]}
                  </option>
                ))}
              </select>
            ) : null}
          </>
        ) : null}

        {action === 'followup' ? (
          <>
            <input type="date" aria-label="Follow-up day" value={day} onChange={(e) => setDay(e.target.value)} className="fld sm" />
            <input type="time" aria-label="Time (optional)" value={time} onChange={(e) => setTime(e.target.value)} className="fld sm" />
            <input type="text" aria-label="What to do (optional)" placeholder="What to do (optional)" value={what} onChange={(e) => setWhat(e.target.value)} className="fld sm" style={{ width: '14rem' }} />
          </>
        ) : null}
      </div>

      {action === 'split' ? (
        <fieldset className="hstack" style={{ margin: 0, border: 0, padding: 0, gap: 14 }}>
          <legend className="lbl" style={{ marginBottom: 6 }}>Share them out evenly, taking turns, between:</legend>
          {people.map((p) => (
            <label key={p.id} className="hstack" style={{ gap: 6 }}>
              <input
                type="checkbox"
                checked={split.includes(p.id)}
                onChange={(e) => {
                  setSure(false);
                  setSplit((s) => (e.target.checked ? [...s, p.id] : s.filter((x) => x !== p.id)));
                }}
              />
              {p.name}
            </label>
          ))}
          {split.length >= 2 ? (
            <span className="muted">About {Math.ceil(count / split.length).toLocaleString('en-IN')} each.</span>
          ) : null}
        </fieldset>
      ) : null}

      {action && ready ? (
        <div className="hstack" style={{ gap: 8 }}>
          {sure || count === 1 || action === 'claim' ? (
            <button type="button" disabled={pending} onClick={go} className="btn pri sm">
              {pending ? 'Working…' : `Yes — ${verb[action]}`}
            </button>
          ) : (
            <button type="button" onClick={() => setSure(true)} className={action === 'bin' ? 'btn sec sm bad-b' : 'btn sec sm'}>
              {verb[action]}
            </button>
          )}
          {action === 'bin' ? <span className="muted sm">Into the bin for 30 days; ones with quotations or a booking are left alone.</span> : null}
          {action === 'assign' || action === 'split' ? <span className="muted sm">Each person is told.</span> : null}
        </div>
      ) : null}
      <Said result={result} />
    </div>
  );
}
