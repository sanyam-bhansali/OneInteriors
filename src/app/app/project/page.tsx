'use client';

/** Project tracker (the owner's v1 screens): late, paid and handover up top, then every milestone with its reason. */

import Link from 'next/link';
import { AskGeio, ExampleTag, Frame, Tabs } from '@/components/app/ui';
import { CARPENTRY, EXAMPLE, MILESTONES } from '@/modules/app/example-project';

const MONO = { margin: '4px 0 0', font: '400 12.5px var(--mono)', color: 'var(--ink-2)' } as const;

export default function AppProject() {
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
