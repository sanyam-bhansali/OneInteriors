'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Container } from '@/components/ui';

/**
 * The tabs across the second half of the flow.
 *
 * Without these, a customer who lands on their quotes has no way to reach the
 * comparison except by finding one button at the bottom of the page — and no
 * way back to their matches at all. A linear flow still needs a spine you can
 * move along in both directions, or people get stuck and leave rather than ask.
 *
 * A step the customer has not reached yet is shown but not linked, so the
 * shape of what is coming is visible without offering a dead end.
 */
const STEPS = [
  { href: '/match', label: 'Matches' },
  { href: '/quotes', label: 'Quotes' },
  { href: '/compare', label: 'Compare' },
  { href: '/expert', label: 'Talk to us' },
] as const;

export function JourneyNav({ reached = 4 }: { reached?: number }) {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Your progress"
      className="border-b border-[var(--color-rule)] bg-[var(--color-paper-2)]"
    >
      <Container size="wide">
        <ol className="m-0 flex list-none items-stretch gap-0 overflow-x-auto p-0">
          {STEPS.map((step, i) => {
            const active = pathname === step.href;
            const available = i < reached;

            const inner = (
              <span
                className={`flex items-center gap-2.5 whitespace-nowrap border-b-2 px-1 py-3.5 text-[14.5px] transition-colors ${
                  active
                    ? 'border-[var(--color-petrol)] text-[var(--color-ink)]'
                    : available
                      ? 'border-transparent text-[var(--color-ink-2)] hover:text-[var(--color-ink)]'
                      : 'border-transparent text-[var(--color-ink-3)]'
                }`}
              >
                <span className="font-[family-name:var(--font-mono)] text-[11px] tabular-nums text-[var(--color-ink-3)]">
                  {String(i + 1).padStart(2, '0')}
                </span>
                {step.label}
              </span>
            );

            return (
              <li key={step.href} className="mr-7 last:mr-0">
                {available && !active ? (
                  <Link href={step.href} className="no-underline">
                    {inner}
                  </Link>
                ) : (
                  <span aria-current={active ? 'step' : undefined}>{inner}</span>
                )}
              </li>
            );
          })}
        </ol>
      </Container>
    </nav>
  );
}
