'use client';

import { useActionState, useEffect, useMemo, useState, useTransition } from 'react';
import { formatINRCompact } from '@/lib/money';
// Values from the PURE module. `clients.ts` carries `server-only`, and a label
// map is a value rather than a type — importing it from there pulls Prisma into
// the browser bundle and the build stops. CONTRIBUTING §9.5.
import {
  SOURCE_LABELS,
  LOST_LABELS,
  BOARD_KINDS,
  colourOf,
  type ClientSourceName,
  type LostReasonName,
} from '@/modules/studio-practice/vocabulary';
import { groupBy } from '@/modules/studio-practice/field-values';
import type { ClientRow } from '@/modules/studio-practice/clients';
import type { StageRow } from '@/modules/studio-practice/stages';
import type { FieldRow } from '@/modules/studio-practice/fields';
import { addClientAction, updateClientAction, setStageAction, IDLE } from './actions';

const input =
  'rounded-[8px] border border-[var(--s-rule)] bg-[var(--s-surface)] px-3 py-2 text-[14px] text-[var(--s-ink)] placeholder:text-[var(--s-ink-3)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--s-accent)]';
const primary =
  'rounded-[8px] bg-[var(--s-accent)] px-4 py-2 text-[14px] font-medium text-white hover:bg-[var(--s-accent-deep)] disabled:opacity-40';
const quiet =
  'rounded-[8px] border border-[var(--s-rule)] px-3 py-1.5 text-[13px] font-medium hover:border-[var(--s-ink-3)] disabled:opacity-40';

function overdue(date: Date | null, today: Date): boolean {
  return date !== null && date <= today;
}

function dueLabel(date: Date | null, today: Date): string | null {
  if (!date) return null;
  const days = Math.round((date.getTime() - today.getTime()) / 86_400_000);
  if (days < -1) return `${Math.abs(days)}d late`;
  if (days === -1) return 'Yesterday';
  if (days === 0) return 'Today';
  if (days === 1) return 'Tomorrow';
  if (days <= 7) return `In ${days}d`;
  return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

/** A stage's colour, as a chip. */
function StageTag({ name, colour }: { name: string; colour: string }) {
  const c = colourOf(colour);
  return (
    <span className="s-tag" style={{ background: c.wash, color: c.ink }}>
      {name}
    </span>
  );
}

/**
 * The studio's own fields, as form inputs.
 *
 * Every one is named `custom.<key>` — the prefix is what stops a studio that
 * defines a field called "name" from silently overwriting the client's name
 * when the form posts. See `custom()` in `actions.ts`.
 */
function CustomFields({
  fields,
  values,
}: {
  fields: FieldRow[];
  values?: Record<string, string>;
}) {
  if (fields.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-3">
      {fields.map((f) => (
        <label key={f.id} className="flex min-w-[9rem] flex-1 flex-col gap-1.5">
          <span className="s-label">{f.label}</span>
          {f.type === 'SELECT' ? (
            <select name={`custom.${f.key}`} defaultValue={values?.[f.key] ?? ''} className={input}>
              <option value="">—</option>
              {f.options.map((o) => (
                <option key={o} value={o}>{o}</option>
              ))}
            </select>
          ) : (
            <input
              name={`custom.${f.key}`}
              defaultValue={values?.[f.key] ?? ''}
              type={f.type === 'DATE' ? 'date' : 'text'}
              inputMode={f.type === 'NUMBER' ? 'decimal' : undefined}
              className={`${input} ${f.type === 'NUMBER' ? 's-num text-right' : ''}`}
            />
          )}
        </label>
      ))}
    </div>
  );
}

/**
 * One client, as a card.
 *
 * The card carries what you need on the phone: name, number, what you owe them
 * next and when. The stage moves with one click on the arrow — dragging is the
 * obvious gesture and the wrong one here, because this gets used on a phone at
 * a site where a drag is a scroll.
 *
 * "One click along" now means one click along THE STUDIO'S list, in their
 * order, which is why the next stage arrives as a prop rather than being
 * computed from a constant.
 */
function Card({
  client,
  today,
  stages,
  fields,
  next,
}: {
  client: ClientRow;
  today: Date;
  stages: StageRow[];
  fields: FieldRow[];
  next: StageRow | null;
}) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(updateClientAction, IDLE);
  const [moving, startMove] = useTransition();
  const [moveError, setMoveError] = useState<string | null>(null);

  useEffect(() => {
    if ('ok' in state && state.ok) setOpen(false);
  }, [state]);

  const late = overdue(client.nextActionOn, today);
  const shown = fields.filter((f) => client.fields[f.key]);

  return (
    <li className={`s-card p-3 ${late ? '!border-[var(--s-accent)]' : ''}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="m-0 truncate text-[14.5px] font-semibold">{client.name}</p>
          {client.phone ? (
            <a
              href={`tel:${client.phone}`}
              className="s-num text-[12.5px] text-[var(--s-accent)] no-underline"
            >
              {client.phone}
            </a>
          ) : null}
        </div>
        {client.quotedPaise ? (
          <span className="s-num flex-none text-[13px] font-semibold">
            {formatINRCompact(client.quotedPaise)}
          </span>
        ) : null}
      </div>

      <div className="mt-2 flex flex-wrap gap-1.5">
        <span
          className={`s-tag ${
            client.fromMarketplace ? '!bg-[var(--s-accent-wash)] !text-[var(--s-accent-deep)]' : ''
          }`}
        >
          {SOURCE_LABELS[client.source]}
        </span>
        {client.config ? <span className="s-tag">{client.config}</span> : null}
        {client.society ? <span className="s-tag">{client.society}</span> : null}
        {/* Whatever the studio decided was worth capturing. */}
        {shown.map((f) => (
          <span key={f.id} className="s-tag" title={f.label}>
            {client.fields[f.key]}
          </span>
        ))}
      </div>

      {client.nextAction ? (
        <p className="m-0 mt-2 text-[13px] leading-snug text-[var(--s-ink-2)]">
          {client.nextAction}
          {client.nextActionOn ? (
            <span
              className={`ml-1.5 ${late ? 'font-semibold text-[var(--s-accent)]' : 'text-[var(--s-ink-3)]'}`}
            >
              · {dueLabel(client.nextActionOn, today)}
            </span>
          ) : null}
        </p>
      ) : (
        <p className="m-0 mt-2 text-[12.5px] italic text-[var(--s-ink-3)]">No follow-up set</p>
      )}

      <div className="mt-2.5 flex flex-wrap items-center gap-2 border-t border-[var(--s-rule-soft)] pt-2.5">
        <button type="button" onClick={() => setOpen(!open)} className={quiet}>
          {open ? 'Close' : 'Update'}
        </button>
        {next ? (
          <button
            type="button"
            disabled={moving}
            onClick={() =>
              startMove(async () => {
                const result = await setStageAction(client.id, next.id);
                setMoveError(result && 'ok' in result && !result.ok ? result.error : null);
              })
            }
            className={quiet}
          >
            → {next.name}
          </button>
        ) : null}
      </div>

      {moveError ? (
        <p role="alert" className="m-0 mt-2 text-[12.5px] text-[var(--s-bad)]">{moveError}</p>
      ) : null}

      {open ? (
        <form action={action} className="mt-2.5 flex flex-col gap-2">
          <input type="hidden" name="id" value={client.id} />

          <label className="flex flex-col gap-1">
            <span className="s-label">Column</span>
            <select name="stageId" defaultValue={client.stageId} className={input}>
              {stages.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1">
            <span className="s-label">If lost, why</span>
            <select name="lostReason" defaultValue={client.lostReason ?? ''} className={input}>
              <option value="">—</option>
              {(Object.keys(LOST_LABELS) as LostReasonName[]).map((r) => (
                <option key={r} value={r}>{LOST_LABELS[r]}</option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1">
            <span className="s-label">Next thing to do</span>
            <input name="nextAction" defaultValue={client.nextAction ?? ''} className={input} />
          </label>

          <label className="flex flex-col gap-1">
            <span className="s-label">On</span>
            <input
              type="date"
              name="nextActionOn"
              defaultValue={
                client.nextActionOn ? client.nextActionOn.toISOString().slice(0, 10) : ''
              }
              className={input}
            />
          </label>

          <CustomFields fields={fields} values={client.fields} />

          <button type="submit" disabled={pending} className={primary}>
            {pending ? 'Saving…' : 'Save'}
          </button>

          {'ok' in state && !state.ok ? (
            <p role="alert" className="m-0 text-[12.5px] text-[var(--s-bad)]">
              {state.error}
            </p>
          ) : null}
        </form>
      ) : null}
    </li>
  );
}

/**
 * Adding a client.
 *
 * ## Why this is a sheet and not a popover
 *
 * It was an absolutely positioned panel hanging off the header button. Three
 * things were wrong with that and all three read to the person using it as
 * "I cannot add a client":
 *
 *   1. It is anchored inside the page header. Any ancestor that clips, any
 *      narrow window where the header wraps, and the panel is off-screen or
 *      cut in half with the Add button below the fold.
 *   2. It never closed. On success the form sat there still full of the name
 *      you had just typed, with no confirmation — so the natural read is that
 *      nothing happened, and the natural next move is to press Add again.
 *   3. On an empty list the header was the ONLY way in. If it failed you, the
 *      page had no other door.
 *
 * A fixed sheet with its own backdrop cannot be clipped by anything, closes
 * itself when the row is written, and is reachable from the empty state too.
 */
function AddClient({ label, fields }: { label: string; fields: FieldRow[] }) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(addClientAction, IDLE);

  // Close when the row is actually written — not when the form is submitted.
  useEffect(() => {
    if ('ok' in state && state.ok) setOpen(false);
  }, [state]);

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className={primary}>
        {label}
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/25 p-4 sm:items-center">
      <button
        type="button"
        aria-label="Cancel"
        onClick={() => setOpen(false)}
        className="fixed inset-0 -z-10 cursor-default"
      />
      <form action={action} className="s-card relative flex w-[min(30rem,100%)] flex-col gap-3 p-5 shadow-xl">
        <p className="m-0 text-[15px] font-semibold">Add a client</p>

        <label className="flex flex-col gap-1.5">
          <span className="s-label">Name</span>
          <input name="name" required autoFocus placeholder="Mrs Kothari" className={input} />
        </label>

        <div className="flex flex-wrap gap-3">
          <label className="flex flex-1 flex-col gap-1.5">
            <span className="s-label">Phone</span>
            <input name="phone" inputMode="tel" className={input} />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="s-label">Config</span>
            <input name="config" placeholder="3 BHK" className={`${input} w-[6.5rem]`} />
          </label>
        </div>

        <div className="flex flex-wrap gap-3">
          <label className="flex flex-1 flex-col gap-1.5">
            <span className="s-label">Society or area</span>
            <input name="society" placeholder="Kalyani Nagar" className={input} />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="s-label">Where from</span>
            <select name="source" defaultValue="WALK_IN" className={input}>
              {(Object.keys(SOURCE_LABELS) as ClientSourceName[])
                // Ours is not a choice anyone makes by hand — a One Interiors
                // client arrives through the introduction, and offering it here
                // would let a walk-in be mislabelled as one of ours, which
                // corrupts the one report that says whether we are worth paying.
                .filter((s) => s !== 'ONE_INTERIORS')
                .map((s) => (
                  <option key={s} value={s}>{SOURCE_LABELS[s]}</option>
                ))}
            </select>
          </label>
        </div>

        <CustomFields fields={fields} />

        <div className="flex flex-wrap gap-3">
          <label className="flex flex-1 flex-col gap-1.5">
            <span className="s-label">Next thing to do</span>
            <input name="nextAction" placeholder="Call back with a rough number" className={input} />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="s-label">On</span>
            <input type="date" name="nextActionOn" className={input} />
          </label>
        </div>

        <div className="flex items-center gap-3">
          <button type="submit" disabled={pending} className={primary}>
            {pending ? 'Adding…' : 'Add'}
          </button>
          <button type="button" onClick={() => setOpen(false)} className={quiet}>
            Cancel
          </button>
        </div>

        {'ok' in state && !state.ok ? (
          <p role="alert" className="m-0 text-[12.5px] text-[var(--s-bad)]">
            {state.error}
          </p>
        ) : null}
      </form>
    </div>
  );
}

export function AddClientButton({ fields }: { fields: FieldRow[] }) {
  return <AddClient label="+ Add a client" fields={fields} />;
}

/** The same form, reached from the empty state. See the note on `AddClient`. */
export function AddFirstClientButton({ fields }: { fields: FieldRow[] }) {
  return <AddClient label="Add the first one" fields={fields} />;
}

/**
 * The board.
 *
 * ## The columns are the studio's, not ours
 *
 * They come from `studio_stages` in the studio's order, with the studio's
 * names and colours, and there may be three of them or eleven. That is the
 * whole point of the pipeline being a table — a studio whose process is
 * "New → Calling 1 → Calling 2 → Effective lead → Floor plan pending →
 * Quotation pending → Quotation shared" can now write it down, and the
 * software counts, sorts and moves along THAT list.
 *
 * Columns scroll sideways rather than shrinking, because eleven columns in a
 * responsive grid is eleven unreadable columns.
 *
 * ## Grouping
 *
 * A studio can mark any of its own text, list or date fields as groupable in
 * Settings → Fields, and then group the list by it — which for a studio
 * working one tower at a time is the difference between a list of 200 names
 * and a list of nine buildings.
 */
export function Board({
  clients,
  stages,
  fields,
}: {
  clients: ClientRow[];
  stages: StageRow[];
  fields: FieldRow[];
}) {
  const today = useMemo(() => {
    const d = new Date();
    d.setHours(23, 59, 59, 999);
    return d;
  }, []);

  const groupable = fields.filter((f) => f.groupBy);
  const [grouping, setGrouping] = useState('');

  const board = stages.filter((s) => BOARD_KINDS.includes(s.kind));
  const closedStages = stages.filter((s) => !BOARD_KINDS.includes(s.kind));
  const closedIds = new Set(closedStages.map((s) => s.id));
  const closed = clients.filter((c) => closedIds.has(c.stageId));

  /** The next column along, in the studio's order. Null at the end. */
  const nextAfter = (stageId: string): StageRow | null => {
    const i = stages.findIndex((s) => s.id === stageId);
    return i >= 0 && i < stages.length - 1 ? (stages[i + 1] ?? null) : null;
  };

  const open = clients.filter((c) => !closedIds.has(c.stageId));
  const groups =
    grouping.length > 0 ? groupBy(open, grouping) : [{ label: '', rows: open }];

  return (
    <div className="flex flex-col gap-6">
      {groupable.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2.5">
          <span className="s-label">Group by</span>
          <select
            value={grouping}
            onChange={(e) => setGrouping(e.target.value)}
            className={`${input} py-1.5`}
          >
            <option value="">No grouping</option>
            {groupable.map((f) => (
              <option key={f.id} value={f.key}>{f.label}</option>
            ))}
          </select>
        </div>
      ) : null}

      {groups.map((group) => (
        <section key={group.label || 'all'} className="flex flex-col gap-2">
          {group.label ? (
            <h2 className="m-0 flex items-baseline gap-2 text-[15px] font-semibold">
              {group.label}
              <span className="s-num s-label">{group.rows.length}</span>
            </h2>
          ) : null}

          <div className="-mx-1 flex snap-x gap-3 overflow-x-auto px-1 pb-2">
            {board.map((stage) => {
              const items = group.rows.filter((c) => c.stageId === stage.id);
              const due = items.filter((c) => overdue(c.nextActionOn, today)).length;
              const c = colourOf(stage.colour);

              return (
                <section
                  key={stage.id}
                  className="flex w-[17.5rem] flex-none snap-start flex-col gap-2 rounded-[12px] bg-[var(--s-surface-2)] p-2.5"
                >
                  <div className="flex items-baseline justify-between gap-2 px-1">
                    <h3 className="m-0 flex items-center gap-2 text-[13.5px] font-semibold">
                      <span
                        aria-hidden
                        className="inline-block h-2 w-2 flex-none rounded-full"
                        style={{ background: c.dot }}
                      />
                      <span className="truncate">{stage.name}</span>
                    </h3>
                    <span className="s-num s-label flex-none">
                      {due > 0 ? `${due} due · ` : ''}
                      {items.length}
                    </span>
                  </div>

                  {items.length === 0 ? (
                    <p className="m-0 px-1 py-3 text-[12.5px] italic text-[var(--s-ink-3)]">
                      Nothing here.
                    </p>
                  ) : (
                    <ul className="m-0 flex list-none flex-col gap-2 p-0">
                      {items.map((client) => (
                        <Card
                          key={client.id}
                          client={client}
                          today={today}
                          stages={stages}
                          fields={fields}
                          next={nextAfter(client.stageId)}
                        />
                      ))}
                    </ul>
                  )}
                </section>
              );
            })}
          </div>
        </section>
      ))}

      {closed.length > 0 ? (
        <details>
          <summary className="mb-3 cursor-pointer select-none text-[13.5px] font-medium text-[var(--s-ink-2)]">
            Finished and gone ({closed.length})
          </summary>
          <ul className="m-0 grid list-none grid-cols-1 gap-2 p-0 md:grid-cols-2 xl:grid-cols-3">
            {closed.map((c) => (
              <li key={c.id} className="s-card flex flex-wrap items-baseline gap-x-3 gap-y-1 px-4 py-3">
                <span className="text-[14px] font-medium">{c.name}</span>
                <span className="s-label">{SOURCE_LABELS[c.source]}</span>
                <span className="ml-auto flex items-center gap-2">
                  <StageTag name={c.stageName} colour={c.stageColour} />
                  {c.stageKind === 'LOST' && c.lostReason ? (
                    <span className="text-[12.5px] text-[var(--s-ink-3)]">
                      {LOST_LABELS[c.lostReason]}
                    </span>
                  ) : null}
                </span>
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </div>
  );
}
