import type { Metadata } from 'next';
import Link from 'next/link';
import { leaveView } from '@/modules/studio-leave/store';
import { parseMonth, shiftMonth } from '@/modules/studio-leave/rules';
import { istDay } from '@/modules/project/working-days';
import { currentMember } from '@/modules/studio/access';
import { mayOpen } from '@/modules/studio/surfaces';
import { AskLeave, LeaveList, MonthGrid } from './LeaveUi';
import '../../office-ui.css';
import '../calendar.css';

export const metadata: Metadata = { title: 'Leave', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

/**
 * The team's leave (owner, 13 Nov 2026: "a calendar-based leave approval
 * system, where people put their planned or unplanned leaves, based on
 * approval. It should impact the projects on which they are working. Only
 * in design; execution won't be hampered."). Everyone asks for their own;
 * the owner or the design head approves. A month of the team's leave and
 * the studio's holidays.
 */
export default async function LeavePage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const month = parseMonth(sp.month, istDay(new Date()));
  const [view, member] = await Promise.all([leaveView(month), currentMember()]);
  if (!view || !member) {
    return (
      <main className="content ox-page">
        <p className="ox-note">Sign in to your studio to see the team&rsquo;s leave.</p>
      </main>
    );
  }
  const title = new Date(`${month}-01T00:00:00Z`).toLocaleDateString('en-IN', { month: 'long', year: 'numeric', timeZone: 'UTC' });
  return (
    <main className="content ox-page">
      <div className="phead">
        <div>
          <h1>Leave and holidays</h1>
          <p className="muted">
            Ask for your leave here. The owner or the design head approves it. Approved leave of a designer moves the open design steps of their projects later by the working days they are away; execution keeps its own dates.
          </p>
        </div>
        <div className="hstack" style={{ gap: 8, flexWrap: 'wrap' }}>
          <Link href="/studio/calendar" className="btn ghost">
            Back to calendar
          </Link>
          {mayOpen(member, '/studio/settings/holidays') ? (
            <Link href="/studio/settings/holidays" className="btn ghost">
              Holidays
            </Link>
          ) : null}
        </div>
      </div>

      {view.canAsk ? <AskLeave view={view} /> : null}

      <LeaveList view={view} />

      <div className="cal-bar">
        <div className="cal-nav">
          <Link href={`/studio/calendar/leave?month=${shiftMonth(month, -1)}`} className="btn ghost sm" aria-label="Earlier month">
            ‹
          </Link>
          <Link href="/studio/calendar/leave" className="btn ghost sm">
            This month
          </Link>
          <Link href={`/studio/calendar/leave?month=${shiftMonth(month, 1)}`} className="btn ghost sm" aria-label="Later month">
            ›
          </Link>
        </div>
        <h2>{title}</h2>
      </div>
      <MonthGrid view={view} />
    </main>
  );
}
