import Link from 'next/link';
import type { Metadata } from 'next';
import { delaysList } from '@/modules/studio-design/delays';
import { CheckButton } from './CheckButton';
import '../../projects/projects.css';

export const metadata: Metadata = { title: 'Delays', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

/**
 * Design → Delays (owner and Hauspire's design team, 24 Oct 2026;
 * docs/studio-os/DESIGN-PROCESS-PLAN.md Decision 6): every late design step
 * of the last four months, whose delay it was and why, newest first. The
 * owner, a PM or the design head marks each reason checked; a designer sees
 * the delays on their own projects.
 */

const dayWords = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: 'UTC' });

export default async function DelaysPage() {
  const view = await delaysList();
  if (!view) {
    return (
      <div className="content oi-proj">
        <p className="m-0 text-[15px] text-[var(--text2)]">This page is for designers, the design head, the owner and project managers.</p>
      </div>
    );
  }
  const client = view.rows.filter((r) => r.side === 'CLIENT').reduce((a, r) => a + r.days, 0);
  const studio = view.rows.filter((r) => r.side === 'STUDIO').reduce((a, r) => a + r.days, 0);
  return (
    <div className="content oi-proj">
      <div className="phead">
        <div>
          <h1>Delays</h1>
          <p className="muted" style={{ margin: '6px 0 0' }}>
            Every late design step of the last four months: whose delay and why. {client} days on the client&apos;s side, {studio} on ours.
            {view.canCheck ? ` ${view.unchecked} not checked yet.` : ''}
          </p>
        </div>
        <div className="hstack">
          <Link href="/studio/design" className="btn ghost">
            Back to design
          </Link>
        </div>
      </div>
      {view.rows.length === 0 ? (
        <div className="empty">
          <p className="m-0">No late design steps. Every step is on its day.</p>
        </div>
      ) : (
        <div className="card overflow-x-auto p-0">
          <table className="w-full min-w-[820px] border-collapse text-[13.5px]">
            <thead>
              <tr className="text-left text-[12px] muted">
                <th className="px-3 py-2 font-medium">Step</th>
                <th className="px-2 py-2 font-medium">Late</th>
                <th className="px-2 py-2 font-medium">Whose</th>
                <th className="px-2 py-2 font-medium">Why</th>
                <th className="px-2 py-2 font-medium">Said by</th>
                <th className="px-2 py-2 font-medium" />
              </tr>
            </thead>
            <tbody>
              {view.rows.map((r) => (
                <tr key={r.id} className="border-t border-[var(--s-rule-soft)] align-top">
                  <td className="px-3 py-2">
                    <Link href={`/studio/projects/${r.projectId}?tab=design#step-${r.stepId}`} className="font-medium">
                      {r.step}
                    </Link>
                    <div className="muted sm">{r.home}</div>
                  </td>
                  <td className="whitespace-nowrap px-2 py-2">
                    {r.days === 1 ? '1 day' : `${r.days} days`}
                    <div className="muted sm">
                      {dayWords(r.from)} → {dayWords(r.to)}
                    </div>
                  </td>
                  <td className="px-2 py-2">
                    <span className={`chip ${r.side === 'CLIENT' ? 'warn' : 'bad'}`}>{r.side === 'CLIENT' ? 'Client' : 'Ours'}</span>
                  </td>
                  <td className="px-2 py-2">
                    {r.reason}
                    {r.note ? <div className="muted sm">{r.note}</div> : null}
                  </td>
                  <td className="px-2 py-2">
                    {r.by}
                    <div className="muted sm">{dayWords(r.on)}</div>
                  </td>
                  <td className="whitespace-nowrap px-2 py-2">
                    {r.checked ? <span className="muted sm">Checked by {r.checked.by}, {dayWords(r.checked.on)}</span> : view.canCheck ? <CheckButton id={r.id} /> : <span className="muted sm">Not checked yet</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
