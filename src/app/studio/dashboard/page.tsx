import type { Metadata } from 'next';
import Link from 'next/link';
import { PageHead, PageBody } from '../StudioShell';
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
      <PageBody>
        <p className="m-0 text-[15px] text-[var(--s-ink-2)]">The dashboard is for the people who work leads. Ask your studio owner if you should see it.</p>
      </PageBody>
    );
  }
  const label = rangeLabel(range);
  const booked = d.range.find((k) => k.key === 'booked');

  return (
    <>
      <PageHead title="Dashboard" sub={d.seesAll ? 'Every lead in the studio. Click any number to see those leads.' : 'Your leads. Click any number to see them.'} />
      <PageBody>
        <div className="flex max-w-[72rem] flex-col gap-7">
          <Section title="Right now">
            <Tiles kpis={d.now} />
          </Section>

          <Section title="New leads">
            <Tiles kpis={d.fresh} />
          </Section>

          <section className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="m-0 text-[15.5px] font-semibold">What happened · {label}</h2>
              <RangePicker value={rangeToString(range)} />
            </div>
            <Tiles kpis={d.range} />
            <div className="grid gap-3 sm:grid-cols-2">
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

          <div className="grid gap-5 lg:grid-cols-2">
            <section className="s-card overflow-hidden">
              <div className="flex items-baseline justify-between gap-3 bg-[var(--s-surface-2)] px-4 py-2.5">
                <h2 className="m-0 text-[14.5px] font-semibold">Where they came from</h2>
                <span className="text-[12.5px] text-[var(--s-ink-3)]">added {label.toLowerCase()}</span>
              </div>
              {d.sources.length === 0 ? (
                <p className="m-0 px-4 py-4 text-[13.5px] italic text-[var(--s-ink-3)]">No new leads in these days.</p>
              ) : (
                <table className="w-full border-collapse text-[13.5px]">
                  <thead>
                    <tr className="text-left">
                      {['Source', 'Leads', 'Booked', 'Conversion'].map((h) => (
                        <th key={h} scope="col" className="s-label px-4 py-2 font-medium">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {d.sources.map((s) => (
                      <tr key={s.source} className="border-t border-[var(--s-rule-soft)]">
                        <td className="px-4 py-2">{s.label}</td>
                        <td className="px-4 py-2">
                          <NumLink href={list({ source: [s.source], added: range })} n={s.leads} />
                        </td>
                        <td className="px-4 py-2">
                          <NumLink href={list({ source: [s.source], ...convertedFilters(range) })} n={s.booked} />
                        </td>
                        <td className="s-num px-4 py-2">{pctText(s.pct)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </section>

            <section className="s-card overflow-hidden">
              <div className="flex items-baseline justify-between gap-3 bg-[var(--s-surface-2)] px-4 py-2.5">
                <h2 className="m-0 text-[14.5px] font-semibold">Lost</h2>
                <Link href={list(LOST_FILTERS)} className="s-num text-[13px] text-[var(--s-accent)] no-underline">
                  {d.lost.total.toLocaleString('en-IN')} in all
                </Link>
              </div>
              {d.lost.reasons.length === 0 ? (
                <p className="m-0 px-4 py-4 text-[13.5px] italic text-[var(--s-ink-3)]">Nothing marked lost with a reason yet.</p>
              ) : (
                <ul className="m-0 flex list-none flex-col p-0">
                  {d.lost.reasons.map((r) => (
                    <li key={r.reason} className="flex items-baseline justify-between gap-3 border-t border-[var(--s-rule-soft)] px-4 py-2 text-[13.5px]">
                      <span>{r.label}</span>
                      <NumLink href={list({ ...LOST_FILTERS, lost: r.reason })} n={r.count} />
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>

          {d.seesAll && d.people.length > 0 ? (
            <section className="s-card overflow-x-auto">
              <div className="flex items-baseline justify-between gap-3 bg-[var(--s-surface-2)] px-4 py-2.5">
                <h2 className="m-0 text-[14.5px] font-semibold">By salesperson</h2>
                <span className="text-[12.5px] text-[var(--s-ink-3)]">quotes and bookings: {label.toLowerCase()}</span>
              </div>
              <table className="w-full min-w-[40rem] border-collapse text-[13.5px]">
                <thead>
                  <tr className="text-left">
                    <th scope="col" className="s-label px-4 py-2 font-medium">
                      Person
                    </th>
                    {d.columns.map((c) => (
                      <th key={c.key} scope="col" className="s-label px-4 py-2 font-medium">
                        {c.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {d.people.map((p) => (
                    <tr key={p.id} className="border-t border-[var(--s-rule-soft)]">
                      <td className="px-4 py-2 font-medium">{p.name}</td>
                      {d.columns.map((c) => (
                        <td key={c.key} className="px-4 py-2">
                          <NumLink href={list({ ...c.filters, owner: p.id })} n={p.cells[c.key] ?? 0} bad={c.key === 'missed'} />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          ) : null}
        </div>
      </PageBody>
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="m-0 text-[15.5px] font-semibold">{title}</h2>
      {children}
    </section>
  );
}

function Tiles({ kpis }: { kpis: Kpi[] }) {
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      {kpis.map((k) => (
        <Tile key={k.key} href={list(k.filters)} label={k.label} value={k.value.toLocaleString('en-IN')} note={k.note} bad={k.bad === true && k.value > 0} />
      ))}
    </div>
  );
}

function Tile({ href, label, value, note, bad }: { href: string; label: string; value: string; note?: string; bad?: boolean }) {
  return (
    <Link href={href} className="s-card flex flex-col gap-1 px-4 py-3 text-[var(--s-ink)] no-underline transition-colors hover:border-[var(--s-ink-3)]">
      <span className="s-label">{label}</span>
      <span className={`s-num text-[24px] font-semibold leading-tight ${bad ? 'text-[var(--s-bad)]' : ''}`}>{value}</span>
      {note ? <span className="text-[12.5px] leading-snug text-[var(--s-ink-3)]">{note}</span> : null}
    </Link>
  );
}

function NumLink({ href, n, bad }: { href: string; n: number; bad?: boolean }) {
  if (n === 0) return <span className="s-num text-[var(--s-ink-3)]">0</span>;
  return (
    <Link href={href} className={`s-num font-medium no-underline hover:underline ${bad ? 'text-[var(--s-bad)]' : 'text-[var(--s-accent)]'}`}>
      {n.toLocaleString('en-IN')}
    </Link>
  );
}
