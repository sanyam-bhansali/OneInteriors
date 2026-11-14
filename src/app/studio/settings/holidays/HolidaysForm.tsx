'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Message, useRun } from '../../calendar/leave/run';
import { dayWords, muted } from '../../vendors/format';
import type { HolidaysView } from '@/modules/studio-leave/store';
import { addHolidayAction, addHolidayListAction, removeHolidayAction } from './actions';

/** Settings → Holidays (owner, 13 Nov 2026): the list, one to add, a pasted list, and taking one off. */
export function HolidaysForm({ view }: { view: HolidaysView }) {
  const router = useRouter();
  const { pending, message, run } = useRun();
  const [day, setDay] = useState('');
  const [name, setName] = useState('');
  const [list, setList] = useState('');
  const refresh = () => router.refresh();
  const upcoming = view.holidays.filter((h) => !h.past);
  const past = view.holidays.filter((h) => h.past);

  return (
    <div className="flex flex-col gap-4">
      <p className={`m-0 ${muted}`}>
        Days the studio is closed{view.daysOff.length ? `, besides the weekly day off (${view.daysOff.join(', ')})` : ''}. No design step is planned on them. Adding a holiday moves the open design steps on that day and after it one working day later on every running project, with design end and handover. It is filed as a holiday, never anyone&rsquo;s delay. Taking a holiday off moves nothing back.
      </p>
      <Message m={message} />

      {view.canEdit ? (
        <>
          <form
            className="card flex flex-wrap items-end gap-2 p-3"
            onSubmit={(e) => {
              e.preventDefault();
              run(() => addHolidayAction(day, name), () => {
                setDay('');
                setName('');
                refresh();
              });
            }}
          >
            <label className="flex flex-col gap-1 text-[13px]">
              Day
              <input type="date" className="fld" value={day} min={view.today} onChange={(e) => setDay(e.target.value)} required />
            </label>
            <label className="flex min-w-[12rem] flex-1 flex-col gap-1 text-[13px]">
              Name
              <input className="fld" value={name} maxLength={60} onChange={(e) => setName(e.target.value)} placeholder="Diwali" />
            </label>
            <button type="submit" className="btn pri sm" disabled={pending}>
              Add holiday
            </button>
          </form>

          <form
            className="card flex flex-col gap-2 p-3"
            onSubmit={(e) => {
              e.preventDefault();
              run(() => addHolidayListAction(list), () => {
                setList('');
                refresh();
              });
            }}
          >
            <label className="flex flex-col gap-1 text-[13px]">
              Paste a list, one holiday per line
              <textarea className="fld min-h-[8rem] font-mono text-[13px]" value={list} onChange={(e) => setList(e.target.value)} placeholder={'2026-11-08 Diwali\n09/11/2026 Diwali (Padwa)\n2026-12-25 Christmas'} required />
            </label>
            <p className={`m-0 ${muted}`}>Day first: 2026-11-08 or 08/11/2026, then the name. If a line cannot be read, nothing is saved and the line is named.</p>
            <div>
              <button type="submit" className="btn sm" disabled={pending}>
                Add these holidays
              </button>
            </div>
          </form>
        </>
      ) : (
        <p className={`m-0 ${muted}`}>The owner or the design head adds and takes off holidays.</p>
      )}

      <section className="card p-0" aria-label="Holidays">
        <h2 className="m-0 px-3 pt-3 text-[15px]">Coming up · {upcoming.length}</h2>
        {upcoming.length === 0 ? <p className={`m-0 px-3 pb-3 ${muted}`}>No holidays ahead yet.</p> : null}
        <ul className="m-0 list-none p-0">
          {upcoming.map((h) => (
            <li key={h.day} className="flex flex-wrap items-center justify-between gap-2 border-t border-[var(--line)] px-3 py-2 text-[14px]">
              <span>
                <span className="font-medium">{h.name}</span> <span className={muted}>· {dayWords(h.day)}</span>
              </span>
              {view.canEdit ? (
                <button
                  type="button"
                  className="btn ghost sm"
                  disabled={pending}
                  onClick={() => {
                    if (window.confirm(`Take ${h.name} off the list? Design dates it moved stay where they are.`)) run(() => removeHolidayAction(h.day), refresh);
                  }}
                >
                  Take off
                </button>
              ) : null}
            </li>
          ))}
        </ul>
        {past.length ? (
          <details className="border-t border-[var(--line)] px-3 py-2">
            <summary className={muted}>Past holidays · {past.length}</summary>
            <ul className="m-0 list-none p-0">
              {past.map((h) => (
                <li key={h.day} className="py-1 text-[13.5px]">
                  {h.name} <span className={muted}>· {dayWords(h.day)}</span>
                </li>
              ))}
            </ul>
          </details>
        ) : null}
      </section>
    </div>
  );
}
