'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { formatINR, paiseToRupees, rupeesToPaise } from '@/lib/money';
import { DISCOUNT_NAMES, lineAmount, QTY_SCALE, type QuoteUnitName, type WorkCodeName } from '@/modules/studio-quote/pricing';
import { compareLines, sizeText, type ChangeStatus, type CompareLine } from '@/modules/studio-quote/compare-lines';
import type { ProductRow } from '@/modules/studio-quote/store';
import { Combobox } from './Combobox';
import { usable, type AddSize } from './QuoteLines';

/** A small uppercase section head in the left panel (Hauspire's `h2`). */
export function Sec({ children, first = false }: { children: React.ReactNode; first?: boolean }) {
  return <h2 className={`hsec${first ? ' first' : ''}`}>{children}</h2>;
}

/**
 * The named flat discount (Hauspire's `DiscountPicker`): a name from the list
 * or your own, and an amount. It shows on the quotation only with an amount.
 */
export function DiscountPicker({
  label,
  amount,
  onLabel,
  onAmount,
}: {
  label: string;
  /** Rupees, as typed. */
  amount: string;
  onLabel: (v: string) => void;
  onAmount: (v: string) => void;
}) {
  const presets = DISCOUNT_NAMES as readonly string[];
  const isPreset = label === '' || presets.includes(label);
  return (
    <div className="hstackv">
      <div className="hgrid2">
        <select
          className="fld hfld"
          aria-label="Discount name"
          value={isPreset ? label || presets[0] : '__custom'}
          onChange={(e) => onLabel(e.target.value === '__custom' ? 'Special discount' : e.target.value)}
        >
          {presets.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
          <option value="__custom">Custom…</option>
        </select>
        <input className="fld hfld num" inputMode="numeric" placeholder="Amount ₹" aria-label="Discount amount in rupees" value={amount} onChange={(e) => onAmount(e.target.value)} />
      </div>
      {!isPreset ? (
        <input className="fld hfld" placeholder="Discount name (e.g. Diwali offer)" aria-label="Name of the discount" maxLength={60} value={label} onChange={(e) => onLabel(e.target.value)} />
      ) : null}
      <p className="hhelp">Applies only when an amount is set; shown on the quotation with this name. Modular discount is separate.</p>
    </div>
  );
}

const TYPE_OF: Record<QuoteUnitName, string> = { AREA: 'Area', SQFT: 'SqFt', RFT: 'RFT', UNIT: 'Unit' };
const CODE_OF: Record<WorkCodeName, string> = { MODULAR: 'MO-01', ONSITE: 'NM-01' };

/** "MO-01 · Area · ₹2580/sqft", as Hauspire's add panel reads a product. */
export function productLine(p: Pick<ProductRow, 'code' | 'unit' | 'ratePaise'>): string {
  const rate = p.ratePaise > 0 ? `₹${paiseToRupees(p.ratePaise)}` : 'no rate yet';
  const per = p.unit === 'RFT' ? '/rft' : p.unit === 'UNIT' ? '/unit' : '/sqft';
  return `${CODE_OF[p.code]} · ${TYPE_OF[p.unit]} · ${rate}${p.ratePaise > 0 ? per : ''}`;
}

/**
 * Add a line (Hauspire's "Add a line"): the room, the product, its size by
 * its own unit, the amount before the press. Sizes start at the product
 * master's defaults.
 */
export function AddLine({
  rooms,
  room,
  onRoom,
  products,
  onAdd,
  disabled = false,
}: {
  rooms: string[];
  room: string;
  onRoom: (room: string) => void;
  products: ProductRow[];
  onAdd: (room: string, product: ProductRow, size: AddSize) => void;
  disabled?: boolean;
}) {
  const active = useMemo(() => products.filter((p) => p.isActive), [products]);
  const options = useMemo(
    () => active.map((p) => ({ value: p.id, label: p.name, hint: p.ratePaise > 0 ? `₹${paiseToRupees(p.ratePaise)}` : 'no rate', hintWarns: p.ratePaise === 0 })),
    [active],
  );
  const [productId, setProductId] = useState<string>(() => active[0]?.id ?? '');
  const product = active.find((p) => p.id === productId) ?? null;
  const defaults = (p: ProductRow | null) => ({
    w: p?.defaultWidthMm != null ? String(p.defaultWidthMm) : '',
    h: p?.defaultHeightMm != null ? String(p.defaultHeightMm) : '',
    q:
      p?.unit === 'SQFT' && p.rules?.sqft
        ? String(p.rules.sqft)
        : p?.unit === 'RFT' && p.rules?.rft
          ? String(p.rules.rft)
          : p?.defaultQty != null
            ? String(p.defaultQty)
            : '1',
  });
  const [size, setSize] = useState(() => defaults(product));

  const w = usable(Number(size.w));
  const h = usable(Number(size.h));
  const q = usable(Number(size.q));
  const add: AddSize =
    product?.unit === 'AREA'
      ? { widthMm: w == null ? null : Math.round(w), heightMm: h == null ? null : Math.round(h), qtyMilli: null }
      : { widthMm: null, heightMm: null, qtyMilli: q == null ? null : Math.round(q * QTY_SCALE) };
  /* The figure the line will have: `lineAmount`, the old app's rounding to the rupee. */
  const amount = product == null ? 0 : lineAmount({ unit: product.unit, code: product.code, ratePaise: product.ratePaise, ...add });

  if (active.length === 0) return <p className="hhelp">Your product master is empty.</p>;

  return (
    <div className="hstackv">
      <select className="fld hfld" aria-label="Room for the new line" value={room} onChange={(e) => onRoom(e.target.value)}>
        {rooms.map((r) => (
          <option key={r} value={r}>
            {r}
          </option>
        ))}
      </select>
      <Combobox
        compact
        label="Product"
        value={productId}
        options={options}
        placeholder="Search product…"
        emptyNote="No match. Use “Propose a NEW product” to add it."
        onChange={(id) => {
          setProductId(id);
          setSize(defaults(active.find((p) => p.id === id) ?? null));
        }}
      />
      {product ? <p className="hhelp">{productLine(product)}</p> : null}
      {product?.unit === 'AREA' ? (
        <div className="hgrid2">
          <label className="hlab">
            W (mm)
            <input className="fld hfld num" inputMode="numeric" value={size.w} onChange={(e) => setSize({ ...size, w: e.target.value })} />
          </label>
          <label className="hlab">
            H (mm)
            <input className="fld hfld num" inputMode="numeric" value={size.h} onChange={(e) => setSize({ ...size, h: e.target.value })} />
          </label>
        </div>
      ) : product ? (
        <label className="hlab">
          {product.unit === 'SQFT' ? 'Area (sq ft)' : product.unit === 'RFT' ? 'Length (running ft)' : 'Quantity'}
          <input className="fld hfld num" inputMode="decimal" value={size.q} onChange={(e) => setSize({ ...size, q: e.target.value })} />
        </label>
      ) : null}
      <p className="hamount">Line amount: {formatINR(amount)}</p>
      <button type="button" className="btn pri hwide" disabled={disabled || !product || !room} onClick={() => product && onAdd(room, product, add)}>
        + Add line
      </button>
    </div>
  );
}

/**
 * "+ Propose a NEW product (not in master)": a line the product master does
 * not have. Added to this quotation at once; the owner and a project manager
 * put it straight into the product master, a salesperson's goes to Products
 * for approval.
 */
export function ProposeForm({
  mayAddProducts,
  busy,
  onPropose,
}: {
  mayAddProducts: boolean;
  busy: boolean;
  onPropose: (p: { name: string; code: WorkCodeName; unit: QuoteUnitName; ratePaise: number; details: string }) => void;
}) {
  const [open, setOpen] = useState(false);
  const [np, setNp] = useState({ name: '', code: 'ONSITE' as WorkCodeName, unit: 'UNIT' as QuoteUnitName, value: '10000', details: '' });
  const value = Number(np.value.replace(/[,₹\s]/g, ''));
  const ok = np.name.trim().length >= 2 && Number.isFinite(value) && value >= 0;
  return (
    <div className="hstackv">
      <button type="button" className="linkbtn hpropose" onClick={() => setOpen((v) => !v)}>
        {open ? '− Cancel new product' : '+ Propose a NEW product (not in master)'}
      </button>
      {open ? (
        <div className="hboxsoft hstackv">
          <input className="fld hfld" placeholder="New product name" aria-label="New product name" maxLength={120} value={np.name} onChange={(e) => setNp({ ...np, name: e.target.value })} />
          <div className="hgrid2">
            <select className="fld hfld" aria-label="Work code" value={np.code} onChange={(e) => setNp({ ...np, code: e.target.value as WorkCodeName })}>
              <option value="MODULAR">MO-01</option>
              <option value="ONSITE">NM-01</option>
            </select>
            <select className="fld hfld" aria-label="How it is priced" value={np.unit} onChange={(e) => setNp({ ...np, unit: e.target.value as QuoteUnitName })}>
              <option value="UNIT">Unit</option>
              <option value="AREA">Area</option>
              <option value="SQFT">SqFt</option>
              <option value="RFT">RFT</option>
            </select>
          </div>
          <label className="hlab">
            {np.unit === 'UNIT' ? 'Amount (₹)' : 'Rate (₹/sqft·rft)'}
            <input className="fld hfld num" inputMode="decimal" value={np.value} onChange={(e) => setNp({ ...np, value: e.target.value })} />
          </label>
          <textarea className="fld hfld" rows={2} placeholder="Details (client-facing)" aria-label="Details" value={np.details} onChange={(e) => setNp({ ...np, details: e.target.value })} />
          <button
            type="button"
            className="btn sec hwide"
            disabled={!ok || busy}
            onClick={() => {
              onPropose({ name: np.name.trim(), code: np.code, unit: np.unit, ratePaise: rupeesToPaise(value), details: np.details.trim() });
              setNp({ name: '', code: 'ONSITE', unit: 'UNIT', value: '10000', details: '' });
              setOpen(false);
            }}
          >
            {busy ? 'Saving…' : mayAddProducts ? 'Add to products & to quote' : 'Propose & add to quote'}
          </button>
          <p className="hhelp">
            {mayAddProducts
              ? 'You manage the product master, so it goes straight in and becomes a standard line item.'
              : 'Sent to Products for approval; once approved it becomes a standard line item.'}
          </p>
        </div>
      ) : null}
    </div>
  );
}

const TAG: Record<Exclude<ChangeStatus, 'same'>, { t: string; c: string }> = {
  added: { t: 'NEW', c: 'good' },
  removed: { t: 'REMOVED', c: 'bad' },
  changed: { t: 'CHANGED', c: 'warn' },
};

/**
 * Final (Original vs Revised), Hauspire's `FinalCompare` row for row: room by
 * room, each line's size (original → final), its original and final figure
 * and the change; then the Original and Final Total Project Value and the
 * change. As in the old app the Original is the quotation as it was opened,
 * until "Snapshot current as Original" takes what is on screen (owner, 22
 * Oct 2026). The copy the client was sent is compared on the printable
 * page (revisions R1, R2…), linked here.
 */
export function FinalCompare({
  original,
  current,
  wasTotalPaise,
  nowTotalPaise,
  onSnapshot,
  compareHref,
  compareLabel,
}: {
  original: CompareLine[];
  current: CompareLine[];
  wasTotalPaise: number;
  nowTotalPaise: number;
  onSnapshot: () => void;
  compareHref: string | null;
  compareLabel: string;
}) {
  const rows = compareLines(original, current);
  const rooms = [...new Set(rows.map((r) => r.room))];
  const delta = nowTotalPaise - wasTotalPaise;
  const signed = (p: number) => `${p >= 0 ? '+' : '−'}${formatINR(Math.abs(p))}`;
  return (
    <div className="hfinal">
      <div className="hstack" style={{ gap: 8, margin: '0 0 10px', flexWrap: 'wrap', alignItems: 'center' }}>
        <button type="button" className="btn sec sm" onClick={onSnapshot}>
          Snapshot current as “Original”
        </button>
        <span className="muted hhelp" style={{ margin: 0 }}>
          Original = {original.length} line(s). Open a saved quote or snapshot here, then edit lines and compare.
          {compareHref ? (
            <>
              {' '}
              <Link href={compareHref} className="acc-t">
                {compareLabel}
              </Link>
            </>
          ) : null}
        </span>
      </div>
      <div className="hdochead">
        <div className="hbig">Final Quotation — Original vs Revised</div>
        <Legend />
      </div>
      {rooms.map((room) => (
        <div key={room} className="hfroom">
          <div className="hband hbandbox">{room}</div>
          <div className="tscroll">
            <table className="htable">
              <thead>
                <tr className="hhead">
                  <th scope="col">Product</th>
                  <th scope="col">Size (Orig → Final)</th>
                  <th scope="col" className="r">
                    Original (₹)
                  </th>
                  <th scope="col" className="r">
                    Final (₹)
                  </th>
                  <th scope="col" className="r">
                    Change
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows
                  .filter((r) => r.room === room)
                  .map((r, i) => {
                    const tag = r.status === 'same' ? null : TAG[r.status];
                    const oAmt = r.o?.amountPaise ?? null;
                    const fAmt = r.c?.amountPaise ?? 0;
                    const d = fAmt - (oAmt ?? 0);
                    const os = sizeText(r.o);
                    const fs = sizeText(r.c);
                    return (
                      <tr key={`${r.room}|${r.product}|${i}`} className={`hf-${r.status}`}>
                        <td>
                          <b className={r.status === 'removed' ? 'struck' : ''}>{r.product}</b>
                          {tag ? <span className={`chip ${tag.c} hchip`}>{tag.t}</span> : null}
                          {(r.c ?? r.o)?.details ? (
                            <span className="muted" style={{ display: 'block', fontSize: 12.5, lineHeight: 1.35 }}>
                              {(r.c ?? r.o)!.details}
                              {r.o?.details && r.c?.details && r.o.details !== r.c.details ? <span className="struck"> (was: {r.o.details})</span> : null}
                            </span>
                          ) : null}
                        </td>
                        <td>
                          {r.status === 'changed' && os !== fs ? (
                            <span>
                              <span className="struck muted">{os}</span> → <b>{fs}</b>
                            </span>
                          ) : r.status === 'added' ? (
                            <b>{fs}</b>
                          ) : r.status === 'removed' ? (
                            <span className="struck muted">{os}</span>
                          ) : (
                            os
                          )}
                        </td>
                        <td className="r mono">{oAmt == null ? '—' : formatINR(oAmt)}</td>
                        <td className="r mono" style={{ fontWeight: 600 }}>
                          {r.status === 'removed' ? '—' : formatINR(fAmt)}
                        </td>
                        <td className={`r mono ${d > 0 ? 'good-t' : d < 0 ? 'bad-t' : 'muted'}`}>{d === 0 ? '—' : signed(d)}</td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </div>
      ))}
      <table className="htable htot" style={{ maxWidth: 460, marginTop: 12 }}>
        <tbody>
          <tr>
            <th scope="row">Original Total Project Value</th>
            <td className="mono">{formatINR(wasTotalPaise)}</td>
          </tr>
          <tr>
            <th scope="row">Final Total Project Value</th>
            <td className="mono" style={{ fontWeight: 700 }}>
              {formatINR(nowTotalPaise)}
            </td>
          </tr>
          <tr className={delta >= 0 ? 'good-t strong' : 'bad-t strong'}>
            <th scope="row">Change</th>
            <td className="mono">{signed(delta)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function Legend() {
  return (
    <span className="hstack" style={{ gap: 6 }}>
      <span className="chip good hchip">NEW</span>
      <span className="chip warn hchip">CHANGED</span>
      <span className="chip bad hchip">REMOVED</span>
    </span>
  );
}
