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
  BIN_DAYS,
  QUIET_AFTER_DAYS,
  type ClientSourceName,
  type LostReasonName,
} from '@/modules/studio-practice/vocabulary';
import { groupBy } from '@/modules/studio-practice/field-values';
import type { ClientRow } from '@/modules/studio-practice/clients';
import type { StageRow } from '@/modules/studio-practice/stages';
import type { FieldRow } from '@/modules/studio-practice/fields';
import {
  addClientAction,
  updateClientAction,
  setStageAction,
  assignAction,
  logContactAction,
  binAction,
  removeDemoLeadAction,
} from './actions';
import { IDLE } from '../form-state';
import { SavedViews } from './SavedViews';
import type { SavedView } from '@/modules/studio-practice/saved-views';
import type { ViewFilters } from '@/modules/studio-practice/view-filters';

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

/**
 * Has this one gone quiet?
 *
 * The same line the server counts on — one constant, so the badge on a card
 * and the number in the team list can never disagree. Never contacted
 * counts — an imported list is entirely that, and those are exactly the rows
 * somebody needs to start on.
 */
function quiet7(at: Date | null): boolean {
  if (at === null) return true;
  return Date.now() - at.getTime() > QUIET_AFTER_DAYS * 86_400_000;
}

/**
 * How long since anybody spoke to them.
 *
 * "Never" and "a long time ago" read differently on purpose: one is an
 * imported row waiting to be started, the other is somebody being dropped.
 */
function contactLabel(at: Date | null): string {
  if (!at) return 'Not contacted yet';
  const days = Math.floor((Date.now() - at.getTime()) / 86_400_000);
  if (days <= 0) return 'Spoke today';
  if (days === 1) return 'Spoke yesterday';
  if (days < 7) return `Spoke ${days}d ago`;
  if (days < 28) return `Spoke ${Math.floor(days / 7)}w ago`;
  return `Spoke ${at.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}`;
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
 * Who has this one, and a way to change it.
 *
 * ## Why "Take it" is its own button
 *
 * Assigning something to yourself is the single most common assignment in a
 * small studio, and making it a two-step — open a menu, find your own name in
 * a list of three — is enough friction that people skip it, which leaves the
 * pool full and the counts meaningless.
 *
 * ## Why this is hidden in a one-person studio
 *
 * A sole practitioner assigning every client to themselves is a chore that
 * produces no information. So when there is nobody to assign TO, the whole
 * control disappears rather than sitting there saying "Unassigned" on two
 * hundred cards.
 */
function Assign({
  clientId,
  assignedToId,
  assignedToName,
  members,
  meId,
}: {
  clientId: string;
  assignedToId: string | null;
  assignedToName: string | null;
  members: { id: string; name: string }[];
  meId: string | null;
}) {
  const [busy, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (members.length < 2) return null;

  const run = (memberId: string | null) =>
    start(async () => {
      const result = await assignAction([clientId], memberId);
      setError('ok' in result && !result.ok ? result.error : null);
    });

  return (
    <>
      {assignedToId === null ? (
        <>
          <span className="s-tag !bg-[var(--s-accent-wash)] !text-[var(--s-accent-deep)]">
            Nobody
          </span>
          {meId ? (
            <button type="button" disabled={busy} onClick={() => run(meId)} className={quiet}>
              Take it
            </button>
          ) : null}
        </>
      ) : (
        <span className="s-tag">{assignedToName}</span>
      )}

      <select
        aria-label="Who is working on this"
        value={assignedToId ?? ''}
        disabled={busy}
        onChange={(e) => run(e.target.value === '' ? null : e.target.value)}
        className={`${input} max-w-[8.5rem] py-1 text-[12.5px]`}
      >
        <option value="">Nobody</option>
        {members.map((m) => (
          <option key={m.id} value={m.id}>{m.name}</option>
        ))}
      </select>

      {error ? (
        <span role="alert" className="text-[12px] text-[var(--s-bad)]">{error}</span>
      ) : null}
    </>
  );
}

/**
 * Take the whole pool at once.
 *
 * The honest case for this button: in a two-person studio the pool after an
 * import is "everything", and sharing two hundred rows out one at a time is
 * not going to happen. One click to own the lot, then hand individual ones
 * over from the cards, is the order people actually work in.
 *
 * It asks first. Bulk assignment is easy to undo but annoying to notice.
 */
function TakeAll({ ids, meId }: { ids: string[]; meId: string }) {
  const [busy, start] = useTransition();
  const [confirming, setConfirming] = useState(false);

  if (!confirming) {
    return (
      <button type="button" onClick={() => setConfirming(true)} className={quiet}>
        Take all {ids.length}
      </button>
    );
  }

  return (
    <span className="flex items-center gap-2">
      <button
        type="button"
        disabled={busy}
        onClick={() =>
          start(async () => {
            await assignAction(ids, meId);
            setConfirming(false);
          })
        }
        className={primary}
      >
        {busy ? 'Taking…' : `Yes, all ${ids.length}`}
      </button>
      <button type="button" onClick={() => setConfirming(false)} className={quiet}>
        Cancel
      </button>
    </span>
  );
}

/**
 * Delete one, with thirty days to change your mind.
 *
 * Two clicks, and the second one says the name. The message the module sends
 * back when a client carries quotations or projects is shown as-is, because it
 * names who is blocking and that is the only useful thing to know.
 */
function Bin({ id, name }: { id: string; name: string }) {
  const [asking, setAsking] = useState(false);
  const [busy, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (!asking) {
    return (
      <button
        type="button"
        onClick={() => setAsking(true)}
        className="mt-2.5 self-start text-[12.5px] text-[var(--s-ink-3)] underline hover:text-[var(--s-bad)]"
      >
        Delete
      </button>
    );
  }

  return (
    <div className="mt-2.5 flex flex-col gap-2 border-t border-[var(--s-rule-soft)] pt-2.5">
      <p className="m-0 text-[12.5px] text-[var(--s-ink-2)]">
        Delete {name}? You have {BIN_DAYS} days to get them back.
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() =>
            start(async () => {
              const result = await binAction([id]);
              setError('ok' in result && !result.ok ? result.error : null);
              if ('ok' in result && result.ok) setAsking(false);
            })
          }
          className={quiet}
        >
          {busy ? 'Deleting…' : 'Yes, delete'}
        </button>
        <button type="button" onClick={() => { setAsking(false); setError(null); }} className={quiet}>
          Keep
        </button>
      </div>
      {error ? (
        <p role="alert" className="m-0 text-[12.5px] text-[var(--s-bad)]">{error}</p>
      ) : null}
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
  members,
  meId,
}: {
  client: ClientRow;
  today: Date;
  stages: StageRow[];
  fields: FieldRow[];
  next: StageRow | null;
  members: { id: string; name: string }[];
  meId: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(updateClientAction, IDLE);
  const [moving, startMove] = useTransition();
  const [moveError, setMoveError] = useState<string | null>(null);
  const [calling, startCall] = useTransition();

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
        {/* First in the row, because everything else on this card is a claim
            about a person and this says there is no person. The name carries
            "Sample" too — a badge is a rendering decision and could be lost in
            a redesign, where the name survives into a CSV export. */}
        {client.isDemo ? <span className="s-tag s-tag-demo">Sample</span> : null}
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

      {/* Last contact sits under the follow-up because the two answer
          different questions: what is owed, and whether anybody is actually
          doing it. A card can have a tidy follow-up note and not have been
          touched in a month. */}
      <p
        className={`m-0 mt-1 text-[12px] ${
          quiet7(client.lastContactedAt) ? 'font-medium text-[var(--s-accent)]' : 'text-[var(--s-ink-3)]'
        }`}
      >
        {contactLabel(client.lastContactedAt)}
      </p>

      <div className="mt-2.5 flex flex-wrap items-center gap-2 border-t border-[var(--s-rule-soft)] pt-2.5">
        <Assign
          clientId={client.id}
          assignedToId={client.assignedToId}
          assignedToName={client.assignedToName}
          members={members}
          meId={meId}
        />
        <button type="button" onClick={() => setOpen(!open)} className={quiet}>
          {open ? 'Close' : 'Update'}
        </button>
        <button
          type="button"
          disabled={calling}
          title="Records that somebody spoke to them today"
          onClick={() => startCall(async () => { await logContactAction(client.id); })}
          className={quiet}
        >
          Spoke to them
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

      {/* Delete lives inside the opened card, never in the always-visible
          footer. This gets used one-handed on a phone, and a delete button
          sitting next to "→ next stage" is a delete button pressed by
          accident. It is reversible for thirty days, but a card that vanishes
          mid-scroll is still alarming. */}
      {open ? <Bin id={client.id} name={client.name} /> : null}
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

/**
 * The strip above the board, while the sample is on it.
 *
 * Three jobs, in this order: say it is not real, say what to do with it, and
 * get out of the way. It does not explain the board — the walkthrough does
 * that, and two panels explaining the same screen is one too many.
 *
 * "It is not counted in anything" is on screen rather than only in the schema
 * because it is the studio's first question the moment they notice a lead they
 * did not add, and the answer is the reason the sample is allowed to exist.
 */
function DemoStrip() {
  const [busy, start] = useTransition();
  const [gone, setGone] = useState(false);

  // Optimistic: the row is removed the moment they press, because waiting for
  // a round trip to watch an example disappear is a strange thing to ask.
  if (gone) return null;

  return (
    <div className="s-card flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
      <p className="m-0 max-w-[62ch] text-[14px] leading-snug">
        <span className="font-semibold">There is a sample lead on your board.</span>{' '}
        <span className="text-[var(--s-ink-2)]">
          Drag it, open it, change the date — it behaves exactly like a real one. It is not counted
          in any of your figures.
        </span>
      </p>
      <button
        type="button"
        disabled={busy}
        onClick={() => {
          setGone(true);
          start(async () => {
            const result = await removeDemoLeadAction();
            // Put it back if the delete failed, rather than leaving them
            // looking at a board that will have the sample again on reload.
            // `State` is a union carrying an idle member, so the narrowing has
            // to test for the key before reading it — see form-state.ts.
            if ('ok' in result && !result.ok) setGone(false);
          });
        }}
        className={`${quiet} ml-auto`}
      >
        {busy ? 'Removing…' : 'Remove the sample'}
      </button>
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
  members,
  meId,
  views,
}: {
  clients: ClientRow[];
  stages: StageRow[];
  fields: FieldRow[];
  /** Everyone who can be given work. One name means the controls stay hidden. */
  members: { id: string; name: string }[];
  /** The signed-in person's membership row, for "Take it". */
  meId: string | null;
  /** This person's named filters. Empty until they save one. */
  views: SavedView[];
}) {
  const today = useMemo(() => {
    const d = new Date();
    d.setHours(23, 59, 59, 999);
    return d;
  }, []);

  const groupable = fields.filter((f) => f.groupBy);

  /* The starred view decides what the board opens with, so it seeds the
     state rather than being applied afterwards — applying it in an effect
     would render the unfiltered board first and then rearrange it under
     somebody already reaching for a card. */
  const opening = views.find((v) => v.isDefault)?.filters ?? {};
  const [grouping, setGrouping] = useState(opening.groupBy ?? '');

  // '' everyone · 'pool' nobody has taken it · a member id · 'quiet'
  const [who, setWho] = useState(opening.who ?? '');

  /* What the two controls above add up to, in the shape a saved view holds.
     Empty strings are dropped so an unfiltered board compares equal to a
     view carrying no filters at all. */
  const currentView: ViewFilters = {
    ...(who ? { who } : {}),
    ...(grouping ? { groupBy: grouping } : {}),
  };

  const applyView = (f: ViewFilters) => {
    setWho(f.who ?? '');
    setGrouping(f.groupBy ?? '');
  };

  const nameOf = (id: string) => members.find((m) => m.id === id)?.name ?? null;
  const team = members.length > 1;

  const board = stages.filter((s) => BOARD_KINDS.includes(s.kind));
  const closedStages = stages.filter((s) => !BOARD_KINDS.includes(s.kind));
  const closedIds = new Set(closedStages.map((s) => s.id));
  const closed = clients.filter((c) => closedIds.has(c.stageId));

  /** The next column along, in the studio's order. Null at the end. */
  const nextAfter = (stageId: string): StageRow | null => {
    const i = stages.findIndex((s) => s.id === stageId);
    return i >= 0 && i < stages.length - 1 ? (stages[i + 1] ?? null) : null;
  };

  const allOpen = clients.filter((c) => !closedIds.has(c.stageId));
  const pool = allOpen.filter((c) => c.assignedToId === null);
  // Not `quiet` — that name is taken by the button class at the top of this
  // file, and shadowing it here silently restyles every button below.
  const quietOnes = allOpen.filter((c) => quiet7(c.lastContactedAt));

  const open =
    who === ''
      ? allOpen
      : who === 'pool'
        ? pool
        : who === 'quiet'
          ? quietOnes
          : allOpen.filter((c) => c.assignedToId === who);

  const groups =
    grouping.length > 0 ? groupBy(open, grouping) : [{ label: '', rows: open }];

  return (
    <div className="flex flex-col gap-6">
      {/* What the sample is, said once, at the top.
          The badge on the card says "this is not a person"; this says why it
          is here and how to get rid of it. Above the board rather than beside
          the card, because it is a statement about the screen rather than
          about that lead — and a studio scanning for the exit should not have
          to find a particular card first.

          It disappears the moment the sample is removed, so nobody who has
          cleared it is told about it again. */}
      {clients.some((c) => c.isDemo) ? <DemoStrip /> : null}

      {/* The pool is a filter on this board, not a second screen. A studio
          that has to go somewhere else to find the clients nobody has taken
          is a studio that never goes. */}
      {team && pool.length > 0 ? (
        <div className="s-card flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
          <p className="m-0 text-[14px]">
            <span className="s-num font-semibold">{pool.length}</span>{' '}
            {pool.length === 1 ? 'client has' : 'clients have'} nobody working on them.
          </p>
          <button
            type="button"
            onClick={() => setWho(who === 'pool' ? '' : 'pool')}
            className={`${quiet} ml-auto`}
          >
            {who === 'pool' ? 'Show everyone' : 'Show me those'}
          </button>
          {meId ? <TakeAll ids={pool.map((c) => c.id)} meId={meId} /> : null}
        </div>
      ) : null}

      <SavedViews
        views={views}
        current={currentView}
        onApply={applyView}
        memberName={nameOf}
      />

      {(groupable.length > 0 || team || quietOnes.length > 0) ? (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2.5">
          {team || quietOnes.length > 0 ? (
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="s-label">Showing</span>
              <select
                value={who}
                onChange={(e) => setWho(e.target.value)}
                className={`${input} py-1.5`}
              >
                <option value="">Everyone ({allOpen.length})</option>
                {quietOnes.length > 0 ? (
                  <option value="quiet">Gone quiet ({quietOnes.length})</option>
                ) : null}
                {team ? <option value="pool">Nobody has taken ({pool.length})</option> : null}
                {team
                  ? members.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.id === meId ? `${m.name} (you)` : m.name} (
                        {allOpen.filter((c) => c.assignedToId === m.id).length})
                      </option>
                    ))
                  : null}
              </select>
            </div>
          ) : null}

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
        </div>
      ) : null}

      {open.length === 0 && allOpen.length > 0 ? (
        <p className="m-0 text-[14px] text-[var(--s-ink-2)]">
          Nothing matches that.{' '}
          <button type="button" onClick={() => setWho('')} className="underline">
            Show everyone
          </button>
        </p>
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
                          members={members}
                          meId={meId}
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
