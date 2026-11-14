'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { dayWords, muted } from '../../vendors/format';
import type { LeaveRowView, LeaveView } from '@/modules/studio-leave/store';
import { askLeaveAction, decideLeaveAction, withdrawLeaveAction } from './actions';
import { Message, useRun } from './run';

const STATUS_CHIP: Record<LeaveRowView['status'], string> = { ASKED: 'chip warn', APPROVED: 'chip good', DECLINED: 'chip', WITHDRAWN: 'chip' };
const STATUS_WORDS: Record<LeaveRowView['status'], string> = { ASKED: 'Waiting', APPROVED: 'Approved', DECLINED: 'Declined', WITHDRAWN: 'Withdrawn' };

const span = (r: Pick<LeaveRowView, 'fromDay' | 'toDay'>) => (r.fromDay === r.toDay ? dayWords(r.fromDay) : `${dayWords(r.fromDay)} to ${dayWords(r.toDay)}`);

/** Ask for leave: planned or unplanned, first and last day, a short reason. An approver may enter it for someone. */
export function AskLeave({ view }: { view: LeaveView }) {
  const router = useRouter();
  const { pending, message, run } = useRun();
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState('PLANNED');
  const [fromDay, setFrom] = useState(view.today);
  const [toDay, setTo] = useState(view.today);
  const [reason, setReason] = useState('');
  const [memberId, setMember] = useState(view.meId);
  if (!open) {
    return (
      <div className="flex flex-col gap-2">
        <Message m={message} />
        <div>
          <button type="button" className="btn pri" onClick={() => setOpen(true)}>
            Ask for leave
          </button>
        </div>
      </div>
    );
  }
  return (
    <form
      className="card flex flex-col gap-3 p-3"
      onSubmit={(e) => {
        e.preventDefault();
        run(() => askLeaveAction({ memberId, fromDay, toDay, kind, reason }), () => {
          setOpen(false);
          setReason('');
          router.refresh();
        });
      }}
    >
      <fieldset className="m-0 flex flex-wrap gap-3 border-0 p-0 text-[13.5px]">
        <legend className="mb-1">Which leave?</legend>
        <label className="flex items-center gap-2">
          <input type="radio" name="kind" value="PLANNED" checked={kind === 'PLANNED'} onChange={() => setKind('PLANNED')} /> Planned
        </label>
        <label className="flex items-center gap-2">
          <input type="radio" name="kind" value="UNPLANNED" checked={kind === 'UNPLANNED'} onChange={() => setKind('UNPLANNED')} /> Unplanned (sick, an emergency, or already taken)
        </label>
      </fieldset>
      <div className="flex flex-wrap gap-2">
        {view.team.length > 1 ? (
          <label className="flex flex-col gap-1 text-[13px]">
            For
            <select className="fld" value={memberId} onChange={(e) => setMember(e.target.value)}>
              {view.team.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.id === view.meId ? `${m.name} (you)` : m.name}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        <label className="flex flex-col gap-1 text-[13px]">
          First day
          <input
            type="date"
            className="fld"
            value={fromDay}
            onChange={(e) => {
              setFrom(e.target.value);
              if (toDay < e.target.value) setTo(e.target.value);
            }}
            required
          />
        </label>
        <label className="flex flex-col gap-1 text-[13px]">
          Last day
          <input type="date" className="fld" value={toDay} min={fromDay} onChange={(e) => setTo(e.target.value)} required />
        </label>
        <label className="flex min-w-[14rem] flex-1 flex-col gap-1 text-[13px]">
          Why (a few words)
          <input className="fld" value={reason} maxLength={120} onChange={(e) => setReason(e.target.value)} placeholder="Sister's wedding" required />
        </label>
      </div>
      <p className={`m-0 ${muted}`}>
        {view.canApprove ? 'Yours is approved at once. ' : 'The owner or the design head approves it. '}
        Once approved, the open design steps of the projects you design move later by the working days you are away, as the studio&rsquo;s delay. Only the approvers see the reason.
      </p>
      <Message m={message} />
      <div className="flex flex-wrap gap-2">
        <button type="submit" className="btn pri sm" disabled={pending}>
          {view.canApprove ? 'Enter leave' : 'Ask'}
        </button>
        <button type="button" className="btn ghost sm" onClick={() => setOpen(false)}>
          Cancel
        </button>
      </div>
    </form>
  );
}

function Row({ r, view, run, pending }: { r: LeaveRowView; view: LeaveView; run: ReturnType<typeof useRun>['run']; pending: boolean }) {
  const router = useRouter();
  const refresh = () => router.refresh();
  return (
    <li className="flex flex-wrap items-center justify-between gap-2 border-t border-[var(--line)] px-3 py-2 text-[13.5px]">
      <span>
        <span className="font-medium">{r.mine ? 'You' : r.who}</span> · {span(r)} <span className={muted}>· {r.workingDays} working day{r.workingDays === 1 ? '' : 's'} · {r.kindLabel.toLowerCase()}</span>
        {r.reason ? <span className={`block ${muted}`}>{r.reason}</span> : null}
        {r.status === 'APPROVED' && r.shiftedProjects ? <span className={`block ${muted}`}>Moved the design steps of {r.shiftedProjects} project{r.shiftedProjects === 1 ? '' : 's'}.</span> : null}
      </span>
      <span className="flex flex-wrap items-center gap-2">
        <span className={STATUS_CHIP[r.status]}>{STATUS_WORDS[r.status]}</span>
        {r.status === 'ASKED' && view.canApprove ? (
          <>
            <button type="button" className="btn pri sm" disabled={pending} onClick={() => run(() => decideLeaveAction(r.id, true), refresh)}>
              Approve
            </button>
            <button type="button" className="btn ghost sm" disabled={pending} onClick={() => run(() => decideLeaveAction(r.id, false), refresh)}>
              Decline
            </button>
          </>
        ) : null}
        {r.status === 'ASKED' && r.mine && view.canAsk ? (
          <button type="button" className="btn ghost sm" disabled={pending} onClick={() => run(() => withdrawLeaveAction(r.id), refresh)}>
            Withdraw
          </button>
        ) : null}
      </span>
    </li>
  );
}

/** Waiting for approval, approved leave ahead, and your own. */
export function LeaveList({ view }: { view: LeaveView }) {
  const { pending, message, run } = useRun();
  const mineDone = view.mine.filter((r) => r.status !== 'ASKED');
  return (
    <div className="flex flex-col gap-3">
      <Message m={message} />
      {view.waiting.length ? (
        <section className="card p-0" aria-label="Waiting for approval">
          <h2 className="m-0 px-3 pt-3 text-[15px]">Waiting for approval · {view.waiting.length}</h2>
          {view.canApprove ? <p className={`m-0 px-3 ${muted}`}>Approving moves the design dates now. Approved leave cannot be taken back here.</p> : null}
          <ul className="m-0 mt-2 list-none p-0">
            {view.waiting.map((r) => (
              <Row key={r.id} r={r} view={view} run={run} pending={pending} />
            ))}
          </ul>
        </section>
      ) : null}
      <section className="card p-0" aria-label="Approved leave ahead">
        <h2 className="m-0 px-3 pt-3 text-[15px]">Approved leave ahead · {view.upcoming.length}</h2>
        {view.upcoming.length === 0 ? <p className={`m-0 px-3 pb-3 ${muted}`}>Nobody is on leave ahead.</p> : null}
        <ul className="m-0 mt-2 list-none p-0">
          {view.upcoming.map((r) => (
            <Row key={r.id} r={r} view={view} run={run} pending={pending} />
          ))}
        </ul>
      </section>
      {mineDone.length ? (
        <details className="card px-3 py-2">
          <summary className={muted}>Your leave · {mineDone.length}</summary>
          <ul className="m-0 list-none p-0">
            {mineDone.map((r) => (
              <Row key={r.id} r={r} view={view} run={run} pending={pending} />
            ))}
          </ul>
        </details>
      ) : null}
    </div>
  );
}

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/** The month, Monday first: holidays, the weekly day off, and who is on leave (waiting leave dashed). */
export function MonthGrid({ view }: { view: LeaveView }) {
  return (
    <div className="card overflow-x-auto p-2">
      <table className="w-full table-fixed border-collapse text-[12.5px]" aria-label="Leave and holidays this month">
        <thead>
          <tr>
            {WEEKDAYS.map((d) => (
              <th key={d} className="px-1 py-1 text-left font-medium muted">
                {d}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {view.weeks.map((week, k) => (
            <tr key={k}>
              {week.map((d, j) => {
                if (!d) return <td key={j} className="h-[4.5rem] border border-[var(--line)] bg-[var(--soft)]" />;
                const info = view.days[d];
                const closed = info?.holiday || info?.off;
                return (
                  <td key={d} className={`h-[4.5rem] border border-[var(--line)] p-1 align-top ${closed ? 'bg-[var(--soft)]' : ''}`} aria-current={d === view.today ? 'date' : undefined}>
                    <div className={`text-[12px] ${d === view.today ? 'font-semibold' : 'muted'}`}>{Number(d.slice(8))}</div>
                    {info?.holiday ? <div className="truncate font-medium text-[var(--warn)]">{info.holiday}</div> : info?.off ? <div className="muted">Day off</div> : null}
                    {(info?.leave ?? []).map((l, i) => (
                      <div key={i} className={`truncate rounded px-1 ${l.status === 'APPROVED' ? 'bg-[var(--soft)]' : 'border border-dashed border-[var(--line)]'}`} title={l.status === 'APPROVED' ? `${l.who}: on leave` : `${l.who}: asked, waiting`}>
                        {l.who}
                      </div>
                    ))}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <p className={`m-0 mt-2 ${muted}`}>Holidays and the weekly day off are shaded. Leave waiting for approval has a dashed border.</p>
    </div>
  );
}
