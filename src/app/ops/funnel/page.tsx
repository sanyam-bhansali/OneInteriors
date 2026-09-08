import type { Metadata } from 'next';
import { Container } from '@/components/ui';
import { OpsHeader } from '../ui';
import { requireRole } from '@/modules/auth/session';
import { funnelSummary } from '@/modules/analytics/record';
import { worstStep } from '@/modules/analytics/events';

export const metadata: Metadata = {
  title: 'Funnel',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

const QUESTIONS = [
  'Property and area',
  'Scope',
  'Budget',
  'Styles you like',
  'Styles you do not',
  'Household',
  'Priorities',
  'Working style',
  'Timeline',
];

export default async function FunnelPage() {
  await requireRole('OPS');
  const summary = await funnelSummary(30);
  const worst = worstStep(summary.steps);

  return (
    <>
      <OpsHeader />
      <main className="py-8">
        <Container size="wide">
          <p className="label m-0 mb-2">Last 30 days</p>
          <h1 className="h1 mb-8">Where the quiz loses people</h1>

          <div className="mb-10 grid grid-cols-2 gap-6 sm:grid-cols-4">
            <Stat label="Quiz starts" value={summary.quizStarts} />
            <Stat label="Completions" value={summary.quizCompletions} />
            <Stat
              label="Completion rate"
              value={
                summary.completionRate === null
                  ? null
                  : `${Math.round(summary.completionRate * 100)}%`
              }
            />
            <Stat label="Enquiries sent" value={summary.enquiries} />
          </div>

          {summary.quizStarts === 0 ? (
            <p className="m-0 rounded-[10px] border border-[var(--color-rule)] bg-[var(--color-paper-2)] px-5 py-6 text-[15px] italic text-[var(--color-ink-3)]">
              Nothing recorded yet. Events start arriving the first time somebody opens the quiz on
              a deployment with a database.
            </p>
          ) : (
            <>
              {worst ? (
                <p className="m-0 mb-6 max-w-[62ch] rounded-[10px] border-l-2 border-[var(--color-brass)] bg-[var(--color-paper-2)] px-5 py-4 text-[15px] leading-relaxed text-[var(--color-ink-2)]">
                  Worst step is <strong>Q{worst.step} — {QUESTIONS[worst.step - 1]}</strong>, losing{' '}
                  {Math.round((worst.dropOff ?? 0) * 100)}% of the {worst.views} people who reached
                  it.
                </p>
              ) : null}

              <table className="w-full border-collapse text-[14.5px]">
                <thead>
                  <tr className="border-b border-[var(--color-rule)] text-left">
                    <th className="py-2 pr-4 font-normal text-[var(--color-ink-3)]">Question</th>
                    <th className="py-2 pr-4 text-right font-normal text-[var(--color-ink-3)]">Saw it</th>
                    <th className="py-2 pr-4 text-right font-normal text-[var(--color-ink-3)]">Answered</th>
                    <th className="py-2 text-right font-normal text-[var(--color-ink-3)]">Lost here</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.steps.map((s) => (
                    <tr key={s.step} className="border-b border-[var(--color-rule-soft)]">
                      <td className="py-2.5 pr-4">
                        <span className="font-[family-name:var(--font-mono)] text-[11px] text-[var(--color-ink-3)]">
                          Q{s.step}
                        </span>{' '}
                        {QUESTIONS[s.step - 1] ?? ''}
                      </td>
                      <td className="py-2.5 pr-4 text-right tabular-nums">{s.views}</td>
                      <td className="py-2.5 pr-4 text-right tabular-nums">{s.completions}</td>
                      <td
                        className={`py-2.5 text-right tabular-nums ${
                          s.dropOff !== null && s.dropOff > 0.2
                            ? 'text-[var(--color-atrisk)]'
                            : 'text-[var(--color-ink-2)]'
                        }`}
                      >
                        {/* Null, not 0% — a step nobody reached has no rate,
                            and printing 0% there reads as a success. */}
                        {s.dropOff === null ? '—' : `${Math.round(s.dropOff * 100)}%`}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}

          <p className="m-0 mt-8 max-w-[62ch] text-[13.5px] leading-relaxed text-[var(--color-ink-3)]">
            These rows are ours — no third-party analytics script runs on the site, and no visitor
            data leaves this database. Events carry counts, slugs and enum values only; anything
            resembling a name, email or phone number is stripped before the row is written.
          </p>
        </Container>
      </main>
    </>
  );
}

function Stat({ label, value }: { label: string; value: number | string | null }) {
  return (
    <div>
      <p className="label m-0 mb-1">{label}</p>
      <p className="m-0 font-[family-name:var(--font-display)] text-[30px] leading-none text-[var(--color-ink)]">
        {value === null ? (
          <span className="text-[16px] italic text-[var(--color-ink-3)]">Not enough data</span>
        ) : (
          value
        )}
      </p>
    </div>
  );
}
