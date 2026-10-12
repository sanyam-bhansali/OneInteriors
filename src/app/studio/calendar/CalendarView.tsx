'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { KIND_WORDS, type CalendarItem, type CalendarView } from '@/modules/studio-sales/calendar-rules';
import { Said, useAct, inputClass, primaryClass, quietClass } from '../SalesUi';
import { setMeetingAction } from '../sales-actions';
import { createTaskAction, deleteTaskAction, setTaskDoneAction, updateTaskAction } from '../tasks-actions';
import { bulkFollowUpAction } from '../clients/list-actions';
import { QUICK_LABELS, istInputs, quickAt } from '@/modules/studio-sales/call-schedule';

const KIND_STYLE: Record<CalendarItem['kind'], string> = {
  followup: 'bg-[var(--s-accent)]/12 text-[var(--s-accent-deep,var(--s-accent))]',
  meeting: 'bg-[#2f6f9f]/12 text-[#2f6f9f]',
  task: 'bg-[#8a6220]/12 text-[#8a6220]',
  appointment: 'bg-[var(--s-rail-active)] text-[var(--s-ink-2)]',
};

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/** "HH:MM" India time of an instant, for a time input. */
const istHm = (at: Date) => new Date(new Date(at).getTime() + 330 * 60_000).toISOString().slice(11, 16);

/** Owner and PM: everyone, or one person. */
export function PersonPicker({ people, who, base }: { people: { id: string; name: string }[]; who: string | null; base: { view: string; day: string } }) {
  const router = useRouter();
  return (
    <label className="flex items-center gap-2 text-[13px]">
      <span className="s-label">Whose</span>
      <select
        value={who ?? ''}
        onChange={(e) => {
          const p = new URLSearchParams({ view: base.view, day: base.day });
          if (e.target.value) p.set('who', e.target.value);
          router.push(`/studio/calendar?${p.toString()}`);
        }}
        className={`${inputClass} w-auto py-1.5`}
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
      <div className="grid grid-cols-1 gap-3 md:grid-cols-7">
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
            <section key={d} className={`flex min-w-0 flex-col gap-1.5 rounded-[12px] bg-[var(--s-surface-2)] p-2 ${d === today ? 'ring-2 ring-[var(--s-accent)]' : ''}`}>
              <Link href={dayHref[d]!} className="px-1 text-[13px] font-semibold text-[var(--s-ink)] no-underline hover:underline">
                {label(d)}
              </Link>
              {items.length === 0 && callTotal === 0 ? <p className="m-0 px-1 text-[12px] italic text-[var(--s-ink-3)]">—</p> : null}
              {fold ? (
                <Link href={dayHref[d]!} className={`rounded-[9px] px-2 py-1.5 text-[12.5px] font-medium no-underline ${KIND_STYLE.followup}`}>
                  {callTotal.toLocaleString('en-IN')} follow-up{callTotal === 1 ? '' : 's'}{late > 0 ? <span className="text-[var(--s-bad)]"> · {late} late</span> : null}
                  <span className="block text-[11.5px] font-normal text-[var(--s-ink-2)]">Open the day</span>
                </Link>
              ) : null}
              <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
                {shown.map((i) => (
                  <Item key={i.key} item={i} people={people} seesAll={seesAll} />
                ))}
              </ul>
            </section>
          );
        })}
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <div className="grid min-w-[44rem] grid-cols-7 gap-px overflow-hidden rounded-[12px] border border-[var(--s-rule)] bg-[var(--s-rule)]">
        {WEEKDAYS.map((w) => (
          <div key={w} className="s-label bg-[var(--s-surface-2)] px-2 py-1.5">
            {w}
          </div>
        ))}
        {days.map((d) => {
          const items = byDay[d] ?? [];
          const late = items.filter((i) => i.overdue).length;
          return (
            <div key={d} className={`flex min-h-[6.5rem] flex-col gap-1 bg-[var(--s-surface)] p-1.5 ${d.slice(0, 7) !== month ? 'opacity-50' : ''}`}>
              <Link href={dayHref[d]!} className={`self-start rounded-full px-1.5 text-[12.5px] font-semibold no-underline ${d === today ? 'bg-[var(--s-accent)] text-white' : 'text-[var(--s-ink)] hover:underline'}`}>
                {Number(d.slice(8, 10))}
              </Link>
              {callCounts && (callCounts[d] ?? 0) > 0 ? (
                <Link href={dayHref[d]!} className={`truncate rounded-[5px] px-1.5 py-0.5 text-[11.5px] font-medium no-underline ${KIND_STYLE.followup} ${d < today ? '!text-[var(--s-bad)]' : ''}`}>
                  {callCounts[d]!.toLocaleString('en-IN')} follow-up{callCounts[d] === 1 ? '' : 's'}
                </Link>
              ) : null}
              {items.slice(0, 3).map((i) => (
                <Link key={i.key} href={i.href ?? dayHref[d]!} title={`${KIND_WORDS[i.kind]} · ${i.time} · ${i.title}`} className={`truncate rounded-[5px] px-1.5 py-0.5 text-[11.5px] no-underline ${KIND_STYLE[i.kind]} ${i.overdue ? '!text-[var(--s-bad)] font-semibold' : ''} ${i.done ? 'line-through opacity-60' : ''}`}>
                  {i.time.replace(':00', '')} {i.title}
                </Link>
              ))}
              {items.length > 3 ? (
                <Link href={dayHref[d]!} className="text-[11.5px] text-[var(--s-ink-2)]">
                  {items.length - 3} more{late > 0 ? ` · ${late} late` : ''}
                </Link>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
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
      <div className="s-card max-w-[48rem] px-4 py-6 text-[14px] text-[var(--s-ink-2)]">Nothing on this day. Give a lead a follow-up date, or add a task.</div>
    );
  }
  const shown = all ? items : items.slice(0, DAY_SHOWN);
  return (
    <div className="s-card max-w-[48rem] overflow-hidden">
      <ul className="m-0 flex list-none flex-col p-0">
        {shown.map((i) => (
          <Item key={i.key} item={i} people={people} seesAll={seesAll} wide />
        ))}
      </ul>
      {shown.length < items.length ? (
        <button type="button" onClick={() => setAll(true)} className={`${quietClass} m-3`}>
          Show all {items.length}
        </button>
      ) : null}
    </div>
  );
}

/** One thing on the calendar: open the lead, move it, or (a task) tick it. */
function Item({ item, people, seesAll, wide = false }: { item: CalendarItem; people: { id: string; name: string }[]; seesAll: boolean; wide?: boolean }) {
  const [moving, setMoving] = useState(false);
  const [editing, setEditing] = useState(false);
  const { pending, result, run } = useAct();
  const movable = item.kind !== 'appointment' && !(item.kind === 'meeting' && item.done);

  return (
    <li className={wide ? 'border-b border-[var(--s-rule-soft)] px-4 py-3 last:border-b-0' : 'rounded-[9px] bg-[var(--s-surface)] px-2 py-1.5 shadow-[var(--s-lift)]'}>
      <div className="flex flex-wrap items-start gap-x-2.5 gap-y-1">
        {item.kind === 'task' ? (
          <input
            type="checkbox"
            className="mt-1"
            aria-label={item.done ? `Open "${item.title}" again` : `Mark "${item.title}" done`}
            checked={item.done}
            disabled={pending}
            onChange={(e) => run(() => setTaskDoneAction(item.taskId!, e.target.checked, item.leadId))}
          />
        ) : null}
        <div className="min-w-0 flex-1">
          <p className="m-0 flex flex-wrap items-center gap-1.5 text-[12px]">
            <span className={`rounded-full px-1.5 py-px font-medium ${KIND_STYLE[item.kind]}`}>{KIND_WORDS[item.kind]}</span>
            <span className={`s-num ${item.overdue ? 'font-semibold text-[var(--s-bad)]' : 'text-[var(--s-ink-2)]'}`}>
              {item.time}
              {item.overdue ? ' · late' : ''}
            </span>
          </p>
          {item.href ? (
            <Link href={item.href} className={`block text-[13.5px] font-medium text-[var(--s-ink)] no-underline hover:underline ${item.done ? 'line-through opacity-60' : ''}`}>
              {item.title}
            </Link>
          ) : (
            <span className={`block text-[13.5px] font-medium ${item.done ? 'line-through opacity-60' : ''}`}>{item.title}</span>
          )}
          {item.detail ? <span className="block text-[12.5px] leading-snug text-[var(--s-ink-2)]">{item.detail}</span> : null}
          {seesAll && item.ownerName ? <span className="block text-[12px] text-[var(--s-ink-3)]">{item.ownerName}</span> : null}
        </div>
        {movable && !moving && !editing ? (
          <div className="flex gap-1.5">
            <button type="button" onClick={() => setMoving(true)} className="text-[12px] text-[var(--s-accent)] underline">
              Move
            </button>
            {item.kind === 'task' ? (
              <button type="button" onClick={() => setEditing(true)} className="text-[12px] text-[var(--s-ink-2)] underline">
                Edit
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
      {moving ? <MoveForm item={item} onClose={() => setMoving(false)} /> : null}
      {editing && item.taskId ? (
        <TaskForm
          people={people}
          seesAll={seesAll}
          meId={null}
          task={{ id: item.taskId, title: item.title, day: item.day, time: istHm(item.at), assignedToId: null, leadId: item.leadId }}
          onClose={() => setEditing(false)}
        />
      ) : null}
      <Said result={result} />
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
    <div className="mt-2 flex flex-wrap items-center gap-1.5">
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
          className="rounded-full border border-[var(--s-rule)] px-2.5 py-0.5 text-[12.5px] hover:border-[var(--s-ink-3)]"
        >
          {QUICK_LABELS[q]}
        </button>
      ))}
      <input type="date" aria-label="New day" value={day} onChange={(e) => setDay(e.target.value)} className={`${inputClass} w-auto py-1 text-[13px]`} />
      <input type="time" aria-label="New time" value={time} onChange={(e) => setTime(e.target.value)} className={`${inputClass} w-auto py-1 text-[13px]`} />
      <button type="button" disabled={pending || !day} onClick={save} className={`${primaryClass} px-3 py-1 text-[13px]`}>
        {pending ? 'Saving…' : 'Save'}
      </button>
      <button type="button" onClick={onClose} className="text-[12.5px] text-[var(--s-ink-2)] underline">
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
    <div className="mt-2 flex flex-col gap-2 rounded-[10px] border border-[var(--s-rule)] p-3">
      <input type="text" aria-label="Task" placeholder="What needs doing, e.g. Send the revised kitchen" value={title} onChange={(e) => setTitle(e.target.value)} className={inputClass} />
      <div className="flex flex-wrap items-center gap-1.5">
        <input type="date" aria-label="Due day" value={day} onChange={(e) => setDay(e.target.value)} className={`${inputClass} w-auto py-1.5`} />
        <input type="time" aria-label="Time (10 am if empty)" value={time} onChange={(e) => setTime(e.target.value)} className={`${inputClass} w-auto py-1.5`} />
        {seesAll && people.length > 1 ? (
          <select aria-label="Whose task" value={to} onChange={(e) => setTo(e.target.value)} className={`${inputClass} w-auto py-1.5`}>
            {people.map((p) => (
              <option key={p.id} value={p.id}>
                {p.id === meId ? `${p.name} (me)` : p.name}
              </option>
            ))}
          </select>
        ) : null}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" disabled={pending || title.trim().length < 2 || !day} onClick={save} className={primaryClass}>
          {pending ? 'Saving…' : task.id ? 'Save' : 'Add task'}
        </button>
        <button type="button" onClick={onClose} className={quietClass}>
          Cancel
        </button>
        {task.id ? (
          sure ? (
            <button type="button" disabled={pending} onClick={() => run(() => deleteTaskAction(task.id!, task.leadId), (r) => r.ok && onClose())} className={`${quietClass} text-[var(--s-bad)]`}>
              Yes, delete it
            </button>
          ) : (
            <button type="button" onClick={() => setSure(true)} className="text-[12.5px] text-[var(--s-bad)] underline">
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
      <button type="button" onClick={() => setOpen(true)} className={primaryClass}>
        + Task
      </button>
    );
  }
  return (
    <div className="w-[min(26rem,90vw)]">
      <TaskForm people={people} seesAll={seesAll} meId={meId} task={{ id: null, title: '', day: defaultDay, time: '', assignedToId: meId, leadId: null }} onClose={() => setOpen(false)} />
    </div>
  );
}
