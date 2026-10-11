'use client';

/**
 * The lead page's working parts (Studio OS Phase 1): the next-step button,
 * details, a note, the meeting, files, quotations, the booking, and who has
 * the lead. Each part is one small form with one obvious button and says
 * what happened right under it. Nothing here moves a lead by itself.
 */

import Link from 'next/link';
import { useRef, useState } from 'react';
import { formatINR } from '@/lib/money';
import { SOURCE_LABELS, type ClientSourceName } from '@/modules/studio-practice/vocabulary';
import { LEAD_FILE_ACCEPT, checkLeadFile, fileSize, meetingInputs, budgetInput, type NextStep } from '@/modules/studio-sales/lead-rules';
import type { LeadFileView, LeadQuoteView } from '@/modules/studio-sales/leads';
import type { LeadBooking, BookingDraft } from '@/modules/studio-sales/booking';
import {
  addNoteAction,
  assignLeadsAction,
  attachFileAction,
  editLeadAction,
  newQuoteForLeadAction,
  readRoomsAction,
  recordBookingAction,
  refundBookingAction,
  removeFileAction,
  setMeetingAction,
} from '../../sales-actions';
import { Said, useAct, inputClass, primaryClass, quietClass } from '../../SalesUi';

const box = 'rounded-[12px] border border-[var(--s-rule)] px-4 py-3.5';
const h2 = 'm-0 mb-2 text-[15px] font-semibold';

// ── The next step ──────────────────────────────────────────────

export function NextStepButton({
  step,
  clientId,
  phone,
  quoteId,
  projectId,
  mayBook,
}: {
  step: NextStep;
  clientId: string;
  phone: string | null;
  quoteId: string | null;
  projectId: string | null;
  mayBook: boolean;
}) {
  const { pending, result, run } = useAct();
  let control: React.ReactNode;
  switch (step.id) {
    case 'call':
      control = phone ? (
        <a href={phone} className={primaryClass}>
          {step.label}
        </a>
      ) : (
        <a href="#contact" className={primaryClass}>
          Log a contact
        </a>
      );
      break;
    case 'floor-plan':
      control = (
        <a href="#files" className={primaryClass}>
          {step.label}
        </a>
      );
      break;
    case 'quote':
      control = (
        <button type="button" disabled={pending} onClick={() => run(() => newQuoteForLeadAction(clientId))} className={primaryClass}>
          {pending ? 'Starting…' : step.label}
        </button>
      );
      break;
    case 'open-quote':
      control = quoteId ? (
        <Link href={`/studio/quotations/${quoteId}`} className={primaryClass}>
          {step.label}
        </Link>
      ) : null;
      break;
    case 'sales-final':
      control = quoteId ? (
        <Link href={`/studio/quotations/${quoteId}#revisions`} className={primaryClass}>
          {step.label}
        </Link>
      ) : null;
      break;
    case 'booking':
      control = mayBook ? (
        <a href="#booking" className={primaryClass}>
          {step.label}
        </a>
      ) : (
        <span className="text-[13.5px] text-[var(--s-ink-2)]">Waiting for accounts to record the booking</span>
      );
      break;
    case 'booked':
      control = projectId ? (
        <Link href={`/studio/projects/${projectId}`} className={primaryClass}>
          {step.label}
        </Link>
      ) : (
        <span className="s-tag !bg-[var(--s-good-wash)] !text-[var(--s-good)]">Booked</span>
      );
      break;
  }
  return (
    <div className="flex flex-col items-end">
      {control}
      <Said result={result} />
    </div>
  );
}

// ── Talk to them ───────────────────────────────────────────────

export function ContactBar({ tel, whatsapp, budget, meeting, source, owner }: { tel: string | null; whatsapp: string | null; budget: string; meeting: string | null; source: string; owner: string | null }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {tel ? (
        <a href={tel} className={quietClass}>
          Call
        </a>
      ) : null}
      {whatsapp ? (
        <a href={whatsapp} target="_blank" rel="noreferrer" className={quietClass} title="Opens your own WhatsApp with a chat to them. We send nothing.">
          Open WhatsApp
        </a>
      ) : null}
      <span className="s-tag">{source}</span>
      <span className="s-tag">{owner ? `With ${owner}` : 'In the pool'}</span>
      {budget ? <span className="s-tag">Budget {budget}</span> : null}
      {meeting ? <span className="s-tag !bg-[var(--s-accent-wash)] !text-[var(--s-accent-deep)]">Meeting {meeting}</span> : null}
    </div>
  );
}

// ── Details ────────────────────────────────────────────────────

export interface DetailValues {
  name: string;
  phone: string;
  email: string;
  society: string;
  config: string;
  budgetPaise: number | null;
  source: string;
  leadSourceId: string | null;
  carpetSqft: number | null;
  locality: string | null;
}

export function Details({ clientId, v, sources, may, fromOneInteriors }: { clientId: string; v: DetailValues; sources: { id: string; name: string }[]; may: boolean; fromOneInteriors: boolean }) {
  const [editing, setEditing] = useState(false);
  const [askDup, setAskDup] = useState<string | null>(null);
  const { pending, result, setResult, run } = useAct();
  const form = useRef<HTMLFormElement>(null);

  const rows: [string, string | null][] = [
    ['Phone', v.phone || null],
    ['Email', v.email || null],
    ['Society', v.society || v.locality],
    ['BHK', v.config || null],
    ['Carpet area', v.carpetSqft ? `${v.carpetSqft.toLocaleString('en-IN')} sq ft` : null],
    ['Budget', v.budgetPaise ? formatINR(v.budgetPaise) : null],
  ];

  function save(force: boolean) {
    const f = new FormData(form.current!);
    const get = (k: string) => String(f.get(k) ?? '');
    run(
      async () => {
        const r = await editLeadAction({
          clientId,
          name: get('name'),
          phone: get('phone'),
          email: get('email'),
          society: get('society'),
          config: get('config'),
          budget: get('budget'),
          source: get('source'),
          force,
        });
        if (!r.ok && 'duplicateOf' in r) {
          setAskDup(r.error);
          return { ok: false, error: r.error };
        }
        return r.ok ? { ok: true, message: 'Saved.' } : r;
      },
      (r) => {
        if (r.ok) {
          setEditing(false);
          setAskDup(null);
        }
      },
    );
  }

  if (!editing) {
    return (
      <section className={box}>
        <div className="mb-2 flex items-baseline justify-between gap-3">
          <h2 className="s-label m-0 text-[var(--s-ink-3)]">Details</h2>
          {may ? (
            <button type="button" onClick={() => { setEditing(true); setResult(null); }} className="text-[13px] text-[var(--s-accent)]">
              Edit
            </button>
          ) : null}
        </div>
        <dl className="m-0 flex flex-col gap-2">
          {rows.map(([label, value]) => (
            <div key={label} className="flex items-baseline justify-between gap-3">
              <dt className="flex-none text-[12.5px] text-[var(--s-ink-3)]">{label}</dt>
              <dd className="m-0 min-w-0 text-right text-[13.5px]">{value ?? <span className="text-[var(--s-ink-3)]">—</span>}</dd>
            </div>
          ))}
        </dl>
        <Said result={result} />
      </section>
    );
  }

  const sourceValue = v.leadSourceId ? `own:${v.leadSourceId}` : v.source;
  return (
    <section className={box}>
      <h2 className={h2}>Edit details</h2>
      <form
        ref={form}
        onSubmit={(e) => {
          e.preventDefault();
          save(false);
        }}
        className="flex flex-col gap-2.5"
      >
        <Field label="Name">
          <input name="name" defaultValue={v.name} required className={inputClass} />
        </Field>
        <Field label="Phone">
          <input name="phone" defaultValue={v.phone} inputMode="tel" className={inputClass} />
        </Field>
        <Field label="Email">
          <input name="email" defaultValue={v.email} type="email" className={inputClass} />
        </Field>
        <Field label="Society">
          <input name="society" defaultValue={v.society} className={inputClass} />
        </Field>
        <Field label="BHK">
          <input name="config" defaultValue={v.config} placeholder="3 BHK" className={inputClass} />
        </Field>
        <Field label="Budget">
          <input name="budget" defaultValue={budgetInput(v.budgetPaise)} placeholder="12 lakh" className={inputClass} />
        </Field>
        <Field label="Where from">
          {fromOneInteriors ? (
            <>
              <input type="hidden" name="source" value="ONE_INTERIORS" />
              <span className="text-[13.5px]">One Interiors</span>
            </>
          ) : (
            <select name="source" defaultValue={sourceValue} className={inputClass}>
              {(Object.keys(SOURCE_LABELS) as ClientSourceName[])
                .filter((s) => s !== 'ONE_INTERIORS')
                .map((s) => (
                  <option key={s} value={s}>
                    {SOURCE_LABELS[s]}
                  </option>
                ))}
              {sources.map((s) => (
                <option key={s.id} value={`own:${s.id}`}>
                  {s.name}
                </option>
              ))}
            </select>
          )}
        </Field>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <button type="submit" disabled={pending} className={primaryClass}>
            {pending ? 'Saving…' : 'Save'}
          </button>
          <button type="button" onClick={() => { setEditing(false); setAskDup(null); }} className={quietClass}>
            Cancel
          </button>
        </div>
        {askDup ? (
          <div role="alert" className="flex flex-col gap-2 text-[13px]">
            <p className="m-0 text-[var(--s-bad)]">{askDup}</p>
            <button type="button" disabled={pending} onClick={() => save(true)} className={quietClass}>
              Different person — save anyway
            </button>
          </div>
        ) : (
          <Said result={result} />
        )}
      </form>
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="s-label">{label}</span>
      {children}
    </label>
  );
}

// ── A note ─────────────────────────────────────────────────────

export function NoteBox({ clientId }: { clientId: string }) {
  const [note, setNote] = useState('');
  const { pending, result, run } = useAct();
  return (
    <section className={box}>
      <h2 className={h2}>Add a note</h2>
      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        rows={2}
        placeholder="What was said, what they want, anything worth remembering"
        className={`${inputClass} resize-y`}
      />
      <div className="mt-2">
        <button type="button" disabled={pending || note.trim().length === 0} onClick={() => run(() => addNoteAction(clientId, note), (r) => r.ok && setNote(''))} className={quietClass}>
          {pending ? 'Saving…' : 'Add to the history'}
        </button>
      </div>
      <Said result={result} />
    </section>
  );
}

// ── The meeting ────────────────────────────────────────────────

export function MeetingBox({ clientId, at, note, may }: { clientId: string; at: string | null; note: string | null; may: boolean }) {
  const [day0, time0] = meetingInputs(at ? new Date(at) : null);
  const [day, setDay] = useState(day0);
  const [time, setTime] = useState(time0 || '11:00');
  const [words, setWords] = useState(note ?? '');
  const { pending, result, run } = useAct();
  if (!may) return null;
  return (
    <section className={box}>
      <h2 className={h2}>Meeting</h2>
      <div className="flex flex-wrap gap-2">
        <input type="date" aria-label="Meeting day" value={day} onChange={(e) => setDay(e.target.value)} className={`${inputClass} w-auto`} />
        <input type="time" aria-label="Meeting time" value={time} onChange={(e) => setTime(e.target.value)} className={`${inputClass} w-auto`} />
      </div>
      <input value={words} onChange={(e) => setWords(e.target.value)} placeholder="Office meeting, site visit…" className={`${inputClass} mt-2`} />
      <div className="mt-2 flex flex-wrap gap-2">
        <button type="button" disabled={pending || !day} onClick={() => run(() => setMeetingAction(clientId, day, time, words))} className={quietClass}>
          {pending ? 'Saving…' : 'Save meeting'}
        </button>
        {at ? (
          <button type="button" disabled={pending} onClick={() => run(() => setMeetingAction(clientId, '', '', ''), (r) => r.ok && setDay(''))} className="text-[13px] text-[var(--s-ink-3)] hover:text-[var(--s-ink)]">
            Clear
          </button>
        ) : null}
      </div>
      <Said result={result} />
    </section>
  );
}

// ── Who has it ─────────────────────────────────────────────────

export function AssignBox({ clientId, assignedToId, members }: { clientId: string; assignedToId: string | null; members: { id: string; name: string }[] }) {
  const [to, setTo] = useState(assignedToId ?? '');
  const { pending, result, run } = useAct();
  return (
    <section className={box}>
      <h2 className={h2}>Who has this lead</h2>
      <div className="flex flex-wrap gap-2">
        <select aria-label="Give this lead to" value={to} onChange={(e) => setTo(e.target.value)} className={`${inputClass} w-auto min-w-[10rem]`}>
          <option value="">Nobody (the pool)</option>
          {members.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </select>
        <button type="button" disabled={pending || to === (assignedToId ?? '')} onClick={() => run(() => assignLeadsAction([clientId], to || null))} className={quietClass}>
          {pending ? 'Saving…' : 'Assign'}
        </button>
      </div>
      <Said result={result} />
    </section>
  );
}

// ── Files ──────────────────────────────────────────────────────

export function FilesBox({ clientId, files, may, mayReadRooms }: { clientId: string; files: LeadFileView[]; may: boolean; mayReadRooms: boolean }) {
  const [kind, setKind] = useState<'FLOOR_PLAN' | 'OTHER'>(files.some((f) => f.kind === 'FLOOR_PLAN') ? 'OTHER' : 'FLOOR_PLAN');
  const [over, setOver] = useState(false);
  const [busy, setBusy] = useState(false);
  const [said, setSaid] = useState<{ ok: boolean; message?: string; error?: string } | null>(null);
  const picker = useRef<HTMLInputElement>(null);
  const act = useAct();

  async function upload(file: File) {
    setSaid(null);
    const type = file.type || (file.name.toLowerCase().endsWith('.pdf') ? 'application/pdf' : '');
    const check = checkLeadFile(type, file.size);
    if (!check.ok) {
      setSaid({ ok: false, error: check.error });
      return;
    }
    setBusy(true);
    try {
      const res = await fetch('/api/studio/leads/upload', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ clientId, contentType: type, bytes: file.size }),
      });
      const ticket = (await res.json().catch(() => null)) as { ok: boolean; path?: string; url?: string | null; error?: string } | null;
      if (!ticket?.ok || !ticket.path) {
        setSaid({ ok: false, error: ticket?.error ?? 'We could not start the upload. Try again.' });
        return;
      }
      if (ticket.url) {
        const put = await fetch(ticket.url, { method: 'PUT', headers: { 'content-type': type, 'x-upsert': 'false' }, body: file });
        if (!put.ok) {
          setSaid({ ok: false, error: 'The upload did not finish. Check your connection and try again.' });
          return;
        }
      }
      act.run(() => attachFileAction({ clientId, path: ticket.path!, name: file.name, contentType: type, bytes: file.size, kind }));
    } catch {
      setSaid({ ok: false, error: 'The upload did not finish. Check your connection and try again.' });
    } finally {
      setBusy(false);
      if (picker.current) picker.current.value = '';
    }
  }

  return (
    <section id="files" className={`${box} scroll-mt-20`}>
      <h2 className={h2}>Floor plan and files</h2>
      {may ? (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setOver(true);
          }}
          onDragLeave={() => setOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setOver(false);
            const f = e.dataTransfer.files?.[0];
            if (f) void upload(f);
          }}
          className={`flex flex-col gap-2.5 rounded-[10px] border border-dashed px-4 py-4 ${over ? 'border-[var(--s-accent)] bg-[var(--s-accent-wash)]' : 'border-[var(--s-rule)]'}`}
        >
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[13px] text-[var(--s-ink-2)]">This is a</span>
            <select aria-label="What the file is" value={kind} onChange={(e) => setKind(e.target.value as 'FLOOR_PLAN' | 'OTHER')} className={`${inputClass} w-auto py-1.5 text-[13px]`}>
              <option value="FLOOR_PLAN">Floor plan</option>
              <option value="OTHER">Other file</option>
            </select>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button type="button" disabled={busy || act.pending} onClick={() => picker.current?.click()} className={primaryClass}>
              {busy || act.pending ? 'Attaching…' : 'Choose a file'}
            </button>
            <span className="text-[12.5px] text-[var(--s-ink-3)]">or drag it here · PDF or photo, up to 15 MB</span>
          </div>
          <input
            ref={picker}
            type="file"
            accept={LEAD_FILE_ACCEPT}
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void upload(f);
            }}
          />
        </div>
      ) : null}
      <Said result={said ?? act.result} />
      {files.length === 0 ? (
        <p className="m-0 mt-3 text-[13.5px] text-[var(--s-ink-3)]">Nothing attached yet. Ask for the floor plan on WhatsApp, then attach it here.</p>
      ) : (
        <ul className="m-0 mt-3 flex list-none flex-col gap-2 p-0">
          {files.map((f) => (
            <FileRow key={f.id} clientId={clientId} f={f} may={may} mayReadRooms={mayReadRooms} />
          ))}
        </ul>
      )}
    </section>
  );
}

function FileRow({ clientId, f, may, mayReadRooms }: { clientId: string; f: LeadFileView; may: boolean; mayReadRooms: boolean }) {
  const [sure, setSure] = useState(false);
  const { pending, result, run } = useAct();
  const readable = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'].includes(f.contentType);
  return (
    <li className="flex flex-col gap-1 rounded-[10px] bg-[var(--s-surface-2)] px-3 py-2.5">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="s-tag">{f.kind === 'FLOOR_PLAN' ? 'Floor plan' : 'File'}</span>
        {f.url ? (
          <a href={f.url} target="_blank" rel="noreferrer" className="min-w-0 flex-1 truncate text-[13.5px] font-medium text-[var(--s-accent)]">
            {f.name}
          </a>
        ) : (
          <span className="min-w-0 flex-1 truncate text-[13.5px] font-medium">{f.name}</span>
        )}
        <span className="text-[12px] text-[var(--s-ink-3)]">
          {fileSize(f.bytes)} · {new Date(f.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
          {f.uploadedByName ? ` · ${f.uploadedByName}` : ''}
        </span>
      </div>
      {may ? (
        <div className="flex flex-wrap items-center gap-3 text-[12.5px]">
          {f.roomsRead !== null ? <span className="text-[var(--s-good)]">{f.roomsRead} rooms read</span> : null}
          {mayReadRooms && readable && f.roomsRead === null ? (
            <button type="button" disabled={pending} onClick={() => run(() => readRoomsAction(clientId, f.id))} className="text-[var(--s-accent)]" title="Optional: the floor-plan reader fills the next quotation's rooms">
              {pending ? 'Reading…' : 'Read rooms'}
            </button>
          ) : null}
          {sure ? (
            <>
              <button type="button" disabled={pending} onClick={() => run(() => removeFileAction(clientId, f.id))} className="text-[var(--s-bad)]">
                Yes, remove it
              </button>
              <button type="button" onClick={() => setSure(false)} className="text-[var(--s-ink-3)]">
                Keep
              </button>
            </>
          ) : (
            <button type="button" onClick={() => setSure(true)} className="text-[var(--s-ink-3)] hover:text-[var(--s-bad)]">
              Remove
            </button>
          )}
        </div>
      ) : null}
      <Said result={result} />
    </li>
  );
}

// ── Quotations ─────────────────────────────────────────────────

export function QuotesBox({ clientId, quotes, mayQuote, fromOneInteriors }: { clientId: string; quotes: LeadQuoteView[]; mayQuote: boolean; fromOneInteriors: boolean }) {
  const { pending, result, run } = useAct();
  return (
    <section id="quotes" className={`${box} scroll-mt-20`}>
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-3">
        <h2 className="m-0 text-[15px] font-semibold">Quotations</h2>
        {mayQuote && !fromOneInteriors ? (
          <button type="button" disabled={pending} onClick={() => run(() => newQuoteForLeadAction(clientId))} className={quietClass}>
            {pending ? 'Starting…' : '+ New quotation'}
          </button>
        ) : null}
      </div>
      <Said result={result} />
      {quotes.length === 0 ? (
        <p className="m-0 text-[13.5px] text-[var(--s-ink-3)]">No quotation yet. It starts filled in from this lead.</p>
      ) : (
        <ul className="m-0 flex list-none flex-col gap-2 p-0">
          {quotes.map((q) => (
            <li key={q.id} className="rounded-[10px] bg-[var(--s-surface-2)] px-3 py-2.5">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <Link href={`/studio/quotations/${q.id}`} className="s-num text-[14px] font-medium text-[var(--s-accent)]">
                  {q.number}
                </Link>
                <span className="text-[12.5px] text-[var(--s-ink-3)]">{q.status === 'DRAFT' ? 'Draft, not sent' : q.status === 'ISSUED' ? 'Sent' : q.status === 'ACCEPTED' ? 'Won' : 'Lost'}</span>
                {q.salesFinal ? <span className="s-tag !bg-[var(--s-good-wash)] !text-[var(--s-good)]">Sales final {q.salesFinal}</span> : null}
                {q.totalPaise !== null ? <span className="s-num ml-auto text-[13px] font-semibold">{formatINR(q.totalPaise)}</span> : null}
              </div>
              {q.revisions.length > 0 ? (
                <p className="m-0 mt-1 text-[12.5px] text-[var(--s-ink-2)]">
                  {q.revisions.map((r) => `${r.label}${r.isSalesFinal ? ' (sales final)' : ''} sent ${new Date(r.sentAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}`).join(' · ')}
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

// ── The booking ────────────────────────────────────────────────

export function BookingBox({
  clientId,
  booking,
  draft,
  mayRefund,
  isOwner,
  seesProject,
}: {
  clientId: string;
  booking: LeadBooking | null;
  draft: BookingDraft | null;
  mayRefund: boolean;
  isOwner: boolean;
  seesProject: boolean;
}) {
  if (booking && !booking.cancelled) {
    return (
      <section id="booking" className={`${box} scroll-mt-20 border-l-[3px] !border-l-[var(--s-good)]`}>
        <h2 className={h2}>Booked</h2>
        <p className="m-0 text-[13.5px] leading-relaxed">
          {formatINR(booking.advancePaise)} received, booked {new Date(booking.bookedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}. The client has the app.
        </p>
        {booking.payments.length > 0 ? (
          <ol className="m-0 mt-2 flex list-none flex-col gap-1 p-0 text-[13px]">
            {booking.payments.map((p, i) => (
              <li key={i} className="flex justify-between gap-3">
                <span>{p.label}</span>
                <span className="s-num">{formatINR(p.amountPaise)}</span>
              </li>
            ))}
          </ol>
        ) : null}
        {seesProject ? (
          <Link href={`/studio/projects/${booking.projectId}`} className={`${quietClass} mt-3 inline-block`}>
            Open the project
          </Link>
        ) : null}
        {mayRefund ? <Refund clientId={clientId} booking={booking} isOwner={isOwner} /> : null}
      </section>
    );
  }
  if (!draft) return null;
  return <RecordBooking draft={draft} cancelledBefore={booking?.cancelled === true} />;
}

function RecordBooking({ draft, cancelledBefore }: { draft: BookingDraft; cancelledBefore: boolean }) {
  const [amount, setAmount] = useState(String(Math.round(draft.bookingPaise / 100)));
  const [day, setDay] = useState(draft.today);
  const [mode, setMode] = useState('UPI');
  const [ref, setRef] = useState('');
  const [name, setName] = useState(draft.customer.name);
  const [phone, setPhone] = useState(draft.customer.phone);
  const [email, setEmail] = useState(draft.customer.email);
  const { pending, result, run } = useAct();
  return (
    <section id="booking" className={`${box} scroll-mt-20 border-l-[3px] !border-l-[var(--s-accent)]`}>
      <h2 className={h2}>Record booking</h2>
      <p className="m-0 mb-3 text-[13px] leading-relaxed text-[var(--s-ink-2)]">
        On {draft.revision} of {draft.number} ({formatINR(draft.totalPaise)}), the sales final. Refundable for {draft.refundDays} days. This opens the project, records the
        payment and invites the client to the app by SMS or email.{cancelledBefore ? ' An earlier booking on this lead was refunded.' : ''}
      </p>
      {draft.blocked ? (
        <p role="alert" className="m-0 text-[13px] text-[var(--s-bad)]">
          {draft.blocked}
        </p>
      ) : (
        <div className="flex flex-col gap-2.5">
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            <Field label="Amount received (₹)">
              <input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="numeric" className={`${inputClass} s-num`} />
            </Field>
            <Field label="Day it arrived">
              <input type="date" value={day} max={draft.today} onChange={(e) => setDay(e.target.value)} className={inputClass} />
            </Field>
            <Field label="How it was paid">
              <select value={mode} onChange={(e) => setMode(e.target.value)} className={inputClass}>
                <option value="UPI">UPI</option>
                <option value="BANK">Bank transfer</option>
                <option value="CASH">Cash</option>
                <option value="CHEQUE">Cheque</option>
              </select>
            </Field>
            <Field label="Reference (optional)">
              <input value={ref} onChange={(e) => setRef(e.target.value)} placeholder="UTR or cheque number" className={inputClass} />
            </Field>
            <Field label="Client's name">
              <input value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
            </Field>
            <Field label="Client's mobile (they sign in with it)">
              <input value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" className={inputClass} />
            </Field>
            <Field label="Client's email (optional)">
              <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" className={inputClass} />
            </Field>
          </div>
          <div>
            <button
              type="button"
              disabled={pending}
              onClick={() =>
                run(() =>
                  recordBookingAction({ quoteId: draft.quoteId, amount, receivedOn: day, mode, reference: ref, customerName: name, customerPhone: phone, customerEmail: email }),
                )
              }
              className={primaryClass}
            >
              {pending ? 'Recording…' : `Record ${amount ? `₹${Number(amount.replace(/,/g, '')).toLocaleString('en-IN')}` : 'the booking'}`}
            </button>
          </div>
        </div>
      )}
      <Said result={result} />
    </section>
  );
}

export function Refund({ clientId, booking, isOwner }: { clientId: string; booking: LeadBooking; isOwner: boolean }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [askLate, setAskLate] = useState<string | null>(null);
  const { pending, result, run } = useAct();
  const late = booking.daysLeft < 0;
  if (late && !isOwner) {
    return <p className="m-0 mt-3 text-[12.5px] text-[var(--s-ink-3)]">The {booking.refundDays}-day refund window has passed. Only the owner can refund it now.</p>;
  }
  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="mt-3 block text-[13px] text-[var(--s-ink-3)] underline hover:text-[var(--s-bad)]">
        Refund booking{late ? '' : ` (${Math.max(0, booking.daysLeft)} day${booking.daysLeft === 1 ? '' : 's'} left)`}
      </button>
    );
  }
  return (
    <div className="mt-3 flex flex-col gap-2 border-t border-[var(--s-rule-soft)] pt-3">
      <p className="m-0 text-[13px] leading-relaxed text-[var(--s-ink-2)]">
        The refund is recorded against the payment, the project is marked cancelled (kept, not deleted) and the lead goes back to its column.
      </p>
      <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Why (optional)" className={inputClass} />
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            run(async () => {
              const r = await refundBookingAction(clientId, reason, askLate !== null);
              if (!r.ok && r.askLate) {
                setAskLate(r.error);
                return { ok: false, error: r.error };
              }
              return r.ok ? { ok: true, message: 'Refunded. The project is cancelled and the lead is back in its column.' } : r;
            })
          }
          className={`${quietClass} !border-[var(--s-bad)] !text-[var(--s-bad)]`}
        >
          {pending ? 'Refunding…' : askLate ? 'Refund anyway' : 'Yes, refund the booking'}
        </button>
        <button type="button" onClick={() => setOpen(false)} className={quietClass}>
          Keep the booking
        </button>
      </div>
      <Said result={result} />
    </div>
  );
}
