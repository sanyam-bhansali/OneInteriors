import type { Metadata } from 'next';
import Link from 'next/link';
import { currentMember } from '@/modules/studio/access';
import { expectedClosing } from '@/modules/studio/expected-closing-store';
import { isInTime } from '@/modules/studio/expected-closing';
import '../projects.css';
import '../../design/lifecycle.css';

export const metadata: Metadata = { title: 'Expected closing', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

/**
 * Expected closing (owner, 13 Nov 2026: "I need to see when, per the system,
 * my closure will be. I have to close 35 projects by December end."): every
 * running project with the handover the system now expects, earliest first,
 * against a target day (31 Dec unless ?by=YYYY-MM-DD). The owner, the design
 * head and a PM (their projects). Rules in modules/studio/expected-closing.ts.
 */

const dayWords = (d: string) => new Date(`${d}T00:00:00Z`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });

export default async function ExpectedClosingPage({ searchParams }: { searchParams: Promise<{ by?: string }> }) {
  const [{ by: rawBy }, member] = await Promise.all([searchParams, currentMember()]);
  const list = await expectedClosing(rawBy?.slice(0, 10));
  const back = member?.role === 'DESIGNER' ? { href: '/studio/design', label: 'Back to design' } : { href: '/studio/projects', label: 'Back to projects' };
  if (!list) {
    return (
      <div className="content oi-proj">
        <p className="m-0 text-[15px] text-[var(--text2)]">This page is for the owner, the design head and project managers.</p>
      </div>
    );
  }
  const byWords = dayWords(list.by);
  const carcass = list.rows.filter((r) => r.onSiteCarcass).length;
  return (
    <div className="content oi-proj">
      <div className="phead">
        <div>
          <h1>Expected closing</h1>
          <p className="muted" style={{ margin: '6px 0 0' }}>
            Every running project and the day the system now expects its handover, from the plan and how late the work under way is. Earliest first.
          </p>
        </div>
        <div className="hstack">
          <Link href={back.href} className="btn ghost">
            {back.label}
          </Link>
        </div>
      </div>

      <div className="oi-life">
      <section className={list.after > 0 ? 'remind' : 'card'} style={list.after > 0 ? undefined : { padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 8 }} role="status" aria-label="Projects closing by the target day" data-testid="closing-summary">
        <b>
          {list.inTime} of {list.rows.length} project{list.rows.length === 1 ? '' : 's'} close by {byWords}
        </b>
        <span className="sm">
          {list.after > 0 ? `${list.after} expected after ${byWords}, or with no plan yet.` : 'Every running project is expected in time.'}
          {carcass > 0 ? ` ${carcass} marked on-site carcass.` : ''}
        </span>
      </section>

      <form method="get" className="hstack" style={{ flexWrap: 'wrap', gap: 8 }} aria-label="Target day">
        <label htmlFor="by" className="muted sm">
          Close by
        </label>
        <input id="by" name="by" type="date" className="fld sm fit" defaultValue={list.by} />
        <button type="submit" className="btn sec">
          Show
        </button>
      </form>

      {list.rows.length === 0 ? (
        <div className="empty">
          <b>No running projects.</b>
          <span className="muted">Projects in design, pre-execution or execution show here until their handover.</span>
        </div>
      ) : (
        <section className="card flush" aria-label="Running projects by expected closing">
          <div className="tscroll">
            <table className="tbl" style={{ minWidth: 860 }} data-testid="closing-table">
              <thead>
                <tr>
                  <th>Client · home</th>
                  <th>Phase</th>
                  <th>Designer</th>
                  <th>Category</th>
                  <th>Expected close</th>
                  <th>Late</th>
                </tr>
              </thead>
              <tbody>
                {list.rows.map((r) => {
                  const late = !isInTime(r, list.by);
                  return (
                    <tr key={r.id} data-testid="closing-row" data-late={late ? 'true' : 'false'}>
                      <td>
                        <Link href={`/studio/projects/${r.id}?tab=plan`} className="font-semibold">
                          {r.client}
                        </Link>
                        <span className="muted sm block">{r.home}</span>
                        {r.onSiteCarcass || r.onHold ? (
                          <span className="hstack" style={{ gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
                            {r.onSiteCarcass ? <span className="chip warn">On-site carcass (shutters from factory)</span> : null}
                            {r.onHold ? <span className="chip">On hold</span> : null}
                          </span>
                        ) : null}
                      </td>
                      <td>{r.phaseLabel}</td>
                      <td>{r.designer ?? <span className="muted">Not picked</span>}</td>
                      <td>{r.category ?? <span className="muted">Not set</span>}</td>
                      <td>
                        {r.expectedOn ? (
                          <span className={`chip mono ${late ? 'bad' : 'good'}`} title={late ? `After ${byWords}` : `By ${byWords}`}>
                            {dayWords(r.expectedOn)}
                          </span>
                        ) : (
                          <span className="chip bad">No plan yet</span>
                        )}
                        {r.plannedOn && r.plannedOn !== r.expectedOn ? <span className="muted sm block">First planned {dayWords(r.plannedOn)}</span> : null}
                      </td>
                      <td className="mono">
                        {r.lateDays > 0 ? (
                          <span className="chip bad">
                            <span className="dot" />
                            {r.lateDays} day{r.lateDays === 1 ? '' : 's'}
                          </span>
                        ) : (
                          <span className="muted">{r.onHold ? 'On hold' : 'On time'}</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}
      </div>
      <p className="muted sm m-0">Late is working days past the handover as first planned. Days a project is on hold are not counted.</p>
    </div>
  );
}
