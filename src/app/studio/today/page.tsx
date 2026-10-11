import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { PageHead, PageBody } from '../StudioShell';
import { myToday } from '@/modules/studio-sales/today';
import { todayCount } from '@/modules/studio-sales/today-rules';
import { currentStudio } from '@/modules/studio/onboarding';
import { crmIsOpen } from '@/modules/studio/standing';
import { currentMember } from '@/modules/studio/access';
import { myInboxFor } from '@/modules/studio-sales/inbox';
import { Inbox } from '../Inbox';
import { TodayList } from './TodayList';

export const metadata: Metadata = { title: 'Today', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

/**
 * Today (Studio OS Phase 1): where an owner, a project manager and a
 * salesperson land. What needs doing, each with its one button — calls due,
 * meetings, floor plans not in yet, quotes waiting, bookings; for the owner
 * and PMs also the leads to assign and the ones nobody has called.
 */
export default async function TodayPage() {
  const member = await currentMember();
  /* An owner still finishing setup is sent to it: the leads are not open yet. */
  if (member && member.role !== 'SALES') {
    const context = await currentStudio();
    if (context && !crmIsOpen({ status: context.studio.status, submittedForReview: context.studio.submittedForReview })) redirect('/studio');
  }
  const [today, inbox] = await Promise.all([myToday(), myInboxFor(member?.userId ?? null)]);
  if (!today) {
    return (
      <PageBody>
        <p className="m-0 text-[15px] text-[var(--s-ink-2)]">Today is for the people who work leads. Ask your studio owner if you should see it.</p>
      </PageBody>
    );
  }
  const count = todayCount(today.sections);
  const now = new Date();
  const dateLine = now.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Asia/Kolkata' });

  return (
    <>
      <PageHead
        title="Today"
        sub={count === 0 ? `${dateLine} · nothing waiting on you` : `${dateLine} · ${count} thing${count === 1 ? '' : 's'} to do`}
        action={
          <Link href="/studio/clients" className="s-btn-ghost no-underline">
            {today.seesAll ? 'All leads' : 'My leads'}
          </Link>
        }
      />
      <PageBody>
        <div className="flex max-w-[56rem] flex-col gap-5">
          {inbox.length > 0 ? <Inbox items={inbox} /> : null}
          {count === 0 ? (
            <div className="s-card p-6">
              <p className="m-0 text-[15.5px] font-semibold">All clear.</p>
              <p className="m-0 mt-1 text-[14px] leading-relaxed text-[var(--s-ink-2)]">
                No calls due, no meetings today, nothing waiting. Give a lead a follow-up date and it shows here on the day.
              </p>
            </div>
          ) : (
            <TodayList sections={today.sections} members={today.members} meId={today.meId} />
          )}
        </div>
      </PageBody>
    </>
  );
}
