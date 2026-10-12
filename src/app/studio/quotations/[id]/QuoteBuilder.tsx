'use client';

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { formatINR } from '@/lib/money';
import { computeTotals, isUnpriced, keptFeeBps, lineAmount } from '@/modules/studio-quote/pricing';
import { compareToIssued, byRoom, type ComparableLine } from '@/modules/studio-quote/revision';
import type { QuoteRow } from '@/modules/studio-quote/quotes';
import type { ProductRow } from '@/modules/studio-quote/store';
import type { SaveLineInput } from '@/modules/studio-quote/quotes';
import { saveLinesAction } from '../actions';
import {
  ConfigurePanel,
  AddLinePanel,
  RoomSection,
  type AddSize,
  type EditableLine,
} from './QuoteLines';
import { TotalsPanel, RoomBreakdown, DocumentPreview, ChangesPanel } from './QuotePanels';
import { TermsPanel, pctToBps, rupeesToPaiseText, type TermsDraft } from './TermsPanel';
import { ClientPanel } from './ClientPanel';
import { FloorPlanView } from '@/components/floorplan/FloorPlanView';
import type { QuoteTermsInput } from '@/modules/studio-quote/quotes';

/**
 * The quotation builder.
 *
 * ## One state, recalculated as they type
 *
 * Every line lives in this component, and the total, the room breakdown and
 * the document preview are all derived from it on each render. Nothing is
 * memoised into a second copy of the truth.
 *
 * This replaced a row-by-row save, and the change matters more than it sounds.
 * Pricing a job is forty lines of arithmetic where the interesting number is
 * always the one at the bottom: a designer widens a wardrobe to see what it
 * does to the total, twice, and then puts it back. Under the old build each of
 * those was a round trip and the total lagged the conversation. Under this one
 * the figure moves while they are still talking.
 *
 * The cost is honest: work can be unsaved. That is handled twice over — a save
 * bar that will not go away while anything is pending, and a browser warning
 * on the way out. Autosave was the other option and was rejected for a
 * specific reason: a quotation is a document with a number on it, and quietly
 * writing a half-typed rate to it is worse than asking.
 *
 * ## Why the amounts are computed here and again on the server
 *
 * `lineAmount` is pure and runs in both places. The browser's copy is for the
 * figure on screen; the server's is the one that is stored, because a total
 * that arrived from a browser is a total somebody could have sent us. They use
 * the same function, so they cannot drift.
 */
export function QuoteBuilder({
  quote,
  products,
  branding,
  showMark,
  markText,
  logoUrl,
  planReader,
  mayAddProducts = false,
}: {
  quote: QuoteRow;
  products: ProductRow[];
  branding: {
    legalName: string;
    addressLine: string | null;
    city: string;
    pincode: string | null;
    gstin: string | null;
    phone: string | null;
    email: string | null;
    accentHex: string;
  } | null;
  showMark: boolean;
  markText: string;
  logoUrl: string | null;
  planReader?: { canRead: boolean; leadHasPlan: boolean };
  mayAddProducts?: boolean;
}) {
  const [lines, setLines] = useState<EditableLine[]>(() => quote.lines.map(toEditable));
  const [dirty, setDirty] = useState(false);
  const [saving, startSave] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<'lines' | 'document' | 'changes'>('lines');
  const [picked, setPicked] = useState<string | null>(null);
  const [terms, setTerms] = useState<TermsDraft>(() => termsDraftOf(quote));
  const savedTerms = useRef(JSON.stringify(termsDraftOf(quote)));

  /* The saved copy, for the "nothing to save" test. Compared by value rather
     than by a dirty flag alone, so typing a 3, deleting it and typing it back
     does not leave the bar up for the rest of the session. */
  const saved = useRef(JSON.stringify(quote.lines.map(toEditable)));

  useEffect(() => {
    setDirty(JSON.stringify(lines) !== saved.current || JSON.stringify(terms) !== savedTerms.current);
  }, [lines, terms]);

  /* Lines rewritten on the server — a rebuild or a clear — arrive as new
     props. Taken when nothing on screen is unsaved; the old state was kept
     until a reload, so a rebuild looked as if it had done nothing (11 Oct). */
  const server = JSON.stringify(quote.lines.map(toEditable));
  const onScreen = useRef(lines);
  onScreen.current = lines;
  useEffect(() => {
    if (server === saved.current) return;
    if (JSON.stringify(onScreen.current) !== saved.current) return; // unsaved work wins
    saved.current = server;
    setLines(JSON.parse(server) as EditableLine[]);
  }, [server]);

  /* The terms as figures. A half-typed percentage keeps the last good one on
     screen rather than flashing the total to zero. */
  const termsIn = useMemo(() => termsInput(terms, quote.feeBps), [terms, quote.feeBps]);
  const live = useMemo(
    () => ({
      ...quote,
      ...(termsIn
        ? {
            feeBps: termsIn.feeBps,
            discountBps: termsIn.discountBps,
            gstBps: termsIn.gstOn ? 1800 : 0,
            onSpotPaise: termsIn.onSpotPaise,
            onSpotLabel: termsIn.onSpotLabel,
            bookingAdvancePaise: termsIn.bookingAdvancePaise,
            quoteDate: termsIn.quoteDate ? new Date(`${termsIn.quoteDate}T00:00:00`) : quote.quoteDate,
          }
        : {}),
    }),
    [quote, termsIn],
  );

  /**
   * The browser's own warning, and the only thing standing between forty
   * lines of work and a closed tab. Registered only while there is something
   * to lose — an unconditional handler makes every navigation away from a
   * saved quotation ask a pointless question, which teaches people to click
   * through the one that matters.
   */
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  const priced = useMemo(
    () =>
      lines.map((line) => ({
        ...line,
        amountPaise: lineAmount({
          unit: line.unit,
          code: line.code,
          ratePaise: line.ratePaise,
          widthMm: line.widthMm,
          heightMm: line.heightMm,
          qtyMilli: line.qtyMilli,
          amountPaise: line.agreedPaise ?? undefined,
        }),
      })),
    [lines],
  );

  const totals = useMemo(
    () =>
      computeTotals(
        priced.map((l) => ({ ...l, amountPaise: l.amountPaise })),
        {
          feeBps: live.feeBps,
          discountBps: live.discountBps,
          onSpotPaise: live.onSpotPaise,
          bookingAdvancePaise: live.bookingAdvancePaise,
          gstBps: live.gstBps,
          phases: live.phases,
        },
      ),
    [priced, live],
  );

  const comparable: ComparableLine[] = useMemo(
    () => priced.map((l) => ({ room: l.room, product: l.product, amountPaise: l.amountPaise })),
    [priced],
  );

  const rooms = useMemo(() => byRoom(comparable), [comparable]);
  const revision = useMemo(
    () => (quote.issuedLines.length > 0 ? compareToIssued(quote.issuedLines, comparable) : null),
    [quote.issuedLines, comparable],
  );

  const unpriced = priced.filter((l) => isUnpriced({ ...l, amountPaise: l.agreedPaise })).length;

  /* Rooms in the order they were built, not alphabetical. The plan puts the
     kitchen first for a reason and a sort would undo it. */
  const roomOrder = useMemo(() => {
    const seen: string[] = [];
    for (const line of lines) if (!seen.includes(line.room)) seen.push(line.room);
    return seen;
  }, [lines]);

  const update = useCallback((key: string, patch: Partial<EditableLine>) => {
    setLines((current) => current.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  }, []);

  const remove = useCallback((key: string) => {
    setLines((current) => current.filter((l) => l.key !== key));
  }, []);

  const duplicate = useCallback((key: string) => {
    setLines((current) => {
      const at = current.findIndex((l) => l.key === key);
      if (at < 0) return current;
      const copy = { ...current[at]!, key: freshKey(), id: undefined };
      return [...current.slice(0, at + 1), copy, ...current.slice(at + 1)];
    });
  }, []);

  /** Within its own room. Moving a line out of its room by arrow would be a surprise. */
  const move = useCallback((key: string, by: -1 | 1) => {
    setLines((current) => {
      const at = current.findIndex((l) => l.key === key);
      if (at < 0) return current;
      const room = current[at]!.room;
      const inRoom = current.map((l, i) => ({ l, i })).filter((x) => x.l.room === room);
      const pos = inRoom.findIndex((x) => x.i === at);
      const swap = inRoom[pos + by];
      if (!swap) return current;

      const next = current.slice();
      next[at] = current[swap.i]!;
      next[swap.i] = current[at]!;
      return next;
    });
  }, []);

  /**
   * Swap a line to another of the studio's products, re-priced from it. The
   * size carries over when the unit is the same — a wardrobe swapped for a
   * sliding one keeps its 1800 × 2100 — and takes the product's own default
   * when it is not.
   */
  const swap = useCallback((key: string, product: ProductRow) => {
    setLines((current) =>
      current.map((l) => {
        if (l.key !== key) return l;
        const same = l.unit === product.unit;
        const defaultQty =
          product.unit === 'SQFT' && product.rules?.sqft
            ? Math.round(product.rules.sqft * 1000)
            : product.unit === 'RFT' && product.rules?.rft
              ? Math.round(product.rules.rft * 1000)
              : product.defaultQty != null
                ? product.defaultQty * 1000
                : product.unit === 'UNIT'
                  ? 1000
                  : null;
        return {
          ...l,
          product: product.name,
          code: product.code,
          unit: product.unit,
          details: product.details,
          ratePaise: product.ratePaise,
          widthMm: product.unit === 'AREA' ? (same ? l.widthMm : product.defaultWidthMm) : null,
          heightMm: product.unit === 'AREA' ? (same ? l.heightMm : product.defaultHeightMm) : null,
          qtyMilli: product.unit === 'AREA' ? null : same ? l.qtyMilli : defaultQty,
          agreedPaise: null,
        };
      }),
    );
  }, []);

  /** Drag and drop, within a room: `from` takes `to`'s place. */
  const reorder = useCallback((from: string, to: string) => {
    setLines((current) => {
      const a = current.findIndex((l) => l.key === from);
      const b = current.findIndex((l) => l.key === to);
      if (a < 0 || b < 0 || current[a]!.room !== current[b]!.room) return current;
      const next = current.slice();
      const [moved] = next.splice(a, 1);
      next.splice(b, 0, moved!);
      return next;
    });
  }, []);

  /**
   * Move a whole room up or down (Hauspire's "Room order"): its lines move
   * together, every other room keeps its place, and the document follows.
   */
  const moveRoom = useCallback((room: string, by: -1 | 1) => {
    setLines((current) => {
      const order: string[] = [];
      for (const l of current) if (!order.includes(l.room)) order.push(l.room);
      const at = order.indexOf(room);
      const to = at + by;
      if (at < 0 || to < 0 || to >= order.length) return current;
      [order[at], order[to]] = [order[to]!, order[at]!];
      return order.flatMap((r) => current.filter((l) => l.room === r));
    });
  }, []);

  /** Rename a room on every line in it. Renaming onto an existing room merges them. */
  const renameRoom = useCallback((from: string, to: string) => {
    setLines((current) => current.map((l) => (l.room === from ? { ...l, room: to } : l)));
  }, []);

  const add = useCallback((room: string, product: ProductRow, size: AddSize) => {
    setLines((current) => {
      const line: EditableLine = {
        key: freshKey(),
        room,
        product: product.name,
        code: product.code,
        unit: product.unit,
        details: product.details,
        widthMm: size.widthMm,
        heightMm: size.heightMm,
        qtyMilli: size.qtyMilli,
        ratePaise: product.ratePaise,
        agreedPaise: null,
      };

      /* Straight after the last line of that room, so a kitchen line lands in
         the kitchen rather than at the bottom of the document. */
      const last = current.map((l) => l.room).lastIndexOf(room);
      if (last < 0) return [...current, line];
      return [...current.slice(0, last + 1), line, ...current.slice(last + 1)];
    });
  }, []);

  function save() {
    setError(null);
    if (!termsIn) {
      setError('Check the terms: a percentage between 0 and 50, and amounts in rupees.');
      return;
    }
    const sentTerms = JSON.stringify(terms);
    const payload: SaveLineInput[] = lines.map((l) => ({
      id: l.id,
      room: l.room,
      product: l.product,
      code: l.code,
      unit: l.unit,
      details: l.details,
      widthMm: l.widthMm,
      heightMm: l.heightMm,
      qtyMilli: l.qtyMilli,
      ratePaise: l.ratePaise,
      agreedPaise: l.agreedPaise,
    }));

    startSave(async () => {
      const result = await saveLinesAction(quote.id, payload, termsIn);
      if (result && 'ok' in result && !result.ok) {
        setError(result.error);
        return;
      }
      /* Marked saved from what was SENT, not from what is on screen now: a
         figure typed while the request was in flight is still unsaved. */
      saved.current = JSON.stringify(lines);
      savedTerms.current = sentTerms;
      setDirty(JSON.stringify(lines) !== saved.current || JSON.stringify(terms) !== savedTerms.current);
    });
  }

  /* The room on screen (StudioQuoteBuilder: rooms down the left, one room's
     lines in the middle). A room that went away — renamed, or its last line
     removed — falls back to the first; NEW_ROOM is the add box on its own. */
  const shownRoom = picked === NEW_ROOM ? NEW_ROOM : picked !== null && roomOrder.includes(picked) ? picked : (roomOrder[0] ?? NEW_ROOM);
  const roomTotal = (room: string) => priced.filter((l) => l.room === room).reduce((a, l) => a + l.amountPaise, 0);
  const roomCount = (room: string) => lines.filter((l) => l.room === room).length;
  const addHere = (room: string, product: ProductRow, size: AddSize) => {
    add(room, product, size);
    setPicked(room);
  };

  const flat = <ConfigurePanel quote={quote} hasLines={lines.length > 0} planReader={planReader} />;

  return (
    <>
      <div className="hstack" style={{ justifyContent: 'space-between' }}>
        <div className="tabs" role="tablist" aria-label="Quotation view">
          <Tab on={tab === 'lines'} onClick={() => setTab('lines')}>
            Quotation
            {lines.length > 0 ? <span className="n">{lines.length}</span> : null}
          </Tab>
          <Tab on={tab === 'document'} onClick={() => setTab('document')}>
            What the client sees
          </Tab>
          {revision ? (
            <Tab on={tab === 'changes'} onClick={() => setTab('changes')}>
              Changes
              {revision.identical ? null : <span className="n">{revision.addedCount + revision.removedCount + revision.repricedCount}</span>}
            </Tab>
          ) : null}
        </div>
        <span className={`sm ${saving ? 'muted' : dirty ? 'warn-t' : 'good-t'}`} style={{ fontWeight: 600 }} role="status">
          {saving ? 'Saving…' : dirty ? 'Unsaved changes' : 'Saved'}
        </span>
      </div>

      {tab === 'lines' ? (
        <div className="qb">
          <nav className="rooms" aria-label="Rooms">
            {roomOrder.map((room) => (
              <button key={room} type="button" className="room" aria-current={shownRoom === room} onClick={() => setPicked(room)}>
                <b>{room}</b>
                <span className="muted sm mono">
                  {roomCount(room)} {roomCount(room) === 1 ? 'line' : 'lines'} · {formatINR(roomTotal(room))}
                </span>
              </button>
            ))}
            <button type="button" className="room add" aria-current={shownRoom === NEW_ROOM} onClick={() => setPicked(NEW_ROOM)}>
              <span aria-hidden="true" style={{ fontSize: 18, lineHeight: 1 }}>
                +
              </span>
              <b>Add a room</b>
            </button>
          </nav>

          <div className="qmid">
            {unpriced > 0 ? (
              <p className="qnote warn">
                {unpriced} {unpriced === 1 ? 'line has' : 'lines have'} no figure yet — a measurement or a rate is missing. They count as
                zero in the total, which is almost certainly not what you want to send.
              </p>
            ) : null}

            {lines.length === 0 ? (
              <>
                <div className="empty">
                  <b>Nothing on it yet.</b>
                  <span className="muted sm" style={{ maxWidth: '62ch', lineHeight: 1.5 }}>
                    Build the standard quotation for this flat below, or add lines one at a time. Either way the sizes and rates come
                    from your own product list as a starting point and every one of them is editable here — changing a line never
                    changes your catalogue, and changing your catalogue never changes a quotation you have already sent.
                  </span>
                </div>
                {flat}
              </>
            ) : null}

            {shownRoom === NEW_ROOM ? (
              <section className="card flush" aria-label="Add a room">
                <div className="chead">
                  <h2>{lines.length === 0 ? 'Add the first line' : 'A new room'}</h2>
                  <span className="muted sm">Type the room&rsquo;s name in Room and pick its first item.</span>
                </div>
                <AddLinePanel
                  key={NEW_ROOM}
                  rooms={roomOrder}
                  products={products}
                  quoteConfig={quote.config}
                  baths={quote.bathrooms}
                  onAdd={addHere}
                  defaultRoom=""
                />
              </section>
            ) : (
              <RoomSection
                key={shownRoom}
                room={shownRoom}
                onMoveRoom={moveRoom}
                firstRoom={roomOrder.indexOf(shownRoom) === 0}
                lastRoom={roomOrder.indexOf(shownRoom) === roomOrder.length - 1}
                mayAddProducts={mayAddProducts}
                lines={priced.filter((l) => l.room === shownRoom)}
                onUpdate={update}
                onRemove={remove}
                onDuplicate={duplicate}
                onMove={move}
                products={products}
                onSwap={swap}
                onReorder={reorder}
                onRenameRoom={(from, to) => {
                  renameRoom(from, to);
                  setPicked(to);
                }}
              >
                <AddLinePanel
                  key={shownRoom}
                  rooms={roomOrder}
                  products={products}
                  quoteConfig={quote.config}
                  baths={quote.bathrooms}
                  onAdd={addHere}
                  defaultRoom={shownRoom}
                />
              </RoomSection>
            )}

            {quote.planRooms.length > 0 ? (
              <section className="card" aria-label="Their floor plan">
                <div className="chead">
                  <h2>Their floor plan</h2>
                </div>
                <FloorPlanView rooms={quote.planRooms} />
              </section>
            ) : null}
          </div>

          <div className="qside">
            <TotalsPanel quote={live} totals={totals} lineCount={lines.length}>
              {/* Beside the figure everything on screen moves. */}
              <button type="button" onClick={save} disabled={saving || !dirty} className="btn pri" style={!dirty && !saving ? { opacity: 0.45 } : undefined}>
                {saving ? 'Saving…' : dirty ? 'Save the quotation' : 'Saved'}
              </button>
              {error ? (
                <p role="alert" className="qerr">
                  {error}
                </p>
              ) : null}
              <span className="muted sm">
                {dirty ? 'Unsaved. Figures on screen are live; the stored copy is not.' : 'Everything on screen is stored.'}
              </span>
            </TotalsPanel>
            <TermsPanel
              terms={terms}
              onChange={(patch) => setTerms((t) => ({ ...t, ...patch }))}
              ownSchedule={(quote.phases?.length ?? 0) > 0}
            />
            <RoomBreakdown rooms={rooms} />
            <ClientPanel quote={quote} />
            {lines.length > 0 ? flat : null}
          </div>
        </div>
      ) : null}

      {tab === 'document' ? (
        <DocumentPreview
          quote={live}
          lines={priced}
          rooms={roomOrder}
          totals={totals}
          branding={branding}
          showMark={showMark}
          markText={markText}
          logoUrl={logoUrl}
        />
      ) : null}

      {tab === 'changes' && revision ? <ChangesPanel summary={revision} issuedOn={quote.issuedOn} /> : null}
    </>
  );
}

/*
 * `AddRoom` used to live here: a text box under the last room that created
 * one by seeding it with an arbitrary product, because a room with no lines
 * cannot exist when rooms are derived from the lines. "Add a room" now opens
 * the add box with an empty room, which is the same act without the invented
 * seed line.
 */

/** The add box on its own, for a room that does not exist yet. */
const NEW_ROOM = '\u0000new-room';

function Tab({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" role="tab" onClick={onClick} aria-selected={on}>
      {children}
    </button>
  );
}

/**
 * A key that is not the database id.
 *
 * React needs a stable identity for a row that may never have been saved, and
 * the id is absent until it has. Keying on the array index instead would make
 * a removed line take the next line's input state with it, which looks exactly
 * like the wrong line being deleted.
 */
let counter = 0;
function freshKey(): string {
  counter += 1;
  return `new-${counter}`;
}

function toEditable(line: QuoteRow['lines'][number]): EditableLine {
  return {
    key: line.id,
    id: line.id,
    room: line.room,
    product: line.product,
    code: line.code,
    unit: line.unit,
    details: line.details,
    widthMm: line.widthMm,
    heightMm: line.heightMm,
    qtyMilli: line.qtyMilli,
    ratePaise: line.ratePaise,
    /**
     * An agreed figure is recognised, not remembered.
     *
     * The column stores what the line came to, whether that was arithmetic or
     * a decision, so on the way back in there is nothing that says which. A
     * stored amount that does not equal rate × quantity can only have been
     * typed by somebody, and treating it as an override keeps that decision
     * across a reload. Where they are equal it does not matter which we call
     * it — the figure is the same either way.
     */
    agreedPaise:
      line.amountPaise !==
      lineAmount({
        unit: line.unit,
        code: line.code,
        ratePaise: line.ratePaise,
        widthMm: line.widthMm,
        heightMm: line.heightMm,
        qtyMilli: line.qtyMilli,
      })
        ? line.amountPaise
        : null,
  };
}

function termsDraftOf(quote: QuoteRow): TermsDraft {
  return {
    feeOn: quote.feeBps > 0,
    discountPct: String(quote.discountBps / 100),
    gstOn: quote.gstBps > 0,
    onSpotRupees: quote.onSpotPaise > 0 ? String(quote.onSpotPaise / 100) : '',
    onSpotLabel: quote.onSpotLabel ?? '',
    advanceRupees: String(quote.bookingAdvancePaise / 100),
    quoteDate: isoDay(quote.quoteDate),
  };
}

function isoDay(d: Date | string): string {
  const date = new Date(d);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** The draft as the server takes it, or null when a figure is not a figure. */
function termsInput(t: TermsDraft, storedFeeBps: number): QuoteTermsInput | null {
  /* The quotation's own fee while the box stays on (an older 10% stays
     10%); 7% only when a fee is turned on from off. */
  const feeBps = keptFeeBps(storedFeeBps, t.feeOn);
  const discountBps = pctToBps(t.discountPct);
  const onSpotPaise = rupeesToPaiseText(t.onSpotRupees);
  const bookingAdvancePaise = rupeesToPaiseText(t.advanceRupees);
  if (discountBps === null || onSpotPaise === null || bookingAdvancePaise === null) return null;
  return {
    feeBps,
    discountBps,
    gstOn: t.gstOn,
    onSpotPaise,
    onSpotLabel: t.onSpotLabel.trim() || null,
    bookingAdvancePaise,
    quoteDate: /^\d{4}-\d{2}-\d{2}$/.test(t.quoteDate) ? t.quoteDate : null,
  };
}
