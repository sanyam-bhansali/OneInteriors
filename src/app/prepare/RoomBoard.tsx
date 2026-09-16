'use client';

import { StyleScene, MaterialSwatches } from '@/components/art/StyleScene';
import { formatINRCompact } from '@/lib/money';
import { proposeRoom } from '@/modules/prepare/moodboard';
import type { RoomKey } from '@/modules/prepare/rooms';
import type { BudgetTier, StyleTag } from '@/modules/brief/types';
import type { RoomState } from './PrepClient';
import { BoardEditor } from './BoardEditor';

/**
 * One room of the prep pack.
 *
 * Presentational and controlled — every piece of state belongs to `PrepClient`,
 * because the assembled board further down the page has to move in step with
 * these cards and two components cannot share a truth neither of them owns.
 *
 * The board is recomputed here from `proposeRoom`, which is why that function
 * is pure and why we store the shuffle counter rather than the generated board:
 * Shuffle has to feel instant, and a round trip to regenerate something we can
 * derive would make it feel like submitting a form.
 */
export function RoomBoard({
  room,
  label,
  likes,
  dislikes,
  tier,
  indicativePaise,
  state,
  saved,
  onShuffle,
  onChoose,
  onItems,
  onNote,
  onNoteBlur,
}: {
  room: RoomKey;
  label: string;
  likes: StyleTag[];
  dislikes: StyleTag[];
  tier: BudgetTier | null;
  indicativePaise: number | null;
  state: RoomState | undefined;
  saved: boolean;
  onShuffle: () => void;
  onChoose: (option: number | null) => void;
  onItems: (items: string[]) => void;
  onNote: (note: string) => void;
  onNoteBlur: () => void;
}) {
  const shuffle = state?.shuffle ?? 0;
  const choice = state?.chosenOption ?? null;
  const note = state?.note ?? '';
  const items = state?.items ?? [];

  const proposal = proposeRoom(room, likes, dislikes, shuffle);
  const position = ((shuffle % proposal.optionCount) + proposal.optionCount) % proposal.optionCount;

  return (
    <li className="overflow-hidden rounded-[16px] border border-[var(--color-rule)] bg-[var(--color-paper-2)]">
      <div className="grid gap-0 sm:grid-cols-[minmax(0,18rem)_minmax(0,1fr)]">
        {/* Drawn, and honestly a drawing — see StyleScene. */}
        <div className="relative">
          <StyleScene tag={proposal.style} className="block aspect-[4/3] w-full sm:h-full" />
          <button
            type="button"
            onClick={onShuffle}
            className="absolute bottom-3 right-3 inline-flex items-center gap-1.5 rounded-full bg-[var(--color-paper)]/92 px-3.5 py-2 text-[13px] font-medium text-[var(--color-ink)] shadow-sm hover:bg-[var(--color-paper)]"
            aria-label={`Show a different look for ${label}`}
          >
            Shuffle
            <span className="font-[family-name:var(--font-mono)] text-[11px] tabular-nums text-[var(--color-ink-3)]">
              {position + 1}/{proposal.optionCount}
            </span>
          </button>
        </div>

        <div className="p-6">
          <div className="mb-4 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <h3 className="m-0 font-[family-name:var(--font-display)] text-[21px] leading-tight">
              {label}
            </h3>
            {indicativePaise !== null ? (
              <span className="font-[family-name:var(--font-mono)] text-[12.5px] tabular-nums text-[var(--color-ink-3)]">
                about {formatINRCompact(indicativePaise)}
              </span>
            ) : null}
          </div>

          <p className="m-0 mb-4 text-[14.5px] text-[var(--color-ink)]">{proposal.styleLabel}</p>

          <MaterialSwatches tag={proposal.style} className="mb-6" />

          {/* The board for this room. This is the part the customer builds —
              the drawing above is the starting direction, this is their
              answer. */}
          <div className="mb-6 border-t border-[var(--color-rule)] pt-5">
            <p className="label m-0 mb-3">On this board</p>
            <BoardEditor
              room={room}
              likes={likes}
              dislikes={dislikes}
              tier={tier}
              items={items}
              onChange={onItems}
            />
          </div>

          <fieldset className="m-0 border-0 p-0">
            <legend className="label m-0 mb-3 p-0">{proposal.decision.question}</legend>
            <div className="flex flex-col gap-2">
              {proposal.decision.options.map((option, i) => {
                const picked = choice === i;
                return (
                  <label
                    key={option.label}
                    className={`flex cursor-pointer gap-3 rounded-[10px] border px-4 py-3 ${
                      picked
                        ? 'border-[var(--color-petrol)] bg-[var(--color-petrol-soft)]'
                        : 'border-[var(--color-rule)]'
                    }`}
                  >
                    <input
                      type="radio"
                      name={`${room}-decision`}
                      checked={picked}
                      // Tapping the chosen option again clears it. "I do not
                      // know yet" is a real answer and the expert wants to see
                      // it, so there has to be a way back to it.
                      onChange={() => onChoose(picked ? null : i)}
                      className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--color-petrol)]"
                    />
                    <span className="min-w-0">
                      <span className="block text-[15px] text-[var(--color-ink)]">
                        {option.label}
                        <span
                          className="ml-2 font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.08em] text-[var(--color-ink-3)]"
                          aria-label={
                            option.direction === 'less'
                              ? 'costs less'
                              : option.direction === 'more'
                                ? 'costs more'
                                : 'middle of the range'
                          }
                        >
                          {option.direction === 'less' ? '₹' : option.direction === 'more' ? '₹₹₹' : '₹₹'}
                        </span>
                      </span>
                      <span className="block text-[13.5px] leading-snug text-[var(--color-ink-3)]">
                        {option.note}
                      </span>
                    </span>
                  </label>
                );
              })}
            </div>
          </fieldset>

          <div className="mt-5">
            <label htmlFor={`${room}-note`} className="label m-0 mb-2 block">
              Anything about this room — optional
            </label>
            <textarea
              id={`${room}-note`}
              value={note}
              onChange={(e) => onNote(e.target.value)}
              onBlur={onNoteBlur}
              rows={2}
              placeholder="The window is on the wrong wall for a bed."
              className="w-full rounded-[10px] border border-[var(--color-rule)] bg-[var(--color-paper)] px-4 py-3 text-[14.5px] leading-relaxed"
            />
            <p
              aria-live="polite"
              className="m-0 mt-1.5 h-4 font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.1em] text-[var(--color-ink-3)]"
            >
              {saved ? 'Saved' : ''}
            </p>
          </div>
        </div>
      </div>
    </li>
  );
}
