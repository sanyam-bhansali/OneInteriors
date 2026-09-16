'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import type { RoomKey } from '@/modules/prepare/rooms';
import type { BudgetTier, StyleTag } from '@/modules/brief/types';
import { RoomBoard } from './RoomBoard';
import { Moodboard } from './Moodboard';
import { saveRoomAction } from './actions';

/**
 * Owns the prep pack's state for every room at once.
 *
 * ## Why the state is here and not in each card
 *
 * Because the board at the bottom has to move the instant somebody shuffles a
 * card at the top. Those are two components that are nowhere near each other in
 * the tree, and the only honest way to keep them in step is for one thing above
 * both of them to hold the truth. State that lived inside each card would give
 * us a board that was quietly wrong — the worst failure available here, since
 * the board's entire job is to be the thing you show somebody else.
 *
 * ## What saves, and when
 *
 *   · Shuffle and the decision save immediately. Single taps; losing one is
 *     irritating in a way that reads as the page being broken.
 *   · Notes save 900ms after typing stops, and again on blur. Per keystroke is
 *     a write per character. Blur-only loses the note of anyone who closes the
 *     tab mid-sentence — and this is a page designed to sit open for days, so
 *     that is the likelier accident, not the rarer one.
 */

export interface RoomState {
  shuffle: number;
  chosenOption: number | null;
  note: string;
  /** Element slugs, in the order the customer placed them. */
  items: string[];
}

/** An untouched room. Every state must be complete, never half-built. */
const BLANK: RoomState = { shuffle: 0, chosenOption: null, note: '', items: [] };

export function PrepClient({
  rooms,
  likes,
  dislikes,
  tier,
  initial,
}: {
  rooms: { key: RoomKey; label: string; indicativePaise: number | null }[];
  likes: StyleTag[];
  dislikes: StyleTag[];
  tier: BudgetTier | null;
  initial: Record<string, RoomState>;
}) {
  const [states, setStates] = useState<Record<string, RoomState>>(initial);
  const [savedRoom, setSavedRoom] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  // One debounce timer per room. A single shared timer would let a note typed
  // in the kitchen cancel the pending save of one typed in the bedroom.
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const latest = useRef<Record<string, RoomState>>(initial);
  latest.current = states;

  useEffect(() => {
    const pending = timers.current;
    return () => {
      for (const timer of pending.values()) clearTimeout(timer);
    };
  }, []);

  function persist(room: string, patch: Partial<RoomState>) {
    startTransition(async () => {
      const result = await saveRoomAction(room, {
        shuffle: patch.shuffle,
        chosenOption: patch.chosenOption,
        note: patch.note,
        items: patch.items,
      });
      if (result.ok) {
        setSavedRoom(room);
        setTimeout(() => setSavedRoom((current) => (current === room ? null : current)), 1800);
      }
    });
  }

  function update(room: RoomKey, patch: Partial<RoomState>, save: boolean) {
    // `prev[room]` is typed as possibly absent, and a room that genuinely has
    // no entry must still end up with a complete state rather than a partial
    // one — a half-built object here would render a card with no note field.
    setStates((prev) => ({ ...prev, [room]: { ...BLANK, ...prev[room], ...patch } }));
    if (save) persist(room, patch);
  }

  function onNote(room: RoomKey, note: string) {
    update(room, { note }, false);

    const existing = timers.current.get(room);
    if (existing) clearTimeout(existing);

    timers.current.set(
      room,
      setTimeout(() => {
        timers.current.delete(room);
        // Read from the ref, not the closure — the value here is already stale
        // by the time this fires, which is the entire point of a debounce.
        persist(room, { note: latest.current[room]?.note ?? '' });
      }, 900),
    );
  }

  function flushNote(room: RoomKey) {
    const existing = timers.current.get(room);
    if (!existing) return;
    clearTimeout(existing);
    timers.current.delete(room);
    persist(room, { note: latest.current[room]?.note ?? '' });
  }

  return (
    <>
      <ul className="m-0 flex list-none flex-col gap-5 p-0">
        {rooms.map((room) => (
          <RoomBoard
            key={room.key}
            room={room.key}
            label={room.label}
            likes={likes}
            dislikes={dislikes}
            tier={tier}
            indicativePaise={room.indicativePaise}
            state={states[room.key]}
            saved={savedRoom === room.key}
            onShuffle={() =>
              update(room.key, { shuffle: (states[room.key]?.shuffle ?? 0) + 1 }, true)
            }
            onChoose={(chosenOption) => update(room.key, { chosenOption }, true)}
            onItems={(items) => update(room.key, { items }, true)}
            onNote={(note) => onNote(room.key, note)}
            onNoteBlur={() => flushNote(room.key)}
          />
        ))}
      </ul>

      <Moodboard rooms={rooms} tier={tier} states={states} />
    </>
  );
}
