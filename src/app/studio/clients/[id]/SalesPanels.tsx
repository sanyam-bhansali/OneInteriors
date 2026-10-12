'use client';

/**
 * The lead page's working parts (Studio OS Phase 1): the next-step button,
 * details, a note, the meeting, files, quotations, the booking, and who has
 * the lead. Each part is one small form with one obvious button and says
 * what happened right under it. Nothing here moves a lead by itself.
 */

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
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
  recordBookingAction,
  refundBookingAction,
  removeFileAction,
  setMeetingAction,
} from '../../sales-actions';
import { Said, useAct } from '../../SalesUi';

/* The design's field and buttons (studio-ui.css). */
const inputClass = 'fld';
const primaryClass = 'btn pri sm';
const quietClass = 'btn sec sm';
import { buildFromPlanAction, planJobsAction } from '../../quotations/actions';
import type { PlanJobView } from '@/modules/studio-quote/from-plan-rules';

const box = 'card';
const h2 = 'h';
const h2Style: React.CSSProperties = { margin: 0, fontSize: 17, fontWeight: 600, letterSpacing: '-.01em' };

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
        <span className="muted sm">Waiting for accounts to record the booking</span>
      );
      break;
    case 'booked':
      control = projectId ? (
        <Link href={`/studio/projects/${projectId}`} className={primaryClass}>
          {step.label}
        </Link>
      ) : (
        <span className="chip good">Booked</span>
      );
      break;
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 6 }}>
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
      <span className="chip">{source}</span>
      <span className="chip">{owner ? `With ${owner}` : 'In the pool'}</span>
      {budget ? <span className="chip">Budget {budget}</span> : null}
      {meeting ? <span className="chip oi">Meeting {meeting}</span> : null}
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
        <div className="chead">
          <h2 style={h2Style}>Details</h2>
          {may ? (
            <button type="button" onClick={() => { setEditing(true); setResult(null); }} className="btn ghost sm">
              Edit
            </button>
          ) : null}
        </div>
        <dl className="kv">
          {rows.map(([label, value]) => (
            <div key={label} style={{ display: 'contents' }}>
              <dt>{label}</dt>
              <dd>{value ?? <span className="muted">—</span>}</dd>
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
      <h2 className={h2} style={h2Style}>Edit details</h2>
      <form
        ref={form}
        onSubmit={(e) => {
          e.preventDefault();
          save(false);
        }}
        style={{ display: 'flex', flexDirection: 'column', gap: 10 }}
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
              <span>One Interiors</span>
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
        <div className="hstack" style={{ gap: 8 }}>
          <button type="submit" disabled={pending} className={primaryClass}>
            {pending ? 'Saving…' : 'Save'}
          </button>
          <button type="button" onClick={() => { setEditing(false); setAskDup(null); }} className={quietClass}>
            Cancel
          </button>
        </div>
        {askDup ? (
          <div role="alert" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <p className="cl-err">{askDup}</p>
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
    <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <span className="lbl">{label}</span>
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
      <h2 className={h2} style={h2Style}>Add a note</h2>
      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        rows={2}
        placeholder="What was said, what they want, anything worth remembering"
        className="fld"
      />
      <div>
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
      <h2 className={h2} style={h2Style}>Meeting</h2>
      <div className="hstack" style={{ gap: 8 }}>
        <input type="date" aria-label="Meeting day" value={day} onChange={(e) => setDay(e.target.value)} className="fld" style={{ width: 'auto' }} />
        <input type="time" aria-label="Meeting time" value={time} onChange={(e) => setTime(e.target.value)} className="fld" style={{ width: 'auto' }} />
      </div>
      <input value={words} onChange={(e) => setWords(e.target.value)} placeholder="Office meeting, site visit…" className="fld" />
      <div className="hstack" style={{ gap: 8 }}>
        <button type="button" disabled={pending || !day} onClick={() => run(() => setMeetingAction(clientId, day, time, words))} className={quietClass}>
          {pending ? 'Saving…' : 'Save meeting'}
        </button>
        {at ? (
          <button type="button" disabled={pending} onClick={() => run(() => setMeetingAction(clientId, '', '', ''), (r) => r.ok && setDay(''))} className="btn ghost sm">
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
      <h2 className={h2} style={h2Style}>Who has this lead</h2>
      <div className="hstack" style={{ gap: 8 }}>
        <select aria-label="Give this lead to" value={to} onChange={(e) => setTo(e.target.value)} className="fld" style={{ width: 'auto', minWidth: '10rem' }}>
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

/** The floor plan types the reader takes (floorplan/plan-cache.ts). */
const READABLE = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];

type PlanJobs = { canRead: boolean; jobs: Record<string, PlanJobView> } | null;
type BuildSaid = { ok: boolean; message?: string; error?: string; quoteId?: string | null } | null;

export function FilesBox({ clientId, files, may, mayReadRooms }: { clientId: string; files: LeadFileView[]; may: boolean; mayReadRooms: boolean }) {
  const [kind, setKind] = useState<'FLOOR_PLAN' | 'OTHER'>(files.some((f) => f.kind === 'FLOOR_PLAN') ? 'OTHER' : 'FLOOR_PLAN');
  const [over, setOver] = useState(false);
  const [busy, setBusy] = useState(false);
  const [said, setSaid] = useState<{ ok: boolean; message?: string; error?: string } | null>(null);
  const picker = useRef<HTMLInputElement>(null);
  const act = useAct();
  const router = useRouter();

  /* Floor plan → first quotation (12 Oct 2026): the last run of each plan,
     and whether reading is switched on, read after the page has drawn. */
  const [plans, setPlans] = useState<PlanJobs>(null);
  const [building, setBuilding] = useState<string | null>(null);
  const [built, setBuilt] = useState<BuildSaid>(null);
  const fileIds = files.map((f) => f.id).join(',');
  const loadPlans = useCallback(() => {
    planJobsAction(clientId)
      .then(setPlans)
      .catch(() => undefined);
  }, [clientId]);
  useEffect(() => {
    loadPlans();
  }, [loadPlans, fileIds]);

  /** Read the plan and build the quotation; says what happened under the box. */
  async function buildFrom(ref: { fileId?: string; path?: string }, mode: 'auto' | 'manual' | 'read', label: string) {
    setBuilding(label);
    setBuilt(null);
    try {
      const r = await buildFromPlanAction(clientId, ref, mode);
      setBuilt(r.ok ? { ok: r.status !== 'FAILED', message: r.message, error: r.message, quoteId: r.quoteId } : r);
      router.refresh();
      loadPlans();
    } catch {
      setBuilt({ ok: false, error: 'That did not go through. Check your connection and try again.' });
    } finally {
      setBuilding(null);
    }
  }

  async function upload(file: File) {
    setSaid(null);
    setBuilt(null);
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
      const path = ticket.path;
      const asKind = kind;
      act.run(
        () => attachFileAction({ clientId, path, name: file.name, contentType: type, bytes: file.size, kind: asKind }),
        (r) => {
          /* After the upload has answered: read the plan and build the
             first quotation from it, with the state on screen. */
          if (r.ok && asKind === 'FLOOR_PLAN') void buildFrom({ path }, 'auto', 'Reading the plan and building the first quotation…');
        },
      );
    } catch {
      setSaid({ ok: false, error: 'The upload did not finish. Check your connection and try again.' });
    } finally {
      setBusy(false);
      if (picker.current) picker.current.value = '';
    }
  }

  return (
    <section id="files" className={box} style={{ scrollMarginTop: 80 }}>
      <h2 className={h2} style={h2Style}>Floor plan and files</h2>
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
          style={{ display: 'flex', flexDirection: 'column', gap: 10, borderRadius: 14, padding: 16, background: over ? 'var(--acc-soft)' : 'var(--soft)', boxShadow: `inset 0 0 0 1.5px ${over ? 'var(--acc)' : 'var(--fillh)'}` }}
        >
          <div className="hstack" style={{ gap: 8 }}>
            <span className="sm">This is a</span>
            <select aria-label="What the file is" value={kind} onChange={(e) => setKind(e.target.value as 'FLOOR_PLAN' | 'OTHER')} className="fld" style={{ width: 'auto', minHeight: 34 }}>
              <option value="FLOOR_PLAN">Floor plan</option>
              <option value="OTHER">Other file</option>
            </select>
          </div>
          <div className="hstack">
            <button type="button" disabled={busy || act.pending || building !== null} onClick={() => picker.current?.click()} className={primaryClass}>
              {busy || act.pending ? 'Attaching…' : 'Choose a file'}
            </button>
            <span className="muted sm">or drag it here · PDF or photo, up to 15 MB</span>
          </div>
          {kind === 'FLOOR_PLAN' ? (
            <p className="muted sm" style={{ margin: 0, lineHeight: 1.5 }}>
              {plans && !plans.canRead
                ? "Floor-plan reading isn't switched on yet, so the first quotation is built from the lead's BHK."
                : 'The plan is read and the first quotation is built from it: rooms, sizes, kitchen run, bathrooms and false ceilings. You check it and send it.'}
            </p>
          ) : null}
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
      {building ? (
        <p role="status" className="hstack sm" style={{ margin: 0, gap: 8 }}>
          <span aria-hidden className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-[var(--acc)] border-t-transparent" />
          {building}
        </p>
      ) : null}
      {built ? (
        <div>
          <Said result={built.ok ? { ok: true, message: built.message } : { ok: false, error: built.error ?? built.message ?? '' }} />
          {built.quoteId ? (
            <Link href={`/studio/quotations/${built.quoteId}`} className={quietClass}>
              Open the quotation
            </Link>
          ) : null}
        </div>
      ) : null}
      {files.length === 0 ? (
        <p className="muted" style={{ margin: 0 }}>Nothing attached yet. Ask for the floor plan on WhatsApp, then attach it here.</p>
      ) : (
        <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {files.map((f) => (
            <FileRow
              key={f.id}
              clientId={clientId}
              f={f}
              may={may}
              mayReadRooms={mayReadRooms}
              job={plans?.jobs[f.id] ?? null}
              canRead={plans?.canRead ?? true}
              building={building !== null}
              onBuild={(mode) => void buildFrom({ fileId: f.id }, mode, mode === 'read' ? 'Reading the plan…' : 'Reading the plan and building a quotation…')}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

const JOB_TONE: Record<PlanJobView['status'], string> = {
  READING: 'muted',
  BUILT: 'good-t',
  READ: 'good-t',
  FALLBACK: 'warn-t',
  FAILED: 'bad-t',
};

function FileRow({
  clientId,
  f,
  may,
  mayReadRooms,
  job,
  canRead,
  building,
  onBuild,
}: {
  clientId: string;
  f: LeadFileView;
  may: boolean;
  mayReadRooms: boolean;
  job: PlanJobView | null;
  canRead: boolean;
  building: boolean;
  onBuild: (mode: 'manual' | 'read') => void;
}) {
  const [sure, setSure] = useState(false);
  const { pending, result, run } = useAct();
  const readable = READABLE.includes(f.contentType);
  const plan = f.kind === 'FLOOR_PLAN';
  return (
    <li style={{ display: 'flex', flexDirection: 'column', gap: 6, borderRadius: 12, background: 'var(--soft)', padding: '10px 12px' }}>
      <div className="hstack" style={{ gap: 10 }}>
        <span className="chip">{plan ? 'Floor plan' : 'File'}</span>
        {f.url ? (
          <a href={f.url} target="_blank" rel="noreferrer" className="acc-t" style={{ flex: 1, minWidth: 0, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {f.name}
          </a>
        ) : (
          <span style={{ flex: 1, minWidth: 0, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</span>
        )}
        <span className="muted sm">
          {fileSize(f.bytes)} · {new Date(f.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
          {f.uploadedByName ? ` · ${f.uploadedByName}` : ''}
        </span>
      </div>
      {job && job.message ? (
        <p className={`sm ${JOB_TONE[job.status]}`} style={{ margin: 0, lineHeight: 1.5 }}>
          {job.message}{' '}
          {job.quoteId && job.quoteNumber ? (
            <Link href={`/studio/quotations/${job.quoteId}`} className="acc-t" style={{ fontWeight: 600 }}>
              Open {job.quoteNumber}
            </Link>
          ) : null}
        </p>
      ) : null}
      {may ? (
        <div className="hstack sm" style={{ gap: 12 }}>
          {f.roomsRead !== null ? <span className="good-t">{f.roomsRead} rooms read</span> : null}
          {plan && (readable || !canRead) ? (
            <button
              type="button"
              disabled={building || pending}
              onClick={() => onBuild('manual')}
              className="btn ghost xs"
              title={canRead ? 'Reads the plan (once — a plan read before is not read again) and makes a new draft quotation from it' : "Floor-plan reading isn't switched on yet: builds a draft from the lead's BHK"}
            >
              {job?.status === 'FAILED' ? 'Try again: build a quotation from this plan' : 'Build a quotation from this plan'}
            </button>
          ) : null}
          {mayReadRooms && canRead && readable && f.roomsRead === null ? (
            <button type="button" disabled={building || pending} onClick={() => onBuild('read')} className="btn ghost xs" title="Reads the rooms only: the next quotation starts from them">
              Read rooms
            </button>
          ) : null}
          {sure ? (
            <>
              <button type="button" disabled={pending} onClick={() => run(() => removeFileAction(clientId, f.id))} className="btn ghost xs bad-b">
                Yes, remove it
              </button>
              <button type="button" onClick={() => setSure(false)} className="btn ghost xs">
                Keep
              </button>
            </>
          ) : (
            <button type="button" onClick={() => setSure(true)} className="btn ghost xs">
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
    <section id="quotes" className={box} style={{ scrollMarginTop: 80 }}>
      <div className="chead">
        <h2 style={h2Style}>Quotations</h2>
        {mayQuote && !fromOneInteriors ? (
          <button type="button" disabled={pending} onClick={() => run(() => newQuoteForLeadAction(clientId))} className={quietClass}>
            {pending ? 'Starting…' : '+ New quotation'}
          </button>
        ) : null}
      </div>
      <Said result={result} />
      {quotes.length === 0 ? (
        <p className="muted" style={{ margin: 0 }}>No quotation yet. It starts filled in from this lead.</p>
      ) : (
        <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {quotes.map((q) => (
            <li key={q.id} style={{ borderRadius: 12, background: 'var(--soft)', padding: '10px 12px' }}>
              <div className="hstack" style={{ gap: 10 }}>
                <Link href={`/studio/quotations/${q.id}`} className="mono acc-t" style={{ fontWeight: 600 }}>
                  {q.number}
                </Link>
                <span className="muted sm">{q.status === 'DRAFT' ? 'Draft, not sent' : q.status === 'ISSUED' ? 'Sent' : q.status === 'ACCEPTED' ? 'Won' : 'Lost'}</span>
                {q.salesFinal ? <span className="chip good">Sales final {q.salesFinal}</span> : null}
                {q.totalPaise !== null ? <span className="mono" style={{ marginLeft: 'auto', fontWeight: 600 }}>{formatINR(q.totalPaise)}</span> : null}
              </div>
              {q.revisions.length > 0 ? (
                <p className="sm" style={{ margin: '4px 0 0', color: 'var(--text2)' }}>
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
      <section id="booking" className={box} style={{ scrollMarginTop: 80, boxShadow: 'inset 3px 0 0 var(--good)' }}>
        <h2 className={h2} style={h2Style}>Booked</h2>
        <p style={{ margin: 0, lineHeight: 1.5 }}>
          {formatINR(booking.advancePaise)} received, booked {new Date(booking.bookedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}. The client has the app.
        </p>
        {booking.payments.length > 0 ? (
          <ol className="sm" style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 4 }}>
            {booking.payments.map((p, i) => (
              <li key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                <span>{p.label}</span>
                <span className="mono">{formatINR(p.amountPaise)}</span>
              </li>
            ))}
          </ol>
        ) : null}
        {seesProject ? (
          <Link href={`/studio/projects/${booking.projectId}`} className={quietClass} style={{ alignSelf: 'flex-start' }}>
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
    <section id="booking" className={box} style={{ scrollMarginTop: 80, boxShadow: 'inset 3px 0 0 var(--acc)' }}>
      <h2 className={h2} style={h2Style}>Record booking</h2>
      <p className="sm" style={{ margin: 0, lineHeight: 1.5, color: 'var(--text2)' }}>
        On {draft.revision} of {draft.number} ({formatINR(draft.totalPaise)}), the sales final. Refundable for {draft.refundDays} days. This opens the project, records the
        payment and invites the client to the app by SMS or email.{cancelledBefore ? ' An earlier booking on this lead was refunded.' : ''}
      </p>
      {draft.blocked ? (
        <p role="alert" className="sm bad-t" style={{ margin: 0 }}>
          {draft.blocked}
        </p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            <Field label="Amount received (₹)">
              <input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="numeric" className="fld mono" />
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
    return <p className="muted sm" style={{ margin: 0 }}>The {booking.refundDays}-day refund window has passed. Only the owner can refund it now.</p>;
  }
  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="btn ghost xs" style={{ alignSelf: 'flex-start' }}>
        Refund booking{late ? '' : ` (${Math.max(0, booking.daysLeft)} day${booking.daysLeft === 1 ? '' : 's'} left)`}
      </button>
    );
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, borderTop: '1px solid var(--soft)', paddingTop: 12 }}>
      <p className="sm" style={{ margin: 0, lineHeight: 1.5, color: 'var(--text2)' }}>
        The refund is recorded against the payment, the project is marked cancelled (kept, not deleted) and the lead goes back to its column.
      </p>
      <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Why (optional)" className={inputClass} />
      <div className="hstack" style={{ gap: 8 }}>
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
          className={quietClass} style={{ color: 'var(--bad)' }}
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
