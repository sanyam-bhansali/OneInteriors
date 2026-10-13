'use client';

import { Fragment, useMemo, useState, useTransition } from 'react';
import { formatINR, paiseToRupees, rupeesToPaise } from '@/lib/money';
import { areaMilli, formatQty, lineAmount, QTY_SCALE, type QuoteUnitName, type WorkCodeName } from '@/modules/studio-quote/pricing';
import { discountedPaise } from '@/modules/studio-quote/rooms';
import type { ProductRow } from '@/modules/studio-quote/store';
import { addLineToProductsAction, proposeProductAction } from '../actions';
import { Combobox, type ComboOption } from './Combobox';
import { Num, type EditableLine, type PricedLine } from './QuoteLines';

/**
 * The quotation, room by room, in Hauspire's table (`QuoteTable.tsx`): a dark
 * band with the room's name, a header row, one editable row per line, and the
 * room's sub-total with "+ add item" — every cell edited where it sits, the
 * amounts moving as they type.
 *
 * Columns as Hauspire's: #, Product, Code, Details, Units / SqFt / RFT, W, H,
 * Amount, Discounted. Ours adds what our builder already did: the rate under
 * the product (it applies to this quotation only), a typed amount that beats
 * rate × quantity ("agreed", with ↺ to hand it back), duplicate, and a line
 * typed outside the product master offered to it (owner, PM) or proposed for
 * approval (sales).
 *
 * The Discounted figure takes the modular discount off a modular (MO-01) line;
 * the total's discount is taken once on the modular sum (`computeTotals`), so
 * that is the figure that prints.
 */
export function QuoteTable({
  lines,
  rooms,
  products,
  discountBps,
  onUpdate,
  onRemove,
  onDuplicate,
  onMove,
  onReorder,
  onSwap,
  onAddItem,
  mayAddProducts = false,
  quoteId = null,
  readOnly = false,
}: {
  lines: PricedLine[];
  /** The one room order (`orderedRooms`). Rooms with no line are not drawn. */
  rooms: string[];
  products: ProductRow[];
  discountBps: number;
  onUpdate: (key: string, patch: Partial<EditableLine>) => void;
  onRemove: (key: string) => void;
  onDuplicate: (key: string) => void;
  onMove: (key: string, by: -1 | 1) => void;
  onReorder: (from: string, to: string) => void;
  onSwap: (key: string, product: ProductRow) => void;
  onAddItem: (room: string) => void;
  mayAddProducts?: boolean;
  quoteId?: string | null;
  readOnly?: boolean;
}) {
  const options: ComboOption[] = useMemo(
    () =>
      products
        .filter((p) => p.isActive)
        .map((p) => ({ value: p.id, label: p.name, hint: p.ratePaise > 0 ? `₹${paiseToRupees(p.ratePaise)}` : 'no rate', hintWarns: p.ratePaise === 0 })),
    [products],
  );
  const shown = rooms.filter((r) => lines.some((l) => l.room === r));

  return (
    <div className="tscroll htable-wrap">
      <table className="htable">
        <colgroup>
          <col style={{ width: 54 }} />
          <col style={{ width: 210 }} />
          <col style={{ width: 82 }} />
          <col />
          <col style={{ width: 110 }} />
          <col style={{ width: 78 }} />
          <col style={{ width: 78 }} />
          <col style={{ width: 112 }} />
          <col style={{ width: 120 }} />
        </colgroup>
        <tbody>
          {shown.map((room) => {
            const items = lines.filter((l) => l.room === room);
            const sub = items.reduce((a, l) => a + l.amountPaise, 0);
            const subDisc = items.reduce((a, l) => a + discountedPaise(l.amountPaise, l.code, discountBps), 0);
            return (
              <Fragment key={room}>
                <tr className="hband">
                  <td colSpan={9}>{room}</td>
                </tr>
                <tr className="hhead">
                  <th scope="col">#</th>
                  <th scope="col">Product</th>
                  <th scope="col">Code</th>
                  <th scope="col">Details</th>
                  <th scope="col" className="r">
                    Units / SqFt / RFT
                  </th>
                  <th scope="col" className="r">
                    W
                  </th>
                  <th scope="col" className="r">
                    H
                  </th>
                  <th scope="col" className="r">
                    Amount
                  </th>
                  <th scope="col" className="r">
                    Discounted
                  </th>
                </tr>
                {items.map((line, n) => (
                  <Row
                    key={line.key}
                    n={n + 1}
                    line={line}
                    first={n === 0}
                    last={n === items.length - 1}
                    options={options}
                    products={products}
                    discountBps={discountBps}
                    onUpdate={onUpdate}
                    onRemove={onRemove}
                    onDuplicate={onDuplicate}
                    onMove={onMove}
                    onReorder={onReorder}
                    onSwap={onSwap}
                    mayAddProducts={mayAddProducts}
                    quoteId={quoteId}
                    readOnly={readOnly}
                  />
                ))}
                <tr className="hsub">
                  <td colSpan={7}>
                    {room} — Sub-total
                    {readOnly ? null : (
                      <button type="button" className="hmini" onClick={() => onAddItem(room)}>
                        + add item
                      </button>
                    )}
                  </td>
                  <td className="r mono">{formatINR(sub)}</td>
                  <td className="r mono">{formatINR(subDisc)}</td>
                </tr>
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

const UNIT_WORD: Record<QuoteUnitName, string> = { AREA: 'sqft', SQFT: 'sqft', RFT: 'rft', UNIT: 'nos' };
const RATE_WORD: Record<QuoteUnitName, string> = { AREA: '/sqft', SQFT: '/sqft', RFT: '/rft', UNIT: '/unit' };
const squash = (t: string) => t.toLowerCase().replace(/[^a-z0-9]/g, '');

function Row({
  n,
  line,
  first,
  last,
  options,
  products,
  discountBps,
  onUpdate,
  onRemove,
  onDuplicate,
  onMove,
  onReorder,
  onSwap,
  mayAddProducts,
  quoteId,
  readOnly,
}: {
  n: number;
  line: PricedLine;
  first: boolean;
  last: boolean;
  options: ComboOption[];
  products: ProductRow[];
  discountBps: number;
  onUpdate: (key: string, patch: Partial<EditableLine>) => void;
  onRemove: (key: string) => void;
  onDuplicate: (key: string) => void;
  onMove: (key: string, by: -1 | 1) => void;
  onReorder: (from: string, to: string) => void;
  onSwap: (key: string, product: ProductRow) => void;
  mayAddProducts: boolean;
  quoteId: string | null;
  readOnly: boolean;
}) {
  const [over, setOver] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [adding, startAdding] = useTransition();
  const [added, setAdded] = useState<string | null>(null);
  const area = line.unit === 'AREA';
  const modular = line.code === 'MODULAR';
  const match = products.find((p) => squash(p.name) === squash(line.product)) ?? null;
  const known = line.product.trim().length < 2 || match !== null;
  const overridden = line.agreedPaise != null;
  const calculated = lineAmount({
    unit: line.unit,
    code: line.code,
    ratePaise: line.ratePaise,
    widthMm: line.widthMm,
    heightMm: line.heightMm,
    qtyMilli: line.qtyMilli,
  });

  const whole = (raw: string): number | null => {
    const t = raw.trim();
    if (t === '') return null;
    const v = Number(t);
    return Number.isFinite(v) && v > 0 ? Math.round(v) : null;
  };

  function offer() {
    startAdding(async () => {
      try {
        const r = mayAddProducts
          ? await addLineToProductsAction({
              name: line.product.trim(),
              code: line.code,
              unit: line.unit,
              rateRupees: line.ratePaise / 100,
              room: line.room,
              details: line.details,
            })
          : await proposeProductAction(
              { name: line.product.trim(), code: line.code, unit: line.unit, ratePaise: line.ratePaise, details: line.details, room: line.room },
              quoteId,
            );
        setAdded(r.ok ? ('message' in r ? String(r.message) : 'Added to your products.') : r.error);
      } catch {
        setAdded('That did not save.');
      }
    });
  }

  return (
    <tr
      className={`hrow ${over ? 'over' : ''} ${dragging ? 'dragging' : ''}`}
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
    >
      <td className="c hnum">
        {readOnly ? null : (
          <span
            className="hgrip"
            draggable
            title="Drag to reorder within this room"
            aria-hidden="true"
            onDragStart={(e) => {
              e.dataTransfer.setData('text/x-line', line.key);
              e.dataTransfer.effectAllowed = 'move';
              setDragging(true);
            }}
            onDragEnd={() => setDragging(false)}
          >
            ⠿
          </span>
        )}
        <span>{n}</span>
        {readOnly ? null : (
          <span className="harrows">
            <button type="button" disabled={first} onClick={() => onMove(line.key, -1)} title="Move up" aria-label={`Move ${line.product} up`}>
              ▲
            </button>
            <button type="button" disabled={last} onClick={() => onMove(line.key, 1)} title="Move down" aria-label={`Move ${line.product} down`}>
              ▼
            </button>
          </span>
        )}
      </td>

      <td>
        <Combobox
          compact
          label={`Product on line ${n} of ${line.room}`}
          value={match?.id ?? line.product}
          options={options}
          placeholder="Search product…"
          allowCustom
          customHint={(t) => `Use “${t}” (not in the product master)`}
          onChange={(v) => {
            const p = products.find((x) => x.id === v);
            if (p) onSwap(line.key, p);
            else onUpdate(line.key, { product: v });
          }}
        />
        <div className="hrate">
          <span>₹</span>
          <Num
            value={line.ratePaise > 0 ? paiseToRupees(line.ratePaise) : null}
            label={`Rate for ${line.product}`}
            className="hcell num hratein"
            onChange={(v) => {
              const num = Number(v.trim());
              onUpdate(line.key, { ratePaise: v.trim() === '' || !Number.isFinite(num) || num < 0 ? 0 : rupeesToPaise(num) });
            }}
          />
          <span>{RATE_WORD[line.unit]}</span>
          {overridden ? (
            <span className="chip oi hchip" title="This figure was agreed, not calculated">
              agreed
            </span>
          ) : null}
        </div>
        {!known && added === null ? (
          <div className="hrate">
            <span className="chip warn hchip" title="Typed on this quotation; not one of your products">
              not in products
            </span>
            {readOnly ? null : (
              <button type="button" disabled={adding} onClick={offer} className="linkbtn acc-t hlink">
                {adding ? '…' : mayAddProducts ? 'Add to products' : 'Propose'}
              </button>
            )}
          </div>
        ) : null}
        {added ? <div className="muted hnote">{added}</div> : null}
      </td>

      <td>
        <select
          value={line.code}
          onChange={(e) => onUpdate(line.key, { code: e.target.value as WorkCodeName })}
          aria-label="Work code: MO-01 modular, NM-01 non-modular"
          title={modular ? 'Modular (factory-made)' : 'Non-modular (on site)'}
          className="hcell"
        >
          <option value="MODULAR">MO-01</option>
          <option value="ONSITE">NM-01</option>
        </select>
      </td>

      <td>
        <textarea
          value={line.details ?? ''}
          onChange={(e) => onUpdate(line.key, { details: e.target.value })}
          rows={2}
          aria-label={`What ${line.product} includes`}
          className="hcell hdetails"
        />
      </td>

      <td className="r">
        {area ? (
          <span className="muted hunit">{line.widthMm && line.heightMm ? `${formatQty(areaMilli(line.widthMm, line.heightMm))} sqft` : '—'}</span>
        ) : (
          <span className="hqty">
            <Num
              value={line.qtyMilli != null ? line.qtyMilli / QTY_SCALE : null}
              label={`Quantity of ${line.product}`}
              className="hcell num"
              onChange={(v) => {
                const num = Number(v.trim());
                onUpdate(line.key, { qtyMilli: v.trim() === '' || !Number.isFinite(num) || num < 0 ? null : Math.round(num * QTY_SCALE) });
              }}
            />
            <span className="muted hunit">{UNIT_WORD[line.unit]}</span>
          </span>
        )}
      </td>

      <td className="r">
        {area ? (
          <Num value={line.widthMm} label={`Width of ${line.product}, mm`} className="hcell num" onChange={(v) => onUpdate(line.key, { widthMm: whole(v) })} />
        ) : (
          <span className="hdash">—</span>
        )}
      </td>
      <td className="r">
        {area ? (
          <Num value={line.heightMm} label={`Height of ${line.product}, mm`} className="hcell num" onChange={(v) => onUpdate(line.key, { heightMm: whole(v) })} />
        ) : (
          <span className="hdash">—</span>
        )}
      </td>

      <td className="r">
        {/* The agreed figure is the editable one; empty hands the line back
            to rate × quantity, shown as the placeholder. */}
        <span className="hamt">
          <Num
            value={line.agreedPaise != null ? paiseToRupees(line.agreedPaise) : null}
            placeholder={calculated > 0 ? formatINR(calculated, { symbol: false }) : '—'}
            label={`Amount for ${line.product}`}
            className={`hcell num hamtin ${modular ? 'mo' : ''}`}
            onChange={(v) => {
              const num = Number(v.replace(/,/g, '').trim());
              onUpdate(line.key, { agreedPaise: v.trim() === '' || !Number.isFinite(num) || num < 0 ? null : rupeesToPaise(num) });
            }}
          />
          {overridden && !readOnly ? (
            <button type="button" className="hmini ghost" title="Back to rate × quantity" aria-label={`Use the calculated amount for ${line.product}`} onClick={() => onUpdate(line.key, { agreedPaise: null })}>
              ↺
            </button>
          ) : null}
        </span>
        {overridden && calculated > 0 && calculated !== line.agreedPaise ? <span className="hstruck mono">{formatINR(calculated)}</span> : null}
      </td>

      <td className="r">
        <span className="hdisc">
          <span className={modular ? 'good-t hdiscv' : 'muted hdiscv'}>{formatINR(discountedPaise(line.amountPaise, line.code, discountBps))}</span>
          {readOnly ? null : (
            <>
              <button type="button" className="hx dup" onClick={() => onDuplicate(line.key)} title="Duplicate line" aria-label={`Duplicate ${line.product}`}>
                ⧉
              </button>
              <button type="button" className="hx" onClick={() => onRemove(line.key)} title="Remove line" aria-label={`Remove ${line.product}`}>
                ✕
              </button>
            </>
          )}
        </span>
      </td>
    </tr>
  );
}
