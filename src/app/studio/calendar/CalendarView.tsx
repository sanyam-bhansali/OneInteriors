'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { KIND_WORDS, type CalendarItem, type CalendarView } from '@/modules/studio-sales/calendar-rules';
import { Said, useAct } from '../SalesUi';
import { setMeetingAction } from '../sales-actions';
import { createTaskAction, deleteTaskAction, setTaskDoneAction, updateTaskAction } from '../tasks-actions';
import { bulkFollowUpAction } from '../clients/list-actions';
import { QUICK_LABELS, istInputs, quickAt } from '@/modules/studio-sales/call-schedule';
import { LineIcon } from '../ui/icons';
import '../office-ui.css';
import './calendar.css';

/** The design's event colours (StudioCalendar): meetings, visits, follow-ups; tasks in the warn tone. */
const KIND_CLASS: Record<CalendarItem['kind'], string> = {
  followup: 'k-follow',
  meeting: 'k-first',
  task: 'k-task',
  appointment: 'k-site',
};

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/** "HH:MM" India time of an instant, for a time input. */
const istHm = (at: Date) => new Date(new Date(at).getTime() + 330 * 60_000).toISOString().slice(11, 16);

/** The legend over the calendar: what each colour is. */
export function Legend() {
  return (
    <div className="hstack cal-legend" style={{ gap: 8 }}>
      {(['meeting', 'appointment', 'followup', 'task'] as const).map((k) => (
        <span key={k} className={`chip ${KIND_CLASS[k]}`} style={{ boxShadow: 'none' }}>
          {KIND_WORDS[k]}
        </span>
      ))}
    </div>
  );
}

/** Owner and PM: everyone, or one person. */
export function PersonPicker({ people, who, base }: { people: { id: string; name: string }[]; who: string | null; base: { view: string; day: string } }) {
  const router = useRouter();
  return (
    <label className="hstack" style={{ gap: 8 }}>
      <span className="lbl">Whose</span>
      <select
        value={who ?? ''}
        onChange={(e) => {
          const p = new URLSearchParams({ view: base.view, day: base.day });
          if (e.target.value) p.set('who', e.target.value);
          router.push(`/studio/calendar?${p.toString()}`);
        }}
        className="fld sm fit"
      >
        <option value="">Everyone</option>
        {people.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>
    </label>
  );
}

export function CalendarBody({
  view,
  days,
  month,
  today,
  byDay,
  callCounts = null,
  people,
  seesAll,
  dayHref,
}: {
  view: CalendarView;
  days: string[];
  /** `YYYY-MM` of the month view, to grey the days outside it. */
  month: string;
  today: string;
  byDay: Record<string, CalendarItem[]>;
  /** Follow-ups counted per day instead of listed (a busy week or month). */
  callCounts?: Record<string, number> | null;
  people: { id: string; name: string }[];
  seesAll: boolean;
  dayHref: Record<string, string>;
}) {
  const label = (d: string) => {
    const js = new Date(`${d}T00:00:00Z`).getUTCDay();
    return `${WEEKDAYS[(js + 6) % 7]} ${Number(d.slice(8, 10))}`;
  };

  if (view === 'day') {
    return <DayList items={byDay[days[0]!] ?? []} people={people} seesAll={seesAll} />;
  }

  if (view === 'week') {
    return (
      <section className="card flush">
        <div className="tscroll">
          <div className="cal-week" role="grid" aria-label="Week">
            {days.map((d) => {
              const items = byDay[d] ?? [];
              /* A busy studio has hundreds of calls a day: past a handful they fold
                 into one line that opens the day, so meetings and tasks stay in view. */
              const calls = items.filter((i) => i.kind === 'followup');
              const counted = callCounts ? (callCounts[d] ?? 0) : null;
              const callTotal = counted ?? calls.length;
              const fold = counted !== null ? counted > 0 : calls.length > WEEK_CALLS_SHOWN;
              const shown = fold ? items.filter((i) => i.kind !== 'followup') : items;
              // Counted days have no times: a day before today is all late.
              const late = counted !== null ? (d < today ? counted : 0) : calls.filter((i) => i.overdue).length;
              return (
                <section key={d} role="gridcell" className={`cal-col${d === today ? ' today' : ''}`}>
                  <div className={`wh${d === today ? ' today' : ''}`}>
                    <Link href={dayHref[d]!}>{label(d)}</Link>
                  </div>
                  {items.length === 0 && callTotal === 0 ? <p className="cal-empty">—</p> : null}
                  {fold ? (
                    <Link href={dayHref[d]!} className="evt k-follow">
                      <b>
                        {callTotal.toLocaleString('en-IN')} follow-up{callTotal === 1 ? '' : 's'}
                        {late > 0 ? <span className="bad-t"> · {late} late</span> : null}
                      </b>
                      <span>Open the day</span>
                    </Link>
                  ) : null}
                  <ul className="cal-items">
                    {shown.map((i) => (
                      <Item key={i.key} item={i} people={people} seesAll={seesAll} />
                    ))}
                  </ul>
                </section>
              );
            })}
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="card flush">
      <div className="tscroll">
        <div className="cal-month">
          {WEEKDAYS.map((w) => (
            <div key={w} className="wh">
              {w}
            </div>
          ))}
          {days.map((d) => {
            const items = byDay[d] ?? [];
            const late = items.filter((i) => i.overdue).length;
            return (
              <div key={d} className={`cal-cell${d.slice(0, 7) !== month ? ' out' : ''}${d === today ? ' today' : ''}`}>
                <Link href={dayHref[d]!} className="cal-num">
                  {Number(d.slice(8, 10))}
                </Link>
                {callCounts && (callCounts[d] ?? 0) > 0 ? (
                  <Link href={dayHref[d]!} className={`cal-pill ${KIND_CLASS.followup}${d < today ? ' late' : ''}`}>
                    {callCounts[d]!.toLocaleString('en-IN')} follow-up{callCounts[d] === 1 ? '' : 's'}
                  </Link>
                ) : null}
                {items.slice(0, 3).map((i) => (
                  <Link
                    key={i.key}
                    href={i.href ?? dayHref[d]!}
                    title={`${KIND_WORDS[i.kind]} · ${i.time} · ${i.title}`}
                    className={`cal-pill ${KIND_CLASS[i.kind]}${i.overdue ? ' late' : ''}${i.done ? ' done' : ''}`}
                  >
                    {i.time.replace(':00', '')} {i.title}
                  </Link>
                ))}
                {items.length > 3 ? (
                  <Link href={dayHref[d]!} className="muted" style={{ fontSize: 11.5 }}>
                    {items.length - 3} more{late > 0 ? ` · ${late} late` : ''}
                  </Link>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/** Follow-ups a week column lists one by one before folding them into a count. */
const WEEK_CALLS_SHOWN = 6;
/** Items the day view draws before "Show all". */
const DAY_SHOWN = 100;

/** The day view: everything on one day, the first hundred at once. */
function DayList({ items, people, seesAll }: { items: CalendarItem[]; people: { id: string; name: string }[]; seesAll: boolean }) {
  const [all, setAll] = useState(false);
  if (items.length === 0) {
    return (
      <div className="empty cal-day">
        <b>Nothing on this day.</b>
        <span className="muted sm">Give a lead a follow-up date, or add a task.</span>
      </div>
    );
  }
  const shown = all ? items : items.slice(0, DAY_SHOWN);
  return (
    <section className="card flush cal-day">
      <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
        {shown.map((i) => (
          <Item key={i.key} item={i} people={people} seesAll={seesAll} wide />
        ))}
      </ul>
      {shown.length < items.length ? (
        <div style={{ padding: '0 18px 16px' }}>
          <button type="button" onClick={() => setAll(true)} className="btn ghost sm">
            Show all {items.length}
          </button>
        </div>
      ) : null}
    </section>
  );
}

/** One thing on the calendar: open the lead, move it, or (a task) tick it. */
function Item({ item, people, seesAll, wide = false }: { item: CalendarItem; people: { id: string; name: string }[]; seesAll: boolean; wide?: boolean }) {
  const [moving, setMoving] = useState(false);
  const [editing, setEditing] = useState(false);
  const { pending, result, run } = useAct();
  const movable = item.kind !== 'appointment' && !(item.kind === 'meeting' && item.done);

  const check =
    item.kind === 'task' ? (
      <input
        type="checkbox"
        style={{ marginTop: 3 }}
        aria-label={item.done ? `Open "${item.title}" again` : `Mark "${item.title}" done`}
        checked={item.done}
        disabled={pending}
        onChange={(e) => run(() => setTaskDoneAction(item.taskId!, e.target.checked, item.leadId))}
      />
    ) : null;

  const title = item.href ? (
    <Link href={item.href} className="cal-t" style={{ display: 'block' }}>
      {item.title}
    </Link>
  ) : (
    <span className="cal-t" style={{ display: 'block' }}>
      {item.title}
    </span>
  );

  const actions =
    movable && !moving && !editing ? (
      <div className="cal-acts">
        <button type="button" onClick={() => setMoving(true)}>
          Move
        </button>
        {item.kind === 'task' ? (
          <button type="button" onClick={() => setEditing(true)}>
            Edit
          </button>
        ) : null}
      </div>
    ) : null;

  const forms = (
    <>
      {moving ? <MoveForm item={item} onClose={() => setMoving(false)} /> : null}
      {editing && item.taskId ? (
        <div className="cal-task">
          <TaskForm
            people={people}
            seesAll={seesAll}
            meId={null}
            task={{ id: item.taskId, title: item.title, day: item.day, time: istHm(item.at), assignedToId: null, leadId: item.leadId }}
            onClose={() => setEditing(false)}
          />
        </div>
      ) : null}
      <Said result={result} />
    </>
  );

  if (wide) {
    return (
      <li className={`cal-row${item.done ? ' done' : ''}`}>
        {check ?? <span />}
        <div style={{ minWidth: 0 }}>
          <span className="hstack" style={{ gap: 8 }}>
            <span className={`chip ${KIND_CLASS[item.kind]}`} style={{ boxShadow: 'none' }}>
              {KIND_WORDS[item.kind]}
            </span>
            <span className={`cal-time${item.overdue ? ' bad-t' : ' muted'}`} style={item.overdue ? { fontWeight: 600 } : undefined}>
              {item.time}
              {item.overdue ? ' · late' : ''}
            </span>
          </span>
          {title}
          {item.detail ? <span className="muted sm" style={{ display: 'block' }}>{item.detail}</span> : null}
          {seesAll && item.ownerName ? <span className="muted sm" style={{ display: 'block' }}>{item.ownerName}</span> : null}
        </div>
        <div style={{ color: 'var(--acc)' }}>{actions}</div>
        {forms}
      </li>
    );
  }

  return (
    <li className={`cal-item ${KIND_CLASS[item.kind]}${item.overdue ? ' late' : ''}${item.done ? ' done' : ''}`}>
      <div style={{ display: 'flex', gap: 6, alignItems: 'flex-start' }}>
        {check}
        <div style={{ minWidth: 0, flex: 1 }}>
          <span className="cal-time">
            {item.time}
            {item.overdue ? ' · late' : ''}
          </span>
          {title}
          {item.detail ? <span style={{ display: 'block', opacity: 0.85 }}>{item.detail}</span> : null}
          {seesAll && item.ownerName ? <span style={{ display: 'block', opacity: 0.7 }}>{item.ownerName}</span> : null}
          {actions}
        </div>
      </div>
      {forms}
    </li>
  );
}

/** Quick reschedule: a new day and (optionally) time. */
function MoveForm({ item, onClose }: { item: CalendarItem; onClose: () => void }) {
  const [day, setDay] = useState(item.day);
  const [time, setTime] = useState(item.defaultTime ? '' : istHm(item.at));
  const { pending, result, run } = useAct();
  const save = () =>
    run(
      () => {
        if (item.kind === 'followup') return bulkFollowUpAction({ ids: [item.leadId!] }, day, time, '');
        if (item.kind === 'meeting') return setMeetingAction(item.leadId!, day, time || '11:00', item.detail === 'Meeting' ? '' : (item.detail ?? ''));
        return updateTaskAction(item.taskId!, { title: item.title, day, time }, item.leadId);
      },
      (r) => {
        if (r.ok) onClose();
      },
    );
  return (
    <div className="cal-form">
      {(['later-today', 'tomorrow'] as const).map((q) => (
        <button
          key={q}
          type="button"
          onClick={() => {
            const at = quickAt(q, new Date());
            if (!at) return;
            const v = istInputs(at);
            setDay(v.day);
            setTime(v.time);
          }}
          className="btn ghost xs"
        >
          {QUICK_LABELS[q]}
        </button>
      ))}
      <input type="date" aria-label="New day" value={day} onChange={(e) => setDay(e.target.value)} className="fld sm fit" />
      <input type="time" aria-label="New time" value={time} onChange={(e) => setTime(e.target.value)} className="fld sm fit" />
      <button type="button" disabled={pending || !day} onClick={save} className="btn pri xs">
        {pending ? 'Saving…' : 'Save'}
      </button>
      <button type="button" onClick={onClose} className="ox-plain">
        Cancel
      </button>
      <Said result={result} />
    </div>
  );
}

export interface TaskFormValue {
  id: string | null;
  title: string;
  day: string;
  time: string;
  assignedToId: string | null;
  leadId: string | null;
}

/** Write or change a task. Owner and PM may give it to someone; a salesperson writes their own. */
export function TaskForm({
  people,
  seesAll,
  meId,
  task,
  onClose,
}: {
  people: { id: string; name: string }[];
  seesAll: boolean;
  meId: string | null;
  task: TaskFormValue;
  onClose: () => void;
}) {
  const [title, setTitle] = useState(task.title);
  const [day, setDay] = useState(task.day);
  const [time, setTime] = useState(task.time);
  const [to, setTo] = useState(task.assignedToId ?? meId ?? '');
  const [sure, setSure] = useState(false);
  const { pending, result, run } = useAct();
  const save = () =>
    run(
      () =>
        task.id
          ? updateTaskAction(task.id, { title, day, time, assignedToId: seesAll && to ? to : null }, task.leadId)
          : createTaskAction({ title, day, time, leadId: task.leadId, assignedToId: seesAll && to ? to : null }),
      (r) => {
        if (r.ok) onClose();
      },
    );
  return (
    <div className="ox-panel" style={{ marginTop: 8, color: 'var(--ink)' }}>
      <input type="text" aria-label="Task" placeholder="What needs doing, e.g. Send the revised kitchen" value={title} onChange={(e) => setTitle(e.target.value)} className="fld" />
      <div className="hstack" style={{ gap: 6 }}>
        <input type="date" aria-label="Due day" value={day} onChange={(e) => setDay(e.target.value)} className="fld sm fit" />
        <input type="time" aria-label="Time (10 am if empty)" value={time} onChange={(e) => setTime(e.target.value)} className="fld sm fit" />
        {seesAll && people.length > 1 ? (
          <select aria-label="Whose task" value={to} onChange={(e) => setTo(e.target.value)} className="fld sm fit">
            {people.map((p) => (
              <option key={p.id} value={p.id}>
                {p.id === meId ? `${p.name} (me)` : p.name}
              </option>
            ))}
          </select>
        ) : null}
      </div>
      <div className="hstack" style={{ gap: 8 }}>
        <button type="button" disabled={pending || title.trim().length < 2 || !day} onClick={save} className="btn pri sm">
          {pending ? 'Saving…' : task.id ? 'Save' : 'Add task'}
        </button>
        <button type="button" onClick={onClose} className="btn ghost sm">
          Cancel
        </button>
        {task.id ? (
          sure ? (
            <button type="button" disabled={pending} onClick={() => run(() => deleteTaskAction(task.id!, task.leadId), (r) => r.ok && onClose())} className="btn ghost sm bad-b">
              Yes, delete it
            </button>
          ) : (
            <button type="button" onClick={() => setSure(true)} className="ox-plain bad-t">
              Delete
            </button>
          )
        ) : null}
      </div>
      <Said result={result} />
    </div>
  );
}

/** "+ Task" in the page head. */
export function NewTask({ people, defaultDay, seesAll, meId }: { people: { id: string; name: string }[]; defaultDay: string; seesAll: boolean; meId: string }) {
  const [open, setOpen] = useState(false);
  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="btn pri">
        <LineIcon name="plus" size={17} />
        Add a task
      </button>
    );
  }
  return (
    <div style={{ width: 'min(26rem, 90vw)' }}>
      <TaskForm people={people} seesAll={seesAll} meId={meId} task={{ id: null, title: '', day: defaultDay, time: '', assignedToId: meId, leadId: null }} onClose={() => setOpen(false)} />
    </div>
  );
}
