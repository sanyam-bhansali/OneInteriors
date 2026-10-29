'use client';

import { useEffect, useState } from 'react';
import { Said, useAct } from '../SalesUi';
import { LineIcon } from '../ui/icons';
import type { Done } from '@/modules/studio-office/meetings';
import { acceptMeetingAction, addBusyBlockAction, busyOnAction, cancelMeetingAction, createMeetingAction, moveMeetingAction, proposeMeetingTimeAction, removeBusyBlockAction } from './meeting-actions';
import { minutesLabel, overlaps, WEEKDAYS, type BusySpan } from '@/modules/studio-office/meeting-rules';

/**
 * Office meetings on the calendar (owner, 27 Oct 2026;
 * docs/studio-os/OFFICE-MEETINGS.md): set one up with anyone at the studio;
 * a guest accepts or suggests another time; the organiser takes a
 * suggestion, moves it, or cancels it.
 */

export interface Person {
  id: string;
  name: string;
  role: string;
}

const LENGTHS: readonly [number, string][] = [
  [15, '15 min'],
  [30, '30 min'],
  [45, '45 min'],
  [60, '1 hr'],
  [90, '1 hr 30 min'],
  [120, '2 hr'],
];

/** The next half hour, India time, as day and "HH:MM" inputs. */
function nextSlot(day: string | null): { day: string; time: string } {
  const ist = new Date(Date.now() + 330 * 60_000);
  const today = ist.toISOString().slice(0, 10);
  if (day && day > today) return { day, time: '11:00' };
  const mins = ist.getUTCHours() * 60 + ist.getUTCMinutes();
  const next = Math.ceil((mins + 1) / 30) * 30;
  if (next >= 20 * 60) {
    const t = new Date(ist.getTime() + 86_400_000).toISOString().slice(0, 10);
    return { day: t, time: '11:00' };
  }
  return { day: today, time: `${String(Math.floor(next / 60)).padStart(2, '0')}:${String(next % 60).padStart(2, '0')}` };
}

/** "Set up a meeting" in the calendar's head, and the form it opens. */
export function NewMeeting({ people, day = null, primary = false }: { people: Person[]; day?: string | null; primary?: boolean }) {
  const [open, setOpen] = useState(false);
  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className={primary ? 'btn pri' : 'btn ghost'}>
        <LineIcon name="plus" size={17} />
        Set up a meeting
      </button>
    );
  }
  return (
    <div style={{ width: 'min(30rem, 92vw)' }}>
      <MeetingForm people={people} day={day} onClose={() => setOpen(false)} />
    </div>
  );
}

function MeetingForm({ people, day, onClose }: { people: Person[]; day: string | null; onClose: () => void }) {
  const slot = nextSlot(day);
  const [title, setTitle] = useState('');
  const [when, setWhen] = useState(slot);
  const [minutes, setMinutes] = useState(30);
  const [place, setPlace] = useState('');
  const [note, setNote] = useState('');
  const [picked, setPicked] = useState<string[]>([]);
  const [find, setFind] = useState('');
  /* Who is busy when, that day (27 Oct 2026): their meetings and regular busy times, so you pick a free time. */
  const [busy, setBusy] = useState<Record<string, BusySpan[]>>({});
  useEffect(() => {
    if (picked.length === 0 || !when.day) return;
    let stale = false;
    busyOnAction(picked, when.day)
      .then((b) => {
        if (!stale) setBusy(b);
      })
      .catch(() => undefined);
    return () => {
      stale = true;
    };
  }, [picked, when.day]);
  const startMin = /^\d{2}:\d{2}$/.test(when.time) ? Number(when.time.slice(0, 2)) * 60 + Number(when.time.slice(3, 5)) : null;
  const { pending, result, run } = useAct();
  const shown = people.filter((p) => !find.trim() || `${p.name} ${p.role}`.toLowerCase().includes(find.trim().toLowerCase()));
  const toggle = (id: string) => setPicked((x) => (x.includes(id) ? x.filter((y) => y !== id) : [...x, id]));
  const save = () =>
    run(
      () => createMeetingAction({ title, day: when.day, time: when.time, minutes, place, note, guestIds: picked }),
      (r) => {
        if (r.ok) onClose();
      },
    );

  if (people.length === 0) {
    return (
      <div className="ox-panel" style={{ marginTop: 8 }}>
        <p className="muted sm" style={{ margin: 0 }}>
          Nobody else is on your studio’s team yet. The owner adds people in Settings → Team.
        </p>
        <button type="button" onClick={onClose} className="btn ghost sm">
          Close
        </button>
      </div>
    );
  }

  return (
    <div className="ox-panel" style={{ marginTop: 8, color: 'var(--ink)' }}>
      <input type="text" aria-label="What is it about" placeholder="What it is about, e.g. Kitchen design review" value={title} onChange={(e) => setTitle(e.target.value)} className="fld" maxLength={120} />
      <div className="hstack" style={{ gap: 6, flexWrap: 'wrap' }}>
        <input type="date" aria-label="Day" value={when.day} onChange={(e) => setWhen({ ...when, day: e.target.value })} className="fld sm fit" />
        <input type="time" aria-label="Time" value={when.time} onChange={(e) => setWhen({ ...when, time: e.target.value })} className="fld sm fit" />
        <select aria-label="How long" value={minutes} onChange={(e) => setMinutes(Number(e.target.value))} className="fld sm fit">
          {LENGTHS.map(([m, w]) => (
            <option key={m} value={m}>
              {w}
            </option>
          ))}
        </select>
      </div>
      <input type="text" aria-label="Where" placeholder="Where (optional): Conference room, site, a call" value={place} onChange={(e) => setPlace(e.target.value)} className="fld sm" maxLength={120} />

      <div>
        <span className="lbl">With{picked.length > 0 ? ` · ${picked.length} picked` : ''}</span>
        {people.length > 8 ? <input type="search" aria-label="Find someone" placeholder="Find someone" value={find} onChange={(e) => setFind(e.target.value)} className="fld sm" style={{ marginTop: 4 }} /> : null}
        <div className="meet-people" role="group" aria-label="Who to meet">
          {shown.map((p) => (
            <label key={p.id} className={`meet-person${picked.includes(p.id) ? ' on' : ''}`}>
              <input type="checkbox" aria-label={`${p.name}, ${p.role}`} checked={picked.includes(p.id)} onChange={() => toggle(p.id)} />
              <span>
                <b>{p.name}</b>
                <span className="muted sm"> · {p.role}</span>
              </span>
            </label>
          ))}
          {shown.length === 0 ? <span className="muted sm">Nobody by that name.</span> : null}
        </div>
      </div>

      {picked.length > 0 ? (
        <div className="meet-busy" aria-label="Who is busy that day">
          {picked.map((id) => {
            const p = people.find((x) => x.id === id);
            const spans = busy[id] ?? [];
            const clash = startMin !== null ? overlaps(spans, startMin, minutes) : [];
            return (
              <p key={id} className="sm" style={{ margin: 0 }}>
                <b>{p?.name ?? 'Someone'}</b>{' '}
                {spans.length === 0 ? (
                  <span className="good-t">free all day</span>
                ) : (
                  <span className="muted">
                    busy {spans.map((b) => `${minutesLabel(b.fromMin)}–${minutesLabel(b.toMin)} (${b.label})`).join(', ')}
                  </span>
                )}
                {clash.length > 0 ? <span className="bad-t"> · clashes with your time</span> : null}
              </p>
            );
          })}
        </div>
      ) : null}
      <textarea aria-label="Note (optional)" placeholder="A note for them (optional): what to bring, what to look at first" value={note} onChange={(e) => setNote(e.target.value)} className="fld sm" rows={2} maxLength={1000} />
      <div className="hstack" style={{ gap: 8 }}>
        <button type="button" disabled={pending || title.trim().length < 2 || picked.length === 0 || !when.day || !when.time} onClick={save} className="btn pri sm">
          {pending ? 'Asking…' : picked.length > 1 ? `Ask ${picked.length} people` : 'Ask them'}
        </button>
        <button type="button" onClick={onClose} className="btn ghost sm">
          Cancel
        </button>
      </div>
      <p className="muted sm" style={{ margin: 0 }}>
        They get a notice and accept it, or suggest another time.
      </p>
      <Said result={result} />
    </div>
  );
}

/** A day and time picker with Save / Cancel, for a suggestion or a move. */
function WhenForm({ label, withNote, onSave, onClose }: { label: string; withNote: boolean; onSave: (day: string, time: string, note: string) => Promise<Done>; onClose: () => void }) {
  const slot = nextSlot(null);
  const [day, setDay] = useState(slot.day);
  const [time, setTime] = useState(slot.time);
  const [note, setNote] = useState('');
  const { pending, result, run } = useAct();
  return (
    <div className="meet-when">
      <div className="hstack" style={{ gap: 6, flexWrap: 'wrap' }}>
        <input type="date" aria-label="Day" value={day} onChange={(e) => setDay(e.target.value)} className="fld sm fit" />
        <input type="time" aria-label="Time" value={time} onChange={(e) => setTime(e.target.value)} className="fld sm fit" />
      </div>
      {withNote ? <input type="text" aria-label="Why (optional)" placeholder="Why (optional), e.g. On site till 4" value={note} onChange={(e) => setNote(e.target.value)} className="fld sm" maxLength={300} /> : null}
      <div className="hstack" style={{ gap: 8 }}>
        <button type="button" disabled={pending || !day || !time} onClick={() => run(() => onSave(day, time, note), (r) => r.ok && onClose())} className="btn pri xs">
          {pending ? 'Saving…' : label}
        </button>
        <button type="button" onClick={onClose} className="ox-plain">
          Cancel
        </button>
      </div>
      <Said result={result} />
    </div>
  );
}

/** A guest's answer: Accept, or Suggest another time. */
export function AnswerButtons({ id, accepted }: { id: string; accepted: boolean }) {
  const [suggesting, setSuggesting] = useState(false);
  const { pending, result, run } = useAct();
  if (suggesting) return <WhenForm label="Suggest this time" withNote onSave={(d, t, n) => proposeMeetingTimeAction(id, d, t, n)} onClose={() => setSuggesting(false)} />;
  return (
    <div>
      <div className="hstack" style={{ gap: 8 }}>
        {!accepted ? (
          <button type="button" disabled={pending} onClick={() => run(() => acceptMeetingAction(id))} className="btn pri sm">
            {pending ? 'Saving…' : 'Accept'}
          </button>
        ) : null}
        <button type="button" disabled={pending} onClick={() => setSuggesting(true)} className="btn ghost sm">
          Suggest another time
        </button>
      </div>
      <Said result={result} />
    </div>
  );
}

/** The organiser takes a guest's suggested time. */
export function TakeSuggestion({ id, guestId, label }: { id: string; guestId: string; label: string }) {
  const { pending, result, run } = useAct();
  return (
    <span>
      <button type="button" disabled={pending} onClick={() => run(() => moveMeetingAction(id, guestId, null, null))} className="btn pri xs">
        {pending ? 'Moving…' : label}
      </button>
      <Said result={result} />
    </span>
  );
}

/** The organiser's Move and Cancel. */
export function OrganiserButtons({ id }: { id: string }) {
  const [moving, setMoving] = useState(false);
  const [sure, setSure] = useState(false);
  const { pending, result, run } = useAct();
  if (moving) return <WhenForm label="Move it here" withNote={false} onSave={(d, t) => moveMeetingAction(id, null, d, t)} onClose={() => setMoving(false)} />;
  return (
    <div>
      <div className="hstack" style={{ gap: 8 }}>
        <button type="button" onClick={() => setMoving(true)} className="btn ghost sm">
          Move
        </button>
        {sure ? (
          <button type="button" disabled={pending} onClick={() => run(() => cancelMeetingAction(id))} className="btn ghost sm bad-b">
            {pending ? 'Cancelling…' : 'Yes, cancel it'}
          </button>
        ) : (
          <button type="button" onClick={() => setSure(true)} className="ox-plain bad-t">
            Cancel the meeting
          </button>
        )}
      </div>
      <Said result={result} />
    </div>
  );
}

/** Your regular busy times, on the Meetings page (27 Oct 2026: "every Wednesday the design meeting"). */
export function BusyTimes({ blocks }: { blocks: { id: string; weekday: number; startMin: number; minutes: number; label: string }[] }) {
  const [weekday, setWeekday] = useState(3);
  const [from, setFrom] = useState('14:00');
  const [to, setTo] = useState('15:00');
  const [label, setLabel] = useState('');
  const { pending, result, run } = useAct();
  return (
    <section className="meet-section" aria-label="Your regular busy times">
      <h2>Your regular busy times</h2>
      <p className="muted sm" style={{ margin: 0 }}>
        Every week, the times you are not free. Whoever picks a meeting time with you sees them.
      </p>
      {blocks.length > 0 ? (
        <ul className="card" style={{ margin: 0, padding: '6px 14px', listStyle: 'none' }}>
          {blocks.map((b) => (
            <li key={b.id} className="hstack sm" style={{ justifyContent: 'space-between', padding: '6px 0', gap: 8 }}>
              <span>
                <b>{WEEKDAYS[b.weekday - 1]}</b> {minutesLabel(b.startMin)}–{minutesLabel(b.startMin + b.minutes)} · {b.label}
              </span>
              <button type="button" className="ox-plain bad-t" disabled={pending} onClick={() => run(() => removeBusyBlockAction(b.id))}>
                Remove
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      <div className="hstack" style={{ gap: 6, flexWrap: 'wrap' }}>
        <select aria-label="Day of the week" value={weekday} onChange={(e) => setWeekday(Number(e.target.value))} className="fld sm fit">
          {WEEKDAYS.map((w, i) => (
            <option key={w} value={i + 1}>
              Every {w}
            </option>
          ))}
        </select>
        <input type="time" aria-label="From" value={from} onChange={(e) => setFrom(e.target.value)} className="fld sm fit" />
        <input type="time" aria-label="To" value={to} onChange={(e) => setTo(e.target.value)} className="fld sm fit" />
        <input type="text" aria-label="What it is" placeholder="Design meeting" value={label} onChange={(e) => setLabel(e.target.value)} maxLength={60} className="fld sm fit" />
        <button type="button" className="btn sec sm" disabled={pending || label.trim().length < 2} onClick={() => run(() => addBusyBlockAction({ weekday, from, to, label }), (r) => r.ok && setLabel(''))}>
          Add
        </button>
      </div>
      <Said result={result} />
    </section>
  );
}
