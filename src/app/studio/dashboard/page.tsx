import type { Metadata } from 'next';
import Link from 'next/link';
import '../clients/clients.css';
import { formatINRCompact } from '@/lib/money';
import { myDashboard, type Kpi } from '@/modules/studio-sales/dashboard';
import { leadsHref, type LeadFilters } from '@/modules/studio-sales/lead-filters';
import { parseRange, rangeLabel, rangeToString } from '@/modules/studio-sales/ist-range';
import { LOST_FILTERS, convertedFilters, pctText } from '@/modules/studio-sales/dashboard-rules';
import { RangePicker } from './RangePicker';

export const metadata: Metadata = { title: 'Dashboard', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

const list = (f: LeadFilters) => leadsHref(f, { view: 'list' });

/**
 * The sales dashboard (leads at scale, 12 Oct 2026). Every number is
 * counted in SQL and is a link to the leads list showing exactly those
 * leads. Owner and PM see the studio and each salesperson; a salesperson
 * the same page for their own leads, with the pool they can claim from.
 */
export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ range?: string }> }) {
  const sp = await searchParams;
  const range = parseRange(sp.range) ?? '7d';
  const d = await myDashboard(range);
  if (!d) {
    return (
      <main className="content cl-page">
        <div className="empty">
          <b>The numbers are for the people who work leads.</b>
          <span className="muted">Ask your studio owner if you should see them.</span>
        </div>
      </main>
    );
  }
  const label = rangeLabel(range);
  const booked = d.range.find((k) => k.key === 'booked');

  return (
    <main className="content cl-page" style={{ maxWidth: 1240 }}>
      <div className="phead">
        <div>
          <h1>Numbers</h1>
          <p className="muted">{d.seesAll ? 'Every lead in the studio. Tap any number to see those leads.' : 'Your leads. Tap any number to see them.'}</p>
        </div>
      </div>

      <Section title="Right now">
        <Tiles kpis={d.now} />
      </Section>

      <Section title="New leads">
        <Tiles kpis={d.fresh} />
      </Section>

      <section style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div className="cl-row">
          <h2 className="cl-sec">What happened · {label}</h2>
          <RangePicker value={rangeToString(range)} />
        </div>
        <Tiles kpis={d.range} />
        <div className="cl-sgrid two">
          <Tile
            href={list({ booked: range })}
            label="Booked value"
            value={d.bookedPaise > 0 ? formatINRCompact(d.bookedPaise) : '—'}
            note={`sales final total of the ${booked?.value ?? 0} booking${booked?.value === 1 ? '' : 's'}`}
          />
          <Tile
            href={list(convertedFilters(range))}
            label="Conversion"
            value={pctText(d.conversion.pct)}
            note={d.conversion.added === 0 ? 'no new leads in these days' : `${d.conversion.booked} of the ${d.conversion.added} leads added have booked`}
          />
        </div>
      </section>

      <div className="cols">
        <section className="card flush" style={{ flex: '1 1 420px', overflow: 'hidden' }}>
          <div className="chead">
            <h2>Where they came from</h2>
            <span className="muted sm">added {label.toLowerCase()}</span>
          </div>
          {d.sources.length === 0 ? (
            <p className="muted" style={{ margin: 0, padding: '0 18px 18px' }}>No new leads in these days.</p>
          ) : (
            <div className="tscroll">
              <table className="tbl">
                <thead>
                  <tr>
                    {['Source', 'Leads', 'Booked', 'Conversion'].map((h) => (
                      <th key={h} scope="col">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {d.sources.map((s) => (
                    <tr key={s.source}>
                      <td>{s.label}</td>
                      <td>
                        <NumLink href={list({ source: [s.source], added: range })} n={s.leads} />
                      </td>
                      <td>
                        <NumLink href={list({ source: [s.source], ...convertedFilters(range) })} n={s.booked} />
                      </td>
                      <td className="mono">{pctText(s.pct)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="card flush" style={{ flex: '1 1 420px', overflow: 'hidden' }}>
          <div className="chead">
            <h2>Lost</h2>
            <Link href={list(LOST_FILTERS)} className="mono cl-link sm">
              {d.lost.total.toLocaleString('en-IN')} in all
            </Link>
          </div>
          {d.lost.reasons.length === 0 ? (
            <p className="muted" style={{ margin: 0, padding: '0 18px 18px' }}>Nothing marked lost with a reason yet.</p>
          ) : (
            <ul className="cl-rows" style={{ padding: '0 18px 8px' }}>
              {d.lost.reasons.map((r) => (
                <li key={r.reason} style={{ justifyContent: 'space-between' }}>
                  <span>{r.label}</span>
                  <NumLink href={list({ ...LOST_FILTERS, lost: r.reason })} n={r.count} />
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {d.seesAll && d.people.length > 0 ? (
        <section className="card flush" style={{ overflow: 'hidden' }}>
          <div className="chead">
            <h2>By salesperson</h2>
            <span className="muted sm">quotes and bookings: {label.toLowerCase()}</span>
          </div>
          <div className="tscroll">
            <table className="tbl" style={{ minWidth: 640 }}>
              <thead>
                <tr>
                  <th scope="col">Person</th>
                  {d.columns.map((c) => (
                    <th key={c.key} scope="col">
                      {c.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {d.people.map((p) => (
                  <tr key={p.id}>
                    <td style={{ fontWeight: 600 }}>{p.name}</td>
                    {d.columns.map((c) => (
                      <td key={c.key}>
                        <NumLink href={list({ ...c.filters, owner: p.id })} n={p.cells[c.key] ?? 0} bad={c.key === 'missed'} />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <h2 className="cl-sec">{title}</h2>
      {children}
    </section>
  );
}

function Tiles({ kpis }: { kpis: Kpi[] }) {
  return (
    <div className="cl-sgrid">
      {kpis.map((k) => (
        <Tile key={k.key} href={list(k.filters)} label={k.label} value={k.value.toLocaleString('en-IN')} note={k.note} bad={k.bad === true && k.value > 0} />
      ))}
    </div>
  );
}

function Tile({ href, label, value, note, bad }: { href: string; label: string; value: string; note?: string; bad?: boolean }) {
  return (
    <Link href={href} className={`cl-stat ${bad ? 'bad' : ''}`}>
      <span className="l">{label}</span>
      <span className="v">{value}</span>
      {note ? <span className="s">{note}</span> : null}
    </Link>
  );
}

function NumLink({ href, n, bad }: { href: string; n: number; bad?: boolean }) {
  if (n === 0) return <span className="mono muted">0</span>;
  return (
    <Link href={href} className="mono" style={{ fontWeight: 600, color: bad ? 'var(--bad)' : 'var(--acc)' }}>
      {n.toLocaleString('en-IN')}
    </Link>
  );
}
