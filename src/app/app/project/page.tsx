'use client';

/** Project tracker (v79 design): late, paid and handover up top, snags and decisions inside, payments and changes in rupees, then every stage. */

import Link from 'next/link';
import { useState } from 'react';
import { sharedMilestoneAction } from '../engage/actions';
import { ExampleTag, Frame, Tabs } from '@/components/app/ui';
import { useMyProject, type MyProject } from '@/components/app/useMyProject';
import { CARPENTRY, EXAMPLE, MILESTONES } from '@/modules/app/example-project';
import { dayLabel, daysLate, pickDecision, shortDate } from '@/modules/app/project-view';
import { formatINR, formatINRCompact } from '@/lib/money';
import { DesignCard } from './DesignCard';
import { PaymentEntries } from './PaymentEntries';

const MONO = { margin: '4px 0 0', font: '400 13px var(--mono)', color: 'var(--ink-2)' } as const;

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
      <Tabs />
    </Frame>
  );
}

/** A progress bar that only ever goes up (the step tracker). */
function Progress({ pct, label }: { pct: number; label: string }) {
  const v = Math.max(0, Math.min(100, pct));
  return (
    <span role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={v} style={{ display: 'block', height: 8, borderRadius: 99, background: 'var(--line)', overflow: 'hidden' }}>
      <span style={{ display: 'block', height: '100%', width: `${v}%`, borderRadius: 99, background: v >= 100 ? 'var(--ok)' : 'var(--accent)' }} />
    </span>
  );
}

/**
 * The real project (v79 + trust fixes 5 and 7, and the step tracker):
 * how much of the home is done, overall delay, paid so far and handover up
 * top; snags and the next decision one tap away; the payment stages in
 * rupees with what is paid and what is next; every change made on a
 * decision, totalled; then every stage with its date, its percentage and
 * its steps — ticked with the day, or the day planned. Photos live in the
 * site feed, never here.
 */
function RealProject({ project, reload }: { project: MyProject; reload: () => void }) {
  const late = daysLate(project.stages);
  const handover = project.stages[project.stages.length - 1];
  const money = project.money;
  const open = project.snags.filter((s) => s.status === 'OPEN').length;
  const fixed = project.snags.length - open;
  const decision = pickDecision(project.decisions, null);
  const pending = decision && (decision.state === 'open' || decision.state === 'due-soon') ? decision : null;
  const tracker = project.tracker;
  // The server's per-stage steps line up with the stages only when both come from the plan.
  const tracked = tracker && tracker.stages.length === project.stages.length ? tracker.stages : null;
  return (
    <Frame>
      <header className="oa-page-head">
        <span className="oa-meta">
          {project.studio}, since {shortDate(project.startOn)}
        </span>
        <h1>Your project</h1>
      </header>
      <main className="oa-body">
        {project.progressPct !== null && project.progressPct !== undefined ? (
          <section aria-label="How much is done" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <span className="oa-meta">Done so far</span>
              <b style={{ font: '600 28px var(--mono)' }}>{project.progressPct}%</b>
            </div>
            <Progress pct={project.progressPct} label={`Your home is ${project.progressPct}% done`} />
            <p className="oa-note" style={{ margin: 0 }}>
              Goes up as {project.studio} ticks off each step, with a photo you can see in Site.
            </p>
          </section>
        ) : null}
        <div className="oa-stats">
          <div>
            <span className="oa-meta">Overall</span>
            <b style={late ? { color: 'var(--accent-ink)' } : { color: 'var(--ok)' }}>{late ? `${late} day${late === 1 ? '' : 's'} late` : 'On time'}</b>
          </div>
          <div>
            <span className="oa-meta">Paid</span>
            {money ? (
              <b>
                {formatINRCompact(money.paidPaise)}{' '}
                <small style={{ fontSize: 13, fontWeight: 400, color: 'var(--ink-2)' }}>of {formatINRCompact(money.contractPaise)}</small>
              </b>
            ) : (
              <b>—</b>
            )}
          </div>
          <div>
            <span className="oa-meta">Handover</span>
            <b>{handover ? shortDate(handover.targetOn) : '—'}</b>
          </div>
        </div>

        <div className="oa-list">
          <Link href="/app/snags" className="oa-row" style={{ textDecoration: 'none' }}>
            <span>
              <span className="oa-row-title">Snags</span>
              <span className="oa-row-sub">
                {project.snags.length ? `${open} open · ${fixed} fixed` : 'Nothing raised. Photograph anything that is not right.'}
              </span>
            </span>
            <span aria-hidden>→</span>
          </Link>
          {pending ? (
            <Link href={`/app/decision?id=${pending.id}`} className="oa-row" style={{ textDecoration: 'none' }}>
              <span>
                <span className="oa-row-title">Your decision</span>
                <span className="oa-row-sub">
                  {pending.title} · due {dayLabel(pending.dueOn)}
                </span>
              </span>
              <span aria-hidden>→</span>
            </Link>
          ) : null}
        </div>

        {/* Studio OS Phase 2: the design phase, while it runs and once it closes. */}
        {project.design && (project.design.pct !== null || project.design.steps.length > 0) && (!project.design.done || project.design.changes) ? (
          <DesignCard design={project.design} studio={project.studio} owner={project.role === 'owner'} docs={project.documents} onChanged={reload} />
        ) : null}

        {money ? <Payments money={money} studio={project.studio} payments={project.payments} owner={project.role === 'owner'} onChanged={reload} /> : null}
        {project.changes.items.length ? <Changes changes={project.changes} contractPaise={money?.contractPaise ?? null} /> : null}

        <div className="oa-section-head">
          <h2>Every stage</h2>
        </div>
        <ol className="oa-timeline">
          {project.stages.map((s, i) => (
            <li key={s.key} className={`oa-tl ${s.state === 'done' ? 'done' : s.state === 'now' ? 'now' : 'next'}`}>
              <h3 style={s.state === 'next' || s.state === 'later' ? { color: 'var(--ink-2)' } : undefined}>
                {s.state === 'now' ? `${s.label}, now` : s.label}
              </h3>
              <p style={MONO}>
                {s.state === 'done' ? 'Done' : `Planned ${shortDate(s.targetOn)}`}
                {s.state === 'now' ? (s.late ? ' · running late' : ' · on track') : ''}
                {tracked?.[i] ? ` · ${tracked[i]!.progressPct}% done` : ''}
              </p>
              {tracked?.[i] && tracked[i]!.steps.length ? <StageMilestones stage={tracked[i]!} /> : null}
              {s.state === 'done' && project.role === 'owner' ? <ShareMilestone stageKey={s.key} label={s.label} studio={project.studio} /> : null}
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

        {!money && project.phases ? (
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
      <Tabs />
    </Frame>
  );
}

/**
 * A stage's milestones: the 2–3 steps its studio starred
 * (docs/studio-os/CUSTOMER-MILESTONES.md), ticked with the day it was done
 * or the day it is planned. The stage's % above counts every step; the rest
 * of the steps are the studio's own. No photos here.
 */
function StageMilestones({ stage }: { stage: NonNullable<MyProject['tracker']>['stages'][number] }) {
  return (
    <div style={{ marginTop: 8 }}>
      <Progress pct={stage.progressPct} label={`${stage.label} ${stage.progressPct}% done`} />
      <ul className="oa-items" style={{ marginTop: 6 }} aria-label={`${stage.label} milestones`}>
        {stage.steps.map((x, j) => (
          <li key={`${x.label}-${j}`} className={x.done ? 'done' : 'next'}>
            <span>
              {x.done ? '✓ ' : ''}
              {x.label}
            </span>
            <span>{x.done && x.doneOn ? `Done ${shortDate(x.doneOn)}` : x.plannedOn ? `Planned ${shortDate(x.plannedOn)}` : ''}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Paid, next and after that, in rupees, as a ring; then each stage with its amount and date (trust fix 5). */

function Payments({
  money,
  studio,
  payments,
  owner,
  onChanged,
}: {
  money: NonNullable<MyProject['money']>;
  studio: string;
  /** The recorded payments (studio workspace Phase 5): what waits on the customer's yes. */
  payments: MyProject['payments'];
  owner: boolean;
  onChanged: () => void;
}) {
  // A stage the studio recorded money on that the customer has not confirmed yet.
  const waitingOn = new Set((payments?.stages ?? []).filter((s) => s.waitingPaise > 0).map((s) => s.index));
  const R = 52;
  const C = 2 * Math.PI * R;
  const total = Math.max(1, money.contractPaise);
  const arc = (from: number, len: number, color: string) =>
    len > 0 ? (
      <circle
        cx="66"
        cy="66"
        r={R}
        fill="none"
        stroke={color}
        strokeWidth="14"
        strokeDasharray={`${Math.max(0, (len / total) * C - 3)} ${C}`}
        strokeDashoffset={-(from / total) * C}
        transform="rotate(-90 66 66)"
      />
    ) : null;
  const next = money.next;
  return (
    <section className="oa-pay">
      <div className="oa-section-head">
        <h2>Payments</h2>
        <span className="oa-meta">You pay the studio</span>
      </div>
      <div className="ring">
        <svg viewBox="0 0 132 132" role="img" aria-label={`Paid ${formatINR(money.paidPaise)} of ${formatINR(money.contractPaise)}`}>
          <circle cx="66" cy="66" r={R} fill="none" stroke="var(--line)" strokeWidth="14" />
          {arc(0, money.paidPaise, 'var(--accent)')}
          {arc(money.paidPaise, next?.amountPaise ?? 0, 'var(--gold)')}
          <text x="66" y="63" textAnchor="middle" className="big">
            {formatINRCompact(money.paidPaise)}
          </text>
          <text x="66" y="82" textAnchor="middle" className="small">
            paid
          </text>
        </svg>
        <div className="legend">
          <div>
            <i style={{ background: 'var(--accent)' }} />
            Paid
            <span>{formatINR(money.paidPaise)}</span>
          </div>
          <div>
            <i style={{ background: 'var(--gold)' }} />
            {next?.dueOn ? `Next, ${shortDate(next.dueOn)}` : 'Next'}
            <span>{next ? formatINR(next.amountPaise) : '—'}</span>
          </div>
          <div>
            <i style={{ background: 'var(--line)' }} />
            After that
            <span>{formatINR(money.laterPaise)}</span>
          </div>
        </div>
      </div>
      <ol className="oa-paystages">
        {money.stages.map((s, i) => (
          <li key={s.index} className={s.state}>
            <span className="n">{i + 1}</span>
            <span className="what">
              {s.label}
              <small>
                {s.paidOn
                  ? `Paid ${shortDate(s.paidOn)}`
                  : waitingOn.has(s.index)
                    ? owner
                      ? 'Recorded by the studio — please confirm'
                      : 'Recorded by the studio — waiting for the owner to confirm'
                    : s.dueOn
                    ? `Due ${shortDate(s.dueOn)}`
                    : s.state === 'next'
                      ? 'Next · the studio sets the date'
                      : 'Later'}
              </small>
            </span>
            <span className="amt">
              {formatINR(s.amountPaise)}
              {s.pct !== null ? <small>{s.pct}%</small> : null}
            </span>
          </li>
        ))}
      </ol>
      {payments ? <PaymentEntries payments={payments} onChanged={onChanged} /> : null}
      <p className="oa-note">
        You pay {studio} directly. We remind you two days before each payment is due, and keep every receipt in your Home locker.
      </p>
    </section>
  );
}

/** Every option chosen on a decision, and what together they add (trust fix 7). */
function Changes({ changes, contractPaise }: { changes: MyProject['changes']; contractPaise: number | null }) {
  return (
    <section className="oa-card oa-changes">
      <p className="oa-label" style={{ marginTop: 0 }}>
        Changes so far
      </p>
      <b className="big">{changes.totalPaise ? `+${formatINR(changes.totalPaise)}` : 'Nothing added'}</b>
      <p className="oa-note">
        Across {changes.items.length} decision{changes.items.length === 1 ? '' : 's'}
        {contractPaise !== null && changes.totalPaise ? `. Now ${formatINR(contractPaise + changes.totalPaise)} in all, before GST.` : '.'}
      </p>
      <ul>
        {changes.items.map((c) => (
          <li key={c.decisionId}>
            <span>
              {c.title}
              <small>
                {c.option}
                {c.chosenAt ? ` · ${shortDate(c.chosenAt)}` : ''}
              </small>
            </span>
            <span className="amt">{c.extraPaise ? `+${formatINR(c.extraPaise)}` : 'In quote'}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

export default function AppProject() {
  const mine = useMyProject();
  if (mine.state === 'loading') return <Frame>{null}</Frame>;
  return mine.state === 'real' ? <RealProject project={mine.project} reload={mine.reload} /> : <ExampleProject />;
}

/** "Share this milestone" on a finished stage: the phone's share sheet, else WhatsApp. +25 coins, up to five. */
function ShareMilestone({ stageKey, label, studio }: { stageKey: string; label: string; studio: string }) {
  const [done, setDone] = useState<string | null>(null);
  const share = async () => {
    const text = `${label} is done at our new home! Built with ${studio}, through One Interiors.`;
    try {
      if (navigator.share) await navigator.share({ text });
      else window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener');
    } catch {
      return; // closed the sheet
    }
    const r = await sharedMilestoneAction(stageKey);
    setDone(r.earned ? `Shared. +${r.earned} coins` : 'Shared');
  };
  return (
    <button type="button" className="oa-inline-link" style={{ marginTop: 6 }} onClick={() => void share()}>
      {done ?? 'Share this milestone'}
    </button>
  );
}
