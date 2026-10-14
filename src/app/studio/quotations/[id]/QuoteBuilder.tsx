'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { formatINR } from '@/lib/money';
import { computeTotals, DISCOUNT_NAMES, isUnpriced, keptFeeBps, lineAmount, type QuoteUnitName, type WorkCodeName } from '@/modules/studio-quote/pricing';
import { compareToIssued, type ComparableLine } from '@/modules/studio-quote/revision';
import { CONFIGS, isConfigName, type ConfigName } from '@/modules/studio-quote/configure';
import { configRooms, moveInList, newRoomName, orderedRooms, renameInList, roomsOfLines, sortByRooms } from '@/modules/studio-quote/rooms';
import type { QuoteRow, QuoteTermsInput, SaveLineInput } from '@/modules/studio-quote/quotes';

/* quotes.ts is server-only; the two labels are repeated here. */
const STAGE_LABELS = { SALES: 'Sales Final', DESIGN: 'Design Final' } as const;
import type { ProductRow } from '@/modules/studio-quote/store';
import { addLineToProductsAction, copyQuoteAction, proposeProductAction, saveClientAction, saveLinesAction } from '../actions';
import { ConfigurePanel, type AddSize, type EditableLine } from './QuoteLines';
import { DocumentPreview, type DocPreviewStatics } from './QuotePanels';
import { pctToBps, rupeesToPaiseText, type TermsDraft } from './TermsPanel';
import { QuoteTable } from './QuoteTable';
import { TotalsTable } from './HTotals';
import { AddLine, DiscountPicker, FinalCompare, ProposeForm, Sec } from './HPanels';
import { FloorPlanView } from '@/components/floorplan/FloorPlanView';

/**
 * The quotation builder, in the layout of Hauspire's own builder
 * (`builder/page.tsx`): a narrow form panel on the left — Project, Rooms, Add
 * a line, Discount, Fees & Tax, the two saves — and the work area on the
 * right: a banner, the Quotation / Final / PDF preview tabs with the two
 * "Save & PDF" buttons, the quotation's header strip, the room-grouped table,
 * the totals and the payment stages. Our theme, Hauspire's structure.
 *
 * ## One state, recalculated as they type
 *
 * Every line lives here; the totals, the table and the document preview are
 * derived from it on each render. `lineAmount` is pure and runs in the browser
 * for the figure on screen and again on the server for the one stored, so the
 * two cannot drift. Work can be unsaved: the status says so, and the browser
 * asks before a tab with unsaved work is closed.
 *
 * ## Rooms
 *
 * The room list (`rooms.ts`) is Hauspire's: "Apply configuration" lays out a
 * flat's rooms without touching a line, rooms can be renamed (merging), added
 * and moved, and the table, the pickers and the document follow one order.
 * An empty room is a heading waiting for its first line; it is not saved.
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
  locked = false,
  sentLabel = null,
  finalHref = null,
  extras,
  doc = null,
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
  /** A project runs on it: lines and terms are shut (the server refuses too). */
  locked?: boolean;
  /** "R2", the revision the client last received; null before the first send. */
  sentLabel?: string | null;
  /** The printable Original-vs-Final comparison, when there is one to print. */
  finalHref?: string | null;
  /** Revisions and the sales final, under the work area. */
  extras?: React.ReactNode;
  /** The PDF's brand pages, stages, specification and terms (server, `quoteDocContext`). */
  doc?: DocPreviewStatics | null;
}) {
  const [lines, setLines] = useState<EditableLine[]>(() => quote.lines.map(toEditable));
  const [terms, setTerms] = useState<TermsDraft>(() => termsDraftOf(quote));
  const [client, setClient] = useState<ClientDraft>(() => clientDraftOf(quote));
  const [roomList, setRoomList] = useState<string[]>(() => {
    const own = roomsOfLines(quote.lines);
    return own.length > 0 ? own : configRooms(asConfig(quote.config), { study: false, bathrooms: quote.bathrooms ?? 2 }, []);
  });
  const [hasStudy, setHasStudy] = useState(() => roomsOfLines(quote.lines).some((r) => /study|office/i.test(r)));
  const [renameFrom, setRenameFrom] = useState('');
  const [renameTo, setRenameTo] = useState('');
  const [newRoom, setNewRoom] = useState('');
  const [addRoom, setAddRoom] = useState('');
  const [tab, setTab] = useState<'quote' | 'final' | 'pdf'>('quote');
  const [banner, setBanner] = useState<string>(() =>
    locked
      ? `${quote.number} — ${STAGE_LABELS[quote.stage]}. A project is running on this quotation, so it is read-only. Make the Design Final from it to change what is built.`
      : quote.lines.length === 0
        ? ''
        : `Editing ${quote.number} — ${STAGE_LABELS[quote.stage]}. Saving overrides this quotation.`,
  );
  const [error, setError] = useState<string | null>(null);
  const [saving, startSave] = useTransition();
  const [proposing, startPropose] = useTransition();

  /* What is stored, for the "nothing to save" test — by value, so typing a
     figure and putting it back does not leave the work marked unsaved. */
  const saved = useRef(JSON.stringify(quote.lines.map(toEditable)));
  const savedTerms = useRef(JSON.stringify(termsDraftOf(quote)));
  const savedClient = useRef(JSON.stringify(clientDraftOf(quote)));
  const dirty =
    JSON.stringify(lines) !== saved.current || JSON.stringify(terms) !== savedTerms.current || JSON.stringify(client) !== savedClient.current;

  /* Lines rewritten on the server (a rebuild, a clear) arrive as new props:
     taken when nothing on screen is unsaved. */
  const server = JSON.stringify(quote.lines.map(toEditable));
  const onScreen = useRef(lines);
  onScreen.current = lines;
  useEffect(() => {
    if (server === saved.current) return;
    if (JSON.stringify(onScreen.current) !== saved.current) return; // unsaved work wins
    saved.current = server;
    const next = JSON.parse(server) as EditableLine[];
    setLines(next);
    setRoomList((list) => orderedRooms(roomsOfLines(next), []).concat(list.filter((r) => !next.some((l) => l.room === r))));
  }, [server]);

  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  const termsIn = useMemo(() => termsInput(terms, quote.feeBps), [terms, quote.feeBps]);
  const live = useMemo<QuoteRow>(
    () => ({
      ...quote,
      clientName: client.clientName.trim() || quote.clientName,
      clientPhone: client.clientPhone.trim() || null,
      locality: client.locality.trim() || null,
      society: client.society.trim() || null,
      config: client.config.trim() || null,
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
    [quote, termsIn, client],
  );

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
      computeTotals(priced, {
        feeBps: live.feeBps,
        discountBps: live.discountBps,
        onSpotPaise: live.onSpotPaise,
        bookingAdvancePaise: live.bookingAdvancePaise,
        gstBps: live.gstBps,
        phases: live.phases,
      }),
    [priced, live],
  );
  const comparable: ComparableLine[] = useMemo(() => priced.map((l) => ({ room: l.room, product: l.product, amountPaise: l.amountPaise })), [priced]);
  const revision = useMemo(() => (quote.issuedLines.length > 0 ? compareToIssued(quote.issuedLines, comparable) : null), [quote.issuedLines, comparable]);
  const unpriced = priced.filter((l) => isUnpriced({ ...l, amountPaise: l.agreedPaise })).length;

  /* The one room order: the list, then rooms only on a line. */
  const rooms = useMemo(() => orderedRooms(roomList, lines), [roomList, lines]);
  const activeRoom = rooms.includes(addRoom) ? addRoom : (rooms[0] ?? '');
  const count = (room: string) => lines.filter((l) => l.room === room).length;
  const config = asConfig(client.config);

  // ── Lines ──────────────────────────────────────────────────

  const update = useCallback((key: string, patch: Partial<EditableLine>) => {
    setLines((current) => current.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  }, []);
  const remove = useCallback((key: string) => setLines((current) => current.filter((l) => l.key !== key)), []);
  const duplicate = useCallback((key: string) => {
    setLines((current) => {
      const at = current.findIndex((l) => l.key === key);
      if (at < 0) return current;
      const copy = { ...current[at]!, key: freshKey(), id: undefined };
      return [...current.slice(0, at + 1), copy, ...current.slice(at + 1)];
    });
  }, []);
  /** Within its own room. */
  const move = useCallback((key: string, by: -1 | 1) => {
    setLines((current) => {
      const at = current.findIndex((l) => l.key === key);
      if (at < 0) return current;
      const inRoom = current.map((l, i) => ({ l, i })).filter((x) => x.l.room === current[at]!.room);
      const swap = inRoom[inRoom.findIndex((x) => x.i === at) + by];
      if (!swap) return current;
      const next = current.slice();
      next[at] = current[swap.i]!;
      next[swap.i] = current[at]!;
      return next;
    });
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
  /** A line swapped to another product, re-priced from it; the size carries over within a unit. */
  const swap = useCallback((key: string, product: ProductRow) => {
    setLines((current) =>
      current.map((l) => {
        if (l.key !== key) return l;
        const same = l.unit === product.unit;
        return {
          ...l,
          product: product.name,
          code: product.code,
          unit: product.unit,
          details: product.details,
          ratePaise: product.ratePaise,
          widthMm: product.unit === 'AREA' ? (same ? l.widthMm : product.defaultWidthMm) : null,
          heightMm: product.unit === 'AREA' ? (same ? l.heightMm : product.defaultHeightMm) : null,
          qtyMilli: product.unit === 'AREA' ? null : same ? l.qtyMilli : defaultQtyOf(product),
          agreedPaise: null,
        };
      }),
    );
  }, []);
  const addLine = (room: string, product: ProductRow, size: AddSize) => {
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
    setLines((current) => sortByRooms([...current, line], rooms));
    setBanner(`Added ${product.name} to ${room}.`);
  };
  /** "+ add item" under a room: a blank line to pick a product into. */
  const addItem = (room: string) => {
    setLines((current) =>
      sortByRooms(
        [
          ...current,
          { key: freshKey(), room, product: 'New item', code: 'MODULAR', unit: 'UNIT', details: null, widthMm: null, heightMm: null, qtyMilli: 1000, ratePaise: 0, agreedPaise: null },
        ],
        rooms,
      ),
    );
  };

  // ── Rooms (Hauspire's applyConfig, renameRoom, addRoom, moveRoom) ──

  function applyConfig() {
    const list = configRooms(config, { study: hasStudy, bathrooms: quote.bathrooms ?? (config === '1 BHK' ? 1 : 2) }, lines);
    setRoomList(list);
    setLines((ls) => sortByRooms(ls, list));
    if (!list.includes(activeRoom)) setAddRoom(list[0] ?? '');
    setClient((c) => ({ ...c, config }));
    setBanner(`${config} configuration applied — ${list.length} rooms. No line was removed.`);
  }
  function renameRoom() {
    const from = renameFrom;
    const to = renameTo.trim().replace(/\s+/g, ' ').slice(0, 80);
    if (!from || !to || to === from) return;
    const n = count(from);
    setRoomList(renameInList(rooms, from, to));
    setLines((ls) => ls.map((l) => (l.room === from ? { ...l, room: to } : l)));
    if (activeRoom === from) setAddRoom(to);
    setRenameFrom('');
    setRenameTo('');
    setBanner(`Renamed “${from}” → “${to}”${n ? ` (${n} item${n > 1 ? 's' : ''}).` : '.'}`);
  }
  function addCustomRoom() {
    const n = newRoomName(newRoom, rooms);
    setNewRoom('');
    if (!n) return;
    setRoomList([...rooms, n]);
    setAddRoom(n);
  }
  function moveRoom(room: string, by: -1 | 1) {
    const next = moveInList(rooms, room, by);
    setRoomList(next);
    setLines((ls) => sortByRooms(ls, next));
  }

  // ── Propose a new product ─────────────────────────────────

  function propose(p: { name: string; code: WorkCodeName; unit: QuoteUnitName; ratePaise: number; details: string }) {
    const room = activeRoom || 'Whole home';
    const line: EditableLine = {
      key: freshKey(),
      room,
      product: p.name,
      code: p.code,
      unit: p.unit,
      details: p.details || null,
      widthMm: p.unit === 'AREA' ? 1000 : null,
      heightMm: p.unit === 'AREA' ? 1000 : null,
      qtyMilli: p.unit === 'AREA' ? null : 1000,
      ratePaise: p.ratePaise,
      agreedPaise: null,
    };
    setLines((current) => sortByRooms([...current, line], rooms));
    startPropose(async () => {
      try {
        const r = mayAddProducts
          ? await addLineToProductsAction({ name: p.name, code: p.code, unit: p.unit, rateRupees: p.ratePaise / 100, room, details: p.details || null })
          : await proposeProductAction({ name: p.name, code: p.code, unit: p.unit, ratePaise: p.ratePaise, details: p.details || null, room }, quote.id);
        setBanner(
          r.ok
            ? 'message' in r
              ? String(r.message)
              : `Added “${p.name}” to your product master and to this quote.`
            : `“${p.name}” is on this quote, but: ${r.error}`,
        );
      } catch {
        setBanner(`“${p.name}” is on this quote, but the proposal did not go through. Try again from the line.`);
      }
    });
  }

  // ── Save ──────────────────────────────────────────────────

  async function persist(): Promise<boolean> {
    setError(null);
    if (!termsIn) {
      setError('Check the terms: a discount between 0 and 50%, and amounts in rupees.');
      return false;
    }
    const sentLines = JSON.stringify(lines);
    const sentTerms = JSON.stringify(terms);
    const sentClient = JSON.stringify(client);
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
      note: l.note ?? null,
    }));
    if (sentClient !== savedClient.current) {
      const carpet = Number(client.carpet);
      const r = await saveClientAction(quote.id, {
        clientName: client.clientName,
        clientPhone: client.clientPhone,
        clientEmail: client.clientEmail,
        society: client.society,
        locality: client.locality,
        config: client.config,
        carpetSqft: client.carpet.trim() && Number.isFinite(carpet) ? Math.round(carpet) : null,
      });
      if (r && 'ok' in r && !r.ok) {
        setError(r.error);
        return false;
      }
      savedClient.current = sentClient;
    }
    const result = await saveLinesAction(quote.id, payload, termsIn);
    if (result && 'ok' in result && !result.ok) {
      setError(result.error);
      return false;
    }
    /* Saved from what was SENT: a figure typed while it was in flight is still unsaved. */
    saved.current = sentLines;
    savedTerms.current = sentTerms;
    return true;
  }

  function saveAs(stage: 'SALES' | 'DESIGN') {
    startSave(async () => {
      const ok = await persist();
      if (!ok) return;
      if (stage === 'DESIGN' && quote.stage === 'SALES') {
        setBanner(`Saved ✓ ${quote.number} · Sales Final. Making the Design Final from it…`);
        const r = await copyQuoteAction(quote.id, 'design-final');
        if (r && 'ok' in r && !r.ok) setBanner(`Saved ✓ ${quote.number} · Sales Final. ${r.error}`);
        return;
      }
      setBanner(`Saved ✓ ${quote.number} · ${STAGE_LABELS[quote.stage]} (overrides previous).`);
    });
  }

  function saveAndOpen(href: string) {
    /* Opened now, inside the press, so a popup blocker lets it through; it
       goes to the page once the save has answered. */
    const w = window.open('about:blank', '_blank');
    startSave(async () => {
      const ok = await persist();
      if (ok) {
        setBanner(`Saved ✓ ${quote.number} · ${STAGE_LABELS[quote.stage]}. The PDF opened in a new tab: choose “Save as PDF” in the print dialog.`);
        if (w) w.location.href = href;
        else window.location.href = href;
      } else if (w) {
        w.close();
      }
    });
  }

  const shownTotal = totals.totalPaise;
  const gstOn = terms.gstOn;
  const where = [client.locality.trim() || client.society.trim(), client.config.trim()].filter(Boolean).join(' · ');

  return (
    <div className="hb">
      <aside className="hside" aria-label="Quotation details">
        <fieldset disabled={locked} className="hfs">
          <Sec first>Project</Sec>
          <input className="fld hfld" placeholder="Client name" aria-label="Client name" maxLength={120} value={client.clientName} onChange={(e) => setClient({ ...client, clientName: e.target.value })} />
          <div className="hgrid2">
            <input className="fld hfld" placeholder="Mobile" aria-label="Mobile" inputMode="tel" maxLength={20} value={client.clientPhone} onChange={(e) => setClient({ ...client, clientPhone: e.target.value })} />
            <input className="fld hfld" placeholder="Location" aria-label="Location" maxLength={80} value={client.locality} onChange={(e) => setClient({ ...client, locality: e.target.value })} />
          </div>
          <label className="hdate">
            <span>Quotation date</span>
            <input className="fld hfld" type="date" value={terms.quoteDate} onChange={(e) => setTerms({ ...terms, quoteDate: e.target.value || isoDay(new Date()) })} />
            {terms.quoteDate !== isoDay(new Date()) ? (
              <button type="button" className="linkbtn hlink" onClick={() => setTerms({ ...terms, quoteDate: isoDay(new Date()) })}>
                Today
              </button>
            ) : null}
          </label>
          <select className="fld hfld" aria-label="Configuration" value={config} onChange={(e) => setClient({ ...client, config: e.target.value })}>
            {CONFIGS.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <details className="hmore">
            <summary>More client details — email, society, carpet area</summary>
            <div className="hstackv">
              <input className="fld hfld" placeholder="Email" aria-label="Email" inputMode="email" value={client.clientEmail} onChange={(e) => setClient({ ...client, clientEmail: e.target.value })} />
              <input className="fld hfld" placeholder="Society, flat number" aria-label="Society" value={client.society} onChange={(e) => setClient({ ...client, society: e.target.value })} />
              <input className="fld hfld num" placeholder="Carpet sq ft" aria-label="Carpet sq ft" inputMode="numeric" value={client.carpet} onChange={(e) => setClient({ ...client, carpet: e.target.value })} />
              {quote.clientId ? (
                <Link href={`/studio/clients/${quote.clientId}`} className="acc-t hlink">
                  Open the lead
                </Link>
              ) : null}
            </div>
          </details>

          <Sec>Rooms</Sec>
          <label className="hcheck">
            <input type="checkbox" checked={hasStudy} onChange={(e) => setHasStudy(e.target.checked)} /> Include Study / Office
          </label>
          <button type="button" className="btn sec hwide happly" onClick={applyConfig}>
            Apply {config} configuration
          </button>
          <div className="hrename">
            <select
              className="fld hfld"
              aria-label="Room to rename"
              value={renameFrom}
              onChange={(e) => {
                setRenameFrom(e.target.value);
                setRenameTo(e.target.value);
              }}
            >
              <option value="">Rename room…</option>
              {rooms.map((r) => (
                <option key={r} value={r}>
                  {r}
                  {count(r) ? ` (${count(r)})` : ''}
                </option>
              ))}
            </select>
            <input className="fld hfld" placeholder="New name" aria-label="New room name" value={renameTo} onChange={(e) => setRenameTo(e.target.value)} />
            <button type="button" className="hsq" onClick={renameRoom} title="Rename" aria-label="Rename the room">
              ↺
            </button>
          </div>
          <div className="hadd">
            <input
              className="fld hfld"
              placeholder="Add custom room"
              aria-label="Add custom room"
              value={newRoom}
              onChange={(e) => setNewRoom(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addCustomRoom();
                }
              }}
            />
            <button type="button" className="hsq" onClick={addCustomRoom} title="Add room" aria-label="Add the room">
              +
            </button>
          </div>
          <details className="horder" open={lines.length > 0}>
            <summary>
              Room order <span className="muted">— as shown in the quotation &amp; PDF</span>
            </summary>
            <ul>
              {rooms.map((r, i) => (
                <li key={r}>
                  <span className="hidx">{i + 1}</span>
                  <span className={`hname ${count(r) ? '' : 'muted'}`} title={r}>
                    {r}
                    {count(r) ? <span className="muted"> ({count(r)})</span> : ' · empty'}
                  </span>
                  <button type="button" disabled={i === 0} onClick={() => moveRoom(r, -1)} title="Move up" aria-label={`Move ${r} up`}>
                    ↑
                  </button>
                  <button type="button" disabled={i === rooms.length - 1} onClick={() => moveRoom(r, 1)} title="Move down" aria-label={`Move ${r} down`}>
                    ↓
                  </button>
                </li>
              ))}
            </ul>
          </details>

          <Sec>Add a line</Sec>
          <AddLine rooms={rooms} room={activeRoom} onRoom={setAddRoom} products={products} onAdd={addLine} />
          <ProposeForm mayAddProducts={mayAddProducts} busy={proposing} onPropose={propose} />

          <Sec>Discount</Sec>
          <DiscountPicker
            label={terms.onSpotLabel}
            amount={terms.onSpotRupees}
            onLabel={(v) => setTerms({ ...terms, onSpotLabel: v })}
            onAmount={(v) => setTerms({ ...terms, onSpotRupees: v, onSpotLabel: terms.onSpotLabel || DISCOUNT_NAMES[0] })}
          />

          <Sec>Fees &amp; Tax</Sec>
          <label className="hcheck">
            <input type="checkbox" checked={terms.feeOn} onChange={(e) => setTerms({ ...terms, feeOn: e.target.checked })} />
            Professional fees ({quote.feeBps > 0 ? quote.feeBps / 100 : 7}%)
          </label>
          <label className="hcheck">
            <input type="checkbox" checked={terms.gstOn} onChange={(e) => setTerms({ ...terms, gstOn: e.target.checked })} />
            Add GST (18%)
          </label>
          <p className="hhelp">
            Untick the fee to remove it from the quote and PDF. GST is added on the final project value, after discounts; payment stages then include GST.
          </p>
          {(quote.phases?.length ?? 0) > 0 ? null : (
            <label className="hlab">
              Booking advance (₹)
              <input className="fld hfld num" inputMode="numeric" value={terms.advanceRupees} onChange={(e) => setTerms({ ...terms, advanceRupees: e.target.value })} />
            </label>
          )}
        </fieldset>

        <p className="hstatus">
          {quote.number} · editing {STAGE_LABELS[quote.stage]}
        </p>
        <div className="hgrid2">
          <button
            type="button"
            className="btn sec"
            disabled={locked || saving || quote.stage !== 'SALES'}
            onClick={() => saveAs('SALES')}
            title={quote.stage === 'SALES' ? 'Save this Sales Final (used until the client is booked)' : 'This is the Design Final; its Sales Final is the quotation it was made from'}
          >
            Save Sales Final
          </button>
          <button
            type="button"
            className="btn sec"
            disabled={locked || saving || (quote.stage === 'SALES' && lines.length === 0)}
            onClick={() => saveAs('DESIGN')}
            title={
              quote.stage === 'DESIGN'
                ? 'Save this Design Final'
                : 'Save, then make the Design Final from this Sales Final (a copy; the Sales Final stays as sent)'
            }
          >
            Save Design Final
          </button>
        </div>
        <p className={`hsaved ${saving ? 'muted' : dirty ? 'warn-t' : 'good-t'}`} role="status">
          {saving ? 'Saving…' : dirty ? 'Unsaved changes — figures on screen are live; the stored copy is not.' : 'Saved. Everything on screen is stored.'}
        </p>
        {error ? (
          <p role="alert" className="qerr">
            {error}
          </p>
        ) : null}
        <p className="hhelp">
          Two quotations per project — <b>Sales Final</b> and <b>Design Final</b>. Saving overrides this one; each time you send it, the copy the client has is kept as a revision (R1, R2…).
        </p>

        <details className="hmore">
          <summary>Rebuild from your standard set — replaces every line</summary>
          <ConfigurePanel quote={quote} hasLines={lines.length > 0} planReader={planReader} />
        </details>
      </aside>

      <section className="hwork" aria-label="Quotation">
        {banner ? <div className="hbanner">{banner}</div> : null}
        <div className="htabs">
          <div className="tabs" role="tablist" aria-label="Quotation view">
            <Tab on={tab === 'quote'} onClick={() => setTab('quote')}>
              Quotation
            </Tab>
            <Tab on={tab === 'final'} onClick={() => setTab('final')}>
              Final (Original vs Revised)
            </Tab>
            <Tab on={tab === 'pdf'} onClick={() => setTab('pdf')}>
              PDF preview
            </Tab>
          </div>
          {lines.length > 0 ? (
            <div className="hpdf">
              <button type="button" className="btn pri sm" disabled={saving} onClick={() => saveAndOpen(`/studio/quotations/${quote.id}/print`)} title="Saves this quotation, then opens the PDF">
                ⬇ Save &amp; Quotation PDF
              </button>
              <button
                type="button"
                className="btn sec sm"
                disabled={saving || !finalHref}
                onClick={() => finalHref && saveAndOpen(finalHref)}
                title={finalHref ? 'Saves this quotation, then opens the Original vs Final PDF' : 'Nothing to compare yet: send it (R1) and change it, or make the Design Final'}
              >
                ⬇ Save &amp; Final PDF
              </button>
            </div>
          ) : null}
        </div>

        {lines.length === 0 && tab === 'quote' ? (
          <p className="muted hempty">Add products from the panel, or open a first quote via “Revise in Full Builder”.</p>
        ) : tab === 'quote' ? (
          <>
            <div className="hdochead">
              <div>
                <div className="hbig">{branding?.legalName ?? 'Your studio'}</div>
                <div className="muted hsmall">
                  Quotation · {formatINR(shownTotal)}
                  {gstOn ? ' incl. GST' : ''}
                </div>
              </div>
              <div className="hwho">
                <b>{client.clientName.trim() || '—'}</b>
                <br />
                {where || '—'}
              </div>
            </div>
            {unpriced > 0 ? (
              <p className="qnote warn">
                {unpriced} {unpriced === 1 ? 'line has' : 'lines have'} no figure yet — a measurement or a rate is missing. They count as zero in the total.
              </p>
            ) : null}
            <fieldset disabled={locked} className="hfs">
              <QuoteTable
                lines={priced}
                rooms={rooms}
                products={products}
                discountBps={live.discountBps}
                onUpdate={update}
                onRemove={remove}
                onDuplicate={duplicate}
                onMove={move}
                onReorder={reorder}
                onSwap={swap}
                onAddItem={addItem}
                mayAddProducts={mayAddProducts}
                quoteId={quote.id}
                readOnly={locked}
              />
              <TotalsTable
                totals={totals}
                feeBps={keptFeeBps(quote.feeBps, true)}
                feeOn={terms.feeOn}
                gstOn={terms.gstOn}
                discountPct={terms.discountPct}
                onSpotLabel={live.onSpotLabel}
                onFeeOn={(v) => setTerms({ ...terms, feeOn: v })}
                onGstOn={(v) => setTerms({ ...terms, gstOn: v })}
                onDiscountPct={(v) => setTerms({ ...terms, discountPct: v })}
                ownSchedule={(quote.phases?.length ?? 0) > 0}
                readOnly={locked}
              />
            </fieldset>
            {quote.planRooms.length > 0 ? (
              <section className="card" aria-label="Their floor plan" style={{ marginTop: 16 }}>
                <div className="chead">
                  <h2>Their floor plan</h2>
                </div>
                <FloorPlanView rooms={quote.planRooms} />
              </section>
            ) : null}
          </>
        ) : tab === 'final' ? (
          <FinalCompare
            summary={revision}
            sentLabel={sentLabel}
            compareHref={finalHref}
            compareLabel={quote.basedOnId ? 'Compare with the Sales Final (printable)' : 'Printable comparison of the revisions'}
          />
        ) : (
          <DocumentPreview
            quote={live}
            lines={priced}
            rooms={rooms.filter((r) => lines.some((l) => l.room === r))}
            totals={totals}
            branding={branding}
            showMark={showMark}
            markText={markText}
            logoUrl={logoUrl}
            doc={doc}
          />
        )}

        {extras ? <div className="hextras">{extras}</div> : null}
      </section>
    </div>
  );
}

function Tab({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" role="tab" onClick={onClick} aria-selected={on}>
      {children}
    </button>
  );
}

/** Who it is for, as the panel edits it. */
interface ClientDraft {
  clientName: string;
  clientPhone: string;
  clientEmail: string;
  society: string;
  locality: string;
  config: string;
  carpet: string;
}

function clientDraftOf(quote: QuoteRow): ClientDraft {
  return {
    clientName: quote.clientName,
    clientPhone: quote.clientPhone ?? '',
    clientEmail: quote.clientEmail ?? '',
    society: quote.society ?? '',
    locality: quote.locality ?? '',
    config: quote.config ?? '',
    carpet: quote.carpetSqft ? String(quote.carpetSqft) : '',
  };
}

/** A configuration from whatever is stored ("3BHK", "3 bhk", "Villa"); 3 BHK when there is none. */
export function asConfig(text: string | null | undefined): ConfigName {
  if (isConfigName(text)) return text;
  const t = String(text ?? '');
  if (/villa/i.test(t)) return 'Villa';
  const n = t.match(/([1-4])/)?.[1];
  return n ? (`${n} BHK` as ConfigName) : '3 BHK';
}

function defaultQtyOf(product: ProductRow): number | null {
  if (product.unit === 'SQFT' && product.rules?.sqft) return Math.round(product.rules.sqft * 1000);
  if (product.unit === 'RFT' && product.rules?.rft) return Math.round(product.rules.rft * 1000);
  if (product.defaultQty != null) return product.defaultQty * 1000;
  return product.unit === 'UNIT' ? 1000 : null;
}

/**
 * A key that is not the database id: a line that was never saved has none,
 * and keying on the index would make a removed line take the next one's
 * input state with it.
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
    note: line.note,
    /* An agreed figure is recognised, not remembered: a stored amount that is
       not rate × quantity can only have been typed, and stays an override
       across a reload. */
    agreedPaise:
      line.amountPaise !==
      lineAmount({ unit: line.unit, code: line.code, ratePaise: line.ratePaise, widthMm: line.widthMm, heightMm: line.heightMm, qtyMilli: line.qtyMilli })
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
  /* The quotation's own fee while the box stays on; 7% only when a fee is turned on from off. */
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
