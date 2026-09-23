'use client';

import { useMemo, useRef, useState, useTransition } from 'react';
import { formatINR, paiseToRupees, rupeesToPaise } from '@/lib/money';
import {
  UNIT_LABELS,
  areaMilli,
  formatQty,
  QTY_SCALE,
  type QuoteUnitName,
  type WorkCodeName,
} from '@/modules/studio-quote/pricing';
import {
  CONFIGS,
  isConfigName,
  standardRunFor,
  type ConfigName,
} from '@/modules/studio-quote/configure';
import type { QuoteRow } from '@/modules/studio-quote/quotes';
import type { ProductRow } from '@/modules/studio-quote/store';
import { applyConfigAction, clearLinesAction, type BuildState } from '../actions';

const field =
  'rounded-[7px] border border-[var(--s-rule)] bg-[var(--s-surface)] px-2.5 py-1.5 text-[13.5px] text-[var(--s-ink)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--s-accent)]';
const quiet =
  'rounded-[7px] border border-[var(--s-rule)] px-2.5 py-1.5 text-[12.5px] font-medium hover:border-[var(--s-ink-3)] disabled:opacity-40';

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
export function ConfigurePanel({ quote, hasLines }: { quote: QuoteRow; hasLines: boolean }) {
  const [config, setConfig] = useState<ConfigName>(
    isConfigName(quote.config) ? quote.config : '2 BHK',
  );
  const [kitchenRun, setKitchenRun] = useState(
    quote.kitchenRunMm != null ? String(quote.kitchenRunMm) : '',
  );
  const [bathrooms, setBathrooms] = useState(String(quote.bathrooms ?? 2));
  const [study, setStudy] = useState(false);
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
        }),
      );
    });
  }

  return (
    <section className="s-card p-4">
      <h2 className="s-label m-0 mb-3">The flat</h2>

      <div className="flex flex-col gap-3">
        <label className="flex flex-col gap-1">
          <span className="s-label">Configuration</span>
          <select
            value={config}
            onChange={(e) => setConfig(e.target.value as ConfigName)}
            className={field}
          >
            {CONFIGS.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>

        <div className="flex gap-3">
          <label className="flex min-w-0 flex-1 flex-col gap-1">
            <span className="s-label">Kitchen run mm</span>
            <input
              value={kitchenRun}
              onChange={(e) => setKitchenRun(e.target.value)}
              inputMode="numeric"
              placeholder={String(standardRunFor(config))}
              className={`${field} s-num w-full text-right`}
            />
          </label>

          <label className="flex w-[5.5rem] flex-none flex-col gap-1">
            <span className="s-label">Baths</span>
            <input
              value={bathrooms}
              onChange={(e) => setBathrooms(e.target.value)}
              inputMode="numeric"
              className={`${field} s-num w-full text-right`}
            />
          </label>
        </div>

        <label className="flex items-center gap-2 text-[13.5px]">
          <input
            type="checkbox"
            checked={study}
            onChange={(e) => setStudy(e.target.checked)}
            className="h-[16px] w-[16px] accent-[var(--s-accent)]"
          />
          Study or office
        </label>

        <button
          type="button"
          onClick={build}
          disabled={pending}
          className={`w-full rounded-[8px] px-4 py-2.5 text-[13.5px] font-medium text-white disabled:opacity-40 ${
            confirming ? 'bg-[var(--s-bad)]' : 'bg-[var(--s-accent)] hover:bg-[var(--s-accent-deep)]'
          }`}
        >
          {pending
            ? 'Building…'
            : confirming
              ? 'Replace every line — press again'
              : hasLines
                ? `Rebuild as ${config}`
                : `Build the ${config}`}
        </button>

        <div className="flex flex-wrap items-center gap-3">
          {confirming ? (
            <button type="button" onClick={() => setConfirming(false)} className={quiet}>
              Keep what is there
            </button>
          ) : null}
          <StartBlank quoteId={quote.id} hasLines={hasLines} />
        </div>
      </div>

      <p className="m-0 mt-3 text-[12px] leading-relaxed text-[var(--s-ink-3)]">
        The kitchen run sets the width of the base, wall and loft lines — one measurement instead
        of three. Leave it blank and a {config} is assumed at {standardRunFor(config)}mm.
      </p>

      {result && result.ok ? (
        <div className="mt-3 rounded-[10px] bg-[var(--s-good-wash,#e5eee1)] px-3.5 py-2.5">
          <p className="m-0 text-[13px] font-medium">
            {result.added} {result.added === 1 ? 'line' : 'lines'} on the quotation.
          </p>
          {result.notes.map((note) => (
            <p key={note} className="m-0 mt-1 text-[12px] leading-relaxed text-[var(--s-ink-2)]">
              {note}
            </p>
          ))}
        </div>
      ) : null}

      {result && !result.ok ? (
        <p role="alert" className="m-0 mt-3 text-[13px] text-[var(--s-bad)]">
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
      className={`${quiet} ${confirming ? '!border-[var(--s-bad)] !text-[var(--s-bad)]' : '!border-transparent !text-[var(--s-ink-3)]'}`}
    >
      {pending ? '…' : confirming ? 'Delete every line — press again' : 'Start blank'}
    </button>
  );
}

/**
 * A room, its lines, and a way to add another.
 *
 * Rooms are derived from the lines rather than stored. A room with nothing in
 * it is not a thing a quotation has — it is a heading a client would read as
 * work that came to nothing — so removing the last line removes the room, and
 * that is the behaviour rather than a bug in it.
 */
export function RoomSection({
  room,
  lines,
  onUpdate,
  onRemove,
  onDuplicate,
  onMove,
}: {
  room: string;
  lines: PricedLine[];
  onUpdate: (key: string, patch: Partial<EditableLine>) => void;
  onRemove: (key: string) => void;
  onDuplicate: (key: string) => void;
  onMove: (key: string, by: -1 | 1) => void;
}) {
  const total = lines.reduce((a, l) => a + l.amountPaise, 0);

  return (
    <section className="s-card overflow-hidden">
      <div className="flex items-baseline justify-between gap-4 bg-[var(--s-surface-2)] px-4 py-2.5">
        <h2 className="m-0 text-[14.5px] font-semibold">{room}</h2>
        <span className="s-num s-label">{formatINR(total)}</span>
      </div>

      <ul className="m-0 flex list-none flex-col p-0">
        {lines.map((line, i) => (
          <LineRow
            key={line.key}
            line={line}
            first={i === 0}
            last={i === lines.length - 1}
            onUpdate={onUpdate}
            onRemove={onRemove}
            onDuplicate={onDuplicate}
            onMove={onMove}
          />
        ))}
      </ul>
    </section>
  );
}

/**
 * One line, edited in place.
 *
 * Every field writes straight to the parent's state, so the sq ft beside a
 * width, the amount at the end of the row and the total in the sidebar all
 * move on the same keystroke. That is the whole point of the rewrite: a
 * designer widening a wardrobe to see what it costs should not have to press
 * anything to find out.
 *
 * The inputs are uncontrolled-by-value on purpose — they hold text, not
 * numbers. A controlled numeric input cannot hold "18" on the way to "1800"
 * without fighting the person typing it, and cannot hold an empty string at
 * all.
 */
function LineRow({
  line,
  first,
  last,
  onUpdate,
  onRemove,
  onDuplicate,
  onMove,
}: {
  line: PricedLine;
  first: boolean;
  last: boolean;
  onUpdate: (key: string, patch: Partial<EditableLine>) => void;
  onRemove: (key: string) => void;
  onDuplicate: (key: string) => void;
  onMove: (key: string, by: -1 | 1) => void;
}) {
  const area = line.unit === 'AREA';
  const overridden = line.agreedPaise != null;

  const whole = (raw: string): number | null => {
    const trimmed = raw.trim();
    if (trimmed === '') return null;
    const n = Number(trimmed);
    return Number.isFinite(n) && n > 0 ? Math.round(n) : null;
  };

  return (
    <li className="border-b border-[var(--s-rule-soft)] px-4 py-3 last:border-b-0">
      <div className="flex flex-wrap items-end gap-x-3 gap-y-2">
        <div className="min-w-[12rem] flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[14px] font-medium">{line.product}</span>
            {overridden ? (
              <span className="s-tag" title="This figure was agreed, not calculated">
                agreed
              </span>
            ) : null}
          </div>
          <span className="s-label">
            {UNIT_LABELS[line.unit]} · {line.code === 'MODULAR' ? 'Modular' : 'On-site'}
          </span>
        </div>

        {area ? (
          <>
            <Num
              label="W mm"
              value={line.widthMm}
              width="5rem"
              onChange={(v) => onUpdate(line.key, { widthMm: whole(v) })}
            />
            <Num
              label="H mm"
              value={line.heightMm}
              width="5rem"
              onChange={(v) => onUpdate(line.key, { heightMm: whole(v) })}
            />
            <div className="flex flex-col gap-1">
              <span className="s-label">Sq ft</span>
              <span className="s-num px-1 py-1.5 text-[13.5px] text-[var(--s-ink-2)]">
                {line.widthMm && line.heightMm
                  ? formatQty(areaMilli(line.widthMm, line.heightMm))
                  : '—'}
              </span>
            </div>
          </>
        ) : (
          <Num
            label="Qty"
            value={line.qtyMilli != null ? line.qtyMilli / QTY_SCALE : null}
            width="5.5rem"
            onChange={(v) => {
              const n = Number(v.trim());
              onUpdate(line.key, {
                qtyMilli: v.trim() === '' || !Number.isFinite(n) ? null : Math.round(n * QTY_SCALE),
              });
            }}
          />
        )}

        <Num
          label="Rate ₹"
          value={line.ratePaise > 0 ? paiseToRupees(line.ratePaise) : null}
          width="6rem"
          onChange={(v) => {
            const n = Number(v.trim());
            onUpdate(line.key, {
              ratePaise: v.trim() === '' || !Number.isFinite(n) || n < 0 ? 0 : rupeesToPaise(n),
            });
          }}
        />

        <Num
          label="Agreed ₹"
          value={line.agreedPaise != null ? paiseToRupees(line.agreedPaise) : null}
          width="6.5rem"
          placeholder="—"
          onChange={(v) => {
            const n = Number(v.trim());
            /* Empty CLEARS the override rather than setting zero. They are
               different answers, and conflating them zeroes a line the moment
               somebody tabs through it. */
            onUpdate(line.key, {
              agreedPaise: v.trim() === '' || !Number.isFinite(n) || n < 0 ? null : rupeesToPaise(n),
            });
          }}
        />

        <div className="flex flex-col gap-1">
          <span className="s-label">Amount</span>
          <span className="s-num px-1 py-1.5 text-[14px] font-semibold">
            {line.amountPaise > 0 ? formatINR(line.amountPaise) : '—'}
          </span>
        </div>

        <div className="flex items-center gap-0.5">
          <Icon label={`Move ${line.product} up`} disabled={first} onClick={() => onMove(line.key, -1)}>
            ↑
          </Icon>
          <Icon label={`Move ${line.product} down`} disabled={last} onClick={() => onMove(line.key, 1)}>
            ↓
          </Icon>
          <Icon label={`Duplicate ${line.product}`} onClick={() => onDuplicate(line.key)}>
            ⧉
          </Icon>
          <Icon label={`Remove ${line.product}`} danger onClick={() => onRemove(line.key)}>
            ×
          </Icon>
        </div>
      </div>
    </li>
  );
}

function Num({
  label,
  value,
  width,
  placeholder,
  onChange,
}: {
  label: string;
  value: number | null;
  width: string;
  placeholder?: string;
  onChange: (raw: string) => void;
}) {
  /**
   * Text in the box, number in the state.
   *
   * The input holds whatever was typed and the parent holds what it parses
   * to. Feeding the parsed value back in would rewrite "18" to "18" on the
   * way to "1800" — harmless — and "" to "0" — not — while the caret jumps.
   * The initial text comes from the value once and is then the input's own.
   */
  const [text, setText] = useState(value != null ? String(value) : '');
  const known = useRef(value);

  /* Re-sync only when the value changed from OUTSIDE, which is what a rebuild
     or an undo looks like. A change we caused ourselves leaves the text alone. */
  if (known.current !== value) {
    known.current = value;
    const expected = Number(text.trim());
    const same = text.trim() === '' ? value == null : Number.isFinite(expected) && expected === value;
    if (!same) setText(value != null ? String(value) : '');
  }

  return (
    <label className="flex flex-col gap-1">
      <span className="s-label">{label}</span>
      <input
        value={text}
        inputMode="decimal"
        placeholder={placeholder}
        onChange={(e) => {
          setText(e.target.value);
          onChange(e.target.value);
        }}
        style={{ width }}
        className={`${field} s-num text-right`}
      />
    </label>
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
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={label}
      className={`grid h-7 w-7 place-items-center rounded-[6px] text-[14px] text-[var(--s-ink-3)] hover:bg-[var(--s-rail-active)] disabled:opacity-25 ${
        danger ? 'hover:!text-[var(--s-bad)]' : 'hover:text-[var(--s-ink)]'
      }`}
    >
      <span aria-hidden="true">{children}</span>
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
  onAdd,
}: {
  rooms: string[];
  products: ProductRow[];
  onAdd: (room: string, product: ProductRow, size: AddSize) => void;
}) {
  const active = useMemo(() => products.filter((p) => p.isActive), [products]);

  const [room, setRoom] = useState(rooms[0] ?? '');
  const [newRoom, setNewRoom] = useState('');
  const [query, setQuery] = useState('');
  const [productId, setProductId] = useState<string | null>(null);
  const [width, setWidth] = useState('');
  const [height, setHeight] = useState('');
  const [qty, setQty] = useState('');

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q === '') return active.slice(0, 10);
    return active.filter((p) => p.name.toLowerCase().includes(q)).slice(0, 10);
  }, [active, query]);

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

  const targetRoom = newRoom.trim() !== '' ? newRoom.trim() : room;
  const canAdd = product !== null && targetRoom.length > 0;

  if (active.length === 0) return null;

  return (
    <section className="s-card p-4">
      <h2 className="s-label m-0 mb-3">Add a line</h2>

      <div className="flex flex-col gap-3">
        <label className="flex flex-col gap-1">
          <span className="s-label">Room</span>
          {rooms.length > 0 ? (
            <select
              value={room}
              onChange={(e) => {
                setRoom(e.target.value);
                setNewRoom('');
              }}
              className={field}
            >
              {rooms.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          ) : null}
          <input
            value={newRoom}
            onChange={(e) => setNewRoom(e.target.value)}
            placeholder={rooms.length > 0 ? 'or a new room — terrace, passage…' : 'Kitchen'}
            className={`${field} mt-1`}
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="s-label">Product</span>
          <input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setProductId(null);
            }}
            placeholder="Type to search your products"
            className={field}
          />
        </label>

        {product === null ? (
          <ul className="m-0 flex max-h-[13rem] list-none flex-col gap-1 overflow-y-auto p-0">
            {matches.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => {
                    setProductId(p.id);
                    setQuery(p.name);
                    setWidth('');
                    setHeight('');
                    setQty('');
                  }}
                  className="flex w-full items-baseline justify-between gap-2 rounded-[7px] px-2.5 py-1.5 text-left text-[13px] hover:bg-[var(--s-surface-2)]"
                >
                  <span className="min-w-0 truncate">{p.name}</span>
                  <span
                    className={`s-num flex-none text-[12px] ${p.ratePaise > 0 ? 'text-[var(--s-ink-3)]' : 'text-[var(--s-warn)]'}`}
                  >
                    {p.ratePaise > 0 ? `₹${paiseToRupees(p.ratePaise)}` : 'no rate'}
                  </span>
                </button>
              </li>
            ))}
            {matches.length === 0 ? (
              <li className="px-2.5 py-1.5 text-[12.5px] text-[var(--s-ink-3)]">
                Nothing in your product list matches that.
              </li>
            ) : null}
          </ul>
        ) : (
          <>
            <p className="m-0 text-[12px] text-[var(--s-ink-3)]">
              <span className="s-num">{UNIT_LABELS[product.unit]}</span> ·{' '}
              {product.code === 'MODULAR' ? 'Modular' : 'On-site'} ·{' '}
              {product.ratePaise > 0 ? (
                <span className="s-num">₹{paiseToRupees(product.ratePaise)}</span>
              ) : (
                <span className="text-[var(--s-warn)]">no rate yet</span>
              )}
            </p>

            {product.unit === 'AREA' ? (
              <div className="flex gap-3">
                <label className="flex min-w-0 flex-1 flex-col gap-1">
                  <span className="s-label">W mm</span>
                  <input
                    value={width}
                    onChange={(e) => setWidth(e.target.value)}
                    inputMode="numeric"
                    placeholder={product.defaultWidthMm != null ? String(product.defaultWidthMm) : ''}
                    className={`${field} s-num w-full text-right`}
                  />
                </label>
                <label className="flex min-w-0 flex-1 flex-col gap-1">
                  <span className="s-label">H mm</span>
                  <input
                    value={height}
                    onChange={(e) => setHeight(e.target.value)}
                    inputMode="numeric"
                    placeholder={product.defaultHeightMm != null ? String(product.defaultHeightMm) : ''}
                    className={`${field} s-num w-full text-right`}
                  />
                </label>
              </div>
            ) : (
              <label className="flex flex-col gap-1">
                <span className="s-label">Quantity</span>
                <input
                  value={qty}
                  onChange={(e) => setQty(e.target.value)}
                  inputMode="decimal"
                  placeholder={product.defaultQty != null ? String(product.defaultQty) : '1'}
                  className={`${field} s-num w-full text-right`}
                />
              </label>
            )}

            {/* Before the press, not after. Pricing a job is a calculator. */}
            <p className="m-0 flex items-baseline justify-between gap-3 border-t border-[var(--s-rule-soft)] pt-2.5 text-[13px]">
              <span className="text-[var(--s-ink-2)]">Line amount</span>
              <span className="s-num text-[15px] font-semibold">
                {amount > 0 ? formatINR(amount) : '—'}
              </span>
            </p>

            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={!canAdd}
                onClick={() => {
                  onAdd(targetRoom, product, size);
                  setNewRoom('');
                  setQuery('');
                  setProductId(null);
                  setWidth('');
                  setHeight('');
                  setQty('');
                }}
                className="flex-1 rounded-[8px] bg-[var(--s-accent)] px-4 py-2.5 text-[13.5px] font-medium text-white hover:bg-[var(--s-accent-deep)] disabled:opacity-40"
              >
                + Add to {targetRoom || 'the quotation'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setProductId(null);
                  setQuery('');
                }}
                className={quiet}
              >
                Back
              </button>
            </div>
          </>
        )}
      </div>
    </section>
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
