'use client';

/**
 * A customer's project, from the studio's or ops' side (docs/CUSTOMER-
 * PLATFORM-PLAN.md, step 2): ask the client for a decision by a date, and
 * keep the snag list moving — a fix-by date on each, and a photo when it is
 * fixed — and file the documents the client keeps in their Locker.
 * Everything here reaches the client's app and their phone.
 */

import { useState, useTransition } from 'react';
import { withShrunkPhotos } from '@/lib/shrink-image';
import type { StaffWork } from '@/modules/portal/project-store';
import {
  addDocumentAction,
  fixSnagAction,
  paymentStageAction,
  postDecisionAction,
  raiseSnagAction,
  removeDocumentAction,
  snagFixByAction,
  type WorkResult,
} from '@/app/project-work/actions';
import { DOC_KINDS } from '@/modules/portal/documents';
import { formatINR } from '@/lib/money';

const input = 'rounded-[8px] border border-[var(--color-rule)] bg-[var(--color-paper)] px-3 py-2 text-[14px]';
const ghost =
  'rounded-full border border-[var(--color-rule)] px-4 py-1.5 text-[13px] text-[var(--color-ink)] hover:border-[var(--color-ink-3)] disabled:opacity-40';
const primary = 'rounded-full border border-[var(--color-petrol)] px-4 py-1.5 text-[13px] text-[var(--color-petrol)] disabled:opacity-40';
const label = 'font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.06em] text-[var(--color-ink-3)]';

const day = (iso: string) => new Date(iso).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'Asia/Kolkata' });
const STATE = { open: 'Open', 'due-soon': 'Due soon', overdue: 'Past due, not chosen', chosen: 'Chosen' } as const;

function useRun() {
  const [pending, start] = useTransition();
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const run = (fn: () => Promise<WorkResult>, okText: string, after?: () => void) =>
    start(async () => {
      const r = await fn();
      setMessage(r.ok ? { ok: true, text: okText } : { ok: false, text: r.error ?? 'Could not save.' });
      if (r.ok) after?.();
    });
  return { pending, message, run };
}

export function ProjectWork({ projectId, work }: { projectId: string; work: StaffWork }) {
  const open = work.snags.filter((s) => s.status === 'OPEN');
  const fixed = work.snags.filter((s) => s.status === 'FIXED');
  return (
    <div className="mt-4 grid gap-5 border-t border-[var(--color-rule)] pt-4">
      <section>
        <div className="flex items-baseline justify-between gap-3">
          <h3 className="m-0 text-[15px] font-semibold">Decisions for the client</h3>
          <span className={label}>{work.decisions.length} asked</span>
        </div>
        {work.decisions.length ? (
          <ul className="m-0 mt-2 flex list-none flex-col gap-1.5 p-0">
            {work.decisions.map((d) => (
              <li key={d.id} className="flex flex-wrap items-baseline justify-between gap-2 text-[14px]">
                <span>
                  {d.title} <span className="text-[var(--color-ink-3)]">· due {day(d.due)}</span>
                </span>
                <span className={d.state === 'overdue' ? 'text-[var(--color-terracotta)] text-[13px]' : 'text-[13px] text-[var(--color-ink-2)]'}>
                  {d.chosen ? `Chosen: ${d.chosen}` : STATE[d.state]}
                </span>
              </li>
            ))}
          </ul>
        ) : null}
        <DecisionForm projectId={projectId} />
      </section>

      {work.money ? <Payments projectId={projectId} money={work.money} /> : null}

      <Documents projectId={projectId} documents={work.documents} />

      <section>
        <div className="flex items-baseline justify-between gap-3">
          <h3 className="m-0 text-[15px] font-semibold">Snags</h3>
          <span className={label}>
            {open.length} open · {fixed.length} fixed
          </span>
        </div>
        <ul className="m-0 mt-2 flex list-none flex-col gap-3 p-0">
          {open.map((s) => (
            <SnagRow key={s.id} snag={s} />
          ))}
        </ul>
        <SnagForm projectId={projectId} />
        {fixed.length ? (
          <details className="mt-3">
            <summary className="cursor-pointer text-[13px] text-[var(--color-ink-2)]">Fixed ({fixed.length})</summary>
            <ul className="m-0 mt-2 flex list-none flex-col gap-1 p-0 text-[13.5px] text-[var(--color-ink-2)]">
              {fixed.map((s) => (
                <li key={s.id}>
                  {s.title}
                  {s.room ? ` · ${s.room}` : ''} · {s.line}
                </li>
              ))}
            </ul>
          </details>
        ) : null}
      </section>
    </div>
  );
}

type Row = { name: string; note: string; extra: string; swatch: string; useSwatch: boolean };
const emptyRow = (): Row => ({ name: '', note: '', extra: '', swatch: '#9fb59a', useSwatch: false });

function DecisionForm({ projectId }: { projectId: string }) {
  const { pending, message, run } = useRun();
  const [openForm, setOpenForm] = useState(false);
  const [rows, setRows] = useState<Row[]>([emptyRow(), emptyRow()]);
  const set = (i: number, patch: Partial<Row>) => setRows((all) => all.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  if (!openForm) {
    return (
      <div className="mt-3">
        <button type="button" className={ghost} onClick={() => setOpenForm(true)}>
          Ask the client to decide
        </button>
        {message ? <p className="m-0 mt-2 text-[13px] text-[var(--color-ink-2)]">{message.text}</p> : null}
      </div>
    );
  }

  return (
    <form
      className="mt-3 grid gap-2 rounded-[10px] border border-[var(--color-rule)] p-3"
      onSubmit={(e) => {
        e.preventDefault();
        const form = e.currentTarget;
        const data = new FormData(form);
        data.set('projectId', projectId);
        data.set(
          'options',
          JSON.stringify(
            rows
              .filter((r) => r.name.trim())
              .map((r) => ({
                name: r.name,
                note: r.note,
                extraPaise: Math.round((Number(r.extra.replace(/[^\d.]/g, '')) || 0) * 100),
                swatch: r.useSwatch ? r.swatch : null,
              })),
          ),
        );
        run(() => postDecisionAction(data), 'Sent. The client has it in their app now.', () => {
          form.reset();
          setRows([emptyRow(), emptyRow()]);
          setOpenForm(false);
        });
      }}
    >
      <input name="title" required maxLength={120} placeholder="What needs deciding — “Kitchen shutter finish”" className={input} />
      <textarea
        name="why"
        required
        maxLength={600}
        rows={2}
        placeholder="What happens if it waits — “Shutters are cut next week; choosing late moves carpentry by about 3 days.”"
        className={input}
      />
      <label className="flex items-center gap-2 text-[13px] text-[var(--color-ink-2)]">
        Decide by
        <input type="date" name="dueOn" required className={input} />
      </label>
      <p className={`${label} m-0 mt-1`}>Options (two or more)</p>
      {rows.map((r, i) => (
        <div key={i} className="flex flex-wrap items-center gap-2">
          <input value={r.name} onChange={(e) => set(i, { name: e.target.value })} maxLength={60} placeholder="Name — “Walnut grain”" className={`${input} min-w-[11rem] flex-1`} />
          <input value={r.note} onChange={(e) => set(i, { note: e.target.value })} maxLength={120} placeholder="One line about it" className={`${input} min-w-[11rem] flex-1`} />
          <input
            value={r.extra}
            onChange={(e) => set(i, { extra: e.target.value })}
            inputMode="decimal"
            placeholder="+₹ over quote (blank = in quote)"
            className={`${input} w-[13rem]`}
          />
          <label className="flex items-center gap-1 text-[12.5px] text-[var(--color-ink-2)]">
            <input type="checkbox" checked={r.useSwatch} onChange={(e) => set(i, { useSwatch: e.target.checked })} />
            Colour
            <input type="color" value={r.swatch} disabled={!r.useSwatch} onChange={(e) => set(i, { swatch: e.target.value })} aria-label="Swatch colour" />
          </label>
          {rows.length > 2 ? (
            <button type="button" className="text-[12.5px] text-[var(--color-ink-3)] underline" onClick={() => setRows((all) => all.filter((_, j) => j !== i))}>
              Remove
            </button>
          ) : null}
        </div>
      ))}
      <div className="flex flex-wrap gap-2">
        {rows.length < 6 ? (
          <button type="button" className={ghost} onClick={() => setRows((all) => [...all, emptyRow()])}>
            Add an option
          </button>
        ) : null}
        <button type="submit" className={primary} disabled={pending}>
          {pending ? 'Sending…' : 'Send to the client'}
        </button>
        <button type="button" className={ghost} onClick={() => setOpenForm(false)}>
          Cancel
        </button>
      </div>
      {message && !message.ok ? <p className="m-0 text-[13px] text-[var(--color-terracotta)]">{message.text}</p> : null}
    </form>
  );
}

function SnagRow({ snag }: { snag: StaffWork['snags'][number] }) {
  const { pending, message, run } = useRun();
  const [fixing, setFixing] = useState(false);
  return (
    <li className="flex gap-3 rounded-[10px] border border-[var(--color-rule)] p-3">
      {snag.photos[0] ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={snag.photos[0]} alt={snag.title} className="h-[72px] w-[72px] flex-none rounded-[8px] object-cover" />
      ) : null}
      <div className="min-w-0 flex-1">
        <p className="m-0 text-[14.5px] font-semibold">{snag.title}</p>
        <p className="m-0 mt-0.5 text-[12.5px] text-[var(--color-ink-3)]">
          {[snag.room, `raised ${day(snag.raisedAt)}`, snag.raisedByStudio ? 'by your team' : 'by the client'].filter(Boolean).join(' · ')}
        </p>
        {snag.note ? <p className="m-0 mt-1 text-[13.5px] text-[var(--color-ink-2)]">{snag.note}</p> : null}
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-2 text-[13px] text-[var(--color-ink-2)]">
            Fix by
            <input
              type="date"
              defaultValue={snag.fixBy}
              className={input}
              onChange={(e) => e.target.value && run(() => snagFixByAction(snag.id, e.target.value), 'Date set. The client can see it.')}
            />
          </label>
          {!fixing ? (
            <button type="button" className={ghost} onClick={() => setFixing(true)}>
              Mark fixed
            </button>
          ) : null}
        </div>
        {fixing ? (
          <form
            className="mt-2 flex flex-wrap items-center gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              const data = new FormData(e.currentTarget);
              data.set('snagId', snag.id);
              run(async () => fixSnagAction(await withShrunkPhotos(data)), 'Marked fixed. The client has been told.', () => setFixing(false));
            }}
          >
            <input name="note" maxLength={600} placeholder="What was done — “Panel replaced”" className={`${input} min-w-[14rem] flex-1`} />
            <input type="file" name="photos" accept="image/jpeg,image/png,image/webp" className="text-[12.5px]" aria-label="Photo of the fix" />
            <button type="submit" className={primary} disabled={pending}>
              {pending ? 'Saving…' : 'Fixed'}
            </button>
          </form>
        ) : null}
        {message ? (
          <p className={`m-0 mt-1 text-[12.5px] ${message.ok ? 'text-[var(--color-ink-2)]' : 'text-[var(--color-terracotta)]'}`}>{message.text}</p>
        ) : null}
      </div>
    </li>
  );
}

function SnagForm({ projectId }: { projectId: string }) {
  const { pending, message, run } = useRun();
  return (
    <form
      className="mt-3 flex flex-wrap items-end gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        const form = e.currentTarget;
        const data = new FormData(form);
        data.set('projectId', projectId);
        run(async () => raiseSnagAction(await withShrunkPhotos(data)), 'Logged. The client can see it on their snag list.', () => form.reset());
      }}
    >
      <input name="title" required maxLength={120} placeholder="Log a snag — “Switchboard not level”" className={`${input} min-w-[14rem] flex-1`} />
      <input name="room" maxLength={40} placeholder="Room" className={`${input} w-[9rem]`} />
      <input type="file" name="photos" accept="image/jpeg,image/png,image/webp" multiple className="text-[12.5px]" aria-label="Snag photos" />
      <button type="submit" className={ghost} disabled={pending}>
        {pending ? 'Logging…' : 'Log snag'}
      </button>
      {message ? (
        <p className={`m-0 basis-full text-[12.5px] ${message.ok ? 'text-[var(--color-ink-2)]' : 'text-[var(--color-terracotta)]'}`}>{message.text}</p>
      ) : null}
    </form>
  );
}

function Documents({ projectId, documents }: { projectId: string; documents: StaffWork['documents'] }) {
  const { pending, message, run } = useRun();
  return (
    <section>
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="m-0 text-[15px] font-semibold">Documents in the client&rsquo;s Locker</h3>
        <span className={label}>{documents.length} filed</span>
      </div>
      {documents.length ? (
        <ul className="m-0 mt-2 flex list-none flex-col gap-1.5 p-0">
          {documents.map((d) => (
            <li key={d.id} className="flex flex-wrap items-baseline justify-between gap-2 text-[14px]">
              <span>
                {d.url ? (
                  <a href={d.url} target="_blank" rel="noreferrer" className="underline">
                    {d.title}
                  </a>
                ) : (
                  d.title
                )}{' '}
                <span className="text-[12.5px] text-[var(--color-ink-3)]">
                  · {DOC_KINDS[d.kind]} · {d.meta}
                </span>
              </span>
              <button
                type="button"
                className="text-[12.5px] text-[var(--color-ink-3)] underline disabled:opacity-40"
                disabled={pending}
                onClick={() => run(() => removeDocumentAction(d.id), 'Removed from the Locker.')}
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      <form
        className="mt-3 flex flex-wrap items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          const form = e.currentTarget;
          const data = new FormData(form);
          data.set('projectId', projectId);
          run(() => addDocumentAction(data), 'Filed. The client can open it in their Locker now.', () => form.reset());
        }}
      >
        <select name="kind" required defaultValue="" className={input} aria-label="Kind of document">
          <option value="" disabled>
            Kind of document
          </option>
          {Object.entries(DOC_KINDS).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
        <input name="title" maxLength={100} placeholder="Title (optional) — “Kitchen drawings, rev 2”" className={`${input} min-w-[14rem] flex-1`} />
        <input type="file" name="file" required accept="application/pdf,image/jpeg,image/png,image/webp" className="text-[12.5px]" aria-label="The file" />
        <button type="submit" className={ghost} disabled={pending}>
          {pending ? 'Uploading…' : 'File it'}
        </button>
        {message ? (
          <p className={`m-0 basis-full text-[12.5px] ${message.ok ? 'text-[var(--color-ink-2)]' : 'text-[var(--color-terracotta)]'}`}>{message.text}</p>
        ) : null}
      </form>
    </section>
  );
}

/**
 * The payment stages the customer signed, in rupees. Set when each is due —
 * the customer is reminded two days before — and mark it received once paid.
 * The customer pays the studio directly; this is the record they see.
 */
function Payments({ projectId, money }: { projectId: string; money: NonNullable<StaffWork['money']> }) {
  const { pending, message, run } = useRun();
  const today = new Date().toISOString().slice(0, 10);
  return (
    <section>
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="m-0 text-[15px] font-semibold">Payments</h3>
        <span className={label}>
          {formatINR(money.paidPaise)} of {formatINR(money.contractPaise)} received
        </span>
      </div>
      <ul className="m-0 mt-2 flex list-none flex-col gap-2 p-0">
        {money.stages.map((s) => (
          <li key={s.index} className="flex flex-wrap items-center justify-between gap-2 text-[14px]">
            <span>
              {s.label} · {formatINR(s.amountPaise)}
              {s.paidOn ? <span className="text-[var(--color-ink-3)]"> · received {s.paidOn}</span> : null}
            </span>
            <span className="flex flex-wrap items-center gap-2">
              {!s.paidOn ? (
                <label className="flex items-center gap-1.5 text-[13px] text-[var(--color-ink-2)]">
                  Due
                  <input
                    type="date"
                    className={input}
                    defaultValue={s.dueOn ?? ''}
                    disabled={pending}
                    onChange={(e) => run(() => paymentStageAction(projectId, s.index, 'dueOn', e.target.value), 'Due date saved')}
                  />
                </label>
              ) : null}
              <button
                type="button"
                className={s.paidOn ? ghost : primary}
                disabled={pending}
                onClick={() =>
                  run(
                    () => paymentStageAction(projectId, s.index, 'paidOn', s.paidOn ? '' : today),
                    s.paidOn ? 'Marked not received' : 'Marked received; the client is told',
                  )
                }
              >
                {s.paidOn ? 'Undo' : 'Mark received'}
              </button>
            </span>
          </li>
        ))}
      </ul>
      {message ? (
        <p className={`m-0 mt-2 text-[13px] ${message.ok ? 'text-[var(--color-ink-2)]' : 'text-[var(--color-terracotta)]'}`}>{message.text}</p>
      ) : null}
    </section>
  );
}
