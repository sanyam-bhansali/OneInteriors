'use client';

import { ElementTile } from '@/components/art/ElementTile';
import { formatINRCompact } from '@/lib/money';
import { readBoard } from '@/modules/prepare/board';
import { elementBySlug, isAboveBand } from '@/modules/prepare/catalogue';
import type { RoomKey } from '@/modules/prepare/rooms';
import type { BudgetTier } from '@/modules/brief/types';
import type { RoomState } from './PrepClient';

/**
 * The board, assembled.
 *
 * ## Why this exists separately from the room editors
 *
 * The editors above are where the work happens; this is where the work becomes
 * a thing. Those are not the same object and the difference matters more than
 * it looks: a column of nine forms feels like admin, and the identical content
 * assembled into one view feels like a home. Nobody screenshots a form.
 *
 * This is what gets shown to the spouse, and the spouse is the second decision
 * maker on every project we will ever see. So it has to survive being looked at
 * cold, with no explanation attached — which is why each room keeps its name
 * and its share of the budget rather than becoming an anonymous grid of
 * swatches.
 *
 * ## Why it is below the editors
 *
 * It is a payoff, and a payoff shown before anything has been done is just an
 * empty state. It fills in as they work, which is the only honest progress
 * indicator available — no percentage, no checklist, no scolding. The board
 * simply gets better.
 */
export function Moodboard({
  rooms,
  tier,
  states,
}: {
  rooms: { key: RoomKey; label: string; indicativePaise: number | null }[];
  tier: BudgetTier | null;
  states: Record<string, RoomState>;
}) {
  const composed = rooms
    .map((room) => ({ ...room, items: states[room.key]?.items ?? [] }))
    .filter((room) => room.items.length > 0);

  if (composed.length === 0) {
    return (
      <section className="mt-14">
        <h2 className="m-0 mb-2 font-[family-name:var(--font-display)] text-[26px] leading-tight">
          Your board
        </h2>
        <p className="m-0 max-w-[58ch] text-[14.5px] leading-relaxed text-[var(--color-ink-3)]">
          Once you have put a few things on the rooms above, they collect here — one view of the
          whole home, worth showing to whoever is deciding this with you.
        </p>
      </section>
    );
  }

  // The reading across the WHOLE home, not per room. A single marble counter in
  // a kitchen is one indulgence; the same choice repeated in six rooms is a
  // budget conversation, and only this view can see that.
  const everything = composed.flatMap((room) => room.items);
  const reading = readBoard(everything, tier);

  return (
    <section className="mt-14">
      <h2 className="m-0 mb-2 font-[family-name:var(--font-display)] text-[26px] leading-tight">
        Your board
      </h2>
      <p className="m-0 mb-6 max-w-[58ch] text-[14.5px] leading-relaxed text-[var(--color-ink-3)]">
        Everything you have chosen, in one place. Worth showing to whoever is deciding this with you
        — the second opinion usually arrives late and unbriefed, and this is the cheapest way to fix
        that.
      </p>

      {reading.message ? (
        <p className="m-0 mb-7 rounded-[10px] border-l-[3px] border-[var(--color-brass)] bg-[var(--color-paper-2)] px-5 py-4 text-[14.5px] leading-relaxed text-[var(--color-ink-2)]">
          {reading.message}
        </p>
      ) : null}

      <div className="flex flex-col gap-8">
        {composed.map((room) => (
          <div key={room.key}>
            <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-[var(--color-rule)] pb-2">
              <h3 className="m-0 font-[family-name:var(--font-display)] text-[19px] leading-tight">
                {room.label}
              </h3>
              {room.indicativePaise !== null ? (
                <span className="font-[family-name:var(--font-mono)] text-[12px] tabular-nums text-[var(--color-ink-3)]">
                  about {formatINRCompact(room.indicativePaise)}
                </span>
              ) : null}
            </div>

            <ul className="m-0 grid list-none grid-cols-3 gap-2.5 p-0 sm:grid-cols-5">
              {room.items.map((slug) => {
                const element = elementBySlug(slug);
                // A retired slug is skipped, never rendered as its raw id. This
                // view is the one somebody shows to another person.
                if (!element) return null;
                const above = isAboveBand(element, tier);

                return (
                  <li
                    key={slug}
                    className="overflow-hidden rounded-[10px] border border-[var(--color-rule)] bg-[var(--color-paper-2)]"
                  >
                    <ElementTile element={element} className="block aspect-[4/3] w-full" />
                    <div className="px-2.5 py-2">
                      <p className="m-0 text-[12px] leading-tight text-[var(--color-ink)]">
                        {element.label}
                      </p>
                      {above ? (
                        <p className="m-0 mt-1 font-[family-name:var(--font-mono)] text-[9.5px] uppercase tracking-[0.08em] text-[var(--color-brass)]">
                          Above band
                        </p>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}
