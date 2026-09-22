import Link from 'next/link';
import type { BoardCounts } from '@/modules/studio-practice/analytics';
import { QUIET_AFTER_DAYS } from '@/modules/studio-practice/vocabulary';

/**
 * The three numbers that go DOWN when the studio does its job.
 *
 * ## Why only problems
 *
 * Total, open and won can never be bad news, so they teach nobody anything at
 * a glance — they belong on the analytics page, where somebody has gone
 * looking. These three are the ones worth putting where the work happens,
 * because each one going up is a thing to do today.
 *
 * ## Why it disappears at zero
 *
 * A strip reading "0 overdue · 0 untaken · 0 quiet" is three pieces of good
 * news nobody needs on a screen they open twenty times a day, and a permanent
 * fixture is one the eye stops seeing — which costs us the day it turns red.
 *
 * So the whole thing is absent when there is nothing wrong, and each tile is
 * absent when its own number is zero. A studio on top of their work gets
 * their board back.
 */
export function NeedsAttention({ counts }: { counts: BoardCounts }) {
  const tiles = [
    {
      key: 'overdue',
      n: counts.overdue,
      label: counts.overdue === 1 ? 'follow-up is overdue' : 'follow-ups are overdue',
      href: '/studio/clients',
      tone: 'bad' as const,
    },
    {
      key: 'pooled',
      n: counts.pooled,
      label: counts.pooled === 1 ? 'lead has nobody on it' : 'leads have nobody on them',
      href: '/studio/clients/pool',
      tone: 'warn' as const,
    },
    {
      key: 'quiet',
      n: counts.quiet,
      label: `gone quiet — no contact in ${QUIET_AFTER_DAYS} days`,
      href: '/studio/clients',
      tone: 'warn' as const,
    },
  ].filter((t) => t.n > 0);

  if (tiles.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2.5">
      {tiles.map((t) => (
        <Link
          key={t.key}
          href={t.href}
          className="group flex min-w-0 flex-1 items-baseline gap-2 rounded-[10px] border border-[var(--s-rule)] px-3.5 py-2.5 no-underline transition-colors hover:border-[var(--s-ink-3)] sm:flex-none"
        >
          <span
            className={`s-num text-[19px] font-semibold leading-none ${
              t.tone === 'bad'
                ? 'text-[var(--s-bad)]'
                : 'text-[var(--s-warn,#8a6220)]'
            }`}
          >
            {t.n}
          </span>
          <span className="min-w-0 text-[12.5px] leading-snug text-[var(--s-ink-2)]">
            {t.label}
          </span>
        </Link>
      ))}
    </div>
  );
}
