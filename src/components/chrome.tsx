import Link from 'next/link';
import { Container } from '@/components/ui';
import { Wordmark, Mark } from '@/components/brand';
import { rosterIsReal } from '@/lib/env';

const NAV = [
  { href: '/studios', label: 'Studios' },
  { href: '/verification', label: 'How we verify' },
];

export function SiteHeader() {
  return (
    <header className="border-b border-[var(--color-rule)] bg-[var(--color-paper)]">
      <Container size="wide">
        <div className="flex items-center justify-between gap-4 py-4">
          <Link href="/" className="no-underline" aria-label="One Interiors, home">
            <Wordmark />
          </Link>

          {/* Sentence case, not all-caps: the nav should read as words, not as
              a control panel. All-caps mono is reserved for labels on data. */}
          <nav className="flex items-center gap-6">
            {NAV.map((item, i) => (
              <Link
                key={item.href}
                href={item.href}
                className={`text-[14.5px] text-[var(--color-ink-2)] no-underline transition-colors hover:text-[var(--color-petrol)] ${
                  i === 1 ? 'hidden sm:inline' : ''
                }`}
              >
                {item.label}
              </Link>
            ))}
            <Link
              href="/quiz"
              className="rounded-full bg-[var(--color-petrol)] px-4 py-2 text-[14px] font-medium text-[var(--color-paper)] no-underline transition-colors hover:bg-[var(--color-petrol-deep)]"
            >
              Start
            </Link>
          </nav>
        </div>
      </Container>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="border-t border-[var(--color-ink)] bg-[var(--color-paper-2)] py-12">
      <Container size="wide">
        <div className="flex flex-col gap-9 sm:flex-row sm:justify-between sm:gap-12">
          <div className="max-w-[42ch]">
            <Mark className="mb-3 h-7 w-7 text-[var(--color-petrol)]" />
            <p className="m-0 mb-2 font-[family-name:var(--font-display)] text-[20px] leading-none">
              One Interiors
            </p>
            <p className="m-0 text-[14px] leading-relaxed text-[var(--color-ink-2)]">
              Verified interior studios in Pune, matched to your home and held to a milestone plan.
            </p>
          </div>

          <nav className="flex flex-col gap-2.5">
            <p className="label m-0 mb-1">Pages</p>
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="text-[14px] text-[var(--color-ink-2)] no-underline hover:text-[var(--color-petrol)]"
              >
                {item.label}
              </Link>
            ))}
            <Link
              href="/quiz"
              className="text-[14px] text-[var(--color-ink-2)] no-underline hover:text-[var(--color-petrol)]"
            >
              Start the brief
            </Link>
          </nav>
        </div>

        {/* Pre-launch honesty notice.
            Keyed to whether the ROSTER is real, not to whether a database
            exists — the database is currently seeded with the invented
            studios, so `hasDatabase()` would have hidden this while every
            studio on the page was still fabricated. Defaults to showing:
            forgetting the flag over-discloses, which is the safe direction. */}
        {!rosterIsReal() ? (
          <p className="m-0 mt-10 max-w-[74ch] border-t border-[var(--color-rule)] pt-6 text-[13px] leading-relaxed text-[var(--color-ink-3)]">
            Pre-launch build. The studios shown are placeholder records used to develop and review
            the product — they are not real businesses and the registration numbers are not real.
          </p>
        ) : null}
      </Container>
    </footer>
  );
}
