import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { myToday } from '@/modules/studio-sales/today';
import { todayCount } from '@/modules/studio-sales/today-rules';
import { currentStudio } from '@/modules/studio/onboarding';
import { crmIsOpen } from '@/modules/studio/standing';
import { currentMember } from '@/modules/studio/access';
import { myInboxFor } from '@/modules/studio-sales/inbox';
import { Inbox } from '../Inbox';
import { TodayList } from './TodayList';
import { myStages } from '@/modules/studio-practice/stages';
import { CrewToday } from '../vendors/CrewToday';
import '../office-ui.css';
/* The call sheet's look (Log call on a line; calling steps, 21 Oct 2026). */
import '../clients/clients.css';
import './today.css';

export const metadata: Metadata = { title: 'Today', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

/**
 * Today (Studio OS Phase 1): where an owner, a project manager and a
 * salesperson land. What needs doing, each with its one button — calls due,
 * meetings, floor plans not in yet, quotes waiting, bookings; for the owner
 * and PMs also the leads to assign and the ones nobody has called.
 * The look is the owner's handoff (StudioHome, "Office · Today"): the list
 * with its progress ring, and the side cards (new for you, crews).
 */
export default async function TodayPage() {
  const member = await currentMember();
  /* An owner still finishing setup is sent to it: the leads are not open yet. */
  if (member && member.role !== 'SALES') {
    const context = await currentStudio();
    if (context && !crmIsOpen({ status: context.studio.status, submittedForReview: context.studio.submittedForReview })) redirect('/studio');
  }
  const [today, inbox, stages] = await Promise.all([myToday(), myInboxFor(member?.userId ?? null), myStages()]);
  if (!today) {
    return (
      <main className="content ox-page">
        <p className="ox-note">Today is for the people who work leads. Ask your studio owner if you should see it.</p>
      </main>
    );
  }
  const count = todayCount(today.sections);
  const now = new Date();
  const dateLine = now.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Asia/Kolkata' });
  const hour = Number(now.toLocaleString('en-GB', { hour: '2-digit', hour12: false, timeZone: 'Asia/Kolkata' }));
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  return (
    <main className="content ox-page">
      <div className="phead">
        <div>
          <span className="eyebrow">{dateLine}</span>
          <h1>{greeting}</h1>
          <p className="muted" style={{ fontSize: 15 }}>
            {count === 0 ? 'Nothing waiting on you today.' : `${count.toLocaleString('en-IN')} thing${count === 1 ? '' : 's'} to do today.`}
          </p>
        </div>
        <div className="hstack">
          <Link href="/studio/calendar" className="btn sec">
            Calendar
          </Link>
          <Link href="/studio/clients" className="btn sec">
            {today.seesAll ? 'All leads' : 'My leads'}
          </Link>
        </div>
      </div>
      <div className="cols">
        <div className="colmain">
          {count === 0 ? (
            <section className="card" aria-labelledby="h-clear">
              <div className="cheer" role="status">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="m5 12 5 5 9-10" />
                </svg>
                <span style={{ display: 'flex', flexDirection: 'column' }}>
                  <b id="h-clear">All clear.</b>
                  <span className="sm">No calls due, no meetings today, nothing waiting. Give a lead a follow-up date and it shows here on the day.</span>
                </span>
              </div>
            </section>
          ) : (
            <TodayList
              sections={today.sections}
              members={today.members}
              meId={today.meId}
              stages={stages.map((s) => ({ id: s.id, name: s.name, colour: s.colour, kind: s.kind, sortOrder: s.sortOrder, isIntake: s.isIntake, isCallStep: s.isCallStep }))}
            />
          )}
        </div>
        <div className="colside">
          {inbox.length > 0 ? <Inbox items={inbox} /> : null}
          {/* Studio OS Phase 3: lines to measure, work to mark done, crews to pay. */}
          <CrewToday />
          {inbox.length === 0 ? (
            <div className="empty">
              <b>Nothing new for you</b>
              <span className="muted sm">New clients, signatures and customer choices show here until you open them.</span>
            </div>
          ) : null}
        </div>
      </div>
    </main>
  );
}
