'use client';

import { useActionState, useState } from 'react';
import { paiseToRupees } from '@/lib/money';
import { ROOM_CATEGORIES } from '@/modules/studio-quote/starter-catalogue';
import { UNIT_LABELS, WORK_CODE_LABELS, type QuoteUnitName, type WorkCodeName } from '@/modules/studio-quote/pricing';
import type { ProductRow } from '@/modules/studio-quote/store';
import { saveRateAction, addProductAction, IDLE } from './actions';

const input =
  'rounded-[8px] border border-[var(--s-rule)] bg-[var(--s-surface)] px-3 py-2 text-[14px] text-[var(--s-ink)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--s-accent)]';
const primary =
  'rounded-[8px] bg-[var(--s-accent)] px-4 py-2 text-[14px] font-medium text-white hover:bg-[var(--s-accent-deep)] disabled:opacity-40';
const quiet =
  'rounded-[8px] border border-[var(--s-rule)] px-3.5 py-2 text-[14px] font-medium hover:border-[var(--s-ink-3)] disabled:opacity-40';

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
    <form action={action} className="flex items-center gap-2">
      <input type="hidden" name="id" value={product.id} />
      <span className="text-[13px] text-[var(--s-ink-3)]">₹</span>
      <input
        name="rate"
        inputMode="decimal"
        defaultValue={product.ratePaise > 0 ? String(paiseToRupees(product.ratePaise)) : ''}
        placeholder="—"
        aria-label={`Rate for ${product.name}`}
        className={`${input} s-num w-[6.5rem] text-right`}
      />
      <span className="w-[4.5rem] text-[12.5px] text-[var(--s-ink-3)]">
        {product.unit === 'UNIT' ? 'each' : `/ ${UNIT_LABELS[product.unit].toLowerCase()}`}
      </span>
      <button type="submit" disabled={pending} className={`${quiet} !px-2.5 !py-1.5 !text-[12.5px]`}>
        {pending ? '…' : 'Save'}
      </button>
      {'ok' in state && state.ok ? (
        <span className="text-[12.5px] text-[var(--s-good)]">Saved</span>
      ) : null}
      {'ok' in state && !state.ok ? (
        <span className="text-[12.5px] text-[var(--s-bad)]">{state.error}</span>
      ) : null}
    </form>
  );
}

export function ProductTable({ products }: { products: ProductRow[] }) {
  const [adding, setAdding] = useState(false);
  const [addState, addAction, addPending] = useActionState(addProductAction, IDLE);

  const grouped = ROOM_CATEGORIES.map((room) => ({
    room,
    items: products.filter((p) => p.rooms.includes(room)),
  })).filter((g) => g.items.length > 0);

  // A product a studio added with no room lands nowhere above, and a row that
  // exists but is invisible is worse than no row.
  const loose = products.filter((p) => !ROOM_CATEGORIES.some((r) => p.rooms.includes(r)));
  if (loose.length > 0) grouped.push({ room: 'Everything else' as never, items: loose });

  return (
    <div className="flex flex-col gap-6">
      {adding ? (
        <form action={addAction} className="s-card flex flex-col gap-4 p-5">
          <p className="m-0 text-[15px] font-semibold">Add a product</p>

          <div className="flex flex-wrap gap-4">
            <label className="flex flex-col gap-1.5">
              <span className="s-label">Name</span>
              <input name="name" required placeholder="Sliding wardrobe" className={`${input} w-[18rem]`} />
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="s-label">Measured by</span>
              <select name="unit" defaultValue="AREA" className={input}>
                {(Object.keys(UNIT_LABELS) as QuoteUnitName[]).map((u) => (
                  <option key={u} value={u}>{UNIT_LABELS[u]}</option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="s-label">Work</span>
              <select name="code" defaultValue="MODULAR" className={input}>
                {(Object.keys(WORK_CODE_LABELS) as WorkCodeName[]).map((c) => (
                  <option key={c} value={c}>{WORK_CODE_LABELS[c]}</option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="s-label">Rate (₹)</span>
              <input name="rate" inputMode="decimal" placeholder="0" className={`${input} s-num w-[7rem] text-right`} />
            </label>
          </div>

          <fieldset className="m-0 border-0 p-0">
            <legend className="s-label mb-2 p-0">Rooms it belongs in</legend>
            <div className="flex flex-wrap gap-2">
              {ROOM_CATEGORIES.map((r) => (
                <label
                  key={r}
                  className="cursor-pointer rounded-full border border-[var(--s-rule)] px-3 py-1.5 text-[13px] text-[var(--s-ink-2)] has-[:checked]:border-[var(--s-accent)] has-[:checked]:bg-[var(--s-accent-wash)] has-[:checked]:text-[var(--s-ink)]"
                >
                  <input type="checkbox" name="rooms" value={r} className="sr-only" />
                  {r}
                </label>
              ))}
            </div>
          </fieldset>

          <label className="flex flex-col gap-1.5">
            <span className="s-label">What it includes — optional</span>
            <input name="details" placeholder="Carcass, shutters, hardware and installation." className={input} />
          </label>

          <div className="flex items-center gap-3">
            <button type="submit" disabled={addPending} className={primary}>
              {addPending ? 'Adding…' : 'Add product'}
            </button>
            <button type="button" onClick={() => setAdding(false)} className={quiet}>
              Cancel
            </button>
            {'ok' in addState && !addState.ok ? (
              <span className="text-[13px] text-[var(--s-bad)]">{addState.error}</span>
            ) : null}
          </div>
        </form>
      ) : (
        <div>
          <button type="button" onClick={() => setAdding(true)} className={quiet}>
            + Add a product
          </button>
        </div>
      )}

      {grouped.map((group) => (
        <section key={group.room} className="s-card overflow-hidden">
          <div className="flex items-baseline justify-between gap-4 border-b border-[var(--s-rule)] bg-[var(--s-surface-2)] px-5 py-3">
            <h2 className="m-0 text-[15px] font-semibold">{group.room}</h2>
            <span className="s-label">
              {group.items.filter((p) => p.ratePaise > 0).length} of {group.items.length} priced
            </span>
          </div>

          <ul className="m-0 flex list-none flex-col p-0">
            {group.items.map((p) => (
              <li
                key={p.id}
                className="flex flex-wrap items-center gap-x-5 gap-y-2 border-b border-[var(--s-rule-soft)] px-5 py-3 last:border-b-0"
              >
                <div className="min-w-[14rem] flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[14.5px] font-medium">{p.name}</span>
                    <span className="s-tag">{WORK_CODE_LABELS[p.code]}</span>
                    {p.ratePaise === 0 ? (
                      <span className="s-tag !bg-[var(--s-warn-wash)] !text-[var(--s-warn)]">
                        No rate
                      </span>
                    ) : null}
                  </div>
                  {p.details ? (
                    <p className="m-0 mt-0.5 max-w-[60ch] text-[13px] leading-snug text-[var(--s-ink-3)]">
                      {p.details}
                    </p>
                  ) : null}
                </div>

                <RateCell product={p} />
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
