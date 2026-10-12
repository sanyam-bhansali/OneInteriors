import { officeSnags, type StudioSnag } from '@/modules/project/snag-read';
import { addWorkingDays, istDay } from '@/modules/project/working-days';
import { shortDay } from '@/modules/studio/workspace-view';
import { CustomerSees } from '../marks';
import { SnagInbox, type InboxSnag } from './SnagInbox';

/**
 * The office Snags tab (studio workspace Phase 4; design
 * StudioProject.dc.html, Snags). A calm inbox in four lanes:
 *
 * - **Needs you** — new, or the customer said "not fixed": accept with a
 *   fix-by date and who fixes it, or say why it is not a defect.
 * - **Being fixed** — accepted (or disputed): who, by when, late ones first.
 * - **Waiting for {customer}** — fixed: before and after side by side and
 *   the sentence they read; it closes when they confirm, or in seven days.
 * - **Closed** — folded away.
 *
 * Plus **Add snags** for the handover walk-through: many lines at once.
 * Reads and writes are gated in the module (project/snag-read.ts,
 * project/snag-flow.ts), not here.
 */
export async function SnagsTab({ projectId, now }: { projectId: string; now: Date }) {
  const data = await officeSnags(projectId, now);
  if (!data) return null;
  const today = istDay(now);
  const quick = [
    { label: 'Tomorrow', day: addWorkingDays(today, 1) },
    { label: 'In 3 days', day: addWorkingDays(today, 3) },
    { label: 'In a week', day: addWorkingDays(today, 6) },
  ];
  const view = (s: StudioSnag): InboxSnag => ({
    id: s.id,
    title: s.title,
    room: s.room,
    raisedNote: s.raisedNote,
    raisedLine: `${s.raisedBy === 'customer' ? `raised by ${data.customerFirst}` : 'raised by your team'}, ${shortDay(s.raisedAt)}`,
    state: s.state,
    lane: s.lane,
    fixByDay: s.fixByDay,
    fixByLabel: s.fixBy ? shortDay(s.fixBy) : null,
    overdue: s.overdue,
    assigneeId: s.assigneeId,
    assigneeName: s.assigneeName,
    internalNote: s.internalNote,
    disputeReason: s.disputeReason,
    notFixedReason: s.notFixedReason,
    fixSentence: s.fixSentence,
    fixedLabel: s.fixedAt ? shortDay(s.fixedAt) : null,
    autoClosesLabel: s.autoClosesAt ? shortDay(s.autoClosesAt) : null,
    closedLabel: s.closedAt ? shortDay(s.closedAt) : null,
    closedBy: s.closedBy,
    before: s.before[0] ?? null,
    after: s.after[0] ?? null,
    reopenCount: s.reopenCount,
  });

  return (
    <section aria-label="Snags" className="card p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 className="m-0 text-[17px] font-semibold">Snags</h2>
        <CustomerSees name={data.customerFirst} />
      </div>
      <p className="m-0 mt-1 text-[12.5px] text-[var(--muted)]">
        A snag closes only when {data.customerFirst} confirms the fix, or by itself 7 days after it. The last payment waits until every snag is closed.
      </p>
      <SnagInbox
        projectId={data.projectId}
        customerFirst={data.customerFirst}
        canAccept={data.canAccept}
        canFix={data.canFix}
        assignees={data.assignees}
        quickDays={quick}
        today={today}
        snags={data.snags.map(view)}
      />
    </section>
  );
}
