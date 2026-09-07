import Link from 'next/link';
import { Container } from '@/components/ui';

export function SiteHeader() {
  return (
    <header className="border-b border-[var(--color-rule)]">
      <Container>
        <div className="flex items-center justify-between gap-4 py-4">
          <Link href="/" className="no-underline">
            <span className="font-[family-name:var(--font-display)] text-[21px] leading-none text-[var(--color-ink)]">
              One Interiors
            </span>
            <span className="ml-2 font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.14em] text-[var(--color-ink-3)]">
              Pune
            </span>
          </Link>
          <nav className="flex items-center gap-5">
            <Link
              href="/studios"
              className="font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.11em] text-[var(--color-ink-2)] no-underline hover:text-[var(--color-petrol)]"
            >
              Studios
            </Link>
            <Link
              href="/verification"
              className="hidden font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.11em] text-[var(--color-ink-2)] no-underline hover:text-[var(--color-petrol)] sm:inline"
            >
              How we verify
            </Link>
          </nav>
        </div>
      </Container>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="border-t border-[var(--color-ink)] py-10">
      <Container>
        <div className="flex flex-col gap-6 sm:flex-row sm:justify-between">
          <div className="max-w-[46ch]">
            <p className="m-0 mb-2 font-[family-name:var(--font-display)] text-[19px] leading-none">
              One Interiors
            </p>
            <p className="m-0 text-[13px] leading-relaxed text-[var(--color-ink-3)]">
              Verified interior studios in Pune, matched to your home and paid through escrow.
            </p>
          </div>
          <nav className="flex flex-col gap-2 font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.11em]">
            <Link href="/studios" className="text-[var(--color-ink-2)] no-underline hover:text-[var(--color-petrol)]">
              Studios
            </Link>
            <Link href="/verification" className="text-[var(--color-ink-2)] no-underline hover:text-[var(--color-petrol)]">
              How we verify
            </Link>
            <Link href="/quiz" className="text-[var(--color-ink-2)] no-underline hover:text-[var(--color-petrol)]">
              Start
            </Link>
          </nav>
        </div>

        {/* Pre-launch honesty notice. Remove when real studios are onboarded. */}
        <p className="mt-8 max-w-[70ch] border-t border-[var(--color-rule-soft)] pt-5 font-[family-name:var(--font-mono)] text-[11px] leading-relaxed text-[var(--color-ink-3)]">
          Pre-launch build. The studios shown are placeholder records used to develop and review the
          product — they are not real businesses and the registration numbers are not real. No data
          entered here is stored or sent anywhere.
        </p>
      </Container>
    </footer>
  );
}
