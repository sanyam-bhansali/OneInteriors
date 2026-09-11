import Link from 'next/link';
import { Container } from '@/components/ui';
import { Mark } from '@/components/brand';

/**
 * Ops chrome. Deliberately distinct from the customer header — a dark band, so
 * nobody is ever confused about which surface they are on, and no screenshot of
 * an internal queue can be mistaken for the public site.
 */
export function OpsHeader() {
  return (
    <header className="border-b border-[var(--color-rule)] bg-[var(--color-petrol-deep)] text-[var(--color-paper)]">
      <Container size="wide">
        <div className="flex items-center justify-between gap-4 py-3.5">
          <Link href="/ops" className="flex items-center gap-2.5 no-underline">
            <Mark className="h-6 w-6 text-[var(--color-paper)]" />
            <span className="font-[family-name:var(--font-display)] text-[19px] leading-none text-[var(--color-paper)]">
              One Interiors
            </span>
            <span className="rounded-full bg-[var(--color-brass-bright)] px-2 py-0.5 font-[family-name:var(--font-mono)] text-[9.5px] uppercase tracking-[0.14em] text-[#1A1405]">
              Ops
            </span>
          </Link>
          {/* Ordered by how often ops actually opens them, not alphabetically.
              Overview first because it is where the day starts. */}
          <nav className="flex flex-wrap items-center gap-x-5 gap-y-1">
            <OpsLink href="/ops">Overview</OpsLink>
            <OpsLink href="/ops/applications">Applications</OpsLink>
            <OpsLink href="/ops/verification">Verification</OpsLink>
            <OpsLink href="/ops/allocation">Allocation</OpsLink>
            <OpsLink href="/ops/consultations">Calls</OpsLink>
            <OpsLink href="/ops/funnel">Funnel</OpsLink>
            <OpsLink href="/">Public site</OpsLink>
          </nav>
        </div>
      </Container>
    </header>
  );
}

function OpsLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.11em] text-[var(--color-paper)] no-underline opacity-70 hover:opacity-100"
    >
      {children}
    </Link>
  );
}

/** Checks complete, as a bar. Colour follows completeness, shape carries it too. */
export function TierProgress({ done, total }: { done: number; total: number }) {
  const pct = total === 0 ? 0 : Math.round((done / total) * 100);
  const tone =
    pct === 100
      ? 'bg-[var(--color-ontrack)]'
      : pct >= 60
        ? 'bg-[var(--color-brass)]'
        : 'bg-[var(--color-atrisk)]';
  return (
    <div className="flex items-center gap-2.5">
      <span className="h-1.5 w-24 overflow-hidden rounded-full bg-[var(--color-paper-3)]">
        <span className={`block h-full ${tone}`} style={{ width: `${pct}%` }} />
      </span>
      <span className="tabular font-[family-name:var(--font-mono)] text-[11.5px] text-[var(--color-ink-2)]">
        {done}/{total}
      </span>
    </div>
  );
}
