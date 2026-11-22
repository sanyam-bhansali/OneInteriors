'use client';

import { useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type { StaffRecordView } from '@/modules/staff/store';
import { DEVICE_KINDS, mb, STAFF_DOC_KINDS, STAFF_DOCS_LIMIT_BYTES, STAFF_FILE_ACCEPT, type StaffDocKind } from '@/modules/staff/rules';
import {
  addDeviceAction,
  addIncentiveAction,
  addSalaryAction,
  markIncentivePaidAction,
  removeDocAction,
  returnDeviceAction,
  saveProfileAction,
  uploadDocAction,
} from '../actions';

type Result = { ok: true; message: string } | { ok: false; error: string };
const inr = (paise: number) => `₹${Math.round(paise / 100).toLocaleString('en-IN')}`;
const day = (d: string) => new Date(`${d}T00:00:00Z`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
const monthWords = (m: string) => new Date(`${m}-01T00:00:00Z`).toLocaleDateString('en-IN', { month: 'long', year: 'numeric', timeZone: 'UTC' });

function useRun() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const run = (fn: () => Promise<Result>, after?: () => void) =>
    start(async () => {
      const r = await fn();
      setMsg(r.ok ? { ok: true, text: r.message } : { ok: false, text: r.error });
      if (r.ok) {
        after?.();
        router.refresh();
      }
    });
  return { pending, msg, run };
}
function Said({ msg }: { msg: { ok: boolean; text: string } | null }) {
  return msg ? (
    <p role="status" className="m-0 text-[13px]" style={{ color: msg.ok ? 'var(--good)' : 'var(--bad)' }}>
      {msg.text}
    </p>
  ) : null;
}
const H = ({ children }: { children: React.ReactNode }) => <h2 className="m-0 text-[15px] font-semibold">{children}</h2>;
const L = ({ label, children, grow }: { label: string; children: React.ReactNode; grow?: boolean }) => (
  <label className={`flex flex-col gap-1 text-[13px] ${grow ? 'min-w-[12rem] flex-1' : ''}`}>
    {label}
    {children}
  </label>
);

export function ProfileBox({ r }: { r: StaffRecordView }) {
  const { pending, msg, run } = useRun();
  const [designation, setDesignation] = useState(r.profile.designation);
  const [joinedOn, setJoinedOn] = useState(r.profile.joinedOn);
  const [address, setAddress] = useState(r.profile.address);
  return (
    <form
      className="card flex flex-wrap items-end gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        run(() => saveProfileAction({ memberId: r.memberId, designation, joinedOn, address }));
      }}
    >
      <div className="w-full">
        <H>Details</H>
      </div>
      <L label="Designation">
        <input className="fld" value={designation} maxLength={80} onChange={(e) => setDesignation(e.target.value)} placeholder="Site supervisor" />
      </L>
      <L label="Joined on">
        <input className="fld" type="date" value={joinedOn} onChange={(e) => setJoinedOn(e.target.value)} />
      </L>
      <L label="Residential address" grow>
        <input className="fld" value={address} maxLength={300} onChange={(e) => setAddress(e.target.value)} />
      </L>
      <button type="submit" className="btn pri sm" disabled={pending}>
        Save
      </button>
      <div className="w-full">
        <Said msg={msg} />
      </div>
    </form>
  );
}

export function DocsBox({ r }: { r: StaffRecordView }) {
  const { pending, msg, run } = useRun();
  const [kind, setKind] = useState<StaffDocKind>((Object.keys(STAFF_DOC_KINDS) as StaffDocKind[]).find((k) => r.missingDocs.includes(STAFF_DOC_KINDS[k])) ?? 'OTHER');
  const [file, setFile] = useState<File | null>(null);
  const ref = useRef<HTMLInputElement>(null);
  return (
    <section className="card flex flex-col gap-2">
      <H>
        Documents · {mb(r.usedBytes)} of {mb(STAFF_DOCS_LIMIT_BYTES)}
      </H>
      {r.missingDocs.length ? <p className="m-0 text-[13px]" style={{ color: 'var(--bad)' }}>Missing: {r.missingDocs.join(', ')}.</p> : <p className="m-0 text-[13px]" style={{ color: 'var(--good)' }}>Every required document is on file.</p>}
      <ul className="m-0 list-none p-0">
        {r.docs.map((d) => (
          <li key={d.id} className="flex flex-wrap items-center justify-between gap-2 border-t border-[var(--line)] py-1.5 text-[13.5px]">
            <span>
              <b>{d.kindLabel}</b> · {d.fileName} <span className="muted">· {mb(d.bytes)} · {day(d.on)}</span>
            </span>
            <span className="flex gap-2">
              {d.url ? (
                <a href={d.url} target="_blank" rel="noreferrer" className="btn ghost sm">
                  Open
                </a>
              ) : null}
              <button type="button" className="btn ghost sm" disabled={pending} onClick={() => window.confirm(`Remove ${d.kindLabel}? The file is deleted.`) && run(() => removeDocAction(d.id))}>
                Remove
              </button>
            </span>
          </li>
        ))}
      </ul>
      <form
        className="flex flex-wrap items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (!file) return;
          const form = new FormData();
          form.set('memberId', r.memberId);
          form.set('kind', kind);
          form.set('file', file);
          run(() => uploadDocAction(form), () => {
            setFile(null);
            if (ref.current) ref.current.value = '';
          });
        }}
      >
        <L label="Document">
          <select className="fld" value={kind} onChange={(e) => setKind(e.target.value as StaffDocKind)}>
            {(Object.keys(STAFF_DOC_KINDS) as StaffDocKind[]).map((k) => (
              <option key={k} value={k}>
                {STAFF_DOC_KINDS[k]}
              </option>
            ))}
          </select>
        </L>
        <L label="File (JPG, PNG, WebP or PDF, up to 3.8 MB)" grow>
          <input ref={ref} className="fld" type="file" accept={STAFF_FILE_ACCEPT} onChange={(e) => setFile(e.target.files?.[0] ?? null)} required />
        </L>
        <button type="submit" className="btn pri sm" disabled={pending || !file}>
          {pending ? 'Uploading…' : 'Add'}
        </button>
      </form>
      <Said msg={msg} />
    </section>
  );
}

export function SalaryBox({ r }: { r: StaffRecordView }) {
  const { pending, msg, run } = useRun();
  const [amount, setAmount] = useState('');
  const [fromDay, setFromDay] = useState(r.today);
  const [note, setNote] = useState('');
  const current = r.salaries.find((s) => s.current);
  return (
    <section className="card flex flex-col gap-2">
      <H>Salary{current ? ` · ${inr(current.monthlyPaise)} a month` : ''}</H>
      <ul className="m-0 list-none p-0">
        {r.salaries.map((s) => (
          <li key={s.id} className="border-t border-[var(--line)] py-1.5 text-[13.5px]">
            <b>{inr(s.monthlyPaise)}</b> a month from {day(s.fromDay)}
            {s.current ? <span className="chip good xs" style={{ marginLeft: 6 }}>Now</span> : null}
            {s.note ? <span className="muted"> · {s.note}</span> : null}
          </li>
        ))}
      </ul>
      <form
        className="flex flex-wrap items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          run(() => addSalaryAction({ memberId: r.memberId, amount, fromDay, note }), () => {
            setAmount('');
            setNote('');
          });
        }}
      >
        <L label="Monthly salary (₹)">
          <input className="fld" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="35000" required />
        </L>
        <L label="From">
          <input className="fld" type="date" value={fromDay} onChange={(e) => setFromDay(e.target.value)} required />
        </L>
        <L label="Note" grow>
          <input className="fld" value={note} maxLength={200} onChange={(e) => setNote(e.target.value)} placeholder="Joining salary, or the raise" />
        </L>
        <button type="submit" className="btn pri sm" disabled={pending}>
          {current ? 'Add a change' : 'Save'}
        </button>
      </form>
      <Said msg={msg} />
    </section>
  );
}

export function IncentivesBox({ r }: { r: StaffRecordView }) {
  const { pending, msg, run } = useRun();
  const [month, setMonth] = useState(r.today.slice(0, 7));
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const t = r.incentiveTotals;
  return (
    <section className="card flex flex-col gap-2">
      <H>
        Incentives · earned {inr(t.earned)} · paid out {inr(t.paid)}
        {t.owed ? ` · owed ${inr(t.owed)}` : ''}
      </H>
      <ul className="m-0 list-none p-0">
        {r.incentives.map((i) => (
          <li key={i.id} className="flex flex-wrap items-center justify-between gap-2 border-t border-[var(--line)] py-1.5 text-[13.5px]">
            <span>
              <b>{inr(i.amountPaise)}</b> · {monthWords(i.month)} · {i.reason}
            </span>
            {i.paidOn ? (
              <span className="chip good xs">Paid {day(i.paidOn)}</span>
            ) : (
              <button type="button" className="btn sec sm" disabled={pending} onClick={() => run(() => markIncentivePaidAction(i.id, r.today))}>
                Mark paid out
              </button>
            )}
          </li>
        ))}
      </ul>
      <form
        className="flex flex-wrap items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          run(() => addIncentiveAction({ memberId: r.memberId, month, amount, reason }), () => {
            setAmount('');
            setReason('');
          });
        }}
      >
        <L label="Month earned">
          <input className="fld" type="month" value={month} onChange={(e) => setMonth(e.target.value)} required />
        </L>
        <L label="Amount (₹)">
          <input className="fld" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="5000" required />
        </L>
        <L label="For" grow>
          <input className="fld" value={reason} maxLength={200} onChange={(e) => setReason(e.target.value)} placeholder="3 bookings in October" required />
        </L>
        <button type="submit" className="btn pri sm" disabled={pending}>
          Add
        </button>
      </form>
      <Said msg={msg} />
    </section>
  );
}

export function DevicesBox({ r }: { r: StaffRecordView }) {
  const { pending, msg, run } = useRun();
  const [kind, setKind] = useState<string>(DEVICE_KINDS[0]);
  const [model, setModel] = useState('');
  const [serial, setSerial] = useState('');
  const [givenOn, setGivenOn] = useState(r.today);
  const [note, setNote] = useState('');
  const out = r.devices.filter((d) => !d.returnedOn).length;
  return (
    <section className="card flex flex-col gap-2">
      <H>Devices{out ? ` · ${out} with them` : ''}</H>
      <ul className="m-0 list-none p-0">
        {r.devices.map((d) => (
          <li key={d.id} className="flex flex-wrap items-center justify-between gap-2 border-t border-[var(--line)] py-1.5 text-[13.5px]" style={d.returnedOn ? { opacity: 0.6 } : undefined}>
            <span>
              <b>{d.kind}</b> · {d.model}
              {d.serial ? <span className="muted"> · S/N {d.serial}</span> : null} <span className="muted">· given {day(d.givenOn)}</span>
              {d.note ? <span className="muted"> · {d.note}</span> : null}
            </span>
            {d.returnedOn ? (
              <span className="chip xs">Returned {day(d.returnedOn)}</span>
            ) : (
              <button type="button" className="btn sec sm" disabled={pending} onClick={() => run(() => returnDeviceAction(d.id, r.today))}>
                Mark returned
              </button>
            )}
          </li>
        ))}
      </ul>
      <form
        className="flex flex-wrap items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          run(() => addDeviceAction({ memberId: r.memberId, kind, model, serial, givenOn, note }), () => {
            setModel('');
            setSerial('');
            setNote('');
          });
        }}
      >
        <L label="Device">
          <select className="fld" value={kind} onChange={(e) => setKind(e.target.value)}>
            {DEVICE_KINDS.map((k) => (
              <option key={k} value={k}>
                {k}
              </option>
            ))}
          </select>
        </L>
        <L label="Make and model">
          <input className="fld" value={model} maxLength={120} onChange={(e) => setModel(e.target.value)} placeholder="Dell Inspiron 15" required />
        </L>
        <L label="Serial / IMEI">
          <input className="fld" value={serial} maxLength={80} onChange={(e) => setSerial(e.target.value)} />
        </L>
        <L label="Given on">
          <input className="fld" type="date" value={givenOn} onChange={(e) => setGivenOn(e.target.value)} required />
        </L>
        <L label="Note" grow>
          <input className="fld" value={note} maxLength={200} onChange={(e) => setNote(e.target.value)} placeholder="With charger and bag" />
        </L>
        <button type="submit" className="btn pri sm" disabled={pending}>
          Add
        </button>
      </form>
      <Said msg={msg} />
    </section>
  );
}
