'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { dayWords, muted } from '../../vendors/format';
import type { LeaveRowView, LeaveView } from '@/modules/studio-leave/store';
import { askHolidayWorkAction, askLeaveAction, decideLeaveAction, withdrawLeaveAction } from './actions';
import { Message, useRun } from './run';

const STATUS_CHIP: Record<LeaveRowView['status'], string> = { ASKED: 'chip warn', APPROVED: 'chip good', DECLINED: 'chip', WITHDRAWN: 'chip' };
const STATUS_WORDS: Record<LeaveRowView['status'], string> = { ASKED: 'Waiting', APPROVED: 'Approved', DECLINED: 'Declined', WITHDRAWN: 'Withdrawn' };

const span = (r: Pick<LeaveRowView, 'fromDay' | 'toDay'>) => (r.fromDay === r.toDay ? dayWords(r.fromDay) : `${dayWords(r.fromDay)} to ${dayWords(r.toDay)}`);

/** Ask for leave: planned or unplanned, first and last day, a short reason. An approver may enter it for someone. */
export function AskLeave({ view }: { view: LeaveView }) {
  const router = useRouter();
  const { pending, message, run } = useRun();
  const [open, setOpen] = useState(false);
  const [type, setType] = useState('CASUAL');
  const [fromDay, setFrom] = useState(view.today);
  const [toDay, setTo] = useState(view.today);
  const [reason, setReason] = useState('');
  const [memberId, setMember] = useState(view.meId);
  if (!open) {
    return (
      <div className="flex flex-col gap-2">
        <Message m={message} />
        <Balance view={view} />
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
        run(() => askLeaveAction({ memberId, fromDay, toDay, type, reason }), () => {
          setOpen(false);
          setReason('');
          router.refresh();
        });
      }}
    >
      <fieldset className="m-0 flex flex-wrap gap-3 border-0 p-0 text-[13.5px]">
        <legend className="mb-1">Which leave?</legend>
        {view.types.map((t) => (
          <label key={t.key} className="flex items-center gap-2">
            <input type="radio" name="type" value={t.key} checked={type === t.key} onChange={() => setType(t.key)} /> {t.label}
            {memberId === view.meId ? <span className={muted}>({view.balance[t.key].left} available)</span> : null}
          </label>
        ))}
      </fieldset>
      <p className={`m-0 ${muted}`}>
        One casual and one sick leave earned each month; unused leave carries over. More than you have is unpaid. Casual leave taken without approval (still waiting once the day has passed, or approved only after it) counts as two days.
      </p>
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

/**
 * Working on a holiday (owner, 21 Nov 2026): "2 day salary will be paid but it
 * needs to be pre approved". Ask for a holiday or weekly off ahead; approved
 * on or before the day, it is paid as two days.
 */
export function HolidayWork({ view }: { view: LeaveView }) {
  const router = useRouter();
  const { pending, message, run } = useRun();
  const [open, setOpen] = useState(false);
  const [fromDay, setFrom] = useState(view.today);
  const [toDay, setTo] = useState(view.today);
  const [reason, setReason] = useState('');
  const [memberId, setMember] = useState(view.meId);
  const refresh = () => router.refresh();
  return (
    <section className="card flex flex-col gap-2 p-3" aria-label="Working on a holiday">
      <h2 className="m-0 text-[15px] font-semibold">Working on a holiday</h2>
      <p className={`m-0 ${muted}`}>Paid as two days, when it is approved before the holiday. Ask ahead; approved late, it is paid as usual.</p>
      <Message m={message} />
      {view.work.length > 0 ? (
        <ul className="m-0 list-none p-0">
          {view.work.map((w) => (
            <li key={w.id} className="flex flex-wrap items-center justify-between gap-2 border-t border-[var(--line)] py-2 text-[13.5px]">
              <span>
                <span className="font-medium">{w.mine ? 'You' : w.who}</span> · {span(w)} <span className={muted}>· {w.days} day{w.days === 1 ? '' : 's'}</span>
                {w.status === 'APPROVED' ? (
                  <span className="block text-[12.5px]" style={{ color: w.doublePaid === w.days ? 'var(--good)' : 'var(--bad)' }}>
                    {w.doublePaid === w.days ? 'Paid as two days each.' : w.doublePaid > 0 ? `${w.doublePaid} of ${w.days} paid as two days; the rest was approved late.` : 'Approved late: paid as usual.'}
                  </span>
                ) : null}
                {w.reason ? <span className={`block ${muted}`}>{w.reason}</span> : null}
              </span>
              <span className="flex flex-wrap items-center gap-2">
                <span className={STATUS_CHIP[w.status]}>{STATUS_WORDS[w.status]}</span>
                {w.status === 'ASKED' && view.canApprove ? (
                  <>
                    <button type="button" className="btn pri sm" disabled={pending} onClick={() => run(() => decideLeaveAction(w.id, true), refresh)}>
                      Approve
                    </button>
                    <button type="button" className="btn ghost sm" disabled={pending} onClick={() => run(() => decideLeaveAction(w.id, false), refresh)}>
                      Decline
                    </button>
                  </>
                ) : null}
                {w.status === 'ASKED' && w.mine && view.canAsk ? (
                  <button type="button" className="btn ghost sm" disabled={pending} onClick={() => run(() => withdrawLeaveAction(w.id), refresh)}>
                    Withdraw
                  </button>
                ) : null}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
      {view.canAsk && !open ? (
        <div>
          <button type="button" className="btn ghost sm" onClick={() => setOpen(true)}>
            Ask to work on a holiday
          </button>
        </div>
      ) : null}
      {view.canAsk && open ? (
        <form
          className="flex flex-wrap items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            run(() => askHolidayWorkAction({ memberId, fromDay, toDay, reason }), () => {
              setOpen(false);
              setReason('');
              refresh();
            });
          }}
        >
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
            Holiday
            <input
              type="date"
              className="fld"
              value={fromDay}
              min={view.today}
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
            The work
            <input className="fld" value={reason} maxLength={120} onChange={(e) => setReason(e.target.value)} placeholder="Site handover" required />
          </label>
          <button type="submit" className="btn pri sm" disabled={pending}>
            {view.canApprove ? 'Enter' : 'Ask'}
          </button>
          <button type="button" className="btn ghost sm" onClick={() => setOpen(false)}>
            Cancel
          </button>
        </form>
      ) : null}
    </section>
  );
}

/** Casual and sick leave available now: one of each earned a month, unused carried over (owner, 21 Nov 2026). */
function Balance({ view }: { view: LeaveView }) {
  return (
    <p className="m-0 text-[13.5px]">
      Available now:{' '}
      {view.types.map((t, i) => {
        const b = view.balance[t.key];
        return (
          <span key={t.key}>
            {i > 0 ? ' · ' : ''}
            <b>{b.left}</b> {t.label.toLowerCase()}
            {b.used > b.earned ? <span style={{ color: 'var(--bad)' }}> ({b.used - b.earned} over: unpaid)</span> : null}
          </span>
        );
      })}
    </p>
  );
}

function Row({ r, view, run, pending }: { r: LeaveRowView; view: LeaveView; run: ReturnType<typeof useRun>['run']; pending: boolean }) {
  const router = useRouter();
  const refresh = () => router.refresh();
  return (
    <li className="flex flex-wrap items-center justify-between gap-2 border-t border-[var(--line)] px-3 py-2 text-[13.5px]">
      <span>
        <span className="font-medium">{r.mine ? 'You' : r.who}</span> · {span(r)} <span className={muted}>· {r.typeLabel.toLowerCase()} · {r.workingDays} working day{r.workingDays === 1 ? '' : 's'}</span>
        {r.unapprovedDays > 0 ? (
          <span className="block text-[12.5px]" style={{ color: 'var(--bad)' }}>
            Taken without approval: counts as {r.countedDays} day{r.countedDays === 1 ? '' : 's'}.
          </span>
        ) : null}
        {r.unpaidDays > 0 && (r.status === 'ASKED' || r.status === 'APPROVED') ? (
          <span className="block text-[12.5px]" style={{ color: 'var(--bad)' }}>
            {r.unpaidDays} day{r.unpaidDays === 1 ? '' : 's'} unpaid (more than the {r.typeLabel.toLowerCase()} earned by then).
          </span>
        ) : null}
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
