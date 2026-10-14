import type { Metadata } from 'next';
import Link from 'next/link';
import '../clients.css';
import { leadAnalytics, type LeadAnalytics } from '@/modules/studio-practice/analytics';
import { SOURCE_LABELS, LOST_LABELS, QUIET_AFTER_DAYS } from '@/modules/studio-practice/vocabulary';
import { paiseToLakhs } from '@/lib/money';

export const metadata: Metadata = {
  title: 'Lead analytics',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

/**
 * Whether any of this is working.
 *
 * ## Six tiles, and none of them is "total leads"
 *
 * A total is a number that only goes up, so it can never be bad news and
 * therefore never means anything. What a studio owner actually needs at a
 * glance is the shape of the trouble: how much is going undone, how much has
 * gone quiet, how much is overdue.
 *
 * So the tiles lead with the three problems and follow with the three
 * outcomes. The total is there, once, as context on the first one.
 *
 * ## Every tile is a link
 *
 * A number you cannot act on is a number you learn to stop looking at.
 * "17 overdue" goes to the seventeen; "9 nobody has taken" goes to the pool.
 * AxLeads does the same thing with its KPI drill-downs and it is the single
 * feature that turns the tiles from decoration into a morning routine.
 *
 * ## Why source performance matters more here than anywhere else
 *
 * This is the interiors-specific part. A studio in Pune is spending money in
 * three or four places — Instagram, a builder relationship, walk-ins from a
 * showroom, and us — and has no idea which one produces work that closes.
 * The `won ÷ total` column per source is the only number on this page that
 * changes what somebody does on Monday, and it is the reason `ClientSource`
 * is an enum rather than free text.
 *
 * It is also, deliberately, the number that judges US. `ONE_INTERIORS` sits
 * in the same table as everything else with the same arithmetic applied.
 */
export default async function LeadAnalyticsPage() {
  const data = await leadAnalytics();

  if (!data) {
    return (
      <main className="content cl-page">
        <div className="phead">
          <h1>Analytics</h1>
        </div>
        <p className="muted" style={{ margin: 0 }}>
          We could not read your numbers just now. Nothing is lost — try again in a moment.
        </p>
      </main>
    );
  }

  if (data.total === 0) {
    return (
      <main className="content cl-page">
        <div className="phead">
          <div>
            <h1>Analytics</h1>
            <p className="muted">Nothing to measure yet.</p>
          </div>
        </div>
          <div className="empty">
            <b>No leads yet.</b>
            <p className="muted" style={{ margin: 0, maxWidth: '46ch' }}>
              Once you have a few, this page shows where they come from, which sources actually
              close, and what is going quiet.
            </p>
            <Link
              href="/studio/clients/import"
              className="btn sec"
            >
              Import a spreadsheet
            </Link>
          </div>
      </main>
    );
  }

  return (
    <main className="content cl-page" style={{ maxWidth: 1240 }}>
      <div className="phead">
        <div>
          <h1>Analytics</h1>
          <p className="muted">{`${data.total.toLocaleString('en-IN')} leads all time · ${data.newThisMonth} in the last 30 days`}</p>
        </div>
      </div>
      <Tiles data={data} />
      <div className="cols">
        <div className="colmain" style={{ flexBasis: 420 }}>
          <Sources data={data} />
        </div>
        <div className="colside" style={{ flexBasis: 420 }}>
          <Pipeline data={data} />
          <LostReasons data={data} />
        </div>
      </div>
    </main>
  );
}

// ── Tiles ────────────────────────────────────────────────────────

function Tiles({ data }: { data: LeadAnalytics }) {
  const tiles = [
    {
      label: 'Nobody has taken',
      value: data.pooled,
      note: 'waiting in the pool',
      href: '/studio/clients/pool',
      tone: data.pooled > 0 ? 'warn' : 'calm',
    },
    {
      label: 'Overdue',
      value: data.overdue,
      note: 'follow-up date has passed',
      href: '/studio/clients',
      tone: data.overdue > 0 ? 'bad' : 'calm',
    },
    {
      label: 'Gone quiet',
      value: data.quiet,
      note: `no contact in ${QUIET_AFTER_DAYS} days`,
      href: '/studio/clients',
      tone: data.quiet > 0 ? 'warn' : 'calm',
    },
    { label: 'Open', value: data.open, note: 'still in play', href: '/studio/clients', tone: 'calm' },
    { label: 'Won', value: data.won, note: winNote(data), href: '/studio/clients', tone: 'good' },
    {
      label: 'Won value',
      value: null,
      display: data.wonValuePaise > 0n ? `₹${paiseToLakhs(data.wonValuePaise).toFixed(1)}L` : '—',
      note: data.wonValuePaise > 0n ? 'quoted, on won leads' : 'no quotes on won leads yet',
      href: '/studio/quotations',
      tone: 'good',
    },
  ] as const;

  return (
    <div className="cl-kpis">
      {tiles.map((t) => (
        <Link key={t.label} href={t.href} className="cl-stat">
          <span className="l">{t.label}</span>
          <span className="v" style={toneStyle(t.tone)}>
            {'display' in t && t.display ? t.display : t.value}
          </span>
          <span className="s">{t.note}</span>
        </Link>
      ))}
    </div>
  );
}

function winNote(data: LeadAnalytics): string {
  /* Null, not 0%. A studio three days in should read "nothing has closed
     yet", not a verdict on work they have not finished. */
  if (data.winRate === null) return 'nothing closed yet';
  return `${data.winRate}% of ${data.won + data.lost} closed`;
}

function toneStyle(tone: string): React.CSSProperties | undefined {
  if (tone === 'bad') return { color: 'var(--bad)' };
  if (tone === 'warn') return { color: 'var(--warn)' };
  if (tone === 'good') return { color: 'var(--good)' };
  return undefined;
}

// ── Where they come from ─────────────────────────────────────────

function Sources({ data }: { data: LeadAnalytics }) {
  const max = Math.max(...data.bySource.map((s) => s.total), 1);

  return (
    <section className="card">
      <h2 className="h">Where they come from</h2>
      <p className="cl-sub" style={{ maxWidth: '52ch', lineHeight: 1.5 }}>
        The second number is how many closed. A source that brings plenty and closes none is
        costing you more than it looks.
      </p>

      <ul className="m-0 flex list-none flex-col gap-3 p-0">
        {data.bySource.map((s) => {
          const rate = s.total > 0 ? Math.round((s.won / s.total) * 100) : 0;
          return (
            <li key={s.source}>
              <div className="mb-1 flex items-baseline justify-between gap-3">
                <span className="truncate text-[13.5px]">
                  {SOURCE_LABELS[s.source as keyof typeof SOURCE_LABELS] ?? s.source}
                </span>
                <span className="mono muted sm" style={{ flex: 'none' }}>
                  {s.total} · {s.won} won{s.won > 0 ? ` (${rate}%)` : ''}
                </span>
              </div>
              {/* The bar is the share of leads; the filled part is the share
                  that closed. One bar carrying both is why this is worth
                  drawing rather than tabulating. */}
              <div className="h-2 overflow-hidden rounded-full" style={{ background: 'var(--fill)' }}>
                <div
                  className="h-full rounded-full"
                  style={{ background: 'var(--line)', width: `${(s.total / max) * 100}%` }}
                >
                  <div
                    className="h-full rounded-full"
                    style={{ background: 'var(--good-s)', width: `${s.total > 0 ? (s.won / s.total) * 100 : 0}%` }}
                  />
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

// ── The pipeline, as it stands ───────────────────────────────────

function Pipeline({ data }: { data: LeadAnalytics }) {
  const max = Math.max(...data.byStage.map((s) => s.count), 1);

  return (
    <section className="card">
      <h2 className="h">Your pipeline right now</h2>
      <ul className="m-0 flex list-none flex-col gap-2.5 p-0">
        {data.byStage.map((s) => (
          <li key={s.stageId} className="flex items-center gap-3">
            <span className="w-[34%] flex-none truncate text-[13.5px]">{s.name}</span>
            <div className="h-2.5 flex-1 overflow-hidden rounded-full" style={{ background: 'var(--fill)' }}>
              <div
                className="h-full rounded-full"
                style={{ background: 'var(--acc)', width: `${(s.count / max) * 100}%` }}
              />
            </div>
            <span className="mono muted sm w-9 flex-none text-right">
              {s.count}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

// ── Why the lost ones went ───────────────────────────────────────

function LostReasons({ data }: { data: LeadAnalytics }) {
  if (data.lostReasons.length === 0) return null;

  return (
    <section className="card">
      <h2 className="h">Why they went</h2>
      <p className="cl-sub" style={{ maxWidth: '52ch', lineHeight: 1.5 }}>
        Only counts leads you gave a reason for — which is every one you marked lost, because we
        make you say.
      </p>
      <ul className="m-0 flex list-none flex-wrap gap-2 p-0">
        {data.lostReasons.map((r) => (
          <li
            key={r.reason}
            className="chip"
          >
            {LOST_LABELS[r.reason as keyof typeof LOST_LABELS] ?? r.reason}
            <span className="mono muted">{r.count}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
