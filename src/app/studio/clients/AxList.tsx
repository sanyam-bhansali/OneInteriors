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
import { RowCall, type CallLogged, type CallSheetStage } from './CallLogger';
import { leadHrefIn, listViewContext } from '@/modules/studio-sales/lead-context';
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
 *
 * Each lead the member may work has Call and Log call on its row (calling
 * steps, owner 21 Oct 2026): the same sheet as the lead page, and the row
 * updates where it is.
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
  meId,
}: {
  rows: LeadView[];
  next: string | null;
  total: number;
  /** The filters and sort, as the URL has them. */
  query: string;
  stages: CallSheetStage[];
  fields: { key: string; label: string }[];
  actions: BulkAction[];
  people: { id: string; name: string }[];
  seesAll: boolean;
  poolView: boolean;
  /** The signed-in member: a salesperson logs calls on their own leads only. */
  meId: string;
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

  /** Log call may be offered on this row: the member's own lead, or any lead for owner and PM. Never the pool or the sample. */
  const mayCall = (l: LeadView) => !poolView && !l.isDemo && (seesAll || l.assignedToId === meId);
  /** After a call is logged from a row: the row shows it at once; the refresh brings the rest. */
  const called = (lead: LeadView, r: CallLogged) => {
    setRows((rs) =>
      rs.map((x) =>
        x.id === lead.id
          ? {
              ...x,
              lastContactedAt: r.at,
              ...(r.movedTo ? { stageId: r.movedTo.id, stageName: r.movedTo.name, stageColour: r.movedTo.colour, stageKind: r.movedTo.kind as LeadView['stageKind'] } : {}),
            }
          : x,
      ),
    );
    setSaid(r.movedTo ? `Call logged · ${lead.name} moved to ${r.movedTo.name}` : `Call logged · ${lead.name}`);
  };

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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, minWidth: 0 }}>
      {shownActions.length > 0 && total > 0 ? (
        <div className="hstack sm" style={{ gap: 6 }}>
          <span className="muted">Select:</span>
          <button type="button" className="btn ghost xs" onClick={() => { setMatching(false); setPicked(new Set(rows.map((r) => r.id))); }}>
            Loaded ({rows.length.toLocaleString('en-IN')})
          </button>
          {SELECT_FIRST.filter((n) => n < total).map((n) => (
            <button key={n} type="button" className="btn ghost xs" onClick={() => setMatching(n)}>
              First {n.toLocaleString('en-IN')}
            </button>
          ))}
          <button type="button" className="btn ghost xs" onClick={() => setMatching(null)}>
            All {total.toLocaleString('en-IN')}
          </button>
          {selected > 0 ? (
            <button type="button" className="btn xs" style={{ background: 'transparent', color: 'var(--muted)' }} onClick={clear}>
              Clear
            </button>
          ) : null}
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
        <p role="alert" className="cl-err">
          {error}
        </p>
      ) : null}

      <section className="card flush" style={{ overflow: 'hidden' }}>
        <div className="tscroll">
          <table className="tbl cl-tbl" style={{ minWidth: 1024 }}>
            <thead>
              <tr>
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
                <th scope="col" className={TH}>
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
                  <th key={i} scope="col" className={TH} style={c === 'notes' ? { width: 170 } : undefined}>
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
                /* The list rides along, for "Next lead →" on the lead page (improvement 8, owner 22 Oct 2026). */
                const href = leadHrefIn(l.id, listViewContext(query));
                const open = () => (poolView ? undefined : router.push(href));
                return (
                  <tr
                    key={l.id}
                    onClick={open}
                    className={`${poolView ? '' : 'go'} ${ticked ? 'pick' : ''} ${fresh ? 'fresh' : ''}`}
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
                    <td className={TD}>
                      <div className="hstack" style={{ gap: 12, flexWrap: 'nowrap' }}>
                        <Avatar name={l.name} />
                        <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
                          <div className="hstack" style={{ gap: 6 }}>
                            {poolView ? (
                              <span style={{ fontWeight: 600 }}>{l.name}</span>
                            ) : (
                              <Link href={href} onClick={(e) => e.stopPropagation()} style={{ fontWeight: 600 }}>
                                {l.name}
                              </Link>
                            )}
                            {fresh ? <PillToday /> : null}
                            {cold ? <PillCold label={cold} /> : null}
                            {due ? <PillDue bucket={due.bucket} label={due.label} /> : null}
                          </div>
                          <div className="hstack sub" style={{ gap: 6 }}>
                            {/* A pool lead's phone stays with the server until it is claimed (claimableView). */}
                            {poolView ? null : l.phone ? <span className="mono">{l.phone}</span> : <span className="warn-t">no phone yet</span>}
                            {mayCall(l) ? <RowCall lead={{ id: l.id, name: l.name, phone: l.phone, stageId: l.stageId }} stages={stages} compact onLogged={(r) => called(l, r)} /> : null}
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
                    <td className={`${TD} sub`}>{dayLabel(l.createdAt)}</td>
                    <td className={TD}>
                      <div style={{ fontWeight: 500 }}>{bhk(l.config) ?? '—'}</div>
                      <div className="sub">{[l.society, l.locality].filter(Boolean).join(' · ') || '—'}</div>
                    </td>
                    <td className={`${TD} mono`} style={{ whiteSpace: 'nowrap' }}>{inr(l.budgetPaise) ?? <span className="muted">—</span>}</td>
                    {cols.map((c, i) => (
                      <td key={i} className={`${TD} sub`} style={c === 'notes' ? { width: 170, maxWidth: 170 } : undefined} onClick={c === 'notes' ? (e) => e.stopPropagation() : undefined}>
                        {c === 'notes' ? (
                          <div className="hstack" style={{ gap: 6, flexWrap: 'nowrap', minWidth: 0 }}>
                            {!poolView ? (
                              <button type="button" title="Add note" aria-label={`Add a note to ${l.name}`} onClick={() => setNoteFor(l)} className="cl-iconbtn">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                                  <path d="M5 4h14v12l-4 4H5zM15 20v-4h4M8 9h8M8 13h5" />
                                </svg>
                              </button>
                            ) : null}
                            {l.noteCount > 0 ? (
                              <>
                                <span title={l.latestNote ?? undefined} style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  {l.latestNote}
                                </span>
                                {l.noteCount > 1 ? <span className="chip xs">+{l.noteCount - 1}</span> : null}
                              </>
                            ) : (
                              <span className="muted">—</span>
                            )}
                          </div>
                        ) : (
                          (now ? columnValue(l, c, now) : null) ?? <span className="muted">—</span>
                        )}
                      </td>
                    ))}
                    {poolView ? (
                      <td className={TD} style={{ textAlign: 'right' }} onClick={(e) => e.stopPropagation()}>
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
          <div className="empty" style={{ margin: 18, alignItems: 'center' }}>
            <p style={{ margin: 0, fontWeight: 600 }}>{poolView ? 'Nothing in the pool — every lead has an owner.' : 'No leads match these filters'}</p>
            {!poolView ? <p className="muted sm" style={{ margin: 0 }}>Try clearing a filter or widening the search.</p> : null}
          </div>
        ) : null}
      </section>
      {next ? <div ref={sentinel} style={{ height: 1 }} aria-hidden /> : null}
      <p className="cl-foot">{loading ? 'Loading…' : `${total.toLocaleString('en-IN')} ${total === 1 ? 'lead' : 'leads'}`}</p>

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

/* The design's table (tbl) draws the cells; these stay as hooks. */
const TH = '';
const TD = '';

/** The Stage cell: the badge, and a menu of every column with its dot. */
function StagePicker({ lead, stages, onMove }: { lead: LeadView; stages: { id: string; name: string; colour: string }[]; onMove: (stageId: string) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useDismiss<HTMLDivElement>(open, () => setOpen(false));
  return (
    <div ref={ref} className="cl-pop">
      <button type="button" title="Change stage" aria-haspopup="listbox" aria-expanded={open} onClick={() => setOpen((o) => !o)} style={{ border: 0, background: 'transparent', padding: 0, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
        <StageBadge name={lead.stageName} colour={lead.stageColour} />
        <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden style={{ opacity: 0.5 }}>
          <path d="M4 6l4 4 4-4" />
        </svg>
      </button>
      {open ? (
        <ul role="listbox" className="cl-menu" style={{ width: 220 }}>
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
                className="cl-mi"
              >
                <Dot colour={s.colour} />
                <span>{s.name}</span>
                {s.id === lead.stageId ? <span className="ok">✓</span> : null}
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
    <div ref={ref} className="cl-pop">
      <button type="button" title="Choose field" onClick={() => setOpen((o) => !o)} style={{ border: 0, background: 'transparent', padding: 0, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4, font: 'inherit', color: 'inherit' }}>
        {choices.find((c) => c.value === value)?.label ?? 'Field'}
        <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden style={{ opacity: 0.6 }}>
          <path d="M4 6l4 4 4-4" />
        </svg>
      </button>
      {open ? (
        <ul className="cl-menu r" style={{ width: 200 }}>
          {choices.map((c) => (
            <li key={c.value}>
              <button
                type="button"
                onClick={() => {
                  onChange(c.value);
                  setOpen(false);
                }}
                className="cl-mi"
              >
                {c.label}
                {c.value === value ? <span className="ok">✓</span> : null}
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
      <div className="sb">
        <h2 id="quick-note" style={{ margin: 0, fontSize: 17, fontWeight: 600 }}>
          Note on {lead.name}
        </h2>
        <textarea autoFocus rows={4} value={text} onChange={(e) => setText(e.target.value)} placeholder="Add internal note" className="fld" />
        {error ? <p className="cl-err">{error}</p> : null}
        <div className="hstack" style={{ justifyContent: 'flex-end' }}>
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
