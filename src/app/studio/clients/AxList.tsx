'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { BulkAction } from '@/modules/studio-sales/bulk-rules';
import { SELECT_FIRST } from '@/modules/studio-sales/bulk-rules';
import type { LostReasonName } from '@/modules/studio-practice/vocabulary';
import {
  bhk,
  coldLabel,
  columnChoices,
  columnValue,
  dayLabel,
  dueBadge,
  inr,
  isNewToday,
  readColumns,
  type LeadView,
} from '@/modules/studio-sales/lead-view';
import { Avatar, Dot, Modal, PillCold, PillDue, PillToday, StageBadge, TagChips, btnOutline, btnPrimary, useDismiss } from './ax-ui';
import { LostReasonDialog } from './AxBoard';
import { BulkBar, ClaimOne } from './LeadList';
import { moveLeadAction, viewPageAction } from './list-actions';
import { addNoteAction } from '../sales-actions';

const COLUMNS_KEY = 'studio.leads.columns';

/**
 * The leads list, as AxLeads draws it (12 Oct 2026): Lead (avatar, name with
 * its pills, phone and tags), Stage (change it in place), Created, Property,
 * Budget, then three columns whose header picks what they show — Timeline,
 * Notes, Last active by default, remembered in this browser. It scrolls on
 * forever ("Loading…"), fifty at a time. Tick rows or select every lead the
 * filters match for one action at a time; a salesperson in the pool claims.
 */
export function AxList({
  rows: first,
  next: firstNext,
  total,
  query,
  stages,
  fields,
  actions,
  people,
  seesAll,
  poolView,
}: {
  rows: LeadView[];
  next: string | null;
  total: number;
  /** The filters and sort, as the URL has them. */
  query: string;
  stages: { id: string; name: string; colour: string; kind: string }[];
  fields: { key: string; label: string }[];
  actions: BulkAction[];
  people: { id: string; name: string }[];
  seesAll: boolean;
  poolView: boolean;
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

  // The three swappable columns, remembered in this browser.
  const choices = columnChoices(fields);
  const [cols, setCols] = useState<[string, string, string]>(() => readColumns(null, choices));
  useEffect(() => {
    try {
      setCols(readColumns(JSON.parse(window.localStorage.getItem(COLUMNS_KEY) ?? 'null'), choices));
    } catch {
      /* No storage: the defaults. */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const pickCol = (i: number, v: string) => {
    const nextCols = [...cols] as [string, string, string];
    nextCols[i] = v;
    setCols(nextCols);
    try {
      window.localStorage.setItem(COLUMNS_KEY, JSON.stringify(nextCols));
    } catch {
      /* Not remembered this time. */
    }
  };

  // Infinite scroll: the sentinel below the table fetches the next page.
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

  // Selection: ticked rows, or everything matching (optionally the first N).
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [matching, setMatching] = useState<number | null | false>(false);
  const [said, setSaid] = useState<string | null>(null);
  const selected = matching !== false ? Math.min(matching ?? total, total) : picked.size;
  const shownActions = actions.filter((a) => (poolView ? a === 'claim' : seesAll ? true : a !== 'claim'));
  const clear = () => {
    setPicked(new Set());
    setMatching(false);
  };
  const target = () => (matching !== false ? { query, limit: matching } : { ids: [...picked] });

  const [noteFor, setNoteFor] = useState<LeadView | null>(null);
  const [lostFor, setLostFor] = useState<{ lead: LeadView; to: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function move(lead: LeadView, to: string, reason: string | null) {
    setError(null);
    const s = stages.find((x) => x.id === to);
    setRows((rs) => rs.map((r) => (r.id === lead.id ? { ...r, stageId: to, stageName: s?.name ?? r.stageName, stageColour: s?.colour ?? r.stageColour } : r)));
    const r = await moveLeadAction(lead.id, to, reason);
    if (!r.ok) {
      setError(r.error);
      setRows((rs) => rs.map((x) => (x.id === lead.id ? lead : x)));
    } else router.refresh();
  }

  return (
    <div className="flex flex-col gap-3">
      {shownActions.length > 0 && total > 0 ? (
        <div className="flex flex-wrap items-center gap-2 text-[13px]">
          <span className="text-[var(--s-ink-2)]">Select:</span>
          <button type="button" className={btnOutline} onClick={() => { setMatching(false); setPicked(new Set(rows.map((r) => r.id))); }}>
            Loaded ({rows.length.toLocaleString('en-IN')})
          </button>
          {SELECT_FIRST.filter((n) => n < total).map((n) => (
            <button key={n} type="button" className={btnOutline} onClick={() => setMatching(n)}>
              First {n.toLocaleString('en-IN')}
            </button>
          ))}
          <button type="button" className={btnOutline} onClick={() => setMatching(null)}>
            All {total.toLocaleString('en-IN')}
          </button>
          {selected > 0 ? (
            <button type="button" className="text-[var(--s-ink-2)] underline" onClick={clear}>
              Clear
            </button>
          ) : null}
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
          actions={shownActions}
          target={target}
          people={people}
          stages={stages}
          matching={matching !== false}
          onDone={(m) => {
            clear();
            setSaid(m ?? null);
          }}
        />
      ) : null}
      {error ? (
        <p role="alert" className="m-0 text-[13px] text-[var(--s-bad)]">
          {error}
        </p>
      ) : null}

      <div className="s-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[64rem] border-collapse text-[13.5px]">
            <thead>
              <tr className="text-left">
                {shownActions.length > 0 ? (
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
                <th scope="col" className={`${TH} pl-[18px]`}>
                  Lead
                </th>
                <th scope="col" className={TH}>
                  Stage
                </th>
                <th scope="col" className={TH}>
                  Created
                </th>
                <th scope="col" className={TH}>
                  Property
                </th>
                <th scope="col" className={TH}>
                  Budget
                </th>
                {cols.map((c, i) => (
                  <th key={i} scope="col" className={`${TH} text-center`} style={c === 'notes' ? { width: 170 } : undefined}>
                    <ColumnPicker value={c} choices={choices} onChange={(v) => pickCol(i, v)} />
                  </th>
                ))}
                {poolView ? <th scope="col" className={TH} /> : null}
              </tr>
            </thead>
            <tbody>
              {rows.map((l) => {
                const fresh = now ? isNewToday(l.createdAt, now) : false;
                const cold = !now || fresh ? null : coldLabel(l, now);
                const due = !now || l.flags.closed ? null : dueBadge(l.nextActionOn, now);
                const ticked = matching !== false || picked.has(l.id);
                const href = `/studio/clients/${l.id}`;
                const open = () => (poolView ? undefined : router.push(href));
                return (
                  <tr
                    key={l.id}
                    onClick={open}
                    className={`group h-[57px] border-t border-[var(--s-rule)] ${poolView ? '' : 'cursor-pointer'} hover:bg-[var(--s-surface-2)] ${ticked ? 'bg-[var(--s-accent-wash)]' : ''} ${fresh ? 'shadow-[inset_3px_0_0_var(--s-accent)]' : ''}`}
                  >
                    {shownActions.length > 0 ? (
                      <td className={TD} onClick={(e) => e.stopPropagation()}>
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
                    <td className={`${TD} pl-[18px]`}>
                      <div className="flex items-center gap-3">
                        <Avatar name={l.name} />
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            {poolView ? (
                              <span className="text-[13.5px] font-semibold">{l.name}</span>
                            ) : (
                              <Link href={href} onClick={(e) => e.stopPropagation()} className="text-[13.5px] font-semibold text-[var(--s-ink)] no-underline hover:underline">
                                {l.name}
                              </Link>
                            )}
                            {fresh ? <PillToday /> : null}
                            {cold ? <PillCold label={cold} /> : null}
                            {due ? <PillDue bucket={due.bucket} label={due.label} /> : null}
                          </div>
                          <div className="flex items-center gap-2 text-[12px] text-[var(--s-ink-3)]">
                            {/* A pool lead's phone stays with the server until it is claimed (claimableView). */}
                            {poolView ? null : l.phone ? <span className="s-num">{l.phone}</span> : <span className="text-[var(--s-warn)]">no phone yet</span>}
                            <TagChips tags={l.tags} />
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className={TD} onClick={(e) => e.stopPropagation()}>
                      {poolView ? (
                        <StageBadge name={l.stageName} colour={l.stageColour} />
                      ) : (
                        <StagePicker
                          lead={l}
                          stages={stages}
                          onMove={(to) => {
                            if (stages.find((s) => s.id === to)?.kind === 'LOST') setLostFor({ lead: l, to });
                            else void move(l, to, null);
                          }}
                        />
                      )}
                    </td>
                    <td className={`${TD} text-[12px] text-[var(--s-ink-3)]`}>{dayLabel(l.createdAt)}</td>
                    <td className={TD}>
                      <div className="text-[13px] font-medium">{bhk(l.config) ?? '—'}</div>
                      <div className="text-[12px] text-[var(--s-ink-3)]">{[l.society, l.locality].filter(Boolean).join(' · ') || '—'}</div>
                    </td>
                    <td className={`${TD} s-num whitespace-nowrap font-semibold`}>{inr(l.budgetPaise) ?? <span className="text-[var(--s-ink-3)]">—</span>}</td>
                    {cols.map((c, i) => (
                      <td key={i} className={`${TD} text-[12px] text-[var(--s-ink-3)]`} style={c === 'notes' ? { width: 170, maxWidth: 170 } : undefined} onClick={c === 'notes' ? (e) => e.stopPropagation() : undefined}>
                        {c === 'notes' ? (
                          <div className="flex min-w-0 items-center gap-2">
                            {!poolView ? (
                              <button type="button" title="Add note" aria-label={`Add a note to ${l.name}`} onClick={() => setNoteFor(l)} className="flex-none rounded-[6px] p-1 opacity-60 hover:bg-[var(--s-rail-active)] hover:opacity-100">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                                  <path d="M5 4h14v12l-4 4H5zM15 20v-4h4M8 9h8M8 13h5" />
                                </svg>
                              </button>
                            ) : null}
                            {l.noteCount > 0 ? (
                              <>
                                <span className="min-w-0 truncate" title={l.latestNote ?? undefined}>
                                  {l.latestNote}
                                </span>
                                {l.noteCount > 1 ? <span className="flex-none rounded-full border border-[var(--s-rule)] bg-[var(--s-surface-2)] px-1.5 text-[11px] font-semibold">+{l.noteCount - 1}</span> : null}
                              </>
                            ) : (
                              <span className="opacity-50">—</span>
                            )}
                          </div>
                        ) : (
                          (now ? columnValue(l, c, now) : null) ?? <span className="opacity-50">—</span>
                        )}
                      </td>
                    ))}
                    {poolView ? (
                      <td className={`${TD} text-right`} onClick={(e) => e.stopPropagation()}>
                        <ClaimOne id={l.id} />
                      </td>
                    ) : null}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {rows.length === 0 ? (
          <div className="px-4 py-10 text-center">
            <p className="m-0 font-semibold">{poolView ? 'Nothing in the pool — every lead has an owner.' : 'No leads match these filters'}</p>
            {!poolView ? <p className="m-0 mt-1 text-[13px] text-[var(--s-ink-3)]">Try clearing a filter or widening the search.</p> : null}
          </div>
        ) : null}
      </div>
      {next ? <div ref={sentinel} style={{ height: 1 }} aria-hidden /> : null}
      <p className="m-0 pl-0.5 text-[12px] text-[var(--s-ink-3)]">{loading ? 'Loading…' : `${total.toLocaleString('en-IN')} ${total === 1 ? 'lead' : 'leads'}`}</p>

      {noteFor ? <QuickNote lead={noteFor} onClose={() => setNoteFor(null)} onSaved={(text) => setRows((rs) => rs.map((r) => (r.id === noteFor.id ? { ...r, latestNote: text, noteCount: r.noteCount + 1 } : r)))} /> : null}
      {lostFor ? (
        <LostReasonDialog
          name={lostFor.lead.name}
          onClose={() => setLostFor(null)}
          onPick={(reason: LostReasonName) => {
            const f = lostFor;
            setLostFor(null);
            void move(f.lead, f.to, reason);
          }}
        />
      ) : null}
    </div>
  );
}

const TH = 'sticky top-0 z-[1] whitespace-nowrap border-b border-[var(--s-rule)] bg-[var(--s-surface)] px-3.5 py-2.5 text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--s-ink-3)]';
const TD = 'px-3.5 py-2 align-middle';

/** The Stage cell: the badge, and a menu of every column with its dot. */
function StagePicker({ lead, stages, onMove }: { lead: LeadView; stages: { id: string; name: string; colour: string }[]; onMove: (stageId: string) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useDismiss<HTMLDivElement>(open, () => setOpen(false));
  return (
    <div ref={ref} className="relative inline-flex">
      <button type="button" title="Change stage" aria-haspopup="listbox" aria-expanded={open} onClick={() => setOpen((o) => !o)} className="inline-flex items-center gap-1">
        <StageBadge name={lead.stageName} colour={lead.stageColour} />
        <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden className="opacity-50">
          <path d="M4 6l4 4 4-4" />
        </svg>
      </button>
      {open ? (
        <ul role="listbox" className="absolute left-0 top-full z-50 mt-1 max-h-[22rem] w-[220px] list-none overflow-y-auto rounded-[10px] border border-[var(--s-rule)] bg-[var(--s-surface)] p-1 shadow-[var(--s-lift)]">
          {stages.map((s) => (
            <li key={s.id}>
              <button
                type="button"
                role="option"
                aria-selected={s.id === lead.stageId}
                onClick={() => {
                  setOpen(false);
                  if (s.id !== lead.stageId) onMove(s.id);
                }}
                className="flex w-full items-center gap-2 rounded-[7px] px-2.5 py-1.5 text-left text-[13px] hover:bg-[var(--s-rail-active)]"
              >
                <Dot colour={s.colour} />
                <span className="truncate">{s.name}</span>
                {s.id === lead.stageId ? <span className="ml-auto text-[var(--s-accent)]">✓</span> : null}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

/** A column header: its field, and a menu to pick another. */
function ColumnPicker({ value, choices, onChange }: { value: string; choices: { value: string; label: string }[]; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useDismiss<HTMLDivElement>(open, () => setOpen(false));
  return (
    <div ref={ref} className="relative inline-flex normal-case">
      <button type="button" title="Choose field" onClick={() => setOpen((o) => !o)} className="inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-[0.04em]">
        {choices.find((c) => c.value === value)?.label ?? 'Field'}
        <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden className="opacity-60">
          <path d="M4 6l4 4 4-4" />
        </svg>
      </button>
      {open ? (
        <ul className="absolute right-0 top-full z-50 mt-1 max-h-[20rem] w-[200px] list-none overflow-y-auto rounded-[10px] border border-[var(--s-rule)] bg-[var(--s-surface)] p-1 text-left shadow-[var(--s-lift)]">
          {choices.map((c) => (
            <li key={c.value}>
              <button
                type="button"
                onClick={() => {
                  onChange(c.value);
                  setOpen(false);
                }}
                className="flex w-full items-center gap-2 rounded-[7px] px-2.5 py-1.5 text-[13px] font-normal tracking-normal text-[var(--s-ink)] hover:bg-[var(--s-rail-active)]"
              >
                {c.label}
                {c.value === value ? <span className="ml-auto text-[var(--s-accent)]">✓</span> : null}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

/** The note icon on a row: add an internal note without opening the lead. */
function QuickNote({ lead, onClose, onSaved }: { lead: LeadView; onClose: () => void; onSaved: (text: string) => void }) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <Modal onClose={onClose} width="min(460px, 94vw)" labelledBy="quick-note">
      <div className="flex flex-col gap-3 px-5 py-4">
        <h2 id="quick-note" className="m-0 text-[16px] font-semibold">
          Note on {lead.name}
        </h2>
        <textarea autoFocus rows={4} value={text} onChange={(e) => setText(e.target.value)} placeholder="Add internal note" className="w-full resize-y rounded-[9px] border border-[var(--s-rule)] px-3 py-2 text-[13.5px]" />
        {error ? <p className="m-0 text-[13px] text-[var(--s-bad)]">{error}</p> : null}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className={btnOutline}>
            Cancel
          </button>
          <button
            type="button"
            disabled={busy || !text.trim()}
            onClick={async () => {
              setBusy(true);
              const r = await addNoteAction(lead.id, text.trim());
              setBusy(false);
              if (!r.ok) return setError(r.error);
              onSaved(text.trim());
              onClose();
            }}
            className={btnPrimary}
          >
            {busy ? 'Saving…' : 'Save note'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
