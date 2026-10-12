'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { LOST_LABELS, type LostReasonName } from '@/modules/studio-practice/vocabulary';
import { cardFacts, coldLabel, dueBadge, isNewToday, sourceLabel, type LeadView } from '@/modules/studio-sales/lead-view';
import { Avatar, Dot, Modal, PillCold, PillDue, PillToday, SourceIcon, TagChips, btnOutline, btnPrimary } from './ax-ui';
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
    <div>
      {error ? (
        <p role="alert" className="m-0 mb-2 text-[13px] text-[var(--s-bad)]">
          {error}
        </p>
      ) : null}
      <div ref={topRef} onScroll={() => mirror(topRef.current, boardRef.current)} className="mb-2 overflow-x-auto" aria-hidden>
        <div style={{ width: scrollW, height: 1 }} />
      </div>
      <div ref={boardRef} onScroll={() => mirror(boardRef.current, topRef.current)} className="flex items-start gap-3 overflow-x-auto pb-2">
        {stages.map((s) => {
          const col = cols[s.id] ?? { rows: [], next: null };
          const isOver = over === s.id;
          return (
            <section
              key={s.id}
              aria-label={`${s.name}, ${counts[s.id] ?? 0} leads`}
              onDragOver={(e) => {
                if (!mayMove || !drag) return;
                e.preventDefault();
                setOver(s.id);
              }}
              onDragLeave={() => setOver((o) => (o === s.id ? null : o))}
              onDrop={() => drop(s.id)}
              className={`flex min-h-[200px] w-[264px] flex-none flex-col gap-2.5 rounded-[14px] border p-2.5 transition-colors ${isOver ? 'border-[var(--s-accent)] bg-[var(--s-accent-wash)]' : 'border-[var(--s-rule)] bg-[var(--s-surface-2)]'}`}
            >
              <div className="flex items-center gap-2 px-1 py-0.5">
                <Dot colour={s.colour} />
                <span className="truncate text-[12.5px] font-semibold">{s.name}</span>
                <span className="s-num ml-auto rounded-full bg-[var(--s-surface)] px-2 py-px text-[11.5px] font-semibold text-[var(--s-ink-2)]">{(counts[s.id] ?? 0).toLocaleString('en-IN')}</span>
              </div>
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
              {col.lazy && (counts[s.id] ?? 0) > 0 ? (
                <button type="button" disabled={opening === s.id} onClick={() => void openColumn(s.id)} className={`${btnOutline} justify-center`}>
                  {opening === s.id ? 'Loading…' : `Show ${(counts[s.id] ?? 0).toLocaleString('en-IN')} ${(counts[s.id] ?? 0) === 1 ? 'lead' : 'leads'}`}
                </button>
              ) : null}
              {col.rows.length === 0 && !(col.lazy && (counts[s.id] ?? 0) > 0) ? <div className="rounded-[10px] border border-dashed border-[var(--s-rule)] py-[18px] text-center text-[12px] text-[var(--s-ink-3)]">Drop here</div> : null}
              {col.next && loading ? <div className="py-1.5 text-center text-[11.5px] text-[var(--s-ink-3)]">Loading…</div> : null}
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

/** One card: avatar, name, the pills, tags, then source · "2BHK · ₹15L" · owner. */
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
  const fresh = now ? isNewToday(lead.createdAt, now) : false;
  const cold = fresh || !now ? null : coldLabel(lead, now);
  const due = lead.flags.closed || !now ? null : dueBadge(lead.nextActionOn, now);
  const facts = cardFacts(lead);
  return (
    <Link
      href={`/studio/clients/${lead.id}`}
      draggable={draggable}
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', lead.id);
        onDragStart();
      }}
      onDragEnd={onDragEnd}
      className={`block rounded-[12px] border bg-[var(--s-surface)] p-[11px] text-[var(--s-ink)] no-underline shadow-[0_1px_2px_rgba(0,0,0,0.04)] ${draggable ? 'cursor-grab' : ''} ${dragging ? 'opacity-40' : ''} ${fresh ? 'border-l-[3px] border-[var(--s-rule)] border-l-[var(--s-accent)]' : 'border-[var(--s-rule)]'}`}
    >
      <div className="mb-2 flex items-center gap-2">
        <Avatar name={lead.name} />
        <span className="min-w-0 flex-1 truncate text-[13.5px] font-semibold">{lead.name}</span>
        {fresh ? <PillToday /> : null}
        {cold ? <PillCold label={cold} /> : null}
        {due ? <PillDue bucket={due.bucket} label={due.label} /> : null}
      </div>
      {lead.tags.length > 0 ? (
        <div className="mb-2 flex flex-wrap items-center gap-1.5">
          <TagChips tags={lead.tags} max={3} />
        </div>
      ) : null}
      <div className="flex items-center gap-2 text-[12px] text-[var(--s-ink-3)]">
        <SourceIcon source={lead.source} label={sourceLabel(lead)} />
        {facts ? <span className="min-w-0 truncate">{facts}</span> : null}
        {showOwner ? (
          <>
            <span className="flex-1" />
            {ownerName ? <span className="whitespace-nowrap">{ownerName}</span> : <span className="whitespace-nowrap text-[var(--s-warn)]">Unassigned</span>}
          </>
        ) : null}
      </div>
    </Link>
  );
}

/** Moving to a lost column: why, in one tap. */
export function LostReasonDialog({ name, onClose, onPick }: { name: string; onClose: () => void; onPick: (reason: LostReasonName) => void }) {
  return (
    <Modal onClose={onClose} width="min(420px, 92vw)" labelledBy="lost-title">
      <div className="px-5 py-4">
        <h2 id="lost-title" className="m-0 text-[16px] font-semibold">
          Why was {name} lost?
        </h2>
        <p className="m-0 mt-1 text-[13px] text-[var(--s-ink-2)]">One word is enough; the dashboard counts it.</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {(Object.keys(LOST_LABELS) as LostReasonName[]).map((k) => (
            <button key={k} type="button" onClick={() => onPick(k)} className={btnOutline}>
              {LOST_LABELS[k]}
            </button>
          ))}
        </div>
        <div className="mt-4 flex justify-end">
          <button type="button" onClick={onClose} className={btnPrimary}>
            Cancel
          </button>
        </div>
      </div>
    </Modal>
  );
}
