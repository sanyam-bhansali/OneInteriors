'use client';

import { useMemo, useState, type ReactNode } from 'react';
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';

/**
 * Dragging a card between columns.
 *
 * ## A handle, not the whole card
 *
 * The obvious build puts the drag listeners on the card itself. It is wrong
 * here for three separate reasons, each of which is a bug somebody would
 * report:
 *
 * 1. dnd-kit's `attributes` include `role="button"` and `tabIndex={0}`. On a
 *    card that already contains a phone link, a move button, a contact
 *    button and a delete, that is a button wrapping four buttons — invalid,
 *    and it makes the whole card a tab stop ahead of the controls inside it.
 * 2. On touch, listeners on the card fight the column's horizontal scroll.
 *    A delay constraint helps and does not fix it: every scroll still has a
 *    quarter-second where the board feels stuck.
 * 3. A dragging card cannot be `aria-hidden`, because it still contains
 *    focusable elements — so the announcement has to come from somewhere
 *    else anyway.
 *
 * A handle solves all three at once: one small control that is the only
 * draggable thing, leaving every other gesture on the card exactly as it was.
 *
 * ## Three sensors
 *
 * **Pointer**, with an 8px distance so a click on the handle is still a
 * click. **Touch**, with a 200ms delay and 5px tolerance, so a finger that
 * starts on the handle and swipes still scrolls the board. **Keyboard**, so
 * the board is usable without a mouse: space picks up, arrows move, space
 * drops, escape cancels.
 *
 * ## Only open columns are drop targets
 *
 * The board draws columns for OPEN and WON kinds only — DONE and LOST live
 * in the "Finished and gone" section below and are not rendered as columns.
 * That is what keeps a drag from ever landing in a LOST column, which
 * `updateClient` would refuse because a drag cannot supply a reason.
 *
 * It is a property of what gets rendered rather than a check here, so the
 * caller must keep it that way: registering a closed column as a drop target
 * would produce a card that flies back with an error, which is worse than
 * one that never looked droppable.
 */

export function DragBoard({
  onMove,
  labelFor,
  children,
}: {
  /** Called once, after a drop onto a different column. */
  onMove: (clientId: string, stageId: string) => void;
  /** The name shown on the floating tile, and in the announcements. */
  labelFor: (clientId: string) => string;
  children: ReactNode;
}) {
  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
    useSensor(KeyboardSensor),
  );

  function handleEnd(event: DragEndEvent) {
    setActiveId(null);

    const { active, over } = event;
    if (!over) return;

    /**
     * The droppable id is NOT the stage id.
     *
     * When the board is grouped, every group draws the same set of columns —
     * so a bare stage id would register five droppables sharing one id and
     * dnd-kit could not tell them apart. The id is namespaced per group and
     * the real stage id travels in `data`.
     */
    const stageId = over.data.current?.stageId;
    if (typeof stageId !== 'string') return;

    const from = active.data.current?.stageId;
    /* Dropped back where it started. Without this, every aborted drag writes
       a move and a timeline line saying the card went from Enquiry to
       Enquiry. */
    if (from === stageId) return;

    onMove(String(active.id), stageId);
  }

  const overlay = useMemo(
    () =>
      activeId ? (
        <div className="s-card pointer-events-none max-w-[17rem] rotate-[1.5deg] px-3 py-2.5 shadow-lg">
          <p className="m-0 truncate text-[14.5px] font-semibold">{labelFor(activeId)}</p>
        </div>
      ) : null,
    [activeId, labelFor],
  );

  return (
    <DndContext
      sensors={sensors}
      onDragStart={(e: DragStartEvent) => setActiveId(String(e.active.id))}
      onDragEnd={handleEnd}
      /* Cancelling must clear the id too, or an escaped drag leaves a card
         faded until the next one starts. */
      onDragCancel={() => setActiveId(null)}
      accessibility={{
        announcements: {
          onDragStart: ({ active }) => `Picked up ${labelFor(String(active.id))}.`,
          onDragOver: ({ active, over }) =>
            over
              ? `${labelFor(String(active.id))} is over ${over.data.current?.stageName ?? 'a column'}.`
              : `${labelFor(String(active.id))} is not over a column.`,
          onDragEnd: ({ active, over }) =>
            over
              ? `${labelFor(String(active.id))} moved to ${over.data.current?.stageName ?? 'a column'}.`
              : `${labelFor(String(active.id))} was put back.`,
          onDragCancel: ({ active }) => `Cancelled. ${labelFor(String(active.id))} did not move.`,
        },
      }}
    >
      {children}

      {/* A light tile, not the real card.
          Rendering Card here would mount a second copy of a component holding
          its own form state and transitions — duplicate element ids, and a
          useActionState that restarts mid-drag. A name is all anybody needs
          to see while it is in the air. */}
      <DragOverlay dropAnimation={null}>{overlay}</DragOverlay>
    </DndContext>
  );
}

/**
 * A column that accepts a drop.
 *
 * `dropId` must be unique across the whole board, which matters when the
 * board is grouped and every group draws the same columns. `stageId` is what
 * the move actually uses.
 */
export function DropColumn({
  dropId,
  stageId,
  stageName,
  className,
  children,
}: {
  dropId: string;
  stageId: string;
  stageName: string;
  className?: string;
  children: ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: dropId,
    data: { stageId, stageName },
  });

  return (
    <section
      ref={setNodeRef}
      className={`${className ?? ''} transition-colors ${
        isOver ? 'outline outline-2 outline-[var(--s-accent)]' : ''
      }`}
    >
      {children}
    </section>
  );
}

/**
 * The card's own ref, and the props for its handle.
 *
 * Split deliberately: dnd-kit measures the element it is given, so the ref
 * belongs on the card (the whole card is what moves), while the listeners
 * belong on the handle (only the handle should start a drag). Giving both to
 * the same element is the shape this file's docblock exists to argue against.
 */
export function useCardDrag(clientId: string, stageId: string, disabled?: boolean) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: clientId,
    disabled,
    /* Carried so `onDragEnd` can tell a real move from a drop back into the
       same column without a lookup. */
    data: { stageId },
  });

  return {
    /** Goes on the card. */
    cardRef: setNodeRef,
    /** Goes on the handle button, and nowhere else. */
    handleProps: { ...attributes, ...listeners },
    isDragging,
  };
}

/**
 * The grip.
 *
 * Always visible rather than revealed on hover: touch has no hover, and a
 * control that only exists for mouse users is a board a phone cannot
 * reorganise. Small and quiet enough that it does not compete with the name.
 */
export function DragHandle({
  label,
  disabled,
  ...props
}: {
  label: string;
  disabled?: boolean;
} & React.HTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      disabled={disabled}
      /* `touch-none` is what lets the 200ms hold become a drag instead of the
         browser claiming the gesture for scrolling. Scoped to this button, so
         the rest of the card and the column still scroll normally. */
      className="-m-1 cursor-grab touch-none rounded-[6px] p-1 text-[var(--s-ink-3)] transition-colors hover:bg-[var(--s-rail-active)] hover:text-[var(--s-ink)] active:cursor-grabbing disabled:cursor-not-allowed disabled:opacity-40"
      {...props}
    >
      <span className="sr-only">{label}</span>
      <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true" fill="currentColor">
        <circle cx="4" cy="2.5" r="1.1" />
        <circle cx="8" cy="2.5" r="1.1" />
        <circle cx="4" cy="6" r="1.1" />
        <circle cx="8" cy="6" r="1.1" />
        <circle cx="4" cy="9.5" r="1.1" />
        <circle cx="8" cy="9.5" r="1.1" />
      </svg>
    </button>
  );
}
