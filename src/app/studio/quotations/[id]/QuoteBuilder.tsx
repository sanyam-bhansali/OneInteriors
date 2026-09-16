'use client';

import { useActionState, useState, useTransition } from 'react';
import { formatINR, paiseToRupees } from '@/lib/money';
import {
  UNIT_LABELS,
  formatQty,
  isUnpriced,
  QTY_SCALE,
  type QuoteUnitName,
} from '@/modules/studio-quote/pricing';
import type { QuoteRow, QuoteLineRow } from '@/modules/studio-quote/quotes';
import type { ProductRow } from '@/modules/studio-quote/store';
import { addLineAction, editLineAction, removeLineAction, IDLE } from '../actions';

const input =
  'rounded-[7px] border border-[var(--s-rule)] bg-[var(--s-surface)] px-2.5 py-1.5 text-[13.5px] text-[var(--s-ink)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--s-accent)]';
const quiet =
  'rounded-[7px] border border-[var(--s-rule)] px-2.5 py-1.5 text-[12.5px] font-medium hover:border-[var(--s-ink-3)] disabled:opacity-40';

/**
 * One line, edited where it sits.
 *
 * Every field on the row saves together, because a carpentry line is measured
 * as a set — you take the width, the height and the rate off the drawing in one
 * go — and asking for four separate saves per line across forty lines is how a
 * studio decides Excel was fine.
 *
 * The "agreed" field is the important one. It overrides the arithmetic
 * entirely, and clearing it hands the line back to rate × quantity. That is not
 * a loophole: the rate card proposes and the studio decides, and a designer
 * rounding ₹60,184.25 to ₹60,000 in front of a client is the normal case.
 */
function LineRow({ line, quoteId }: { line: QuoteLineRow; quoteId: string }) {
  const [state, action, pending] = useActionState(editLineAction, IDLE);
  const [removing, startRemove] = useTransition();
  const area = line.unit === 'AREA';

  return (
    <li className="border-b border-[var(--s-rule-soft)] px-4 py-3 last:border-b-0">
      <form action={action} className="flex flex-wrap items-end gap-x-3 gap-y-2">
        <input type="hidden" name="lineId" value={line.id} />
        <input type="hidden" name="quoteId" value={quoteId} />

        <div className="min-w-[13rem] flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[14px] font-medium">{line.product}</span>
            {isUnpriced(line) ? (
              <span className="s-tag !bg-[var(--s-warn-wash)] !text-[var(--s-warn)]">
                Needs a figure
              </span>
            ) : null}
          </div>
          <span className="s-label">{UNIT_LABELS[line.unit as QuoteUnitName]}</span>
        </div>

        {area ? (
          <>
            <label className="flex flex-col gap-1">
              <span className="s-label">W mm</span>
              <input name="widthMm" inputMode="numeric" defaultValue={line.widthMm ?? ''} className={`${input} s-num w-[5rem] text-right`} />
            </label>
            <label className="flex flex-col gap-1">
              <span className="s-label">H mm</span>
              <input name="heightMm" inputMode="numeric" defaultValue={line.heightMm ?? ''} className={`${input} s-num w-[5rem] text-right`} />
            </label>
            <div className="flex flex-col gap-1">
              <span className="s-label">Sq ft</span>
              <span className="s-num px-1 py-1.5 text-[13.5px] text-[var(--s-ink-2)]">
                {line.widthMm && line.heightMm
                  ? formatQty(Math.round(((line.widthMm * line.heightMm) / 92_903.04) * QTY_SCALE))
                  : '—'}
              </span>
            </div>
          </>
        ) : (
          <label className="flex flex-col gap-1">
            <span className="s-label">Qty</span>
            <input
              name="qty"
              inputMode="decimal"
              defaultValue={line.qtyMilli ? formatQty(line.qtyMilli) : ''}
              className={`${input} s-num w-[5.5rem] text-right`}
            />
          </label>
        )}

        <label className="flex flex-col gap-1">
          <span className="s-label">Rate ₹</span>
          <input
            name="rate"
            inputMode="decimal"
            defaultValue={line.ratePaise > 0 ? String(paiseToRupees(line.ratePaise)) : ''}
            className={`${input} s-num w-[6rem] text-right`}
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="s-label">Agreed ₹</span>
          <input
            name="agreed"
            inputMode="decimal"
            placeholder={line.amountPaise > 0 ? String(paiseToRupees(line.amountPaise)) : '—'}
            className={`${input} s-num w-[6.5rem] text-right`}
          />
        </label>

        <div className="flex flex-col gap-1">
          <span className="s-label">Amount</span>
          <span className="s-num px-1 py-1.5 text-[14px] font-semibold">
            {line.amountPaise > 0 ? formatINR(line.amountPaise) : '—'}
          </span>
        </div>

        <button type="submit" disabled={pending} className={quiet}>
          {pending ? '…' : 'Save'}
        </button>
        <button
          type="button"
          disabled={removing}
          onClick={() => startRemove(async () => void (await removeLineAction(line.id, quoteId)))}
          className={`${quiet} !border-transparent !text-[var(--s-ink-3)] hover:!text-[var(--s-bad)]`}
        >
          Remove
        </button>

        {'ok' in state && !state.ok ? (
          <span role="alert" className="w-full text-[12.5px] text-[var(--s-bad)]">
            {state.error}
          </span>
        ) : null}
      </form>
    </li>
  );
}

/**
 * The picker.
 *
 * Only products with a rate appear. A product with no rate would add a line
 * that reads ₹0 on a document going to a client, and the product master page
 * is where that gets fixed rather than here.
 */
function AddLine({
  quoteId,
  room,
  products,
}: {
  quoteId: string;
  room: string;
  products: ProductRow[];
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const usable = products.filter((p) => p.ratePaise > 0 && p.isActive);
  if (usable.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-2 border-t border-[var(--s-rule-soft)] bg-[var(--s-surface-2)] px-4 py-2.5">
      <select
        aria-label={`Add a product to ${room}`}
        defaultValue=""
        disabled={pending}
        onChange={(e) => {
          const productId = e.target.value;
          if (!productId) return;
          e.target.value = '';
          start(async () => {
            const result = await addLineAction(quoteId, room, productId);
            setError(result && 'ok' in result && !result.ok ? result.error : null);
          });
        }}
        className={`${input} max-w-[22rem]`}
      >
        <option value="">+ Add to {room}…</option>
        {usable.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name} — ₹{paiseToRupees(p.ratePaise)}
          </option>
        ))}
      </select>
      {error ? <span className="text-[12.5px] text-[var(--s-bad)]">{error}</span> : null}
    </div>
  );
}

export function QuoteBuilder({
  quote,
  products,
  rooms,
}: {
  quote: QuoteRow;
  products: ProductRow[];
  rooms: string[];
}) {
  const byRoom = rooms.map((room) => ({
    room,
    lines: quote.lines.filter((l) => l.room === room),
    products: products.filter((p) => p.rooms.includes(room)),
  }));

  return (
    <div className="flex flex-col gap-4">
      {byRoom.map((group) => (
        <section key={group.room} className="s-card overflow-hidden">
          <div className="flex items-baseline justify-between gap-4 bg-[var(--s-surface-2)] px-4 py-2.5">
            <h2 className="m-0 text-[14.5px] font-semibold">{group.room}</h2>
            {group.lines.length > 0 ? (
              <span className="s-num s-label">
                {formatINR(group.lines.reduce((a, l) => a + l.amountPaise, 0))}
              </span>
            ) : null}
          </div>

          {group.lines.length > 0 ? (
            <ul className="m-0 flex list-none flex-col p-0">
              {group.lines.map((line) => (
                <LineRow key={line.id} line={line} quoteId={quote.id} />
              ))}
            </ul>
          ) : (
            <p className="m-0 px-4 py-3 text-[13.5px] italic text-[var(--s-ink-3)]">
              Nothing in this room yet.
            </p>
          )}

          <AddLine quoteId={quote.id} room={group.room} products={group.products} />
        </section>
      ))}
    </div>
  );
}
