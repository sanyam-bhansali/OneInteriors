import type { Metadata } from 'next';
import Link from 'next/link';
import '../../clients.css';
import { callStatsFor } from '@/modules/studio-sales/call-stats-data';
import { CALL_RANGE_LABELS, CALL_RANGE_PRESETS, callRange, waitLabel, type CallStats, type PersonCalls } from '@/modules/studio-sales/call-stats';
import { shortDay } from '@/modules/studio-sales/ist-range';
import { AnalyticsTabs } from '../AnalyticsTabs';

export const metadata: Metadata = {
  title: 'Calling numbers',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

/**
 * Calling numbers (improvement 7, owner 22 Oct 2026): how the salespeople's
 * dialling is going, for Today, 7 days, 30 days or picked dates.
 *
 * Three questions, in the order an owner asks them on a slow week:
 *
 * 1. **Are we dialling enough?** Dials per person and per day.
 * 2. **Are people picking up?** Connects and the connect rate, leads
 *    reached, and how many tries it takes to get through.
 * 3. **Are leads waiting?** How long a new lead sits before its first call,
 *    and how many have not been rung at all.
 *
 * Then the steps: of the leads that entered each column in these days, how
 * many have moved on. Every definition is in call-stats.ts; the words on
 * this page say the same thing in plain English.
 */
export default async function CallingPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const one = (k: string) => (Array.isArray(sp[k]) ? sp[k]![0] : (sp[k] as string | undefined));
  const range = callRange({ range: one('range'), from: one('from'), to: one('to') }, new Date());
  const page = await callStatsFor(range);

  return (
    <main className="content cl-page" style={{ maxWidth: 1240 }}>
      <div className="phead">
        <div>
          <h1>Analytics</h1>
          <p className="muted">{page && !page.seesAll ? `Your calls · ${range.label}` : `Calls by everyone · ${range.label}`}</p>
        </div>
      </div>
      <AnalyticsTabs active="calling" />
      <RangeBar stats={page?.stats ?? null} range={range} />

      {!page ? (
        <p className="muted" style={{ margin: 0 }}>
          We could not read your calling numbers just now. Nothing is lost — try again in a moment.
        </p>
      ) : (
        <>
          <Tiles stats={page.stats} />
          <People stats={page.stats} seesAll={page.seesAll} />
          <div className="cols">
            <div className="colmain" style={{ flexBasis: 480 }}>
              <Daily stats={page.stats} />
            </div>
            <div className="colside" style={{ flexBasis: 420 }}>
              <StepsCard stats={page.stats} />
            </div>
          </div>
          <p className="cl-foot">
            A dial is any call logged, whatever happened. A connect is a call where they picked up: spoke to them, asked us to call back, or said not
            interested. Met them, site visits and messages are not dials. Waits are clock time, nights and Sundays included.
          </p>
        </>
      )}
    </main>
  );
}

// ── The range ────────────────────────────────────────────────────

function RangeBar({ stats, range }: { stats: CallStats | null; range: ReturnType<typeof callRange> }) {
  const custom = typeof range.token !== 'string';
  return (
    <div className="hstack" style={{ gap: 10, flexWrap: 'wrap' }}>
      <nav className="atabs" aria-label="Date range">
        {CALL_RANGE_PRESETS.map((p) => (
          <Link key={p} href={`/studio/clients/analytics/calling?range=${p}`} aria-current={!custom && range.token === p ? 'page' : undefined}>
            {CALL_RANGE_LABELS[p]}
          </Link>
        ))}
      </nav>
      {/* Pick dates: a plain GET form, so the range is in the URL and the page works without JavaScript. */}
      <form method="get" action="/studio/clients/analytics/calling" className="hstack" style={{ gap: 6 }} aria-label="Pick dates">
        <input name="from" type="date" aria-label="From" required defaultValue={custom ? range.fromDay : ''} className="fld sm" />
        <span className="muted sm">to</span>
        <input name="to" type="date" aria-label="To" defaultValue={custom ? range.toDay : ''} className="fld sm" />
        <button type="submit" className={`btn sm ${custom ? 'acc' : 'sec'}`}>
          Show
        </button>
      </form>
      {stats && range.days.length > 1 ? <span className="muted sm">{`${shortDay(range.fromDay)} – ${shortDay(range.toDay)}`}</span> : null}
    </div>
  );
}

// ── The headline ─────────────────────────────────────────────────

function Tiles({ stats }: { stats: CallStats }) {
  const t = stats.total;
  const tiles = [
    { label: 'Dials', value: n(t.dials), note: `${n(t.dialled)} different leads` },
    { label: 'Picked up', value: n(t.connects), note: t.connectRate === null ? 'no dials yet' : `${t.connectRate}% of dials` },
    { label: 'Leads reached', value: n(t.reached), note: 'spoke to at least once' },
    { label: 'Tries to get through', value: tries(t.medianTries), note: t.firstConnects ? `median, over ${n(t.firstConnects)} first pick-ups` : 'nobody reached for the first time' },
    { label: 'Wait for a first call', value: waitLabel(t.medianMinutesToFirstCall), note: t.firstCalls ? `median, over ${n(t.firstCalls)} new leads` : 'no new leads rung' },
    {
      label: 'New, not rung yet',
      value: n(stats.notCalled),
      note: 'arrived in these days',
      tone: stats.notCalled > 0 ? 'var(--warn)' : undefined,
    },
  ];
  return (
    <div className="cl-kpis">
      {tiles.map((x) => (
        <div key={x.label} className="cl-stat">
          <span className="l">{x.label}</span>
          <span className="v" style={x.tone ? { color: x.tone } : undefined}>
            {x.value}
          </span>
          <span className="s">{x.note}</span>
        </div>
      ))}
    </div>
  );
}

// ── Per person ───────────────────────────────────────────────────

const COLUMNS: { key: string; label: string; title: string }[] = [
  { key: 'dials', label: 'Dials', title: 'Calls logged, whatever happened' },
  { key: 'connects', label: 'Picked up', title: 'Spoke to them, asked to call back, or not interested' },
  { key: 'rate', label: 'Rate', title: 'Picked up ÷ dials' },
  { key: 'reached', label: 'Leads reached', title: 'Different leads they spoke to' },
  { key: 'tries', label: 'Tries to get through', title: 'Median missed calls before a lead first picked up (0: the first ring got through)' },
  { key: 'wait', label: 'Wait for first call', title: 'Median time from a new lead arriving to their first call on it' },
];

function People({ stats, seesAll }: { stats: CallStats; seesAll: boolean }) {
  const rows = stats.people;
  return (
    <section className="card flush" style={{ overflow: 'hidden' }}>
      <div className="chead">
        <h2>{seesAll ? 'By salesperson' : 'Your calls'}</h2>
        <span className="muted sm">{stats.range.label.toLowerCase()}</span>
      </div>
      {rows.length === 0 ? (
        <p className="muted" style={{ margin: 0, padding: '0 18px 18px' }}>
          No calls logged in these days.
        </p>
      ) : (
        <div className="tscroll">
          <table className="tbl" style={{ minWidth: 720 }}>
            <thead>
              <tr>
                <th scope="col">Person</th>
                {COLUMNS.map((c) => (
                  <th key={c.key} scope="col" title={c.title}>
                    {c.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => (
                <PersonRow key={p.memberId ?? 'none'} p={p} />
              ))}
              {seesAll && rows.length > 1 ? <PersonRow p={stats.total} strong /> : null}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function PersonRow({ p, strong }: { p: PersonCalls; strong?: boolean }) {
  const style = strong ? { fontWeight: 700, borderTop: '1px solid var(--line)' } : undefined;
  return (
    <tr>
      <td style={{ fontWeight: strong ? 700 : 600, ...(strong ? { borderTop: '1px solid var(--line)' } : {}) }}>{p.name}</td>
      <td className="mono" style={style}>
        {n(p.dials)}
      </td>
      <td className="mono" style={style}>
        {n(p.connects)}
      </td>
      <td className="mono" style={style}>
        {p.connectRate === null ? '—' : `${p.connectRate}%`}
      </td>
      <td className="mono" style={style}>
        {n(p.reached)}
      </td>
      <td className="mono" style={style} title={p.firstConnects ? `${n(p.firstConnects)} leads picked up for the first time` : undefined}>
        {tries(p.medianTries)}
      </td>
      <td className="mono" style={style} title={p.firstCalls ? `${n(p.firstCalls)} new leads rung first by ${strong ? 'anyone' : p.name}` : undefined}>
        {waitLabel(p.medianMinutesToFirstCall)}
      </td>
    </tr>
  );
}

// ── Dials per day ────────────────────────────────────────────────

function Daily({ stats }: { stats: CallStats }) {
  const days = stats.daily;
  const max = Math.max(1, ...days.map((d) => d.dials));
  /* Past about six weeks a bar per day is too thin to point at; the labels thin out, the bars stay daily. */
  const every = days.length <= 10 ? 1 : days.length <= 45 ? 7 : 30;
  return (
    <section className="card">
      <h2 className="h">Dials per day</h2>
      <p className="cl-sub" style={{ maxWidth: '52ch', lineHeight: 1.5 }}>
        The whole bar is dials; the darker part is the calls where they picked up.
      </p>
      {stats.total.dials === 0 ? (
        <p className="muted" style={{ margin: 0 }}>
          No calls logged in these days.
        </p>
      ) : (
        <div role="img" aria-label={`Dials per day, ${stats.range.label.toLowerCase()}: ${n(stats.total.dials)} dials in all`}>
          <div className="flex items-end" style={{ gap: days.length > 60 ? 1 : 3, height: 160 }}>
            {days.map((d) => (
              <div
                key={d.day}
                title={`${shortDay(d.day)}: ${n(d.dials)} dials, ${n(d.connects)} picked up`}
                className="flex flex-1 flex-col justify-end overflow-hidden"
                style={{ height: `${(d.dials / max) * 100}%`, minHeight: d.dials > 0 ? 2 : 0, background: 'var(--line)', borderRadius: '4px 4px 0 0' }}
              >
                <div style={{ height: d.dials > 0 ? `${(d.connects / d.dials) * 100}%` : 0, background: 'var(--acc)' }} />
              </div>
            ))}
          </div>
          <div className="flex" style={{ gap: days.length > 60 ? 1 : 3, marginTop: 6 }}>
            {days.map((d, i) => (
              <span key={d.day} className="mono muted flex-1 overflow-visible whitespace-nowrap" style={{ fontSize: 11 }}>
                {i % every === 0 ? shortDay(d.day) : ''}
              </span>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

// ── Stage to stage ───────────────────────────────────────────────

function StepsCard({ stats }: { stats: CallStats }) {
  const { rows, allTheWay } = stats.steps;
  return (
    <section className="card">
      <h2 className="h">Moving on</h2>
      <p className="cl-sub" style={{ maxWidth: '52ch', lineHeight: 1.5 }}>
        Of the leads that came into each column in these days, how many have since moved further along. Recent days read lower: those leads have had
        less time.
      </p>
      {rows.length === 0 ? (
        <p className="muted" style={{ margin: 0 }}>
          Your board needs at least two columns for this.
        </p>
      ) : (
        <ul className="m-0 flex list-none flex-col gap-3 p-0">
          {rows.map((r) => (
            <li key={`${r.from}→${r.to}`}>
              <div className="mb-1 flex items-baseline justify-between gap-3">
                <span className="truncate text-[13.5px]">
                  {r.from} <span className="muted">→</span> {r.to}
                </span>
                <span className="mono muted sm" style={{ flex: 'none' }}>
                  {r.entered === 0 ? 'none came in' : `${n(r.movedOn)} of ${n(r.entered)}${r.rate === null ? '' : ` · ${r.rate}%`}`}
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full" style={{ background: 'var(--fill)' }}>
                <div className="h-full rounded-full" style={{ background: 'var(--acc)', width: `${r.rate ?? 0}%` }} />
              </div>
            </li>
          ))}
        </ul>
      )}
      {allTheWay && allTheWay.arrived > 0 ? (
        <p className="sm" style={{ margin: '14px 0 0' }}>
          {`Of ${n(allTheWay.arrived)} new leads in these days, ${n(allTheWay.won)} have reached ${allTheWay.wonLabel}`}
          {allTheWay.rate === null ? '.' : ` (${allTheWay.rate}%).`}
        </p>
      ) : null}
    </section>
  );
}

// ── Words ────────────────────────────────────────────────────────

const n = (x: number) => x.toLocaleString('en-IN');

function tries(m: number | null): string {
  if (m === null) return '—';
  if (m === 0) return 'First ring';
  return Number.isInteger(m) ? String(m) : m.toFixed(1);
}
