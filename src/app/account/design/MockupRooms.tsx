'use client';

/**
 * The room ideas: per room, a button that draws three pictures from their
 * Design DNA, and a yes / no under each. A no asks one tap of why. Every answer
 * reshapes the DNA (the page refreshes), and the next round is drawn from it.
 */

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type { MockupView } from '@/modules/design-dna/store';
import { NO_REASONS, NO_REASON_LABELS, type NoReason } from '@/modules/design-dna/dna';
import { answerMockupAction, drawRoundAction } from './actions';

export function MockupRooms({
  rooms,
  left,
}: {
  rooms: { room: string; label: string; mockups: MockupView[] }[];
  left: number;
}) {
  const router = useRouter();
  const [busyRoom, setBusyRoom] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [asking, setAsking] = useState<string | null>(null);
  const [pending, start] = useTransition();

  async function draw(room: string) {
    setError(null);
    setBusyRoom(room);
    const r = await drawRoundAction(room);
    setBusyRoom(null);
    if (!r.ok) return setError(r.error);
    router.refresh();
  }

  function answer(id: string, verdict: 'up' | 'down', reason: NoReason | null) {
    setError(null);
    start(async () => {
      const r = await answerMockupAction(id, verdict, reason);
      if (!r.ok) setError(r.error);
      setAsking(null);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-10">
      <p className="m-0 text-[13.5px] text-[var(--color-ink-3)]">
        AI ideas in your Design DNA, not your actual home. {left} more today.
      </p>
      {error ? <p className="m-0 text-[14px] text-[var(--color-accent-ink,#a6461f)]">{error}</p> : null}

      {rooms.map((r) => {
        const latest = r.mockups.length > 0 ? Math.max(...r.mockups.map((m) => m.round)) : 0;
        const current = r.mockups.filter((m) => m.round === latest);
        const unanswered = current.some((m) => m.verdict === null);
        return (
          <section key={r.room} className="flex flex-col gap-4">
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <h3 className="h3 m-0">{r.label}</h3>
              <button
                type="button"
                disabled={busyRoom !== null || left < 3}
                onClick={() => void draw(r.room)}
                className="rounded-full bg-[var(--color-ink)] px-4 py-2 text-[14px] text-[var(--color-paper)] disabled:opacity-40"
              >
                {busyRoom === r.room ? 'Drawing three ideas…' : latest === 0 ? 'Show me room ideas' : 'Show me new ideas'}
              </button>
            </div>
            {latest > 0 && unanswered ? (
              <p className="m-0 text-[13.5px] text-[var(--color-ink-2)]">Tell us yes or no on each. Your answers shape the next ideas.</p>
            ) : null}

            {current.length > 0 ? (
              <div className="grid gap-4 sm:grid-cols-3">
                {current.map((m) => (
                  <figure key={m.id} className="m-0 overflow-hidden rounded-[14px] border border-[var(--color-rule)]">
                    {m.url ? (
                      // eslint-disable-next-line @next/next/no-img-element -- signed, short-lived storage links
                      <img src={m.url} alt={`AI room idea: ${m.caption}`} className="block aspect-[4/3] w-full object-cover" />
                    ) : (
                      <div className="aspect-[4/3] w-full bg-[var(--color-paper-2)]" />
                    )}
                    <figcaption className="flex flex-col gap-2 p-3">
                      <span className="text-[13.5px] text-[var(--color-ink)]">{m.caption}</span>
                      {m.sample ? <span className="text-[12px] text-[var(--color-ink-3)]">Sample picture</span> : null}
                      <div className="flex gap-2">
                        <button
                          type="button"
                          aria-pressed={m.verdict === 'up'}
                          disabled={pending}
                          onClick={() => answer(m.id, 'up', null)}
                          className={`rounded-full border px-3 py-1 text-[13.5px] ${m.verdict === 'up' ? 'border-[var(--color-ink)] bg-[var(--color-ink)] text-[var(--color-paper)]' : 'border-[var(--color-rule)]'}`}
                        >
                          👍 Yes
                        </button>
                        <button
                          type="button"
                          aria-pressed={m.verdict === 'down'}
                          disabled={pending}
                          onClick={() => setAsking(asking === m.id ? null : m.id)}
                          className={`rounded-full border px-3 py-1 text-[13.5px] ${m.verdict === 'down' ? 'border-[var(--color-ink)] bg-[var(--color-ink)] text-[var(--color-paper)]' : 'border-[var(--color-rule)]'}`}
                        >
                          👎 No
                        </button>
                      </div>
                      {m.verdict === 'down' && m.reason ? (
                        <span className="text-[12.5px] text-[var(--color-ink-3)]">{NO_REASON_LABELS[m.reason]}</span>
                      ) : null}
                      {asking === m.id ? (
                        <div className="flex flex-wrap gap-1.5">
                          <span className="w-full text-[12.5px] text-[var(--color-ink-2)]">What&apos;s off?</span>
                          {NO_REASONS.map((reason) => (
                            <button
                              key={reason}
                              type="button"
                              disabled={pending}
                              onClick={() => answer(m.id, 'down', reason)}
                              className="rounded-full border border-[var(--color-rule)] px-2.5 py-1 text-[12.5px]"
                            >
                              {NO_REASON_LABELS[reason]}
                            </button>
                          ))}
                          <button type="button" disabled={pending} onClick={() => answer(m.id, 'down', null)} className="px-2 py-1 text-[12.5px] underline">
                            Just no
                          </button>
                        </div>
                      ) : null}
                    </figcaption>
                  </figure>
                ))}
              </div>
            ) : null}
          </section>
        );
      })}
    </div>
  );
}
