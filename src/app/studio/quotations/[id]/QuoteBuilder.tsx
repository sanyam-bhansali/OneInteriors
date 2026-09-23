'use client';

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { computeTotals, isUnpriced } from '@/modules/studio-quote/pricing';
import { compareToIssued, byRoom, type ComparableLine } from '@/modules/studio-quote/revision';
import { lineAmount } from '@/modules/studio-quote/pricing';
import type { QuoteRow } from '@/modules/studio-quote/quotes';
import type { ProductRow } from '@/modules/studio-quote/store';
import type { SaveLineInput } from '@/modules/studio-quote/quotes';
import { saveLinesAction } from '../actions';
import { ConfigureBar, RoomSection, type EditableLine } from './QuoteLines';
import { TotalsPanel, DocumentPreview, ChangesPanel } from './QuotePanels';

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
}) {
  const [lines, setLines] = useState<EditableLine[]>(() => quote.lines.map(toEditable));
  const [dirty, setDirty] = useState(false);
  const [saving, startSave] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<'lines' | 'document' | 'changes'>('lines');

  /* The saved copy, for the "nothing to save" test. Compared by value rather
     than by a dirty flag alone, so typing a 3, deleting it and typing it back
     does not leave the bar up for the rest of the session. */
  const saved = useRef(JSON.stringify(quote.lines.map(toEditable)));

  useEffect(() => {
    setDirty(JSON.stringify(lines) !== saved.current);
  }, [lines]);

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
          feeBps: quote.feeBps,
          discountBps: quote.discountBps,
          onSpotPaise: quote.onSpotPaise,
          bookingAdvancePaise: quote.bookingAdvancePaise,
        },
      ),
    [priced, quote.feeBps, quote.discountBps, quote.onSpotPaise, quote.bookingAdvancePaise],
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

  const add = useCallback((room: string, product: ProductRow) => {
    setLines((current) => {
      const line: EditableLine = {
        key: freshKey(),
        room,
        product: product.name,
        code: product.code,
        unit: product.unit,
        details: product.details,
        widthMm: product.unit === 'AREA' ? product.defaultWidthMm : null,
        heightMm: product.unit === 'AREA' ? product.defaultHeightMm : null,
        qtyMilli:
          product.unit === 'AREA' ? null : product.defaultQty != null ? product.defaultQty * 1000 : null,
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
      const result = await saveLinesAction(quote.id, payload);
      if (result && 'ok' in result && !result.ok) {
        setError(result.error);
        return;
      }
      /* Marked saved from what was SENT, not from what is on screen now: a
         figure typed while the request was in flight is still unsaved. */
      saved.current = JSON.stringify(lines);
      setDirty(JSON.stringify(lines) !== saved.current);
    });
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <div className="min-w-0">
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <Tab on={tab === 'lines'} onClick={() => setTab('lines')}>
            Lines
            {lines.length > 0 ? <Count n={lines.length} /> : null}
          </Tab>
          <Tab on={tab === 'document'} onClick={() => setTab('document')}>
            What the client sees
          </Tab>
          {revision ? (
            <Tab on={tab === 'changes'} onClick={() => setTab('changes')}>
              Changes
              {revision.identical ? null : (
                <Count n={revision.addedCount + revision.removedCount + revision.repricedCount} />
              )}
            </Tab>
          ) : null}
        </div>

        {tab === 'lines' ? (
          <div className="flex flex-col gap-4">
            <ConfigureBar quote={quote} hasLines={lines.length > 0} />

            {unpriced > 0 ? (
              <p className="s-card m-0 border-l-[3px] !border-l-[var(--s-warn)] px-4 py-3 text-[13.5px] leading-relaxed text-[var(--s-ink-2)]">
                {unpriced} {unpriced === 1 ? 'line has' : 'lines have'} no figure yet — a
                measurement or a rate is missing. They count as zero in the total, which is
                almost certainly not what you want to send.
              </p>
            ) : null}

            {lines.length === 0 ? (
              <div className="s-card p-5">
                <p className="m-0 mb-1.5 text-[14.5px] font-semibold">Nothing on it yet.</p>
                <p className="m-0 max-w-[62ch] text-[14px] leading-relaxed text-[var(--s-ink-2)]">
                  Build the standard quotation for this flat from the bar above, or add lines one
                  at a time below. Either way the sizes and rates come from your own product list
                  as a starting point and every one of them is editable here — changing a line
                  never changes your catalogue, and changing your catalogue never changes a
                  quotation you have already sent.
                </p>
              </div>
            ) : null}

            {roomOrder.map((room) => (
              <RoomSection
                key={room}
                room={room}
                lines={priced.filter((l) => l.room === room)}
                products={products}
                onUpdate={update}
                onRemove={remove}
                onDuplicate={duplicate}
                onMove={move}
                onAdd={add}
              />
            ))}

            <AddRoom
              existing={roomOrder}
              products={products}
              onAdd={(room, product) => add(room, product)}
            />
          </div>
        ) : null}

        {tab === 'document' ? (
          <DocumentPreview
            quote={quote}
            lines={priced}
            rooms={roomOrder}
            totals={totals}
            branding={branding}
            showMark={showMark}
            markText={markText}
            logoUrl={logoUrl}
          />
        ) : null}

        {tab === 'changes' && revision ? (
          <ChangesPanel summary={revision} issuedOn={quote.issuedOn} />
        ) : null}
      </div>

      <aside className="lg:sticky lg:top-5 lg:self-start">
        <TotalsPanel quote={quote} totals={totals} rooms={rooms} />
      </aside>

      {/* The save bar. Fixed, because the thing it is about is forty lines
          long and a button at the bottom of forty lines is a button nobody
          sees until they have scrolled past the reason to press it. */}
      {dirty || saving || error ? (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-[var(--s-rule)] bg-[var(--s-surface)] px-5 py-3 shadow-[0_-6px_20px_rgba(0,0,0,.06)]">
          <div className="mx-auto flex max-w-[72rem] flex-wrap items-center justify-between gap-3">
            <p className="m-0 text-[13.5px] text-[var(--s-ink-2)]">
              {error ? (
                <span role="alert" className="text-[var(--s-bad)]">
                  {error}
                </span>
              ) : saving ? (
                'Saving…'
              ) : (
                'Unsaved changes on this quotation.'
              )}
            </p>
            <button
              type="button"
              onClick={save}
              disabled={saving}
              className="rounded-[8px] bg-[var(--s-accent)] px-5 py-2 text-[14px] font-medium text-white hover:bg-[var(--s-accent-deep)] disabled:opacity-40"
            >
              {saving ? 'Saving…' : 'Save the quotation'}
            </button>
          </div>
        </div>
      ) : null}

      {/* Clears the fixed bar so it never sits on top of the last line. */}
      {dirty || saving || error ? <div className="h-16 lg:col-span-2" /> : null}
    </div>
  );
}

/** A room that is not on the quotation yet. */
function AddRoom({
  existing,
  products,
  onAdd,
}: {
  existing: string[];
  products: ProductRow[];
  onAdd: (room: string, product: ProductRow) => void;
}) {
  const [name, setName] = useState('');

  /* The first usable product is what the new room gets, because a room with
     nothing in it would vanish on the next render — rooms are derived from
     the lines, deliberately, so there is no such thing as an empty one. */
  const seed = products.find((p) => p.isActive && p.ratePaise > 0) ?? products[0];
  if (!seed) return null;

  const clean = name.trim();
  const clash = existing.some((r) => r.toLowerCase() === clean.toLowerCase());

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (clean.length === 0 || clash) return;
        onAdd(clean, seed);
        setName('');
      }}
      className="flex flex-wrap items-center gap-2"
    >
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Another room — terrace, passage, puja…"
        className="min-w-[16rem] flex-1 rounded-[8px] border border-[var(--s-rule)] bg-[var(--s-surface)] px-3 py-2 text-[13.5px] placeholder:text-[var(--s-ink-3)]"
      />
      <button
        type="submit"
        disabled={clean.length === 0 || clash}
        className="rounded-[8px] border border-[var(--s-rule)] px-4 py-2 text-[13.5px] font-medium hover:border-[var(--s-ink-3)] disabled:opacity-40"
      >
        {clash ? 'Already there' : 'Add a room'}
      </button>
    </form>
  );
}

function Tab({
  on,
  onClick,
  children,
}: {
  on: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      className={`inline-flex items-center gap-2 rounded-[9px] px-3.5 py-2 text-[13.5px] font-medium ${
        on
          ? 'bg-[var(--s-ink)] text-[var(--s-surface)]'
          : 'border border-[var(--s-rule)] text-[var(--s-ink-2)] hover:border-[var(--s-ink-3)]'
      }`}
    >
      {children}
    </button>
  );
}

function Count({ n }: { n: number }) {
  return <span className="s-num text-[11.5px] opacity-70">{n}</span>;
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
