'use client';

import { useMemo, useRef, useState, useTransition } from 'react';
import { ChevronDown, ChevronUp, Copy, GripVertical, X } from 'lucide-react';
import { formatINR, paiseToRupees, rupeesToPaise } from '@/lib/money';
import {
  UNIT_LABELS,
  areaMilli,
  formatQty,
  lineAmount,
  QTY_SCALE,
  type QuoteUnitName,
  type WorkCodeName,
} from '@/modules/studio-quote/pricing';
import {
  CONFIGS,
  isConfigName,
  roomsFor,
  standardRunFor,
  type ConfigName,
} from '@/modules/studio-quote/configure';
import type { QuoteRow } from '@/modules/studio-quote/quotes';
import type { ProductRow } from '@/modules/studio-quote/store';
import { addLineToProductsAction, applyConfigAction, clearLinesAction, readRoomsForQuoteAction, type BuildState } from '../actions';
import { Combobox } from './Combobox';

/**
 * One line, as the builder holds it.
 *
 * `key` is React's identity and exists before `id` does — a line that has
 * never been saved has no database id, and keying on the array index makes a
 * deletion appear to remove the wrong row. `agreedPaise` is the studio's
 * decision overriding the arithmetic; null hands the line back to rate ×
 * quantity.
 */
export interface EditableLine {
  key: string;
  id?: string;
  room: string;
  product: string;
  code: WorkCodeName;
  unit: QuoteUnitName;
  details: string | null;
  widthMm: number | null;
  heightMm: number | null;
  qtyMilli: number | null;
  ratePaise: number;
  agreedPaise: number | null;
}

/** With the figure this line currently comes to, computed by the parent. */
export type PricedLine = EditableLine & { amountPaise: number };

/**
 * Build the standard quotation for this flat.
 *
 * ## Why the destructive button is not the quiet one
 *
 * Applying a configuration replaces every line. That is what somebody wants
 * when they picked 2 BHK and it is a 3, and it is a disaster when they have
 * spent an hour measuring. So the button changes its words once there is
 * something to lose, and asks — in the same press, rather than through a
 * dialog nobody reads.
 *
 * ## Why this is a server round trip when everything else here is local
 *
 * The build reads the studio's catalogue, which the browser does not have in
 * full — it has the products, not the standard-build marks combined with room
 * categories and sort order. More to the point, a build is a deliberate act
 * with a confirmation attached, not a keystroke, so the round trip costs
 * nothing anybody notices.
 */
export function ConfigurePanel({
  quote,
  hasLines,
  planReader,
}: {
  quote: QuoteRow;
  hasLines: boolean;
  /** Floor-plan reading: on for this deployment, and whether the lead has a plan attached. */
  planReader?: { canRead: boolean; leadHasPlan: boolean };
}) {
  const [config, setConfig] = useState<ConfigName>(
    isConfigName(quote.config) ? quote.config : '2 BHK',
  );
  const [kitchenRun, setKitchenRun] = useState(
    quote.kitchenRunMm != null ? String(quote.kitchenRunMm) : '',
  );
  const [bathrooms, setBathrooms] = useState(String(quote.bathrooms ?? 2));
  const [study, setStudy] = useState(false);
  const [balcony, setBalcony] = useState(true);
  const hasPlan = quote.planRooms.length > 0;
  const [usePlan, setUsePlan] = useState(hasPlan);
  const [king, setKing] = useState(true);
  const [ceiling, setCeiling] = useState(hasPlan);
  const [ceilingRate, setCeilingRate] = useState('');
  const [reading, startReading] = useTransition();
  const [readSaid, setReadSaid] = useState<{ ok: boolean; message?: string; error?: string } | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [result, setResult] = useState<BuildState>(null);
  const [pending, start] = useTransition();

  function build() {
    if (hasLines && !confirming) {
      setConfirming(true);
      return;
    }

    setConfirming(false);
    setResult(null);

    const run = Number(kitchenRun);
    const baths = Number(bathrooms);

    start(async () => {
      setResult(
        await applyConfigAction(quote.id, {
          config,
          kitchenRunMm: Number.isFinite(run) && run > 0 ? Math.round(run) : null,
          bathrooms: Number.isFinite(baths) && baths >= 0 ? Math.round(baths) : 0,
          study,
          balcony,
          usePlan: hasPlan && usePlan,
          kingMaster: king,
          falseCeiling: ceiling,
          falseCeilingRatePaise: (() => {
            const r = Number(ceilingRate.replace(/[,₹\s]/g, ''));
            return ceilingRate.trim() && Number.isFinite(r) && r > 0 ? Math.round(r * 100) : null;
          })(),
        }),
      );
    });
  }

  return (
    <section className="card" aria-label="The flat">
      <div className="chead">
        <h2>The flat</h2>
        {quote.planRooms.length > 0 ? <span className="chip good">Floor plan read</span> : null}
      </div>

      <div className="hstack" style={{ alignItems: 'flex-end', gap: 12 }}>
        <label className="qfield" style={{ flex: '1 1 7rem' }}>
          <span className="lbl">Configuration</span>
          <select value={config} onChange={(e) => setConfig(e.target.value as ConfigName)} className="fld">
            {CONFIGS.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>

        <label className="qfield" style={{ flex: '1 1 7rem' }}>
          <span className="lbl">Kitchen run mm</span>
          <input
            value={kitchenRun}
            onChange={(e) => setKitchenRun(e.target.value)}
            inputMode="numeric"
            placeholder={String(standardRunFor(config))}
            className="fld num"
          />
        </label>

        <label className="qfield" style={{ flex: '0 1 5rem' }}>
          <span className="lbl">Baths</span>
          <input value={bathrooms} onChange={(e) => setBathrooms(e.target.value)} inputMode="numeric" className="fld num" />
        </label>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <label className="qcheck" style={{ minHeight: 30 }}>
          <input type="checkbox" checked={study} onChange={(e) => setStudy(e.target.checked)} />
          Study or office
        </label>

        <label className="qcheck" style={{ minHeight: 30 }}>
          <input type="checkbox" checked={balcony} onChange={(e) => setBalcony(e.target.checked)} />
          Dry balcony
        </label>

        {hasPlan ? (
          <label className="qcheck" style={{ minHeight: 30 }}>
            <input type="checkbox" checked={usePlan} onChange={(e) => setUsePlan(e.target.checked)} />
            Size from the client&rsquo;s floor plan
          </label>
        ) : null}

        <label className="qcheck" style={{ minHeight: 30 }}>
          <input type="checkbox" checked={king} onChange={(e) => setKing(e.target.checked)} />
          Master bedroom: king bed
        </label>

        <label className="qcheck" style={{ minHeight: 30 }}>
          <input type="checkbox" checked={ceiling} onChange={(e) => setCeiling(e.target.checked)} />
          False ceiling, room by room
        </label>
        {ceiling ? (
          <label className="hstack muted sm" style={{ gap: 8, paddingLeft: 24 }}>
            <span>If you have no false-ceiling product: ₹ per sq ft</span>
            <input
              value={ceilingRate}
              onChange={(e) => setCeilingRate(e.target.value)}
              inputMode="numeric"
              placeholder="—"
              aria-label="False ceiling rate per sq ft"
              className="fld num"
              style={{ width: '5.5rem', minHeight: 34 }}
            />
          </label>
        ) : null}
      </div>

      {quote.clientId && planReader ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {planReader.canRead ? (
            planReader.leadHasPlan ? (
              <button
                type="button"
                disabled={reading}
                onClick={() => {
                  setReadSaid(null);
                  startReading(async () => {
                    try {
                      const r = await readRoomsForQuoteAction(quote.id);
                      setReadSaid(r.ok ? { ok: true, message: r.message } : r);
                      if (r.ok) {
                        setUsePlan(true);
                        setCeiling(true);
                      }
                    } catch {
                      setReadSaid({ ok: false, error: 'That did not go through. Try again.' });
                    }
                  });
                }}
                className="btn sec sm"
              >
                {reading ? 'Reading the plan…' : hasPlan ? 'Read rooms again from the lead’s floor plan' : 'Read rooms from the lead’s floor plan'}
              </button>
            ) : (
              <p className="muted sm" style={{ margin: 0 }}>
                Attach the floor plan on the lead page and its rooms can size this quotation.
              </p>
            )
          ) : (
            <p className="muted sm" style={{ margin: 0 }}>
              Floor-plan reading isn&rsquo;t switched on yet.
            </p>
          )}
          {readSaid ? (
            <p role={readSaid.ok ? 'status' : 'alert'} className={readSaid.ok ? 'qok' : 'qerr'}>
              {readSaid.ok ? readSaid.message : readSaid.error}
            </p>
          ) : null}
        </div>
      ) : null}

      <button
        type="button"
        onClick={build}
        disabled={pending}
        className="btn acc"
        style={confirming ? { background: 'var(--bad-s)' } : undefined}
      >
        {pending ? 'Building…' : confirming ? 'Replace every line — press again' : hasLines ? `Rebuild as ${config}` : `Build the ${config}`}
      </button>

      {confirming || hasLines ? (
        <div className="hstack">
          {confirming ? (
            <button type="button" onClick={() => setConfirming(false)} className="btn ghost sm">
              Keep what is there
            </button>
          ) : null}
          <StartBlank quoteId={quote.id} hasLines={hasLines} />
        </div>
      ) : null}

      <p className="muted sm" style={{ margin: 0, lineHeight: 1.5 }}>
        The kitchen run sets the width of the base, wall and loft lines — one measurement instead of three. Leave it blank and a{' '}
        {config} is assumed at {standardRunFor(config)}mm.
      </p>

      {result && result.ok ? (
        <div className="qnote good" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 4, background: 'var(--good-bg)' }}>
          <p style={{ fontWeight: 600 }}>
            {result.added} {result.added === 1 ? 'line' : 'lines'} on the quotation.
          </p>
          {result.notes.map((note) => (
            <p key={note} className="sm">
              {note}
            </p>
          ))}
        </div>
      ) : null}

      {result && !result.ok ? (
        <p role="alert" className="qerr">
          {result.error}
        </p>
      ) : null}
    </section>
  );
}

function StartBlank({ quoteId, hasLines }: { quoteId: string; hasLines: boolean }) {
  const [confirming, setConfirming] = useState(false);
  const [pending, start] = useTransition();

  if (!hasLines) return null;

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        if (!confirming) {
          setConfirming(true);
          return;
        }
        setConfirming(false);
        start(async () => void (await clearLinesAction(quoteId)));
      }}
      className={`btn sm ${confirming ? 'ghost bad-t' : 'ghost'}`}
    >
      {pending ? '…' : confirming ? 'Delete every line — press again' : 'Start blank'}
    </button>
  );
}

/**
 * A room, its lines, and a way to add another (StudioQuoteBuilder's middle
 * card: the room's name, its lines, and the add box under them).
 *
 * Rooms are derived from the lines rather than stored. A room with nothing in
 * it is not a thing a quotation has — it is a heading a client would read as
 * work that came to nothing — so removing the last line removes the room, and
 * that is the behaviour rather than a bug in it.
 *
 * ## Why a table and not a stack of cards
 *
 * Because a quotation IS a table, and the studio reading it has been reading
 * tables for years. A header row says it once and the figures sit under each
 * other where they can be compared and added up by eye.
 *
 * Hauspire's table carries a `Discounted` column beside `Amount`; ours applies
 * the modular discount once, to the modular half of the total, which is what
 * `computeTotals` does and what the document prints. What occupies that place
 * instead: when a studio has overridden a line, the calculated figure shows
 * struck through under the agreed one — "this is not what the arithmetic
 * said" — without inventing a discount we do not apply.
 */
export function RoomSection({
  room,
  lines,
  onUpdate,
  onRemove,
  onDuplicate,
  onMove,
  products,
  onSwap,
  onReorder,
  onRenameRoom,
  onMoveRoom,
  firstRoom,
  lastRoom,
  mayAddProducts,
  children,
}: {
  room: string;
  lines: PricedLine[];
  onUpdate: (key: string, patch: Partial<EditableLine>) => void;
  onRemove: (key: string) => void;
  onDuplicate: (key: string) => void;
  onMove: (key: string, by: -1 | 1) => void;
  /** The studio's products, for swapping a line to another. */
  products: ProductRow[];
  onSwap: (key: string, product: ProductRow) => void;
  /** Drag and drop: put `from` where `to` is, within this room. */
  onReorder: (from: string, to: string) => void;
  onRenameRoom: (from: string, to: string) => void;
  /** Move the whole room up or down the quotation (Hauspire's room order). */
  onMoveRoom?: (room: string, by: -1 | 1) => void;
  firstRoom?: boolean;
  lastRoom?: boolean;
  /** Owner and PM: a typed product not in the list can be added to it. */
  mayAddProducts?: boolean;
  /** The add box, under the lines. */
  children?: React.ReactNode;
}) {
  const total = lines.reduce((a, l) => a + l.amountPaise, 0);
  const [name, setName] = useState(room);
  const commit = () => {
    const next = name.trim();
    if (next && next !== room) onRenameRoom(room, next);
    else setName(room);
  };

  return (
    <section className="card flush" aria-label={`Lines in ${room}`}>
      <div className="chead">
        <h2 className="roomname">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === 'Enter') e.currentTarget.blur();
              if (e.key === 'Escape') setName(room);
            }}
            maxLength={60}
            aria-label={`Rename ${room}`}
            title="Rename this room"
          />
        </h2>
        <span className="hstack" style={{ gap: 6 }}>
          <span className="muted sm">
            Rates come from your product master. Change a rate here and it applies to this quote only.
          </span>
          {onMoveRoom ? (
            <span className="hstack" style={{ gap: 2 }}>
              <button
                type="button"
                disabled={firstRoom}
                onClick={() => onMoveRoom(room, -1)}
                title="Move this room up"
                aria-label={`Move ${room} up`}
                className="qico"
              >
                <ChevronUp size={16} strokeWidth={2.2} absoluteStrokeWidth />
              </button>
              <button
                type="button"
                disabled={lastRoom}
                onClick={() => onMoveRoom(room, 1)}
                title="Move this room down"
                aria-label={`Move ${room} down`}
                className="qico"
              >
                <ChevronDown size={16} strokeWidth={2.2} absoluteStrokeWidth />
              </button>
            </span>
          ) : null}
        </span>
      </div>

      <div className="tscroll">
        <table className="tbl" style={{ minWidth: 760 }}>
          <thead>
            <tr>
              <th scope="col">
                <span className="sr-only">Order</span>
              </th>
              <th scope="col">Item</th>
              <th scope="col">Quantity</th>
              <th scope="col" style={{ textAlign: 'right' }}>
                Rate
              </th>
              <th scope="col" style={{ textAlign: 'right' }}>
                Amount
              </th>
              <th scope="col">
                <span className="sr-only">Duplicate or remove</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {lines.map((line, i) => (
              <LineRow
                key={line.key}
                n={i + 1}
                line={line}
                first={i === 0}
                last={i === lines.length - 1}
                onUpdate={onUpdate}
                onRemove={onRemove}
                onDuplicate={onDuplicate}
                onMove={onMove}
                products={products}
                onSwap={onSwap}
                onReorder={onReorder}
                mayAddProducts={mayAddProducts === true}
              />
            ))}
          </tbody>
          <tfoot>
            <tr className="qfoot">
              <td />
              <td colSpan={3}>
                {room}, {lines.length} {lines.length === 1 ? 'line' : 'lines'}
              </td>
              <td className="mono" style={{ textAlign: 'right' }}>
                {formatINR(total)}
              </td>
              <td />
            </tr>
          </tfoot>
        </table>
      </div>
      {children}
    </section>
  );
}

/** How a quantity reads beside its stepper. */
const UNIT_WORD: Record<QuoteUnitName, string> = {
  AREA: 'sq ft',
  SQFT: 'sq ft',
  RFT: 'running ft',
  UNIT: 'nos.',
};

/**
 * One line, edited where it sits.
 *
 * Every field writes straight to the parent's state, so the sq ft beside a
 * width, the amount at the end of the row and the total beside the lines all
 * move on the same keystroke. A designer widening a wardrobe to see what it
 * costs should not have to press anything to find out.
 *
 * The inputs hold TEXT, not numbers. A controlled numeric input cannot hold
 * "18" on the way to "1800" without fighting the person typing it, and cannot
 * hold an empty string at all.
 */
function LineRow({
  n,
  line,
  first,
  last,
  onUpdate,
  onRemove,
  onDuplicate,
  onMove,
  products,
  onSwap,
  onReorder,
  mayAddProducts,
}: {
  n: number;
  line: PricedLine;
  first: boolean;
  last: boolean;
  onUpdate: (key: string, patch: Partial<EditableLine>) => void;
  onRemove: (key: string) => void;
  onDuplicate: (key: string) => void;
  onMove: (key: string, by: -1 | 1) => void;
  products: ProductRow[];
  onSwap: (key: string, product: ProductRow) => void;
  onReorder: (from: string, to: string) => void;
  mayAddProducts: boolean;
}) {
  const [over, setOver] = useState(false);
  const area = line.unit === 'AREA';
  const [adding, startAdding] = useTransition();
  const [added, setAdded] = useState<string | null>(null);
  const squash = (t: string) => t.toLowerCase().replace(/[^a-z0-9]/g, '');
  const known = line.product.trim().length < 2 || products.some((p) => squash(p.name) === squash(line.product));
  const overridden = line.agreedPaise != null;

  const whole = (raw: string): number | null => {
    const t = raw.trim();
    if (t === '') return null;
    const v = Number(t);
    return Number.isFinite(v) && v > 0 ? Math.round(v) : null;
  };

  /* The arithmetic this line WOULD have come to. Shown struck through under
     an agreed figure, so an override is visible rather than silent. */
  const calculated = lineAmount({
    unit: line.unit,
    code: line.code,
    ratePaise: line.ratePaise,
    widthMm: line.widthMm,
    heightMm: line.heightMm,
    qtyMilli: line.qtyMilli,
  });

  /* The stepper moves a quantity by one whole unit, never below nothing. */
  const step = (by: 1 | -1) => {
    const now = line.qtyMilli ?? 0;
    onUpdate(line.key, { qtyMilli: Math.max(0, now + by * QTY_SCALE) });
  };

  return (
    <tr
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData('text/x-line', line.key);
        e.dataTransfer.effectAllowed = 'move';
      }}
      onDragOver={(e) => {
        if (e.dataTransfer.types.includes('text/x-line')) {
          e.preventDefault();
          setOver(true);
        }
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        const from = e.dataTransfer.getData('text/x-line');
        if (from && from !== line.key) onReorder(from, line.key);
      }}
      className={`qline ${over ? 'over' : ''}`}
    >
      <td className="qh">
        <div className="qgrip">
          <span title="Drag to reorder" aria-hidden="true">
            <GripVertical size={13} strokeWidth={2} absoluteStrokeWidth />
          </span>
          <span className="mono sm" style={{ minWidth: 14, textAlign: 'right' }}>
            {n}
          </span>
          <div className="qmove">
            <Icon label={`Move ${line.product} up`} disabled={first} onClick={() => onMove(line.key, -1)}>
              <ChevronUp size={12} strokeWidth={2.5} absoluteStrokeWidth />
            </Icon>
            <Icon label={`Move ${line.product} down`} disabled={last} onClick={() => onMove(line.key, 1)}>
              <ChevronDown size={12} strokeWidth={2.5} absoluteStrokeWidth />
            </Icon>
          </div>
        </div>
      </td>

      <td>
        <div className="qitem">
          <input
            value={line.product}
            onChange={(e) => onUpdate(line.key, { product: e.target.value })}
            aria-label="Product name"
            className="cellin name"
          />
          <textarea
            value={line.details ?? ''}
            onChange={(e) => onUpdate(line.key, { details: e.target.value })}
            rows={1}
            aria-label="What this line includes"
            placeholder="18mm BWP carcass · laminate · soft-close"
            className="cellin spec"
          />
          <div className="qtools">
            <select
              value={line.code}
              onChange={(e) => onUpdate(line.key, { code: e.target.value as WorkCodeName })}
              aria-label="Modular or on-site"
              className="cellsel"
            >
              <option value="MODULAR">Modular</option>
              <option value="ONSITE">On-site</option>
            </select>
            <select
              value=""
              onChange={(e) => {
                const p = products.find((x) => x.id === e.target.value);
                if (p) onSwap(line.key, p);
              }}
              aria-label={`Swap ${line.product} for another product`}
              className="cellsel"
            >
              <option value="">Swap for…</option>
              {products
                .filter((p) => p.isActive && p.name !== line.product)
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
            </select>
            {overridden ? (
              <span className="chip oi" title="This figure was agreed, not calculated">
                agreed
              </span>
            ) : null}
            {!known && added === null ? (
              <>
                <span className="chip warn" title="Typed on this quotation; not one of your products">
                  not in your products
                </span>
                {mayAddProducts ? (
                  <button
                    type="button"
                    disabled={adding}
                    onClick={() =>
                      startAdding(async () => {
                        try {
                          const r = await addLineToProductsAction({
                            name: line.product.trim(),
                            code: line.code,
                            unit: line.unit,
                            rateRupees: line.ratePaise / 100,
                            room: line.room,
                            details: line.details,
                          });
                          setAdded(r.ok ? 'Added to your products.' : 'error' in r ? r.error : 'That did not save.');
                        } catch {
                          setAdded('That did not save.');
                        }
                      })
                    }
                    className="linkbtn acc-t"
                    style={{ fontWeight: 600, fontSize: 12.5 }}
                  >
                    {adding ? 'Adding…' : 'Add to products'}
                  </button>
                ) : (
                  <span className="muted sm">ask your studio owner to add it</span>
                )}
              </>
            ) : null}
            {added ? <span className="muted sm">{added}</span> : null}
          </div>
        </div>
      </td>

      <td>
        {area ? (
          <div className="qsize">
            <Num value={line.widthMm} label="Width mm" className="cellin num" onChange={(v) => onUpdate(line.key, { widthMm: whole(v) })} />
            <span className="muted">×</span>
            <Num value={line.heightMm} label="Height mm" className="cellin num" onChange={(v) => onUpdate(line.key, { heightMm: whole(v) })} />
            <span className="muted sm">
              mm
              {line.widthMm && line.heightMm ? (
                <>
                  {' '}
                  · <span className="mono">{formatQty(areaMilli(line.widthMm, line.heightMm))}</span> sq ft
                </>
              ) : null}
            </span>
          </div>
        ) : (
          <span className="hstack" style={{ gap: 6, flexWrap: 'nowrap' }}>
            <span className="step">
              <button type="button" aria-label={`One less ${line.product}`} onClick={() => step(-1)}>
                −
              </button>
              <Num
                value={line.qtyMilli != null ? line.qtyMilli / QTY_SCALE : null}
                label={`Quantity of ${line.product}`}
                className=""
                onChange={(v) => {
                  const num = Number(v.trim());
                  onUpdate(line.key, {
                    qtyMilli: v.trim() === '' || !Number.isFinite(num) ? null : Math.round(num * QTY_SCALE),
                  });
                }}
              />
              <button type="button" aria-label={`One more ${line.product}`} onClick={() => step(1)}>
                +
              </button>
            </span>
            <span className="muted sm" style={{ whiteSpace: 'nowrap' }}>
              {UNIT_WORD[line.unit]}
            </span>
          </span>
        )}
      </td>

      <td className="qrate">
        <Num
          value={line.ratePaise > 0 ? paiseToRupees(line.ratePaise) : null}
          label={`Rate for ${line.product}`}
          className="cellin num"
          onChange={(v) => {
            const num = Number(v.trim());
            onUpdate(line.key, {
              ratePaise: v.trim() === '' || !Number.isFinite(num) || num < 0 ? 0 : rupeesToPaise(num),
            });
          }}
        />
      </td>

      <td className="qamt">
        {/* The agreed figure is the editable one, because it is the one that
            prints. Empty hands the line back to rate × quantity. */}
        <Num
          value={line.agreedPaise != null ? paiseToRupees(line.agreedPaise) : null}
          placeholder={calculated > 0 ? formatINR(calculated) : '—'}
          label={`Amount for ${line.product}`}
          className="cellin num strong"
          onChange={(v) => {
            const num = Number(v.trim());
            onUpdate(line.key, {
              agreedPaise: v.trim() === '' || !Number.isFinite(num) || num < 0 ? null : rupeesToPaise(num),
            });
          }}
        />
        {overridden && calculated > 0 && calculated !== line.agreedPaise ? (
          <span className="struck mono">{formatINR(calculated)}</span>
        ) : null}
      </td>

      <td>
        <div className="qicons">
          <Icon label={`Duplicate ${line.product}`} onClick={() => onDuplicate(line.key)}>
            <Copy size={14} strokeWidth={2} absoluteStrokeWidth />
          </Icon>
          <Icon label={`Remove ${line.product}`} danger onClick={() => onRemove(line.key)}>
            <X size={15} strokeWidth={2.4} absoluteStrokeWidth />
          </Icon>
        </div>
      </td>
    </tr>
  );
}

/**
 * A number in a table cell.
 *
 * Text in the box, number in the state. Feeding the parsed value back in
 * would rewrite "18" on the way to "1800" and turn "" into "0" while the
 * caret jumps. The initial text comes from the value once and is then the
 * input's own; it re-syncs only when the value changes from OUTSIDE, which is
 * what a rebuild (or the stepper) looks like.
 */
function Num({
  value,
  placeholder,
  label,
  className,
  onChange,
}: {
  value: number | null;
  placeholder?: string;
  label: string;
  className: string;
  onChange: (raw: string) => void;
}) {
  const [text, setText] = useState(value != null ? String(value) : '');
  const known = useRef(value);

  if (known.current !== value) {
    known.current = value;
    const typed = Number(text.trim());
    const same = text.trim() === '' ? value == null : Number.isFinite(typed) && typed === value;
    if (!same) setText(value != null ? String(value) : '');
  }

  return (
    <input
      value={text}
      inputMode="decimal"
      placeholder={placeholder}
      aria-label={label}
      onChange={(e) => {
        setText(e.target.value);
        onChange(e.target.value);
      }}
      className={className}
    />
  );
}

function Icon({
  label,
  disabled,
  danger,
  onClick,
  children,
}: {
  label: string;
  disabled?: boolean;
  danger?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} title={label} className={`qico ${danger ? 'bad' : ''}`}>
      <span aria-hidden="true" style={{ display: 'inline-flex' }}>
        {children}
      </span>
      <span className="sr-only">{label}</span>
    </button>
  );
}

/**
 * Add a line — the whole act, in one place.
 *
 * ## Why this moved out of the rooms
 *
 * It used to sit as a footer under every room, which meant the control was
 * repeated eight times down a long page and each copy only did one room. The
 * hosted builder this module is descended from puts it once, in a rail, with
 * the room as the first field — and that is right for the reason the
 * repetition was wrong: adding a line is one action with a room in it, not
 * eight different actions.
 *
 * ## It shows the figure before anything is added
 *
 * Pick a product, type a width, and the line amount is there before the
 * press. That is the difference between a form and a calculator, and pricing
 * a job is a calculator: a designer checks what a 2400mm run costs, tries
 * 2100, and only then decides to add it.
 *
 * Products with no rate are offered, marked. A studio looking for "wardrobe"
 * and not finding it would conclude the software has lost it; finding it
 * marked unpriced tells them exactly what to do.
 */
export function AddLinePanel({
  rooms,
  products,
  quoteConfig,
  baths,
  onAdd,
  defaultRoom,
}: {
  rooms: string[];
  products: ProductRow[];
  /** `Studio.config` — "3 BHK" or whatever was set. Drives the room suggestions. */
  quoteConfig: string | null;
  baths: number | null;
  onAdd: (room: string, product: ProductRow, size: AddSize) => void;
  /** The room on screen; the add box starts on it. Empty for a new room. */
  defaultRoom?: string;
}) {
  const active = useMemo(() => products.filter((p) => p.isActive), [products]);

  /**
   * The rooms offered, in one list.
   *
   * Three sources, in this order and deduplicated: the rooms already on the
   * quotation, then the rooms this configuration implies, then nothing —
   * whatever the studio types becomes a new one.
   *
   * The middle source is the fix. The old control offered only what was
   * already on the quotation, so an empty quotation offered nothing at all
   * and the studio invented a room name that the rest of the software had
   * never heard of. `roomsFor` is the same function the Build button uses,
   * which is what keeps a hand-added Kitchen and a built Kitchen the same
   * Kitchen rather than two rooms that happen to look alike.
   */
  const roomOptions = useMemo(() => {
    const config = isConfigName(quoteConfig) ? quoteConfig : '3 BHK';
    const suggested = roomsFor({
      config,
      kitchenRunMm: null,
      bathrooms: baths ?? 2,
      study: true,
    }).map((r) => r.name);

    const seen = new Set<string>();
    const out: { value: string; label: string; hint?: string }[] = [];

    for (const name of [...rooms, ...suggested]) {
      const key = name.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({
        value: name,
        label: name,
        /* Says which rooms are already costed, so adding a second wardrobe to
           the master is a deliberate act rather than a surprise. */
        hint: rooms.includes(name) ? 'on this quotation' : undefined,
      });
    }
    return out;
  }, [rooms, quoteConfig, baths]);

  const productOptions = useMemo(
    () =>
      active.map((p) => ({
        value: p.id,
        label: p.name,
        /* Unpriced products are offered, marked. Hiding them makes a studio
           think the software lost one. */
        hint: p.ratePaise > 0 ? `₹${paiseToRupees(p.ratePaise)}` : 'no rate',
        hintWarns: p.ratePaise === 0,
      })),
    [active],
  );

  const [room, setRoom] = useState(defaultRoom ?? rooms[0] ?? '');
  const [productId, setProductId] = useState<string | null>(null);
  const [width, setWidth] = useState('');
  const [height, setHeight] = useState('');
  const [qty, setQty] = useState('');


  const product = active.find((p) => p.id === productId) ?? null;

  /* Chosen product first, then whatever the studio typed over it. Reading the
     defaults into the boxes would mean clearing them to change one. */
  const w = width.trim() === '' ? (product?.defaultWidthMm ?? null) : Number(width);
  const h = height.trim() === '' ? (product?.defaultHeightMm ?? null) : Number(height);
  const q = qty.trim() === '' ? (product?.defaultQty ?? null) : Number(qty);

  const size: AddSize =
    product?.unit === 'AREA'
      ? { widthMm: usable(w), heightMm: usable(h), qtyMilli: null }
      : { widthMm: null, heightMm: null, qtyMilli: usable(q) == null ? null : Math.round(usable(q)! * QTY_SCALE) };

  const amount =
    product == null
      ? 0
      : product.unit === 'AREA'
        ? size.widthMm && size.heightMm
          ? Math.round((product.ratePaise * areaMilli(size.widthMm, size.heightMm)) / QTY_SCALE)
          : 0
        : size.qtyMilli
          ? Math.round((product.ratePaise * size.qtyMilli) / QTY_SCALE)
          : 0;

  const targetRoom = room.trim();
  const canAdd = product !== null && targetRoom.length > 0;

  if (active.length === 0) return null;

  return (
    <div className="qadd" aria-label="Add a line">
      <span className="lbl">Add an item from your product master</span>

      <div className="qrow">
        <Combobox
          label="Product"
          value={productId ?? ''}
          options={productOptions}
          placeholder="Type to search your products"
          onChange={(id) => {
            setProductId(id);
            setWidth('');
            setHeight('');
            setQty('');
          }}
          emptyNote="Nothing in your product list matches that. Add it in your products and it will be here next time."
        />
        <Combobox
          label="Room"
          value={room}
          options={roomOptions}
          placeholder="Kitchen"
          onChange={setRoom}
          allowCustom
          customHint={(t) => `Add “${t}” as a new room`}
        />
      </div>

      {product === null ? null : (
        <>
          <p className="muted sm" style={{ margin: 0 }}>
            <span className="mono">{UNIT_LABELS[product.unit]}</span> · {product.code === 'MODULAR' ? 'Modular' : 'On-site'} ·{' '}
            {product.ratePaise > 0 ? <span className="mono">₹{paiseToRupees(product.ratePaise)}</span> : <span className="warn-t">no rate yet</span>}
          </p>

          <div className="qrow">
            {product.unit === 'AREA' ? (
              <>
                <label className="qfield narrow">
                  <span className="lbl">W mm</span>
                  <input
                    value={width}
                    onChange={(e) => setWidth(e.target.value)}
                    inputMode="numeric"
                    placeholder={product.defaultWidthMm != null ? String(product.defaultWidthMm) : ''}
                    className="fld num"
                  />
                </label>
                <label className="qfield narrow">
                  <span className="lbl">H mm</span>
                  <input
                    value={height}
                    onChange={(e) => setHeight(e.target.value)}
                    inputMode="numeric"
                    placeholder={product.defaultHeightMm != null ? String(product.defaultHeightMm) : ''}
                    className="fld num"
                  />
                </label>
              </>
            ) : (
              <label className="qfield narrow">
                <span className="lbl">Quantity</span>
                <input
                  value={qty}
                  onChange={(e) => setQty(e.target.value)}
                  inputMode="decimal"
                  placeholder={product.defaultQty != null ? String(product.defaultQty) : '1'}
                  className="fld num"
                />
              </label>
            )}

            {/* Before the press, not after. Pricing a job is a calculator. */}
            <div className="qfield narrow" style={{ alignItems: 'flex-end' }}>
              <span className="lbl">Line amount</span>
              <span className="mono" style={{ fontSize: 17, fontWeight: 600, minHeight: 42, display: 'flex', alignItems: 'center' }}>
                {amount > 0 ? formatINR(amount) : '—'}
              </span>
            </div>

            <div className="hstack" style={{ flex: '1 1 260px', justifyContent: 'flex-end' }}>
              <button type="button" onClick={() => setProductId(null)} className="btn ghost">
                Clear
              </button>
              <button
                type="button"
                disabled={!canAdd}
                onClick={() => {
                  onAdd(targetRoom, product, size);
                  setProductId(null);
                  setWidth('');
                  setHeight('');
                  setQty('');
                }}
                className="btn pri"
              >
                + Add to {targetRoom || 'the quotation'}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

/** The size a new line starts at, decided in the panel above. */
export interface AddSize {
  widthMm: number | null;
  heightMm: number | null;
  qtyMilli: number | null;
}

/** A typed number that is actually a number, and positive. */
function usable(value: number | null): number | null {
  if (value == null || !Number.isFinite(value) || value <= 0) return null;
  return value;
}
