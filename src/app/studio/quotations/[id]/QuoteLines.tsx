'use client';

import { useMemo, useRef, useState, useTransition } from 'react';
import { ChevronDown, ChevronUp, Copy, X } from 'lucide-react';
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
import { applyConfigAction, clearLinesAction, type BuildState } from '../actions';
import { Combobox } from './Combobox';

const field =
  'rounded-[7px] border border-[var(--s-rule)] bg-[var(--s-surface)] px-2.5 py-1.5 text-[13.5px] text-[var(--s-ink)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--s-accent)]';
const quiet =
  'rounded-[7px] border border-[var(--s-rule)] px-2.5 py-1.5 text-[12.5px] font-medium hover:border-[var(--s-ink-3)] disabled:opacity-40';

/**
 * A control inside a table cell.
 *
 * Transparent until it is touched. Forty bordered boxes in a grid is a form
 * that happens to have rows; a quotation should read as a document you can
 * edit, with the border appearing where the cursor is.
 */
const cell =
  'w-full rounded-[5px] border border-transparent bg-transparent px-1.5 py-1 text-[13px] text-[var(--s-ink)] placeholder:text-[var(--s-ink-3)] hover:border-[var(--s-rule)] focus:border-[var(--s-accent)] focus:bg-[var(--s-surface)] focus-visible:outline-none';

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
/**
 * A room, as a table.
 *
 * ## Why a table and not a stack of cards
 *
 * Because a quotation IS a table, and the studio reading it has been reading
 * tables for years. Cards put every line's labels beside every line's values,
 * so forty lines is forty repetitions of "W mm" and "Rate" — and nothing lines
 * up, which is the one thing a column of money has to do. A header row says it
 * once and the figures sit under each other where they can be compared and
 * added up by eye.
 *
 * This is the layout the hosted builder uses, and the reason it uses it.
 *
 * ## The columns, and one that is not here
 *
 * Hauspire's table carries a `Discounted` column beside `Amount`, because it
 * applies the modular discount line by line. Ours applies it once, to the
 * modular half of the total, which is what `computeTotals` does and what the
 * document prints — so a per-line discount column here would be a number with
 * nothing behind it.
 *
 * What occupies that space instead is the same shape for a different fact:
 * when a studio has overridden a line, the calculated figure shows struck
 * through beside the agreed one. Same glance, same meaning — "this is not
 * what the arithmetic said" — without inventing a discount we do not apply.
 */
export function RoomSection({
  room,
  lines,
  onUpdate,
  onRemove,
  onDuplicate,
  onMove,
  onAddTo,
}: {
  room: string;
  lines: PricedLine[];
  onUpdate: (key: string, patch: Partial<EditableLine>) => void;
  onRemove: (key: string) => void;
  onDuplicate: (key: string) => void;
  onMove: (key: string, by: -1 | 1) => void;
  /** Focuses the rail's add control with this room already chosen. */
  onAddTo?: (room: string) => void;
}) {
  const total = lines.reduce((a, l) => a + l.amountPaise, 0);

  return (
    <section className="s-card overflow-hidden">
      <div className="flex items-baseline justify-between gap-4 bg-[var(--s-accent)] px-4 py-2">
        <h2 className="m-0 text-[13.5px] font-semibold uppercase tracking-[0.06em] text-white">
          {room}
        </h2>
        <span className="s-num text-[12.5px] text-white/70">
          {lines.length} {lines.length === 1 ? 'line' : 'lines'}
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[54rem] border-collapse text-[13px]">
          <thead>
            <tr className="border-b border-[var(--s-rule)] bg-[var(--s-surface-2)] text-left">
              <Th className="w-[3.5rem] text-center">#</Th>
              <Th className="min-w-[11rem]">Product</Th>
              <Th className="w-[6.5rem]">Work</Th>
              <Th className="min-w-[9rem]">Details</Th>
              <Th className="w-[6rem] text-right">Qty</Th>
              <Th className="w-[5.5rem] text-right">W</Th>
              <Th className="w-[5.5rem] text-right">H</Th>
              <Th className="w-[6.5rem] text-right">Rate</Th>
              <Th className="w-[8rem] text-right">Amount</Th>
              <Th className="w-[5.5rem]" />
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
              />
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t border-[var(--s-rule)] bg-[var(--s-surface-2)]">
              <td colSpan={8} className="px-3 py-2">
                <span className="text-[13px] font-medium">{room} — sub-total</span>
                {onAddTo ? (
                  <button
                    type="button"
                    onClick={() => onAddTo(room)}
                    className="ml-3 rounded-[6px] border border-[var(--s-rule)] bg-[var(--s-surface)] px-2 py-0.5 text-[12px] font-medium hover:border-[var(--s-ink-3)]"
                  >
                    + add item
                  </button>
                ) : null}
              </td>
              <td className="s-num px-3 py-2 text-right text-[13.5px] font-semibold">
                {formatINR(total)}
              </td>
              <td />
            </tr>
          </tfoot>
        </table>
      </div>
    </section>
  );
}

function Th({ children, className = '' }: { children?: React.ReactNode; className?: string }) {
  return (
    <th
      scope="col"
      className={`px-3 py-2 font-[family-name:var(--font-mono)] text-[10px] font-medium uppercase tracking-[0.11em] text-[var(--s-ink-3)] ${className}`}
    >
      {children}
    </th>
  );
}

/**
 * One line, edited where it sits.
 *
 * Every field writes straight to the parent's state, so the sq ft beside a
 * width, the amount at the end of the row and the total in the rail all move
 * on the same keystroke. That is the point of the whole rewrite: a designer
 * widening a wardrobe to see what it costs should not have to press anything
 * to find out.
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
}: {
  n: number;
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
    const t = raw.trim();
    if (t === '') return null;
    const v = Number(t);
    return Number.isFinite(v) && v > 0 ? Math.round(v) : null;
  };

  /* The arithmetic this line WOULD have come to. Shown struck through beside
     an agreed figure, so an override is visible rather than silent. */
  const calculated = lineAmount({
    unit: line.unit,
    code: line.code,
    ratePaise: line.ratePaise,
    widthMm: line.widthMm,
    heightMm: line.heightMm,
    qtyMilli: line.qtyMilli,
  });

  return (
    <tr className="border-b border-[var(--s-rule-soft)] align-top last:border-b-0">
      <td className="px-2 py-2">
        <div className="flex items-center gap-0.5">
          <span className="s-num w-4 text-right text-[12px] text-[var(--s-ink-3)]">{n}</span>
          <div className="flex flex-col">
            <Icon label={`Move ${line.product} up`} disabled={first} onClick={() => onMove(line.key, -1)}>
              <ChevronUp size={12} strokeWidth={2.5} absoluteStrokeWidth />
            </Icon>
            <Icon label={`Move ${line.product} down`} disabled={last} onClick={() => onMove(line.key, 1)}>
              <ChevronDown size={12} strokeWidth={2.5} absoluteStrokeWidth />
            </Icon>
          </div>
        </div>
      </td>

      <td className="px-3 py-2">
        <input
          value={line.product}
          onChange={(e) => onUpdate(line.key, { product: e.target.value })}
          aria-label="Product name"
          className={`${cell} font-medium`}
        />
        {overridden ? (
          <span className="s-tag mt-1" title="This figure was agreed, not calculated">
            agreed
          </span>
        ) : null}
      </td>

      <td className="px-3 py-2">
        <select
          value={line.code}
          onChange={(e) => onUpdate(line.key, { code: e.target.value as WorkCodeName })}
          aria-label="Modular or on-site"
          className={cell}
        >
          <option value="MODULAR">Modular</option>
          <option value="ONSITE">On-site</option>
        </select>
      </td>

      <td className="px-3 py-2">
        <textarea
          value={line.details ?? ''}
          onChange={(e) => onUpdate(line.key, { details: e.target.value })}
          rows={2}
          aria-label="What this line includes"
          placeholder="18mm BWP carcass · laminate · soft-close"
          className={`${cell} resize-y text-[12px] leading-snug`}
        />
      </td>

      <td className="px-3 py-2 text-right">
        {area ? (
          <span className="s-num text-[12.5px] text-[var(--s-ink-3)]">
            {line.widthMm && line.heightMm
              ? `${formatQty(areaMilli(line.widthMm, line.heightMm))} ft²`
              : '—'}
          </span>
        ) : (
          <Num
            value={line.qtyMilli != null ? line.qtyMilli / QTY_SCALE : null}
            onChange={(v) => {
              const num = Number(v.trim());
              onUpdate(line.key, {
                qtyMilli:
                  v.trim() === '' || !Number.isFinite(num) ? null : Math.round(num * QTY_SCALE),
              });
            }}
          />
        )}
      </td>

      <td className="px-3 py-2 text-right">
        {area ? (
          <Num value={line.widthMm} onChange={(v) => onUpdate(line.key, { widthMm: whole(v) })} />
        ) : (
          <span className="text-[var(--s-ink-3)]">—</span>
        )}
      </td>

      <td className="px-3 py-2 text-right">
        {area ? (
          <Num value={line.heightMm} onChange={(v) => onUpdate(line.key, { heightMm: whole(v) })} />
        ) : (
          <span className="text-[var(--s-ink-3)]">—</span>
        )}
      </td>

      <td className="px-3 py-2 text-right">
        <Num
          value={line.ratePaise > 0 ? paiseToRupees(line.ratePaise) : null}
          onChange={(v) => {
            const num = Number(v.trim());
            onUpdate(line.key, {
              ratePaise: v.trim() === '' || !Number.isFinite(num) || num < 0 ? 0 : rupeesToPaise(num),
            });
          }}
        />
      </td>

      <td className="px-3 py-2 text-right">
        {/* The agreed figure is the editable one, because it is the one that
            prints. Empty hands the line back to rate × quantity. */}
        <Num
          value={line.agreedPaise != null ? paiseToRupees(line.agreedPaise) : null}
          placeholder={calculated > 0 ? String(paiseToRupees(calculated)) : '—'}
          bold
          onChange={(v) => {
            const num = Number(v.trim());
            onUpdate(line.key, {
              agreedPaise:
                v.trim() === '' || !Number.isFinite(num) || num < 0 ? null : rupeesToPaise(num),
            });
          }}
        />
        {overridden && calculated > 0 && calculated !== line.agreedPaise ? (
          <span className="s-num mt-0.5 block text-[11px] text-[var(--s-ink-3)] line-through">
            {formatINR(calculated)}
          </span>
        ) : null}
      </td>

      <td className="px-2 py-2">
        <div className="flex items-center justify-end gap-0.5">
          <Icon label={`Duplicate ${line.product}`} onClick={() => onDuplicate(line.key)}>
            <Copy size={13} strokeWidth={2} absoluteStrokeWidth />
          </Icon>
          <Icon label={`Remove ${line.product}`} danger onClick={() => onRemove(line.key)}>
            <X size={14} strokeWidth={2.5} absoluteStrokeWidth />
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
 * what a rebuild looks like.
 */
function Num({
  value,
  placeholder,
  bold,
  onChange,
}: {
  value: number | null;
  placeholder?: string;
  bold?: boolean;
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
      onChange={(e) => {
        setText(e.target.value);
        onChange(e.target.value);
      }}
      className={`${cell} s-num text-right ${bold ? 'font-semibold' : ''}`}
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
  quoteConfig,
  baths,
  onAdd,
}: {
  rooms: string[];
  products: ProductRow[];
  /** `Studio.config` — "3 BHK" or whatever was set. Drives the room suggestions. */
  quoteConfig: string | null;
  baths: number | null;
  onAdd: (room: string, product: ProductRow, size: AddSize) => void;
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

  const [room, setRoom] = useState(rooms[0] ?? '');
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
    <section className="s-card p-4">
      <h2 className="s-label m-0 mb-3">Add a line</h2>

      <div className="flex flex-col gap-3">
        <Combobox
          label="Room"
          value={room}
          options={roomOptions}
          placeholder="Kitchen"
          onChange={setRoom}
          allowCustom
          customHint={(t) => `Add “${t}” as a new room`}
        />

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

        {product === null ? null : (
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
                  setProductId(null);
                  setWidth('');
                  setHeight('');
                  setQty('');
                }}
                className="flex-1 rounded-[8px] bg-[var(--s-accent)] px-4 py-2.5 text-[13.5px] font-medium text-white hover:bg-[var(--s-accent-deep)] disabled:opacity-40"
              >
                + Add to {targetRoom || 'the quotation'}
              </button>
              <button type="button" onClick={() => setProductId(null)} className={quiet}>
                Clear
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
