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
import { CONFIGS, isConfigName, type ConfigName } from '@/modules/studio-quote/configure';
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
export function ConfigureBar({ quote, hasLines }: { quote: QuoteRow; hasLines: boolean }) {
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
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-3">
        <h2 className="m-0 text-[14.5px] font-semibold">Build it from the flat</h2>
        <span className="text-[12.5px] text-[var(--s-ink-3)]">
          Uses the products you have marked as standard
        </span>
      </div>

      <div className="flex flex-wrap items-end gap-3">
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

        <label className="flex flex-col gap-1">
          <span className="s-label">Kitchen run mm</span>
          <input
            value={kitchenRun}
            onChange={(e) => setKitchenRun(e.target.value)}
            inputMode="numeric"
            placeholder="3960"
            className={`${field} s-num w-[6.5rem] text-right`}
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="s-label">Bathrooms</span>
          <input
            value={bathrooms}
            onChange={(e) => setBathrooms(e.target.value)}
            inputMode="numeric"
            className={`${field} s-num w-[4.5rem] text-right`}
          />
        </label>

        <label className="flex items-center gap-2 py-1.5 text-[13.5px]">
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
          className={`rounded-[8px] px-4 py-2 text-[13.5px] font-medium text-white disabled:opacity-40 ${
            confirming ? 'bg-[var(--s-bad)]' : 'bg-[var(--s-accent)] hover:bg-[var(--s-accent-deep)]'
          }`}
        >
          {pending
            ? 'Building…'
            : confirming
              ? `Replace all ${''}lines — press again`
              : hasLines
                ? 'Rebuild'
                : `Build the ${config}`}
        </button>

        {confirming ? (
          <button type="button" onClick={() => setConfirming(false)} className={quiet}>
            Keep what is there
          </button>
        ) : null}

        <StartBlank quoteId={quote.id} hasLines={hasLines} />
      </div>

      <p className="m-0 mt-3 max-w-[70ch] text-[12.5px] leading-relaxed text-[var(--s-ink-3)]">
        The kitchen run sets the width of the base, wall and loft lines — one measurement instead
        of three. Sizes are the ones that recur, not the ones that are right for this flat; every
        figure here is yours to correct.
      </p>

      {result && result.ok ? (
        <div className="mt-3 rounded-[10px] bg-[var(--s-good-wash,#e5eee1)] px-4 py-3">
          <p className="m-0 text-[13.5px] font-medium">
            {result.added} {result.added === 1 ? 'line' : 'lines'} on the quotation.
          </p>
          {result.notes.map((note) => (
            <p key={note} className="m-0 mt-1 text-[12.5px] leading-relaxed text-[var(--s-ink-2)]">
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
  products,
  onUpdate,
  onRemove,
  onDuplicate,
  onMove,
  onAdd,
}: {
  room: string;
  lines: PricedLine[];
  products: ProductRow[];
  onUpdate: (key: string, patch: Partial<EditableLine>) => void;
  onRemove: (key: string) => void;
  onDuplicate: (key: string) => void;
  onMove: (key: string, by: -1 | 1) => void;
  onAdd: (room: string, product: ProductRow) => void;
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

      <AddLine room={room} products={products} onAdd={onAdd} />
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
 * The picker, with a search box.
 *
 * A dropdown of forty products is a dropdown nobody reads to the end. Typing
 * three letters is how anybody finds a line in a catalogue they wrote
 * themselves, and the list stays visible so the shape of what is available is
 * still legible to somebody who does not know what they are looking for.
 *
 * Products with no rate are shown, greyed, rather than hidden. A studio
 * looking for "wardrobe" and not finding it would conclude the software has
 * lost it; finding it marked as unpriced tells them exactly what to do.
 */
function AddLine({
  room,
  products,
  onAdd,
}: {
  room: string;
  products: ProductRow[];
  onAdd: (room: string, product: ProductRow) => void;
}) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);

  const active = useMemo(() => products.filter((p) => p.isActive), [products]);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q === '') return active.slice(0, 12);
    return active.filter((p) => p.name.toLowerCase().includes(q)).slice(0, 12);
  }, [active, query]);

  if (active.length === 0) return null;

  return (
    <div className="border-t border-[var(--s-rule-soft)] bg-[var(--s-surface-2)] px-4 py-2.5">
      <input
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        /* A blur that fires before the click on a suggestion would close the
           list out from under the press. One frame is enough and is what
           every combobox in this codebase does. */
        onBlur={() => window.setTimeout(() => setOpen(false), 120)}
        placeholder={`Add to ${room} — type to search your products`}
        className={`${field} w-full max-w-[28rem]`}
      />

      {open && matches.length > 0 ? (
        <ul className="m-0 mt-2 flex list-none flex-wrap gap-1.5 p-0">
          {matches.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  onAdd(room, p);
                  setQuery('');
                }}
                className="rounded-full border border-[var(--s-rule)] bg-[var(--s-surface)] px-3 py-1.5 text-[12.5px] hover:border-[var(--s-ink-3)]"
              >
                {p.name}
                <span
                  className={`s-num ml-1.5 ${p.ratePaise > 0 ? 'text-[var(--s-ink-3)]' : 'text-[var(--s-warn)]'}`}
                >
                  {p.ratePaise > 0 ? `₹${paiseToRupees(p.ratePaise)}` : 'no rate'}
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {open && query.trim() !== '' && matches.length === 0 ? (
        <p className="m-0 mt-2 text-[12.5px] text-[var(--s-ink-3)]">
          Nothing in your product list matches that. Add it in your products and it will be here
          next time.
        </p>
      ) : null}
    </div>
  );
}
