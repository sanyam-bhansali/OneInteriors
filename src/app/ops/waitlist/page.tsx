import type { Metadata } from 'next';
import { Container, Pill } from '@/components/ui';
import { OpsHeader } from '../ui';
import { waitlistSummary, recentSignups } from '@/modules/waitlist/ingest';
import { getCurrentUser, hasRole } from '@/modules/auth/session';

export const metadata: Metadata = {
  title: 'Waitlist',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

const IST = 'Asia/Kolkata';

function whenIST(d: Date): string {
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: IST,
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  }).format(d);
}

/**
 * Pre-launch signups from oneinteriors.in.
 *
 * `via` is the whole reason this page is worth opening. The campaign is one
 * WhatsApp message per society group, each with its own link — so this table
 * answers "which societies actually worked", which is not knowable any other
 * way and decides where the next week of asking goes.
 */
export default async function WaitlistPage() {
  const user = await getCurrentUser();
  if (!hasRole(user, 'OPS')) {
    return (
      <>
        <OpsHeader />
        <Container size="wide">
          <p className="py-16 text-[var(--color-ink-2)]">Not for you.</p>
        </Container>
      </>
    );
  }

  const [summary, rows] = await Promise.all([waitlistSummary(), recentSignups(200)]);

  return (
    <>
      <OpsHeader />
      <Container size="wide">
        <div className="py-8">
          <h1 className="font-[family-name:var(--font-display)] text-[32px] leading-tight">
            Waitlist
          </h1>
          <p className="mt-1 max-w-[62ch] text-[15px] text-[var(--color-ink-2)]">
            People who joined at oneinteriors.in before launch. Each one was told we
            would use their number to tell them when we go live — and nothing else.
          </p>

          {/* ---- the three numbers ---- */}
          <div className="mt-7 grid grid-cols-3 gap-3 sm:max-w-[520px]">
            {[
              { label: 'Total', value: summary.total },
              { label: 'Last 24h', value: summary.last24h },
              { label: 'Last 7 days', value: summary.last7d },
            ].map((s) => (
              <div key={s.label} className="border border-[var(--color-rule)] px-4 py-3">
                <div className="font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.16em] text-[var(--color-ink-3)]">
                  {s.label}
                </div>
                <div className="mt-1 font-[family-name:var(--font-display)] text-[28px] leading-none">
                  {s.value}
                </div>
              </div>
            ))}
          </div>

          {/* ---- which societies worked ---- */}
          <h2 className="mt-10 font-[family-name:var(--font-display)] text-[21px]">
            Where they came from
          </h2>
          {summary.bySource.length === 0 ? (
            <p className="mt-2 text-[15px] text-[var(--color-ink-3)]">Nobody yet.</p>
          ) : (
            <table className="mt-3 w-full border-collapse text-[15px] sm:max-w-[640px]">
              <thead>
                <tr className="border-b border-[var(--color-rule)] text-left font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.16em] text-[var(--color-ink-3)]">
                  <th className="py-2 font-normal">Share link</th>
                  <th className="py-2 text-right font-normal">Signups</th>
                  <th className="py-2 text-right font-normal">Latest</th>
                </tr>
              </thead>
              <tbody>
                {summary.bySource.map((s) => (
                  <tr key={s.via} className="border-b border-[var(--color-rule)]">
                    <td className="py-2.5">
                      {s.via === '(direct)' ? (
                        <span className="text-[var(--color-ink-3)]">no tag</span>
                      ) : (
                        <code className="font-[family-name:var(--font-mono)] text-[13px]">
                          ?s={s.via}
                        </code>
                      )}
                    </td>
                    <td className="py-2.5 text-right tabular-nums">{s.count}</td>
                    <td className="py-2.5 text-right text-[13px] text-[var(--color-ink-3)]">
                      {whenIST(s.latest)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {/* ---- the people ---- */}
          <h2 className="mt-10 font-[family-name:var(--font-display)] text-[21px]">
            Newest first
          </h2>
          {rows.length === 0 ? (
            <p className="mt-2 text-[15px] text-[var(--color-ink-3)]">
              Nothing yet. Check WAITLIST_INGEST_TOKEN is set in both projects.
            </p>
          ) : (
            <table className="mt-3 w-full border-collapse text-[15px]">
              <thead>
                <tr className="border-b border-[var(--color-rule)] text-left font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.16em] text-[var(--color-ink-3)]">
                  <th className="py-2 font-normal">Joined (IST)</th>
                  <th className="py-2 font-normal">Name</th>
                  <th className="py-2 font-normal">Contact</th>
                  <th className="py-2 font-normal">Style</th>
                  <th className="py-2 font-normal">Via</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-b border-[var(--color-rule)] align-top">
                    <td className="py-2.5 text-[13px] text-[var(--color-ink-3)] whitespace-nowrap">
                      {whenIST(r.createdAt)}
                    </td>
                    <td className="py-2.5">{r.name}</td>
                    <td className="py-2.5 font-[family-name:var(--font-mono)] text-[13px]">
                      {r.phone ?? r.email}
                    </td>
                    <td className="py-2.5 text-[var(--color-ink-2)]">{r.style ?? '—'}</td>
                    <td className="py-2.5">
                      {r.via ? (
                        <Pill tone="petrol">{r.via}</Pill>
                      ) : (
                        <span className="text-[var(--color-ink-3)]">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {rows.length >= 200 && (
            <p className="mt-3 text-[13px] text-[var(--color-ink-3)]">
              Showing the newest 200. Export the full list from Supabase.
            </p>
          )}
        </div>
      </Container>
    </>
  );
}
