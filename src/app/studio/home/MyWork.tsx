import Link from 'next/link';
import './mywork.css';
import { EMPTY_LINE, type Bucket, type MyWork as Work, type WorkGroup, type WorkItem } from '@/modules/studio/my-work-rules';

/**
 * My work (owner, 15 Oct 2026): the first block on every role's home and on
 * site mode's Today — **Today**, **Next 3 days**, **Missed**, and under them
 * **Next month** (owner, 1 Nov 2026), folded, by week — each with its
 * count, each item naming what, which project or lead, when, and opening the
 * exact place it is done. Lists from studio/my-work-rules.ts; no client
 * state: a long section folds the rest under "Show N more".
 */

export interface WorkLabels {
  title: string;
  today: string;
  soon: string;
  /** "Next month" (owner, 1 Nov 2026): folded under the three lists. */
  month: string;
  missed: string;
  empty: Record<Bucket, string>;
  /** "Show 4 more". */
  showMore: (n: number) => string;
  /** "And 120 more, oldest first in the full list" — rows not fetched. */
  notShown: (n: number) => string;
  /** "Waiting on payment (3)": steps that open when a payment is recorded. */
  waiting?: (n: number) => string;
}

export const WORK_LABELS: WorkLabels = {
  title: 'My work',
  today: 'Today',
  soon: 'Next 3 days',
  month: 'Next month',
  missed: 'Missed',
  empty: EMPTY_LINE,
  showMore: (n) => `Show ${n} more`,
  notShown: (n) => `And ${n} more not shown here`,
  waiting: (n) => `Waiting on payment (${n})`,
};

/** Rows shown before "Show N more". */
const FIRST = 6;

function Item({ i }: { i: WorkItem }) {
  return (
    <li>
      <Link href={i.href} className="mw-item" data-kind={i.kind}>
        <span className="mw-what">{i.title}</span>
        <span className="mw-where muted sm">{i.place}</span>
        <span className="mw-when sm">
          {i.bucket === 'missed' ? <span className="chip bad">{i.when}</span> : <span className="muted">{i.when}</span>}
          {i.detail ? <span className="muted"> · {i.detail}</span> : null}
        </span>
      </Link>
    </li>
  );
}

function Items({ items, labels }: { items: WorkItem[]; labels: WorkLabels }) {
  const head = items.slice(0, FIRST);
  const rest = items.slice(FIRST);
  return (
    <>
      <ul className="mw-list">
        {head.map((i) => (
          <Item key={i.key} i={i} />
        ))}
      </ul>
      {rest.length ? (
        <details className="mw-more">
          <summary className="sm acc-t">{labels.showMore(rest.length)}</summary>
          <ul className="mw-list">
            {rest.map((i) => (
              <Item key={i.key} i={i} />
            ))}
          </ul>
        </details>
      ) : null}
    </>
  );
}

function Groups({ groups, labels }: { groups: WorkGroup[]; labels: WorkLabels }) {
  return (
    <>
      {groups.map((g) => (
        <div key={g.id} className="mw-group">
          <span className="mw-gt">
            {g.title} <span className="mono muted">{g.items.length}</span>
          </span>
          <Items items={g.items} labels={labels} />
        </div>
      ))}
    </>
  );
}

function Section({ id, title, count, tone, more, labels, children }: { id: Bucket; title: string; count: number; tone: string; more: number; labels: WorkLabels; children: React.ReactNode }) {
  return (
    <section className={`mw-col mw-${id}`} aria-labelledby={`mw-h-${id}`} data-testid={`mywork-${id}`}>
      <h3 id={`mw-h-${id}`} className="mw-h">
        <span>{title}</span>
        <span className={`chip ${count > 0 ? tone : ''}`}>{count}</span>
      </h3>
      {count === 0 ? <p className="muted sm mw-empty">{labels.empty[id]}</p> : children}
      {more > 0 ? <p className="muted sm mw-empty">{labels.notShown(more)}</p> : null}
    </section>
  );
}

export function MyWork({ work, labels = WORK_LABELS, className = '' }: { work: Work; labels?: WorkLabels; className?: string }) {
  const todayItems = work.todayGroups.reduce((n, g) => n + g.items.length, 0);
  const soonItems = work.soonGroups.reduce((n, g) => n + g.items.length, 0);
  const monthItems = work.monthGroups.reduce((n, g) => n + g.items.length, 0);
  return (
    <section className={`card mw ${className}`} aria-labelledby="mw-title" data-testid="my-work">
      <div className="chead">
        <h2 id="mw-title">{labels.title}</h2>
      </div>
      <div className="mw-cols">
        <Section id="today" title={labels.today} count={work.counts.today} tone="warn" more={work.counts.today - todayItems} labels={labels}>
          <Groups groups={work.todayGroups} labels={labels} />
        </Section>
        <Section id="soon" title={labels.soon} count={work.counts.soon} tone="ink" more={work.counts.soon - soonItems} labels={labels}>
          <Groups groups={work.soonGroups} labels={labels} />
        </Section>
        <Section id="missed" title={labels.missed} count={work.counts.missed} tone="bad" more={work.counts.missed - work.missed.length} labels={labels}>
          <Items items={work.missed} labels={labels} />
        </Section>
      </div>
      <details className="mw-month" data-testid="mywork-month">
        <summary className="mw-h">
          <span>{labels.month}</span>
          <span className={`chip ${work.counts.month > 0 ? 'ink' : ''}`}>{work.counts.month}</span>
        </summary>
        {work.counts.month === 0 ? <p className="muted sm mw-empty">{labels.empty.month}</p> : <Groups groups={work.monthGroups} labels={labels} />}
        {work.counts.month - monthItems > 0 ? <p className="muted sm mw-empty">{labels.notShown(work.counts.month - monthItems)}</p> : null}
      </details>
      {(work.waiting ?? []).length > 0 ? (
        // Steps that open when a payment is recorded: never late, so never in Missed (DESIGN-PROCESS-PLAN.md Decision 5).
        <details className="mw-waiting">
          <summary className="muted sm">{(labels.waiting ?? WORK_LABELS.waiting!)(work.waiting.length)}</summary>
          <ul className="mw-list">
            {work.waiting.map((w) => (
              <li key={w.key}>
                <Link href={w.href} className="mw-item">
                  <span className="mw-what">{w.title}</span>
                  <span className="mw-where muted sm">{w.place}</span>
                  <span className="mw-when sm muted">Opens when the {w.payment} is recorded</span>
                </Link>
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </section>
  );
}
