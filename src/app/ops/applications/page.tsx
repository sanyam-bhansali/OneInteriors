import Link from 'next/link';
import type { Metadata } from 'next';
import { Container, Pill } from '@/components/ui';
import { OpsHeader } from '../ui';
import { listApplications } from '@/modules/studio/application';
import { validateGstin } from '@/modules/verification/gstin';
import { formatINRCompact, fromDb } from '@/lib/money';
import { PUNE_LOCALITIES } from '@/modules/brief/types';
import { DecisionForm } from './DecisionForm';

export const metadata: Metadata = {
  title: 'Applications',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

export default async function ApplicationsPage() {
  const applications = await listApplications();

  const open = applications.filter((a) => a.status === 'SUBMITTED' || a.status === 'REVIEWING');
  const closed = applications.filter((a) => a.status !== 'SUBMITTED' && a.status !== 'REVIEWING');

  return (
    <>
      <OpsHeader />

      <main className="py-8">
        <Container size="wide">
          <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="label m-0 mb-2">Applications</p>
              <h1 className="h1">
                {open.length} waiting on us
              </h1>
            </div>
            <Link href="/ops" className="label text-[var(--color-petrol)] no-underline">
              Verification queue →
            </Link>
          </div>

          {open.length === 0 ? (
            <p className="m-0 mb-10 rounded-[10px] border border-[var(--color-rule)] bg-[var(--color-paper-2)] px-5 py-6 text-[15px] italic text-[var(--color-ink-3)]">
              Nothing to review. Applications arrive from <code>/apply</code>.
            </p>
          ) : (
            <ul className="m-0 mb-12 flex list-none flex-col gap-4 p-0">
              {open.map((a) => {
                const gstin = a.gstin ? validateGstin(a.gstin) : null;
                return (
                  <li
                    key={a.id}
                    className="rounded-[14px] border border-[var(--color-rule)] bg-[var(--color-paper-2)] p-6"
                  >
                    <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
                      <div className="min-w-0">
                        <h2 className="h3 mb-1 text-[18px]">{a.tradeName}</h2>
                        <p className="m-0 text-[13.5px] text-[var(--color-ink-3)]">
                          {a.legalName ?? 'No legal name given'} · applied{' '}
                          {new Date(a.createdAt).toLocaleDateString('en-IN', {
                            day: 'numeric', month: 'short', year: 'numeric',
                          })}
                        </p>
                      </div>
                      <Pill tone={a.status === 'REVIEWING' ? 'petrol' : 'neutral'}>{a.status}</Pill>
                    </div>

                    <dl className="mb-5 grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-4">
                      <Detail label="Contact" value={`${a.contactName}`} />
                      <Detail label="Phone" value={a.phone} mono />
                      <Detail label="Email" value={a.email} />
                      <Detail
                        label="Range"
                        value={
                          a.minProjectPaise && a.maxProjectPaise
                            ? `${formatINRCompact(fromDb(a.minProjectPaise))}–${formatINRCompact(fromDb(a.maxProjectPaise))}`
                            : '—'
                        }
                      />
                      <Detail label="Years" value={a.yearsActive ? String(a.yearsActive) : '—'} />
                      <Detail label="Team" value={a.teamSize ? String(a.teamSize) : '—'} />
                      <Detail
                        label="GSTIN"
                        value={
                          !a.gstin
                            ? 'Not given'
                            : gstin?.valid
                              ? `${a.gstin} ✓`
                              : `${a.gstin} — invalid`
                        }
                        mono
                        tone={!a.gstin ? 'muted' : gstin?.valid ? 'ok' : 'bad'}
                      />
                      <Detail label="Heard via" value={a.howHeard ?? '—'} />
                    </dl>

                    <div className="mb-5 flex flex-wrap gap-1.5">
                      {a.localities.map((l) => (
                        <Pill key={l}>
                          {PUNE_LOCALITIES.find((p) => p.slug === l)?.label ?? l}
                        </Pill>
                      ))}
                    </div>

                    {a.about ? (
                      <p className="m-0 mb-5 max-w-[70ch] border-l-2 border-[var(--color-rule)] pl-4 text-[14.5px] leading-relaxed text-[var(--color-ink-2)]">
                        {a.about}
                      </p>
                    ) : null}

                    {(a.website || a.instagram) ? (
                      <p className="m-0 mb-5 flex flex-wrap gap-4 text-[13.5px]">
                        {a.website ? (
                          <a href={a.website} target="_blank" rel="noopener noreferrer nofollow" className="text-[var(--color-petrol)]">
                            {a.website} ↗
                          </a>
                        ) : null}
                        {a.instagram ? (
                          <span className="text-[var(--color-ink-3)]">{a.instagram}</span>
                        ) : null}
                      </p>
                    ) : null}

                    <DecisionForm id={a.id} tradeName={a.tradeName} />
                  </li>
                );
              })}
            </ul>
          )}

          {closed.length > 0 ? (
            <>
              <p className="label m-0 mb-3">Decided</p>
              <ul className="m-0 flex list-none flex-col gap-2 p-0">
                {closed.map((a) => (
                  <li
                    key={a.id}
                    className="flex flex-wrap items-baseline justify-between gap-3 border-b border-[var(--color-rule-soft)] py-3"
                  >
                    <span className="text-[14.5px] text-[var(--color-ink)]">{a.tradeName}</span>
                    <span className="flex items-center gap-3">
                      <span className="max-w-[46ch] text-[13px] text-[var(--color-ink-3)]">
                        {a.decisionReason ?? ''}
                      </span>
                      <Pill tone={a.status === 'APPROVED' ? 'ontrack' : 'atrisk'}>{a.status}</Pill>
                    </span>
                  </li>
                ))}
              </ul>
            </>
          ) : null}
        </Container>
      </main>
    </>
  );
}

function Detail({
  label,
  value,
  mono = false,
  tone = 'default',
}: {
  label: string;
  value: string;
  mono?: boolean;
  tone?: 'default' | 'ok' | 'bad' | 'muted';
}) {
  const colour =
    tone === 'ok'
      ? 'text-[var(--color-ontrack)]'
      : tone === 'bad'
        ? 'text-[var(--color-atrisk)]'
        : tone === 'muted'
          ? 'text-[var(--color-ink-3)]'
          : 'text-[var(--color-ink)]';
  return (
    <div className="min-w-0">
      <dt className="label m-0">{label}</dt>
      <dd className={`m-0 truncate text-[13.5px] ${mono ? 'font-[family-name:var(--font-mono)]' : ''} ${colour}`}>
        {value}
      </dd>
    </div>
  );
}
