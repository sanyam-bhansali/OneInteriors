'use client';

/** Project tracker (the owner's v1 screens): late, paid and handover up top, then every milestone with its reason. */

import Link from 'next/link';
import { AskGeio, ExampleTag, Frame, Tabs } from '@/components/app/ui';
import { useMyProject, type MyProject } from '@/components/app/useMyProject';
import { CARPENTRY, EXAMPLE, MILESTONES } from '@/modules/app/example-project';
import { daysLate, shortDate } from '@/modules/app/project-view';

const MONO = { margin: '4px 0 0', font: '400 12.5px var(--mono)', color: 'var(--ink-2)' } as const;

function ExampleProject() {
  return (
    <Frame>
      <ExampleTag />
      <header className="oa-page-head">
        <span className="oa-meta">
          {EXAMPLE.studio}, since {EXAMPLE.since}
        </span>
        <h1>Your project</h1>
      </header>
      <main className="oa-body">
        <div className="oa-stats">
          <div>
            <span className="oa-meta">Running</span>
            <b style={{ color: 'var(--accent-ink)' }}>{EXAMPLE.runningLateDays} days late</b>
          </div>
          <div>
            <span className="oa-meta">Paid</span>
            <b>
              ₹{EXAMPLE.paidLakh} L{' '}
              <small style={{ fontSize: 13, fontWeight: 400, color: 'var(--ink-2)' }}>of {EXAMPLE.totalLakh}</small>
            </b>
          </div>
          <div>
            <span className="oa-meta">Handover</span>
            <b>{EXAMPLE.handover}</b>
          </div>
        </div>

        <ol className="oa-timeline">
          {MILESTONES.map((m) => (
            <li key={m.title} className={`oa-tl ${m.state}`}>
              <h3 style={m.state === 'next' ? { color: 'var(--ink-2)' } : undefined}>{m.title}</h3>
              <p style={MONO}>{m.meta}</p>
              {m.note ? <p style={{ ...MONO, color: 'var(--ok)' }}>{m.note}</p> : null}
              {m.flag ? (
                <div className="oa-flag">
                  <span className="oa-meta" style={{ color: 'var(--accent-ink)' }}>
                    {m.flag.head}
                  </span>
                  <p style={{ margin: '6px 0 0' }}>{m.flag.body}</p>
                </div>
              ) : null}
              {m.state === 'now' ? (
                <>
                  <ul className="oa-items">
                    {CARPENTRY.map((c) => (
                      <li key={c.item} className={c.kind}>
                        <span>{c.item}</span>
                        <span>{c.status}</span>
                      </li>
                    ))}
                  </ul>
                  <Link href="/app/decision" className="oa-meta mt-3 inline-block" style={{ color: 'var(--accent-ink)' }}>
                    Choose the shutter finish →
                  </Link>
                </>
              ) : null}
            </li>
          ))}
        </ol>
      </main>
      <AskGeio from="project" />
      <Tabs />
    </Frame>
  );
}

/** The real project: how late it runs, when it started and ends, every stage with its date, and the payment plan. */
function RealProject({ project }: { project: MyProject }) {
  const late = daysLate(project.stages);
  const handover = project.stages[project.stages.length - 1];
  return (
    <Frame>
      <header className="oa-page-head">
        <span className="oa-meta">
          {project.studio}, since {shortDate(project.startOn)}
        </span>
        <h1>Your project</h1>
      </header>
      <main className="oa-body">
        <div className="oa-stats">
          <div>
            <span className="oa-meta">Running</span>
            <b style={late ? { color: 'var(--accent-ink)' } : { color: 'var(--ok)' }}>{late ? `${late} day${late === 1 ? '' : 's'} late` : 'On time'}</b>
          </div>
          <div>
            <span className="oa-meta">Started</span>
            <b>{shortDate(project.startOn)}</b>
          </div>
          <div>
            <span className="oa-meta">Handover</span>
            <b>{handover ? shortDate(handover.targetOn) : '—'}</b>
          </div>
        </div>

        <ol className="oa-timeline">
          {project.stages.map((s) => (
            <li key={s.key} className={`oa-tl ${s.state === 'done' ? 'done' : s.state === 'now' ? 'now' : 'next'}`}>
              <h3 style={s.state === 'next' || s.state === 'later' ? { color: 'var(--ink-2)' } : undefined}>{s.state === 'now' ? `${s.label}, now` : s.label}</h3>
              <p style={MONO}>
                {s.state === 'done' ? 'Done' : `Planned ${shortDate(s.targetOn)}`}
              </p>
              {s.late ? (
                <div className="oa-flag">
                  <span className="oa-meta" style={{ color: 'var(--accent-ink)' }}>
                    Past its date
                  </span>
                  <p style={{ margin: '6px 0 0' }}>Planned for {shortDate(s.targetOn)} and not marked done yet. Your expert is following it up.</p>
                </div>
              ) : null}
            </li>
          ))}
        </ol>

        {project.phases ? (
          <>
            <div className="oa-section-head">
              <h2>Payment plan</h2>
              <span className="oa-meta">You pay the studio</span>
            </div>
            <ul className="oa-items" style={{ marginTop: 0 }}>
              {project.phases.map((p) => (
                <li key={p.label} className="next">
                  <span>{p.label}</span>
                  <span>{p.pct}%</span>
                </li>
              ))}
            </ul>
          </>
        ) : null}
      </main>
      <AskGeio from="project" />
      <Tabs />
    </Frame>
  );
}

export default function AppProject() {
  const mine = useMyProject();
  if (mine.state === 'loading') return <Frame>{null}</Frame>;
  return mine.state === 'real' ? <RealProject project={mine.project} /> : <ExampleProject />;
}
