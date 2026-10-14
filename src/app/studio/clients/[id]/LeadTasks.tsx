'use client';

import { useState } from 'react';
import { Said, useAct } from '../../SalesUi';
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
    <section id="tasks" className="card" style={{ scrollMarginTop: 80 }}>
      <div className="chead">
        <h2>Tasks</h2>
        {may && !adding ? (
          <button type="button" onClick={() => setAdding(true)} className="btn ghost sm">
            + Add a task
          </button>
        ) : null}
      </div>
      {adding ? (
        <TaskForm people={people} seesAll={seesAll} meId={meId} task={{ id: null, title: '', day: today, time: '', assignedToId: meId, leadId }} onClose={() => setAdding(false)} />
      ) : null}
      {tasks.length === 0 && !adding ? <p className="cl-sub">Nothing to do on this lead yet. Tasks show on the calendar and on Today.</p> : null}
      <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {tasks.map((t) => {
          const late = !t.doneAt && new Date(t.dueAt).getTime() < now;
          return (
            <li key={t.id}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                <input
                  type="checkbox"
                  style={{ marginTop: 3 }}
                  aria-label={t.doneAt ? `Open "${t.title}" again` : `Mark "${t.title}" done`}
                  checked={t.doneAt !== null}
                  disabled={pending}
                  onChange={(e) => run(() => setTaskDoneAction(t.id, e.target.checked, leadId))}
                />
                <div style={{ minWidth: 0, flex: 1 }}>
                  <span style={t.doneAt ? { textDecoration: 'line-through', opacity: 0.6 } : { fontWeight: 600 }}>{t.title}</span>
                  <span className={`sm ${late ? 'bad-t' : 'muted'}`} style={{ display: 'block' }} suppressHydrationWarning>
                    {when(t.dueAt)}
                    {late ? ' · late' : ''}
                    {seesAll && t.assignedToName ? ` · ${t.assignedToName}` : ''}
                  </span>
                </div>
                {editing !== t.id ? (
                  <button type="button" onClick={() => setEditing(t.id)} className="btn ghost xs">
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
