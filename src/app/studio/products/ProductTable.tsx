'use client';

import { Fragment, useActionState, useState, useTransition } from 'react';
import { paiseToRupees } from '@/lib/money';
import { ROOM_CATEGORIES } from '@/modules/studio-quote/starter-catalogue';
import { UNIT_LABELS, WORK_CODE_LABELS, type QuoteUnitName, type WorkCodeName } from '@/modules/studio-quote/pricing';
import type { ProductRow } from '@/modules/studio-quote/store';
import { saveRateAction, addProductAction, toggleStandardAction } from './actions';
import { IDLE } from '../form-state';
import { ProductEditor } from './ProductEditor';
import { LineIcon } from '../ui/icons';

/**
 * A rate, edited in place.
 *
 * One form per row rather than one form for the table. A studio prices a
 * catalogue over days, in bursts of two or three lines between site visits, and
 * a single "Save all" at the bottom of thirty-eight rows means every visit
 * risks losing the others. Per-row also means the save confirms next to the
 * thing that saved.
 */
function RateCell({ product }: { product: ProductRow }) {
  const [state, action, pending] = useActionState(saveRateAction, IDLE);

  return (
    <form action={action} className="prate">
      <input type="hidden" name="id" value={product.id} />
      <span className="muted sm">₹</span>
      <input
        name="rate"
        inputMode="decimal"
        defaultValue={product.ratePaise > 0 ? String(paiseToRupees(product.ratePaise)) : ''}
        placeholder="—"
        aria-label={`Rate for ${product.name}`}
        className="fld pnum" style={{ width: 130, minHeight: 36 }}
      />
      <button type="submit" disabled={pending} className="btn sec sm">
        {pending ? '…' : 'Save'}
      </button>
      {'ok' in state && state.ok ? (
        <span className="good-t sm">Saved</span>
      ) : null}
      {'ok' in state && !state.ok ? (
        <span className="perr">{state.error}</span>
      ) : null}
    </form>
  );
}

/**
 * Is this part of what the studio fits as standard?
 *
 * ## Why a tick here rather than a list somewhere else
 *
 * The quotation builder can assemble a 3 BHK in one press, and what it
 * assembles is exactly the products ticked here. That makes this column the
 * highest-leverage control in the studio software: twenty-five ticks, once,
 * turn every future quotation from an hour of typing into a few corrections.
 *
 * It is a separate question from the rate and from whether the product is
 * sold at all. A walk-in wardrobe is priced, active, and not standard. Writing
 * it as a second list would be a second list to keep in step with the first;
 * as a tick beside the rate it is maintained in the place a studio already
 * visits when their practice changes.
 *
 * Saves on change, with no confirmation. A tick that needs a Save button is a
 * tick people forget to press, and the cost of an accidental one is a line on
 * the next build that they delete.
 */
function StandardCell({ product }: { product: ProductRow }) {
  const [on, setOn] = useState(product.inStandardBuild);
  const [pending, start] = useTransition();
  const [failed, setFailed] = useState(false);

  return (
    <label className="pcheck">
      <input
        type="checkbox"
        checked={on}
        disabled={pending}
        onChange={(e) => {
          const next = e.target.checked;
          setOn(next);
          setFailed(false);
          start(async () => {
            const result = await toggleStandardAction(product.id, next);
            /* Put back on failure. A tick that stayed ticked while the write
               failed is a product the studio believes is in their standard
               build and is not. */
            if (result && 'ok' in result && !result.ok) {
              setOn(!next);
              setFailed(true);
            }
          });
        }}
      />
      Standard
      {failed ? <span className="bad-t">not saved</span> : null}
    </label>
  );
}

export function ProductTable({
  products,
  summary,
  allPriced,
  notes,
}: {
  products: ProductRow[];
  /** "31 of 75 priced", for the chip beside the tabs. */
  summary: string;
  allPriced: boolean;
  /** The page's notes (the rates gate, blank rates, nothing standard), under the heading. */
  notes?: React.ReactNode;
}) {
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [addState, addAction, addPending] = useActionState(addProductAction, IDLE);

  const grouped = ROOM_CATEGORIES.map((room) => ({
    room: room as string,
    items: products.filter((p) => p.rooms.includes(room)),
  })).filter((g) => g.items.length > 0);

  // A product a studio added with no room lands nowhere above, and a row that
  // exists but is invisible is worse than no row.
  const loose = products.filter((p) => !ROOM_CATEGORIES.some((r) => p.rooms.includes(r)));
  if (loose.length > 0) grouped.push({ room: 'Everything else', items: loose });

  /* One room's products at a time (StudioRates: a tab per category), and
     All for the whole list. */
  const [tab, setTab] = useState<string>(grouped[0]?.room ?? ALL);
  const shown = tab === ALL ? products : (grouped.find((g) => g.room === tab)?.items ?? []);
  const standardShown = shown.filter((p) => p.inStandardBuild).length;
  const pricedShown = shown.filter((p) => p.ratePaise > 0).length;

  return (
    <>
      <div className="phead">
        <div>
          <h1>Product master</h1>
          <p className="muted psub">Your items and your rates. We never fill in or suggest a price.</p>
        </div>
        <div className="hstack">
          <button type="button" onClick={() => setAdding(true)} className="btn pri">
            <LineIcon name="plus" size={17} />
            Add an item
          </button>
        </div>
      </div>

      {notes}

      {adding ? (
        <form action={addAction} className="card">
          <div className="chead">
            <h2>Add an item</h2>
          </div>

          <div className="prow">
            <label className="pfield" style={{ flex: '1 1 18rem' }}>
              <span className="lbl">Name</span>
              <input name="name" required placeholder="Sliding wardrobe" className="fld" />
            </label>

            <label className="pfield">
              <span className="lbl">Measured by</span>
              <select name="unit" defaultValue="AREA" className="fld">
                {(Object.keys(UNIT_LABELS) as QuoteUnitName[]).map((u) => (
                  <option key={u} value={u}>
                    {UNIT_LABELS[u]}
                  </option>
                ))}
              </select>
            </label>

            <label className="pfield">
              <span className="lbl">Work</span>
              <select name="code" defaultValue="MODULAR" className="fld">
                {(Object.keys(WORK_CODE_LABELS) as WorkCodeName[]).map((c) => (
                  <option key={c} value={c}>
                    {WORK_CODE_LABELS[c]}
                  </option>
                ))}
              </select>
            </label>

            <label className="pfield" style={{ width: '8rem' }}>
              <span className="lbl">Rate (₹)</span>
              <input name="rate" inputMode="decimal" placeholder="0" className="fld pnum" />
            </label>
          </div>

          <fieldset className="pset">
            <legend className="lbl">Rooms it belongs in</legend>
            <div className="hstack" style={{ gap: 8 }}>
              {ROOM_CATEGORIES.map((r) => (
                <label key={r} className="ppick">
                  <input type="checkbox" name="rooms" value={r} className="sr-only" />
                  {r}
                </label>
              ))}
            </div>
          </fieldset>

          <label className="pfield">
            <span className="lbl">What it includes — optional</span>
            <input name="details" placeholder="Carcass, shutters, hardware and installation." className="fld" />
          </label>

          <div className="hstack">
            <button type="submit" disabled={addPending} className="btn pri">
              {addPending ? 'Adding…' : 'Add product'}
            </button>
            <button type="button" onClick={() => setAdding(false)} className="btn ghost">
              Cancel
            </button>
            {'ok' in addState && !addState.ok ? <span className="perr">{addState.error}</span> : null}
          </div>
        </form>
      ) : null}

      <div className="hstack" style={{ justifyContent: 'space-between' }}>
        <div className="tabs ptabs" role="tablist" aria-label="Room">
          {grouped.map((g) => (
            <button key={g.room} type="button" role="tab" aria-selected={tab === g.room} onClick={() => setTab(g.room)}>
              {g.room} <span className="n">{g.items.length}</span>
            </button>
          ))}
          <button type="button" role="tab" aria-selected={tab === ALL} onClick={() => setTab(ALL)}>
            All <span className="n">{products.length}</span>
          </button>
        </div>
        <span className={`chip ${allPriced ? 'good' : 'warn'}`}>
          <span className="dot" />
          {summary}
        </span>
      </div>

      <section className="card flush">
        <div className="chead">
          <h2>{tab === ALL ? 'Every product' : tab}</h2>
          <span className="muted sm">
            {pricedShown} of {shown.length} priced · {standardShown} standard
          </span>
        </div>
        <div className="tscroll">
          <table className="tbl ptbl" style={{ minWidth: 980 }}>
            <thead>
              <tr>
                <th scope="col">Item</th>
                <th scope="col">Work</th>
                <th scope="col">Unit</th>
                <th scope="col">In the standard build</th>
                <th scope="col" style={{ textAlign: 'right' }}>
                  Your rate
                </th>
                <th scope="col">
                  <span className="sr-only">Edit</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {shown.map((p) => (
                <Fragment key={p.id}>
                  <tr className={p.isActive ? '' : 'off'}>
                    <td>
                      <div className="hstack" style={{ gap: 6 }}>
                        <b style={{ fontWeight: 600 }}>{p.name}</b>
                        {p.ratePaise === 0 ? <span className="chip warn">No rate</span> : null}
                        {p.isActive ? null : <span className="chip">Switched off</span>}
                        {p.rules?.bhk ? <span className="chip">{p.rules.bhk.replace(/(\d)/, '$1 ')} only</span> : null}
                        {p.rules?.perBath ? <span className="chip">per bathroom</span> : null}
                      </div>
                      {p.details ? (
                        <div className="muted sm" style={{ maxWidth: '60ch', marginTop: 2, lineHeight: 1.4 }}>
                          {p.details}
                        </div>
                      ) : null}
                    </td>
                    <td className="muted">{WORK_CODE_LABELS[p.code]}</td>
                    <td>{p.unit === 'UNIT' ? 'each' : UNIT_LABELS[p.unit].toLowerCase()}</td>
                    <td>
                      <StandardCell product={p} />
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <RateCell product={p} />
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <button type="button" onClick={() => setEditing(editing === p.id ? null : p.id)} className="btn ghost sm">
                        {editing === p.id ? 'Close' : 'Edit'}
                      </button>
                    </td>
                  </tr>
                  {editing === p.id ? (
                    <tr className="pedit">
                      <td colSpan={6}>
                        <ProductEditor product={p} onClose={() => setEditing(null)} />
                      </td>
                    </tr>
                  ) : null}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}

const ALL = '\u0000all';
