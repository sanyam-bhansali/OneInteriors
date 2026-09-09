'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Container, Button } from '@/components/ui';
import { Wordmark } from '@/components/brand';
import { formatINRCompact } from '@/lib/money';
import { TIER, tiersForBudget, type Tier } from '@/modules/quotation/tiers';
import { loadBrief, saveBrief } from '@/modules/brief/store';
import { saveBriefAction, trackAction } from '../quiz/actions';
import type { Brief } from '@/modules/brief/types';

/**
 * The band chooser — the step between the brief and the matches.
 *
 * It sits on its own screen rather than inside the nine questions for one
 * reason: the numbers on it are calculated from the customer's own carpet
 * area, and that is only known once the questions are done. A band shown as an
 * abstract "Premium" means nothing; the same band shown as "₹9.4L–₹15.3L for
 * your 850 sqft flat" is a decision someone can actually make.
 *
 * Nothing here is locked in. Choosing a band filters and orders what comes
 * next; it does not commit the customer to anything, and the copy says so —
 * a choice that feels binding gets avoided, and an avoided choice tells us
 * nothing.
 */
export function TierClient({ initial }: { initial: Brief }) {
  const router = useRouter();
  const [brief, setBrief] = useState<Brief>(() => {
    const local = loadBrief();
    return (local.lastStep ?? 0) >= (initial.lastStep ?? 0) ? local : initial;
  });
  const [picked, setPicked] = useState<Tier | null>(brief.tier ?? null);

  const area = brief.carpetAreaSqft ?? 850;
  const offered = tiersForBudget(brief.budgetMaxPaise, area);

  function choose(tier: Tier) {
    setPicked(tier);
    const next = { ...brief, tier };
    setBrief(next);
    saveBrief(next);
    void saveBriefAction(next).catch(() => {});
    void trackAction('tier.select', { tier });
  }

  function continueOn() {
    router.push('/match');
  }

  return (
    <div className="flex min-h-dvh flex-col bg-[var(--color-paper)]">
      <header className="sticky top-0 z-10 border-b border-[var(--color-rule)] bg-[var(--color-paper)]">
        <Container size="wide">
          <div className="flex items-center justify-between gap-4 py-3.5">
            <Link href="/" className="no-underline" aria-label="Home">
              <Wordmark showCity={false} />
            </Link>
            <span className="font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.12em] text-[var(--color-ink-3)]">
              Brief complete
            </span>
          </div>
        </Container>
      </header>

      <main className="flex-1 py-10 sm:py-14">
        <Container size="wide">
          <div className="mb-9 max-w-[46rem]">
            <p className="m-0 mb-4 font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.15em] text-[var(--color-petrol)]">
              What your home costs
            </p>
            <h1
              className="m-0 mb-4 font-[family-name:var(--font-display)] text-[clamp(1.9rem,4vw,2.9rem)] font-normal leading-[1.06] tracking-[-0.02em] text-[var(--color-ink)]"
              style={{ textWrap: 'balance' }}
            >
              Here is what your {area} sqft would cost, at three levels of finish.
            </h1>
            <p className="m-0 max-w-[58ch] text-[17px] leading-[1.65] text-[var(--color-ink-2)]">
              These are real ranges for a home your size, not brackets we invented to make one
              look reasonable. Pick the one you actually want to spend in — you can change it
              later, and it does not commit you to anything.
            </p>
          </div>

          <div className="mb-10 grid grid-cols-1 gap-5 md:grid-cols-3">
            {offered.map(({ tier, fit }) => {
              const definition = TIER[tier];
              const low = Math.round(definition.perSqftFrom * area * 100);
              const high = Math.round(definition.perSqftTo * area * 100);
              const active = picked === tier;

              return (
                <button
                  key={tier}
                  type="button"
                  onClick={() => choose(tier)}
                  aria-pressed={active}
                  className={`flex flex-col gap-4 rounded-[14px] border-2 p-6 text-left transition-colors ${
                    active
                      ? 'border-[var(--color-petrol)] bg-[var(--color-petrol-soft)]'
                      : 'border-[var(--color-rule)] bg-[var(--color-paper-2)] hover:border-[var(--color-ink-3)]'
                  }`}
                >
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="font-[family-name:var(--font-display)] text-[24px] leading-none text-[var(--color-ink)]">
                      {definition.label}
                    </span>
                    {/* Every band is shown and labelled against their budget,
                        never hidden. People move up when they see what the
                        difference buys, and they are often pleased to find the
                        level below does what they wanted — removing either
                        option decides for them. */}
                    {fit === 'stretch' ? (
                      <span className="rounded-full bg-[var(--color-paper-3)] px-2.5 py-0.5 font-[family-name:var(--font-mono)] text-[9.5px] uppercase tracking-[0.11em] text-[var(--color-ink-3)]">
                        Above your budget
                      </span>
                    ) : fit === 'under' ? (
                      <span className="rounded-full bg-[var(--color-ontrack-soft)] px-2.5 py-0.5 font-[family-name:var(--font-mono)] text-[9.5px] uppercase tracking-[0.11em] text-[var(--color-ontrack)]">
                        Within reach
                      </span>
                    ) : null}
                  </div>

                  <p className="m-0 font-[family-name:var(--font-display)] text-[23px] leading-none text-[var(--color-petrol)]">
                    {formatINRCompact(low)}
                    <span className="text-[var(--color-ink-3)]"> – </span>
                    {formatINRCompact(high)}
                  </p>

                  <p className="m-0 text-[14.5px] leading-[1.55] text-[var(--color-ink-2)]">
                    {definition.promise}
                  </p>

                  <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
                    {definition.materials.slice(0, 4).map((m) => (
                      <li
                        key={m}
                        className="grid grid-cols-[12px_minmax(0,1fr)] gap-2 text-[13.5px] leading-[1.45] text-[var(--color-ink-2)]"
                      >
                        <span aria-hidden="true" className="text-[var(--color-brass)]">
                          ·
                        </span>
                        {m}
                      </li>
                    ))}
                  </ul>

                  <p className="m-0 mt-auto border-t border-[var(--color-rule)] pt-3 text-[13px] leading-[1.5] text-[var(--color-ink-3)]">
                    {definition.notFor}
                  </p>
                </button>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center gap-4 border-t border-[var(--color-rule)] pt-6">
            <Button onClick={continueOn} disabled={!picked} size="lg">
              See who works at this level
            </Button>
            {!picked ? (
              <span className="text-[14px] text-[var(--color-ink-3)]">Choose a level to continue</span>
            ) : (
              <button
                type="button"
                onClick={continueOn}
                className="text-[14px] text-[var(--color-ink-3)] underline underline-offset-4"
              >
                Show me everything instead
              </button>
            )}
          </div>

          <p className="m-0 mt-6 max-w-[62ch] text-[13.5px] leading-[1.6] text-[var(--color-ink-3)]">
            Ranges exclude GST. Your actual quotes come next, priced by each studio from their own
            rates — these are here so you know roughly where you stand before spending more time.
          </p>
        </Container>
      </main>
    </div>
  );
}
