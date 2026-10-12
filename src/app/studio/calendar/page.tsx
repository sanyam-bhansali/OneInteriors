import type { Metadata } from 'next';
import Link from 'next/link';
import { LineIcon } from '../ui/icons';
import { myCalendar } from '@/modules/studio-sales/calendar';
import { calendarWindow, itemsByDay, parseDay, parseView, shiftDay, windowTitle } from '@/modules/studio-sales/calendar-rules';
import { istDay } from '@/modules/project/working-days';
import { taskPeople } from '@/modules/studio-sales/tasks';
import { CalendarBody, Legend, NewTask, PersonPicker } from './CalendarView';
import '../office-ui.css';
import './calendar.css';

export const metadata: Metadata = { title: 'Calendar', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

/**
 * The studio calendar (leads at scale, 12 Oct 2026): follow-ups, meetings
 * and tasks by day, week or month — and, for owner and PM, One Interiors
 * visits. Click one to open the lead; move it to another day or time in
 * place. Owner and PM see everyone or one person; a salesperson their own.
 * Nothing here moves by itself.
 */
export default async function CalendarPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const now = new Date();
  const view = parseView(sp.view);
  const day = parseDay(sp.day, now);
  const [cal, people] = await Promise.all([myCalendar(view, day, sp.who ?? null, now), taskPeople()]);
  if (!cal) {
    return (
      <main className="content ox-page">
        <p className="ox-note">The calendar is for the people who work leads. Ask your studio owner if you should see it.</p>
      </main>
    );
  }
  const w = calendarWindow(view, day);
  const href = (over: Record<string, string | null>) => {
    const p = new URLSearchParams();
    const merged = { view, day, who: cal.who ?? '', ...over };
    for (const [k, v] of Object.entries(merged)) if (v) p.set(k, v);
    return `/studio/calendar?${p.toString()}`;
  };
  const today = istDay(now);

  const whose = cal.seesAll ? (cal.who ? `${people.find((p) => p.id === cal.who)?.name ?? 'One person'}'s` : 'everyone') : 'yours';

  return (
    <main className="content ox-page">
      <div className="phead">
        <div>
          <h1>Calendar</h1>
          <p className="muted">
            {cal.seesAll ? 'Meetings, follow-ups and tasks for the whole team.' : 'Your follow-ups, meetings and tasks.'} One Interiors visits land here by themselves.
          </p>
        </div>
        <NewTask people={people} defaultDay={day === today || view !== 'day' ? today : day} seesAll={cal.seesAll} meId={cal.meId} />
      </div>

      <div className="cal-bar">
        <div className="cal-nav">
          <Link href={href({ day: shiftDay(view, day, -1) })} className="btn ghost sm" aria-label="Earlier">
            <LineIcon name="back" size={16} />
          </Link>
          <Link href={href({ day: today })} className="btn ghost sm">
            Today
          </Link>
          <Link href={href({ day: shiftDay(view, day, 1) })} className="btn ghost sm" aria-label="Later">
            <LineIcon name="arrow" size={16} />
          </Link>
        </div>
        <h2>{windowTitle(w)}</h2>
        <nav className="tabs cal-views" aria-label="Day, week or month">
          {(['day', 'week', 'month'] as const).map((v) => (
            <Link key={v} href={href({ view: v })} aria-current={view === v ? 'page' : undefined}>
              {v === 'day' ? 'Day' : v === 'week' ? 'Week' : 'Month'}
            </Link>
          ))}
        </nav>
        {cal.seesAll ? <PersonPicker people={people} who={cal.who} base={{ view, day }} /> : null}
      </div>

      <div className="hstack" style={{ gap: 8 }}>
        <Legend />
        <span className="muted sm">· {windowTitle(w)} · {whose}</span>
      </div>

      {cal.missedBefore > 0 && w.start.getTime() <= now.getTime() ? (
        <p className="sm" style={{ margin: 0 }}>
          <Link href={`/studio/clients?view=list&due=missed&sort=followup${cal.who ? `&owner=${cal.who}` : ''}`} className="bad-t" style={{ fontWeight: 600 }}>
            {cal.missedBefore.toLocaleString('en-IN')} follow-up{cal.missedBefore === 1 ? '' : 's'} missed before this
          </Link>{' '}
          <span className="muted">— open the list to call them or move them.</span>
        </p>
      ) : null}
      {cal.capped ? <p className="muted sm" style={{ margin: 0 }}>Showing the first 500 of each kind. Pick one person or a shorter view to see all.</p> : null}

      <CalendarBody view={view} days={w.days} month={day.slice(0, 7)} today={today} byDay={Object.fromEntries(itemsByDay(cal.items, w.days))} callCounts={cal.followupCounts} people={people} seesAll={cal.seesAll} dayHref={Object.fromEntries(w.days.map((d) => [d, href({ view: 'day', day: d })]))} />
    </main>
  );
}
