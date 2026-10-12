import type { Metadata } from 'next';
import Link from 'next/link';
import { PageHead, PageBody } from '../StudioShell';
import { myCalendar } from '@/modules/studio-sales/calendar';
import { calendarWindow, itemsByDay, parseDay, parseView, shiftDay, windowTitle } from '@/modules/studio-sales/calendar-rules';
import { istDay } from '@/modules/project/working-days';
import { taskPeople } from '@/modules/studio-sales/tasks';
import { CalendarBody, NewTask, PersonPicker } from './CalendarView';

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
      <PageBody>
        <p className="m-0 text-[15px] text-[var(--s-ink-2)]">The calendar is for the people who work leads. Ask your studio owner if you should see it.</p>
      </PageBody>
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
  const tab = 'px-3 py-1.5 no-underline';

  return (
    <>
      <PageHead
        title="Calendar"
        sub={cal.seesAll ? (cal.who ? `${people.find((p) => p.id === cal.who)?.name ?? 'One person'}'s` : 'Everyone') : 'Your follow-ups, meetings and tasks'}
        action={<NewTask people={people} defaultDay={day === today || view !== 'day' ? today : day} seesAll={cal.seesAll} meId={cal.meId} />}
      />
      <PageBody>
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="flex items-center gap-1">
              <Link href={href({ day: shiftDay(view, day, -1) })} className="s-btn-ghost no-underline" aria-label="Earlier">
                ←
              </Link>
              <Link href={href({ day: today })} className="s-btn-ghost no-underline">
                Today
              </Link>
              <Link href={href({ day: shiftDay(view, day, 1) })} className="s-btn-ghost no-underline" aria-label="Later">
                →
              </Link>
            </div>
            <h2 className="m-0 text-[16px] font-semibold">{windowTitle(w)}</h2>
            <div role="group" aria-label="Day, week or month" className="ml-auto flex overflow-hidden rounded-[8px] border border-[var(--s-rule)] text-[13px] font-medium">
              {(['day', 'week', 'month'] as const).map((v) => (
                <Link key={v} href={href({ view: v })} aria-current={view === v ? 'page' : undefined} className={`${tab} ${view === v ? 'bg-[var(--s-accent)] text-white' : 'text-[var(--s-ink)] hover:bg-[var(--s-rail-active)]'}`}>
                  {v === 'day' ? 'Day' : v === 'week' ? 'Week' : 'Month'}
                </Link>
              ))}
            </div>
            {cal.seesAll ? <PersonPicker people={people} who={cal.who} base={{ view, day }} /> : null}
          </div>

          {cal.missedBefore > 0 && w.start.getTime() <= now.getTime() ? (
            <p className="m-0 text-[13.5px]">
              <Link href={`/studio/clients?view=list&due=missed&sort=followup${cal.who ? `&owner=${cal.who}` : ''}`} className="font-medium text-[var(--s-bad)]">
                {cal.missedBefore.toLocaleString('en-IN')} follow-up{cal.missedBefore === 1 ? '' : 's'} missed before this
              </Link>{' '}
              <span className="text-[var(--s-ink-3)]">— open the list to call them or move them.</span>
            </p>
          ) : null}
          {cal.capped ? <p className="m-0 text-[13px] text-[var(--s-ink-3)]">Showing the first 500 of each kind. Pick one person or a shorter view to see all.</p> : null}

          <CalendarBody view={view} days={w.days} month={day.slice(0, 7)} today={today} byDay={Object.fromEntries(itemsByDay(cal.items, w.days))} callCounts={cal.followupCounts} people={people} seesAll={cal.seesAll} dayHref={Object.fromEntries(w.days.map((d) => [d, href({ view: 'day', day: d })]))} />
        </div>
      </PageBody>
    </>
  );
}
