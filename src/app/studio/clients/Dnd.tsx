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
  type PointerSensorOptions,
  type TouchSensorOptions,
} from '@dnd-kit/core';

/**
 * Controls inside a card that must keep their own gesture.
 *
 * A card holds a phone link, a stage button, a contact button and a delete.
 * Pressing any of those is a click, never the start of a drag, and the check
 * is `closest` rather than an equality test because the press usually lands on
 * an icon or a span inside the control rather than the control itself.
 */
const CONTROLS = 'a,button,input,select,textarea,label,summary,[role="button"],[contenteditable]';

/**
 * Should this press start a drag?
 *
 * `currentTarget` is the element the listener is attached to, which is what
 * lets one static activator serve both the card and its handle: the handle
 * always drags, and the card drags only when the press did not land on a
 * control — including the handle itself, whose own listener has already
 * claimed the same bubbling event.
 */
function pressStartsDrag(event: { target: EventTarget | null; currentTarget: EventTarget | null }) {
  const target = event.target;
  if (!(target instanceof Element)) return true;

  const from = event.currentTarget;
  if (from instanceof Element && from.hasAttribute('data-drag-handle')) return true;

  return target.closest(CONTROLS) === null;
}

/**
 * The card body drags, and the controls on it still work.
 *
 * dnd-kit's own PointerSensor activates on any primary press. That is why the
 * board originally put the listeners on the handle alone — and why nothing
 * happened when somebody did the obvious thing and pulled the card, which is
 * how every other board they have used behaves. Overriding the activator is
 * the narrow fix: same sensor, one extra question before it says yes.
 */
class CardPointerSensor extends PointerSensor {
  static activators = [
    {
      eventName: 'onPointerDown' as const,
      handler: (event: React.PointerEvent, { onActivation }: PointerSensorOptions) => {
        const native = event.nativeEvent;
        if (!native.isPrimary || native.button !== 0) return false;
        if (!pressStartsDrag(event)) return false;
        onActivation?.({ event: native });
        return true;
      },
    },
  ];
}

/** The same question, for a finger. The 200ms hold still applies. */
class CardTouchSensor extends TouchSensor {
  static activators = [
    {
      eventName: 'onTouchStart' as const,
      handler: (event: React.TouchEvent, { onActivation }: TouchSensorOptions) => {
        const native = event.nativeEvent;
        if (native.touches.length > 1) return false;
        if (!pressStartsDrag(event)) return false;
        onActivation?.({ event: native });
        return true;
      },
    },
  ];
}

/**
 * Dragging a card between columns.
 *
 * ## The card drags. So does the handle.
 *
 * This was handle-only at first, for three reasons that were all true and
 * added up to the wrong build:
 *
 * 1. dnd-kit's `attributes` include `role="button"` and `tabIndex={0}`. On a
 *    card that already contains a phone link, a move button, a contact
 *    button and a delete, that is a button wrapping four buttons — invalid,
 *    and it makes the whole card a tab stop ahead of the controls inside it.
 * 2. Listeners on the card start a drag when somebody presses the phone link.
 * 3. On touch they fight the column's horizontal scroll.
 *
 * What none of that reckoned with is that a kanban board teaches its own
 * gesture: people pull the card. They did, nothing moved, and they reported
 * the feature as broken — which it effectively was, because a 12px grip is
 * not discoverable and is not what anybody reaches for.
 *
 * So the listeners are on both, and the three objections are answered
 * separately rather than by withholding the gesture. The `attributes` — the
 * role, the tab stop — stay on the handle alone, so (1) never arises. (2) is
 * `pressStartsDrag`, which refuses any press that landed on a control. (3) is
 * the touch sensor's existing 200ms hold: a swipe across the card scrolls,
 * a hold picks it up.
 *
 * The handle stays, and is not decoration. It is the keyboard affordance and
 * the visible sign that a card can be moved at all.
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
    useSensor(CardPointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(CardTouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
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
 * The card's ref, and the two sets of props that make it draggable.
 *
 * The same listeners go on both the card and its handle; the ARIA attributes
 * go on the handle only. That split is the whole of the accessibility
 * argument in this file's docblock — a card wearing `role="button"` would be
 * a button containing four buttons, while a card wearing only pointer
 * listeners is just an element people can pull.
 */
export function useCardDrag(clientId: string, stageId: string, disabled?: boolean) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, isDragging } = useDraggable({
    id: clientId,
    disabled,
    /* Carried so `onDragEnd` can tell a real move from a drop back into the
       same column without a lookup. */
    data: { stageId },
  });

  return {
    /** Goes on the card. */
    cardRef: setNodeRef,
    /**
     * Also goes on the card. Listeners without attributes, and harmless when
     * the press lands on a control — see `pressStartsDrag`.
     */
    cardProps: listeners ?? {},
    /** Goes on the handle button, and nowhere else. */
    handleProps: { ...attributes, ...listeners },
    /**
     * Also the handle, and not optional now that the card carries listeners.
     *
     * KeyboardSensor refuses a keydown whose target is not the activator
     * node — but only if it HAS one. Without this ref it has none, the guard
     * is skipped, and a space typed into any field inside the card bubbles up
     * to the card's own onKeyDown and picks the card up.
     */
    handleRef: setActivatorNodeRef,
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
  handleRef,
  ...props
}: {
  label: string;
  disabled?: boolean;
  handleRef?: (element: HTMLElement | null) => void;
} & React.HTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      ref={handleRef}
      disabled={disabled}
      /* Read by `pressStartsDrag`: this is the one control inside a card that
         a press SHOULD drag from, and the one the card's own listener must
         keep its hands off when the same event bubbles up. */
      data-drag-handle=""
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
