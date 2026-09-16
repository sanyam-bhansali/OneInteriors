import Link from 'next/link';
import type { Metadata } from 'next';
import { PageHead, PageBody } from '../StudioShell';
import { formatINR, formatINRCompact } from '@/lib/money';
import { myProjects, PROJECT_STAGE_LABELS } from '@/modules/studio-practice/projects';
import { myClients } from '@/modules/studio-practice/clients';
import { NewProject, StageMover } from './ProjectControls';

export const metadata: Metadata = {
  title: 'Projects',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

/**
 * Sites that are running.
 *
 * ## What the numbers mean, and what they do not
 *
 * `Contract` is what the client agreed, frozen when the project was created.
 * `Committed` is what every trade on the site has been billed — summed from the
 * work orders, never stored.
 *
 * The gap between them is NOT margin, and the page does not call it that. A
 * studio's real cost also includes material bought directly, factory work, and
 * its own time, none of which this holds yet. Calling an incomplete subtraction
 * "profit" is how somebody prices the next job wrong, so the two figures sit
 * side by side and the arithmetic is left to the person who knows what is
 * missing.
 */
export default async function ProjectsPage() {
  const [projects, clients] = await Promise.all([myProjects(), myClients()]);

  const live = projects.filter((p) => p.stage !== 'CLOSED');
  const closed = projects.filter((p) => p.stage === 'CLOSED');
  const owed = projects.reduce((sum, p) => sum + Math.max(0, p.owedPaise), 0);

  // Only a client who has actually been won can become a project.
  // Won, by the studio's own definition of won — whatever they called the
  // column. See `stages.ts`.
  const eligible = clients.filter((c) => c.stageKind === 'WON');

  return (
    <>
      <PageHead
        title="Projects"
        sub={
          projects.length === 0
            ? 'Nothing running.'
            : `${live.length} live${owed > 0 ? ` · ${formatINRCompact(owed)} owed to trades` : ''}`
        }
        action={<NewProject clients={eligible.map((c) => ({ id: c.id, name: c.name }))} />}
      />

      <PageBody>
        {projects.length === 0 ? (
          <div className="s-card p-8">
            <p className="m-0 mb-2 text-[15.5px] font-semibold">A project is a client you won.</p>
            <p className="m-0 mb-4 max-w-[62ch] text-[14.5px] leading-relaxed text-[var(--s-ink-2)]">
              It holds the contract figure, the dates, and every work order you raise against the
              site. Vendors get paid against a project, so this is what has to exist before the
              ledger means anything.
            </p>
            {eligible.length === 0 ? (
              <p className="m-0 text-[14px] text-[var(--s-ink-3)]">
                Mark a client as booked on the{' '}
                <Link href="/studio/clients" className="text-[var(--s-accent)]">
                  clients board
                </Link>{' '}
                first — a project needs somebody to belong to.
              </p>
            ) : null}
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            <ul className="m-0 grid list-none grid-cols-1 gap-3 p-0 xl:grid-cols-2">
              {live.map((p) => (
                <li key={p.id} className="s-card p-4">
                  <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                    <span className="text-[15.5px] font-semibold">{p.name}</span>
                    <span className="s-tag">{PROJECT_STAGE_LABELS[p.stage]}</span>
                    {p.targetDate ? (
                      <span className="s-label ml-auto">
                        due {p.targetDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                      </span>
                    ) : null}
                  </div>

                  <p className="m-0 mt-0.5 text-[13.5px] text-[var(--s-ink-2)]">
                    {p.clientName}
                    {p.clientPhone ? (
                      <a href={`tel:${p.clientPhone}`} className="s-num ml-2 text-[var(--s-accent)] no-underline">
                        {p.clientPhone}
                      </a>
                    ) : null}
                  </p>

                  <dl className="m-0 mt-3 grid grid-cols-3 gap-2 border-t border-[var(--s-rule-soft)] pt-3">
                    <Figure label="Contract" value={p.contractPaise} />
                    <Figure label="Committed to trades" value={p.committedPaise} />
                    <Figure label="Owed" value={p.owedPaise} emphasis={p.owedPaise > 0} />
                  </dl>

                  <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-[var(--s-rule-soft)] pt-3">
                    <StageMover projectId={p.id} stage={p.stage} />
                    <Link
                      href="/studio/vendors"
                      className="text-[13px] text-[var(--s-accent)] no-underline"
                    >
                      {p.workOrderCount === 0
                        ? 'Raise a work order →'
                        : `${p.workOrderCount} work order${p.workOrderCount === 1 ? '' : 's'} →`}
                    </Link>
                  </div>
                </li>
              ))}
            </ul>

            {closed.length > 0 ? (
              <details>
                <summary className="mb-3 cursor-pointer select-none text-[13.5px] font-medium text-[var(--s-ink-2)]">
                  Closed ({closed.length})
                </summary>
                <ul className="m-0 flex list-none flex-col gap-2 p-0">
                  {closed.map((p) => (
                    <li key={p.id} className="s-card flex flex-wrap items-baseline gap-x-4 px-4 py-3">
                      <span className="text-[14px] font-medium">{p.name}</span>
                      <span className="text-[13px] text-[var(--s-ink-3)]">{p.clientName}</span>
                      <span className="s-num ml-auto text-[13.5px]">
                        {p.contractPaise ? formatINR(p.contractPaise) : '—'}
                      </span>
                    </li>
                  ))}
                </ul>
              </details>
            ) : null}

            <p className="m-0 max-w-[70ch] text-[13px] leading-relaxed text-[var(--s-ink-3)]">
              <strong className="font-semibold text-[var(--s-ink-2)]">
                Contract minus committed is not your margin.
              </strong>{' '}
              It leaves out material you buy directly, factory work and your own time. We show both
              figures rather than the subtraction, because an incomplete one would price your next
              job wrong.
            </p>
          </div>
        )}
      </PageBody>
    </>
  );
}

function Figure({
  label,
  value,
  emphasis = false,
}: {
  label: string;
  value: number | null;
  emphasis?: boolean;
}) {
  return (
    <div>
      <dt className="s-label m-0">{label}</dt>
      <dd
        className={`s-num m-0 mt-0.5 text-[14.5px] ${emphasis ? 'font-semibold text-[var(--s-accent)]' : 'font-medium'}`}
      >
        {value === null ? '—' : formatINR(value)}
      </dd>
    </div>
  );
}
