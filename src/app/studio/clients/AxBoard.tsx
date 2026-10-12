'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { LOST_LABELS, type LostReasonName } from '@/modules/studio-practice/vocabulary';
import { colourOf } from '@/modules/studio-practice/vocabulary';
import { bhk, coldLabel, dueBadge, inr, isNewToday, relTime, sourceLabel, type LeadView } from '@/modules/studio-sales/lead-view';
import { telLink, whatsappLink } from '@/modules/studio-sales/lead-rules';
import { initials } from '@/modules/studio-sales/lead-view';
import { LineIcon } from '../ui/icons';
import { Modal, PillCold, PillDue, PillToday, TagChips } from './ax-ui';
import { columnPageAction, moveLeadAction } from './list-actions';

export interface BoardStage {
  id: string;
  name: string;
  colour: string;
  kind: string;
}

/**
 * The board, as AxLeads draws it (12 Oct 2026): every column in pipeline
 * order, won and lost included, scrolling sideways with a scroll bar on top
 * as well; each column header is its colour dot, name and count (counted in
 * SQL with the filters on); cards load a page at a time, and scrolling to the
 * foot of the board loads the next page of every column that has more. Drag a
 * card to another column to move it ("Drop here" in an empty one); a lost
 * column asks why.
 */
export function AxBoard({
  stages,
  counts,
  initial,
  query,
  showOwner,
  meId,
  mayMove,
}: {
  stages: BoardStage[];
  counts: Record<string, number>;
  /** Each column's first page, from the server. */
  /** Won, finished and lost columns arrive `lazy`: counted, cards loaded when opened. */
  initial: Record<string, { rows: LeadView[]; next: string | null; lazy?: boolean }>;
  query: string;
  showOwner: boolean;
  meId: string | null;
  mayMove: boolean;
}) {
  const router = useRouter();
  const [cols, setCols] = useState<Record<string, { rows: LeadView[]; next: string | null; lazy?: boolean }>>(initial);
  const [opening, setOpening] = useState<string | null>(null);
  const [drag, setDrag] = useState<{ lead: LeadView; from: string } | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const [askLost, setAskLost] = useState<{ lead: LeadView; from: string; to: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  /* Time-based pills only after mount, so the server's markup and the browser's agree. */
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => setNow(new Date()), []);
  useEffect(() => setCols(initial), [initial]);

  // The top scroll bar mirrors the board's.
  const boardRef = useRef<HTMLDivElement>(null);
  const topRef = useRef<HTMLDivElement>(null);
  const [scrollW, setScrollW] = useState(0);
  useEffect(() => {
    const el = boardRef.current;
    if (!el) return;
    const measure = () => setScrollW(el.scrollWidth);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [stages.length]);
  const syncing = useRef(false);
  const mirror = (from: HTMLDivElement | null, to: HTMLDivElement | null) => {
    if (!from || !to || syncing.current) return;
    syncing.current = true;
    to.scrollLeft = from.scrollLeft;
    requestAnimationFrame(() => (syncing.current = false));
  };

  // Scrolling to the foot of the board loads the next page of every column with more.
  const anyMore = Object.values(cols).some((c) => c.next);
  const bottom = useRef<HTMLDivElement>(null);
  const loadingRef = useRef(false);
  useEffect(() => {
    const el = bottom.current;
    if (!el || !anyMore) return;
    const io = new IntersectionObserver(async (entries) => {
      if (!entries[0]?.isIntersecting || loadingRef.current) return;
      loadingRef.current = true;
      setLoading(true);
      for (const [stageId, c] of Object.entries(cols)) {
        if (!c.next) continue;
        const page = await columnPageAction(query, stageId, c.next);
        setCols((cs) => {
          const cur = cs[stageId] ?? { rows: [], next: null };
          const seen = new Set(cur.rows.map((r) => r.id));
          return { ...cs, [stageId]: { rows: [...cur.rows, ...page.rows.filter((r) => !seen.has(r.id))], next: page.next } };
        });
      }
      loadingRef.current = false;
      setLoading(false);
    });
    io.observe(el);
    return () => io.disconnect();
  }, [anyMore, cols, query]);

  /** Open a lazy column (won, finished, lost): its first page of cards. */
  async function openColumn(stageId: string) {
    setOpening(stageId);
    const page = await columnPageAction(query, stageId, null);
    setCols((cs) => {
      const cur = cs[stageId] ?? { rows: [], next: null };
      const seen = new Set(page.rows.map((r) => r.id));
      // Cards dropped here before it was opened stay on top.
      return { ...cs, [stageId]: { rows: [...cur.rows.filter((r) => !seen.has(r.id)), ...page.rows], next: page.next, lazy: false } };
    });
    setOpening(null);
  }

  async function move(lead: LeadView, from: string, to: string, reason: string | null) {
    setError(null);
    const target = stages.find((s) => s.id === to);
    // Moved on screen at once; put back if the server refuses.
    setCols((cs) => ({
      ...cs,
      [from]: { ...(cs[from] ?? { rows: [], next: null }), rows: (cs[from]?.rows ?? []).filter((r) => r.id !== lead.id) },
      [to]: { ...(cs[to] ?? { rows: [], next: null }), rows: [{ ...lead, stageId: to, stageName: target?.name ?? lead.stageName, stageColour: target?.colour ?? lead.stageColour }, ...(cs[to]?.rows ?? [])] },
    }));
    const r = await moveLeadAction(lead.id, to, reason);
    if (!r.ok) {
      setError(r.error);
      setCols((cs) => ({
        ...cs,
        [to]: { ...(cs[to] ?? { rows: [], next: null }), rows: (cs[to]?.rows ?? []).filter((x) => x.id !== lead.id) },
        [from]: { ...(cs[from] ?? { rows: [], next: null }), rows: [lead, ...(cs[from]?.rows ?? [])] },
      }));
      return;
    }
    router.refresh();
  }

  function drop(to: string) {
    const d = drag;
    setDrag(null);
    setOver(null);
    if (!d || d.from === to || !mayMove) return;
    const target = stages.find((s) => s.id === to);
    if (target?.kind === 'LOST') return setAskLost({ lead: d.lead, from: d.from, to });
    void move(d.lead, d.from, to, null);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
      {error ? (
        <p role="alert" className="cl-err">
          {error}
        </p>
      ) : null}
      <div ref={topRef} onScroll={() => mirror(topRef.current, boardRef.current)} className="cl-topscroll" aria-hidden>
        <div style={{ width: scrollW, height: 1 }} />
      </div>
      <div ref={boardRef} onScroll={() => mirror(boardRef.current, topRef.current)} className="board" role="list" aria-label="Clients by stage">
        {stages.map((s) => {
          const col = cols[s.id] ?? { rows: [], next: null };
          const isOver = over === s.id;
          const n = counts[s.id] ?? 0;
          const left = n - col.rows.length;
          return (
            <section
              key={s.id}
              role="listitem"
              aria-label={`${s.name}, ${n} leads`}
              onDragOver={(e) => {
                if (!mayMove || !drag) return;
                e.preventDefault();
                setOver(s.id);
              }}
              onDragLeave={() => setOver((o) => (o === s.id ? null : o))}
              onDrop={() => drop(s.id)}
            >
              <div className="colh">
                <i style={{ background: colourOf(s.colour).dot }} />
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name}</span>
                <span className="mono">{n.toLocaleString('en-IN')}</span>
              </div>
              <div className={`lane ${isOver ? 'over' : ''}`}>
                {col.rows.map((l) => (
                  <Card
                    key={l.id}
                    lead={l}
                    now={now}
                    showOwner={showOwner}
                    ownerName={l.assignedToId && l.assignedToId === meId ? 'Mine' : l.assignedToName}
                    draggable={mayMove}
                    dragging={drag?.lead.id === l.id}
                    onDragStart={() => setDrag({ lead: l, from: s.id })}
                    onDragEnd={() => setDrag(null)}
                  />
                ))}
                {col.lazy && n > 0 ? (
                  <button type="button" disabled={opening === s.id} onClick={() => void openColumn(s.id)} className="btn ghost sm" style={{ background: 'transparent' }}>
                    {opening === s.id ? 'Loading…' : `Show ${n.toLocaleString('en-IN')} ${n === 1 ? 'client' : 'clients'}`}
                  </button>
                ) : null}
                {col.rows.length === 0 && !(col.lazy && n > 0) ? <div className="drop">Drop here</div> : null}
                {!col.lazy && col.next && left > 0 ? <div className="lmore">{loading ? 'Loading…' : `+ ${left.toLocaleString('en-IN')} more`}</div> : null}
              </div>
            </section>
          );
        })}
      </div>
      {anyMore ? <div ref={bottom} style={{ height: 1 }} aria-hidden /> : null}

      {askLost ? (
        <LostReasonDialog
          name={askLost.lead.name}
          onClose={() => setAskLost(null)}
          onPick={(reason) => {
            const a = askLost;
            setAskLost(null);
            void move(a.lead, a.from, a.to, reason);
          }}
        />
      ) : null}
    </div>
  );
}

/**
 * One card, as the design draws it: name and where they live, the source and
 * budget chips (with Today, cold, due and tags), the next step, then when they
 * were last spoken to, Call and WhatsApp, and whose it is. The whole card
 * opens the lead; it drags to another column.
 */
function Card({
  lead,
  now,
  showOwner,
  ownerName,
  draggable,
  dragging,
  onDragStart,
  onDragEnd,
}: {
  lead: LeadView;
  now: Date | null;
  showOwner: boolean;
  ownerName: string | null;
  draggable: boolean;
  dragging: boolean;
  onDragStart: () => void;
  onDragEnd: () => void;
}) {
  const router = useRouter();
  const href = `/studio/clients/${lead.id}`;
  const fresh = now ? isNewToday(lead.createdAt, now) : false;
  const cold = fresh || !now ? null : coldLabel(lead, now);
  const due = lead.flags.closed || !now ? null : dueBadge(lead.nextActionOn, now);
  const home = [lead.locality ?? lead.society ?? lead.city, bhk(lead.config)].filter(Boolean).join(', ');
  const budget = inr(lead.budgetPaise);
  const tel = telLink(lead.phone);
  const wa = whatsappLink(lead.phone);
  const last = !now ? '' : lead.lastContactedAt ? `Last contact ${relTime(lead.lastContactedAt, now)}` : 'Not contacted yet';
  return (
    <div
      className={`ccard ${dragging ? 'dragging' : ''}`}
      draggable={draggable}
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', lead.id);
        onDragStart();
      }}
      onDragEnd={onDragEnd}
      onClick={(e) => {
        if ((e.target as HTMLElement).closest('a,button')) return;
        router.push(href);
      }}
    >
      <Link href={href} className="nm" draggable={false}>
        <b>{lead.name}</b>
        {home ? <span className="muted sm">{home}</span> : null}
      </Link>
      <div className="hstack" style={{ gap: 6 }}>
        <span className={`chip xs ${lead.source === 'ONE_INTERIORS' ? 'oi' : ''}`}>{sourceLabel(lead)}</span>
        {budget ? <span className="chip xs">{budget}</span> : null}
        {fresh ? <PillToday /> : null}
        {cold ? <PillCold label={cold} /> : null}
        {due ? <PillDue bucket={due.bucket} label={due.label} /> : null}
        <TagChips tags={lead.tags} max={2} />
      </div>
      {lead.nextAction ? (
        <span className="sm" style={{ color: due?.bucket === 'overdue' ? 'var(--bad)' : 'var(--ink)' }}>
          {lead.nextAction}
        </span>
      ) : null}
      <div className="hstack" style={{ justifyContent: 'space-between', gap: 8, flexWrap: 'nowrap' }}>
        <span className="sm" style={{ color: cold ? 'var(--bad)' : 'var(--muted)', fontWeight: cold ? 600 : 400, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {last}
        </span>
        <div className="cact">
          {tel ? (
            <a href={tel} aria-label={`Call ${lead.name}`} draggable={false}>
              <LineIcon name="phone" size={15} />
            </a>
          ) : null}
          {wa ? (
            <a href={wa} target="_blank" rel="noreferrer" aria-label={`WhatsApp ${lead.name}`} draggable={false}>
              <LineIcon name="chat" size={15} />
            </a>
          ) : null}
          {showOwner ? (
            ownerName ? (
              <span className="av" title={ownerName}>
                {ownerName === 'Mine' ? 'Me' : initials(ownerName)}
              </span>
            ) : (
              <span className="av" title="Unassigned, in the pool" style={{ background: 'var(--warn-bg)', color: 'var(--warn)' }}>
                ?
              </span>
            )
          ) : null}
        </div>
      </div>
    </div>
  );
}

/** Moving to a lost column: why, in one tap. */
export function LostReasonDialog({ name, onClose, onPick }: { name: string; onClose: () => void; onPick: (reason: LostReasonName) => void }) {
  return (
    <Modal onClose={onClose} width="min(420px, 92vw)" labelledBy="lost-title">
      <div className="sb">
        <h2 id="lost-title" style={{ margin: 0, fontSize: 17, fontWeight: 600 }}>
          Why was {name} lost?
        </h2>
        <p className="cl-sub">One word is enough; the dashboard counts it.</p>
        <div className="quick">
          {(Object.keys(LOST_LABELS) as LostReasonName[]).map((k) => (
            <button key={k} type="button" onClick={() => onPick(k)} >
              {LOST_LABELS[k]}
            </button>
          ))}
        </div>
        <div className="hstack" style={{ justifyContent: 'flex-end' }}>
          <button type="button" onClick={onClose} className="btn sec sm">
            Cancel
          </button>
        </div>
      </div>
    </Modal>
  );
}
