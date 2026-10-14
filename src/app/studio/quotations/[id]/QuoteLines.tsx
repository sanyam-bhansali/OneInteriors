'use client';

import { useRef, useState, useTransition } from 'react';
import type { QuoteUnitName, WorkCodeName } from '@/modules/studio-quote/pricing';
import { CONFIGS, isConfigName, standardRunFor, type ConfigName } from '@/modules/studio-quote/configure';
import type { QuoteRow } from '@/modules/studio-quote/quotes';
import { applyConfigAction, clearLinesAction, readRoomsForQuoteAction, type BuildState } from '../actions';

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
 * A number in a table cell.
 *
 * Text in the box, number in the state. Feeding the parsed value back in
 * would rewrite "18" on the way to "1800" and turn "" into "0" while the
 * caret jumps. The initial text comes from the value once and is then the
 * input's own; it re-syncs only when the value changes from OUTSIDE, which is
 * what a rebuild (or the stepper) looks like.
 */
export function Num({
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

/** The size a new line starts at, decided in the panel above. */
export interface AddSize {
  widthMm: number | null;
  heightMm: number | null;
  qtyMilli: number | null;
}

/** A typed number that is actually a number, and positive. */
export function usable(value: number | null): number | null {
  if (value == null || !Number.isFinite(value) || value <= 0) return null;
  return value;
}
