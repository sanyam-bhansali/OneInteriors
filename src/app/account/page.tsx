import Link from 'next/link';
import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { Container, Eyebrow, Pill } from '@/components/ui';
import { SiteHeader, SiteFooter } from '@/components/chrome';
import { prisma } from '@/lib/prisma';
import { formatINRCompact } from '@/lib/money';
import { getCurrentUser } from '@/modules/auth/session';
import { loadBrief } from '@/modules/brief/repository';
import { quoteHistory } from '@/modules/quotation/generate';
import { myConsultations } from '@/modules/consultation/request';
import { consentHistory } from '@/modules/consent/record';
import { PURPOSE_NOTICE, type ConsentPurpose } from '@/modules/consent/policy';
import { signedUrlFor } from '@/modules/storage/floor-plan';
import { propertyLabel, scopeLabel, PUNE_LOCALITIES } from '@/modules/brief/types';

export const metadata: Metadata = {
  title: 'Your project',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

/**
 * The customer portal.
 *
 * Everything a customer has with us, in one place: their brief, every quote
 * they were ever shown, their expert call, and what they have consented to.
 * This is the shell the project tracker and escrow ledger drop into later —
 * built now so that each of those has a home rather than arriving as a
 * separate page nobody finds.
 */
export default async function AccountPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/sign-in?next=/account');

  const { brief, found } = await loadBrief();

  const row = await prisma.brief.findUnique({
    where: { userId: user.id },
    select: { id: true, floorPlanName: true },
  });

  const quotes = row ? await quoteHistory(row.id) : [];
  const calls = row ? await myConsultations(row.id) : [];
  const consents = await consentHistory();
  const planUrl = row ? await signedUrlFor(row.id) : null;

  return (
    <>
      <SiteHeader />

      <main className="py-10 sm:py-14">
        <Container size="default">
          <Eyebrow>Your project</Eyebrow>
          <h1 className="display mb-3 text-[clamp(1.9rem,4vw,2.8rem)] leading-[1.03]">
            {user.name ? `Hello, ${user.name.split(' ')[0]}.` : 'Your project'}
          </h1>
          <p className="lede mb-12 max-w-[58ch]">
            Everything you have with us, in one place. It stays here — when your project starts,
            the tracker and your payment schedule appear on this page too.
          </p>

          {/* ── Brief ────────────────────────────────────── */}
          <Section title="Your brief" action={{ href: '/quiz', label: 'Edit' }}>
            {!found || !brief.completedAt ? (
              <Empty>
                You have not finished the nine questions yet.{' '}
                <Link href="/quiz" className="text-[var(--color-petrol)]">
                  Pick up where you left off
                </Link>
                .
              </Empty>
            ) : (
              <dl className="m-0 grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-4">
                <Fact
                  label="Home"
                  value={propertyLabel(brief.propertyType)}
                />
                <Fact
                  label="Area"
                  value={brief.carpetAreaSqft ? `${brief.carpetAreaSqft} sqft` : null}
                />
                <Fact
                  label="Where"
                  value={
                    PUNE_LOCALITIES.find((l) => l.slug === brief.locality)?.label ?? brief.locality
                  }
                />
                <Fact label="Scope" value={scopeLabel(brief.scope)} />
                <Fact
                  label="Budget"
                  value={
                    brief.budgetMinPaise && brief.budgetMaxPaise
                      ? `${formatINRCompact(brief.budgetMinPaise)}–${formatINRCompact(brief.budgetMaxPaise)}`
                      : null
                  }
                />
                <Fact
                  label="Floor plan"
                  value={row?.floorPlanName ?? null}
                  href={planUrl ?? undefined}
                />
              </dl>
            )}
          </Section>

          {/* ── Quotes ───────────────────────────────────── */}
          <Section
            title="Your quotes"
            action={quotes.length > 0 ? { href: '/compare', label: 'Compare' } : undefined}
          >
            {quotes.length === 0 ? (
              <Empty>No quotes yet. They appear once you have finished your brief.</Empty>
            ) : (
              <>
                <ul className="m-0 flex list-none flex-col gap-2 p-0">
                  {quotes.map((quote) => (
                    <li
                      key={quote.id}
                      className="flex flex-wrap items-baseline justify-between gap-3 border-b border-[var(--color-rule-soft)] py-3"
                    >
                      <Link
                        href={`/studios/${quote.studioSlug}`}
                        className="text-[15.5px] text-[var(--color-ink)] no-underline hover:text-[var(--color-petrol)]"
                      >
                        {quote.studioName}
                      </Link>
                      <span className="flex items-baseline gap-4">
                        <span className="font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.1em] text-[var(--color-ink-3)]">
                          {quote.createdAt.toLocaleDateString('en-IN', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                          })}
                        </span>
                        <span className="tabular-nums text-[15px] text-[var(--color-ink)]">
                          {formatINRCompact(quote.totalPaise)}
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>
                {/* The reason every version is kept rather than overwritten. */}
                <p className="m-0 mt-4 max-w-[62ch] text-[13.5px] leading-relaxed text-[var(--color-ink-3)]">
                  Every quote you have ever been shown stays here, including the ones that were
                  replaced. If a number changes, you can see what it was before and when it moved.
                </p>
              </>
            )}
          </Section>

          {/* ── Expert call ──────────────────────────────── */}
          <Section title="Your expert call">
            {calls.length === 0 ? (
              <Empty>
                Not booked yet.{' '}
                <Link href="/expert" className="text-[var(--color-petrol)]">
                  Request a call
                </Link>{' '}
                once you have quotes to talk about.
              </Empty>
            ) : (
              <ul className="m-0 flex list-none flex-col gap-3 p-0">
                {calls.map((call) => (
                  <li
                    key={call.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-[10px] border border-[var(--color-rule)] bg-[var(--color-paper-2)] px-5 py-4"
                  >
                    <span className="text-[14.5px] text-[var(--color-ink-2)]">
                      Requested{' '}
                      {call.createdAt.toLocaleDateString('en-IN', {
                        day: 'numeric',
                        month: 'short',
                      })}
                      {call.preferredTimes ? ` · you said ${call.preferredTimes}` : ''}
                    </span>
                    <Pill tone={call.status === 'completed' ? 'ontrack' : 'petrol'}>
                      {call.status}
                    </Pill>
                  </li>
                ))}
              </ul>
            )}
          </Section>

          {/* ── Project ──────────────────────────────────── */}
          <Section title="Your project">
            <Empty>
              Nothing here yet. Once you sign with a studio, this is where the milestone plan,
              site photographs and payment schedule live. We do not hold your money — you pay the
              studio directly against milestones we set and check.
            </Empty>
          </Section>

          {/* ── Permissions ──────────────────────────────── */}
          <Section title="What you have agreed to">
            {consents.length === 0 ? (
              <Empty>Nothing recorded yet.</Empty>
            ) : (
              <ul className="m-0 flex list-none flex-col gap-2 p-0">
                {latestByPurpose(consents).map((consent) => (
                  <li
                    key={consent.purpose}
                    className="flex flex-wrap items-baseline justify-between gap-3 border-b border-[var(--color-rule-soft)] py-3"
                  >
                    <span className="max-w-[46ch] text-[14.5px] text-[var(--color-ink-2)]">
                      {PURPOSE_NOTICE[consent.purpose].label}
                    </span>
                    <Pill tone={consent.granted && !consent.withdrawnAt ? 'ontrack' : 'neutral'}>
                      {consent.withdrawnAt ? 'Withdrawn' : consent.granted ? 'Yes' : 'No'}
                    </Pill>
                  </li>
                ))}
              </ul>
            )}
            <p className="m-0 mt-4 max-w-[62ch] text-[13.5px] leading-relaxed text-[var(--color-ink-3)]">
              You can change any of these at any time, and withdrawing is as easy as agreeing was.
              Ask us and it is done the same day — we are building the one-click version now.
            </p>
          </Section>
        </Container>
      </main>

      <SiteFooter />
    </>
  );
}

function latestByPurpose(records: { purpose: ConsentPurpose; granted: boolean; withdrawnAt?: Date | string | null }[]) {
  const byPurpose = new Map<ConsentPurpose, (typeof records)[number]>();
  for (const record of records) byPurpose.set(record.purpose, record);
  return [...byPurpose.values()];
}

function Section({
  title,
  action,
  children,
}: {
  title: string;
  action?: { href: string; label: string };
  children: React.ReactNode;
}) {
  return (
    <section className="mb-12 border-t border-[var(--color-rule)] pt-6">
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-3">
        <h2 className="h3 m-0">{title}</h2>
        {action ? (
          <Link
            href={action.href}
            className="font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.11em] text-[var(--color-petrol)] no-underline"
          >
            {action.label} →
          </Link>
        ) : null}
      </div>
      {children}
    </section>
  );
}

function Fact({ label, value, href }: { label: string; value: string | null; href?: string }) {
  return (
    <div className="min-w-0">
      <dt className="label m-0">{label}</dt>
      <dd className="m-0 truncate text-[15px] text-[var(--color-ink)]">
        {value === null ? (
          <span className="text-[var(--color-ink-3)]">—</span>
        ) : href ? (
          <a href={href} target="_blank" rel="noopener noreferrer" className="text-[var(--color-petrol)]">
            {value} ↗
          </a>
        ) : (
          value
        )}
      </dd>
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <p className="m-0 max-w-[62ch] rounded-[10px] border border-[var(--color-rule)] bg-[var(--color-paper-2)] px-5 py-4 text-[14.5px] leading-relaxed text-[var(--color-ink-2)]">
      {children}
    </p>
  );
}
