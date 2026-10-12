'use client';

import { useState } from 'react';
import { Said, useAct, quietClass } from '../../SalesUi';
import { TaskForm } from '../../calendar/CalendarView';
import { setTaskDoneAction } from '../../tasks-actions';

export interface LeadTask {
  id: string;
  title: string;
  dueAt: Date;
  doneAt: Date | null;
  assignedToId: string | null;
  assignedToName: string | null;
}

const IST = 330 * 60_000;
const istParts = (at: Date) => {
  const iso = new Date(new Date(at).getTime() + IST).toISOString();
  return { day: iso.slice(0, 10), time: iso.slice(11, 16) };
};
const when = (at: Date) =>
  new Date(at).toLocaleString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Kolkata' });

/**
 * A lead's tasks (leads at scale, 12 Oct 2026): the to-dos about this lead,
 * which also show on the calendar and on Today. Write one, tick it, move it.
 */
export function LeadTasks({
  leadId,
  tasks,
  people,
  seesAll,
  meId,
  may,
}: {
  leadId: string;
  tasks: LeadTask[];
  people: { id: string; name: string }[];
  seesAll: boolean;
  meId: string | null;
  /** May work this lead (write tasks on it). */
  may: boolean;
}) {
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const { pending, result, run } = useAct();
  const now = Date.now();
  const today = istParts(new Date()).day;

  return (
    <section id="tasks" className="scroll-mt-20 rounded-[12px] border border-[var(--s-rule)] px-4 py-3.5">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="s-label m-0 text-[var(--s-ink-3)]">Tasks</h2>
        {may && !adding ? (
          <button type="button" onClick={() => setAdding(true)} className="text-[13px] text-[var(--s-accent)] underline">
            + Add a task
          </button>
        ) : null}
      </div>
      {adding ? (
        <TaskForm people={people} seesAll={seesAll} meId={meId} task={{ id: null, title: '', day: today, time: '', assignedToId: meId, leadId }} onClose={() => setAdding(false)} />
      ) : null}
      {tasks.length === 0 && !adding ? <p className="m-0 mt-2 text-[13px] text-[var(--s-ink-3)]">Nothing to do on this lead yet. Tasks show on the calendar and on Today.</p> : null}
      <ul className="m-0 mt-2 flex list-none flex-col gap-2 p-0">
        {tasks.map((t) => {
          const late = !t.doneAt && new Date(t.dueAt).getTime() < now;
          return (
            <li key={t.id} className="text-[13.5px]">
              <div className="flex items-start gap-2">
                <input
                  type="checkbox"
                  className="mt-1"
                  aria-label={t.doneAt ? `Open "${t.title}" again` : `Mark "${t.title}" done`}
                  checked={t.doneAt !== null}
                  disabled={pending}
                  onChange={(e) => run(() => setTaskDoneAction(t.id, e.target.checked, leadId))}
                />
                <div className="min-w-0 flex-1">
                  <span className={t.doneAt ? 'line-through opacity-60' : 'font-medium'}>{t.title}</span>
                  <span className={`block text-[12.5px] ${late ? 'font-medium text-[var(--s-bad)]' : 'text-[var(--s-ink-3)]'}`} suppressHydrationWarning>
                    {when(t.dueAt)}
                    {late ? ' · late' : ''}
                    {seesAll && t.assignedToName ? ` · ${t.assignedToName}` : ''}
                  </span>
                </div>
                {editing !== t.id ? (
                  <button type="button" onClick={() => setEditing(t.id)} className={`${quietClass} px-2 py-0.5 text-[12px]`}>
                    Edit
                  </button>
                ) : null}
              </div>
              {editing === t.id ? (
                <TaskForm
                  people={people}
                  seesAll={seesAll}
                  meId={meId}
                  task={{ id: t.id, title: t.title, ...istParts(t.dueAt), assignedToId: t.assignedToId, leadId }}
                  onClose={() => setEditing(null)}
                />
              ) : null}
            </li>
          );
        })}
      </ul>
      <Said result={result} />
    </section>
  );
}
