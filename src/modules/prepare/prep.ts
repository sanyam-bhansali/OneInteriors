import 'server-only';

/**
 * Loading and saving the prep pack.
 *
 * The interesting logic is not here — it is in `rooms.ts` and `moodboard.ts`,
 * which are pure and tested. This file is the database and ownership half:
 * which brief the caller owns, and what may be written to it.
 *
 * ## The ownership rule
 *
 * A prep room is written against a brief, and a brief at this point in the
 * funnel may still be anonymous — the customer requested an expert call with a
 * phone number, but nothing forces them to have signed in. So ownership is the
 * same disjunction the rest of the funnel uses: the signed-in user's brief, or
 * the brief this browser's anonymous cookie points at. Checked here, once, on
 * every read and every write, rather than trusted from a briefId the client
 * sent us — which is the whole reason `savePrepRoom` does not take one.
 */

import { prisma } from '@/lib/prisma';
import { hasDatabase } from '@/lib/env';
import { getCurrentUser } from '@/modules/auth/session';
import { readAnonKey } from '@/modules/brief/repository';
import { rowToBrief } from '@/modules/brief/mapping';
import { estimate, TYPICAL_CARPET_SQFT } from '@/modules/quotation/estimate';
import type { Brief } from '@/modules/brief/types';
import { roomPlan, ROOM_KEYS, ROOM_LABELS, type RoomKey, type RoomPlan } from './rooms';
import { proposeRoom, type RoomProposal } from './moodboard';
import { seedBoard, readBoard } from './board';
import { elementBySlug, isAboveBand } from './catalogue';

export { ROOM_KEYS, ROOM_LABELS, roomPlan } from './rooms';
export type { RoomKey, PlannedRoom, RoomPlan } from './rooms';
export { proposeRoom, candidateStyles, decisionFor } from './moodboard';
export type { RoomProposal, RoomDecision } from './moodboard';
export { pickerFor, seedBoard, readBoard, elementsForRoom } from './board';
export type { PickerEntry, BoardReading } from './board';
export { ELEMENTS, elementBySlug, CATEGORY_LABELS, ELEMENT_CATEGORIES } from './catalogue';
export type { Element, ElementCategory } from './catalogue';

const MAX_NOTE = 2000;

/**
 * The most elements one room's board may hold.
 *
 * Not a technical limit — it is a design one. A board of forty things is not a
 * board, it is a shopping list, and the entire value of this exercise is that
 * it forces a customer to choose. Generous enough that nobody hits it while
 * working honestly.
 */
const MAX_ITEMS = 24;

export interface PrepRoomState {
  roomKey: RoomKey;
  shuffle: number;
  chosenOption: number | null;
  note: string;
  /** Element slugs, in the order the customer placed them. */
  items: string[];
}

export interface PrepPack {
  briefId: string;
  brief: Brief;
  plan: RoomPlan;
  /** One per planned room, already at the customer's saved shuffle position. */
  boards: { proposal: RoomProposal; state: PrepRoomState; indicativePaise: number | null }[];
  floorPlanName: string | null;
  /**
   * What a floor plan is worth to this specific customer's quote band, as the
   * estimator actually computes it — not a marketing pair of numbers.
   *
   * Both values come from `estimate()`, so if somebody changes the variance
   * model this sentence changes with it or stops being shown. `after` equals
   * `before` when there is nothing left to gain, and the page says nothing
   * rather than dressing up a zero.
   */
  spread: { before: string; after: string; worthSaying: boolean };
}

/** The caller's own brief, or null. Never takes an id from the client. */
async function ownBrief() {
  if (!hasDatabase()) return null;

  const user = await getCurrentUser();
  if (user) {
    const row = await prisma.brief.findUnique({ where: { userId: user.id } });
    if (row) return row;
  }

  const anonKey = await readAnonKey();
  if (anonKey) {
    const row = await prisma.brief.findUnique({ where: { anonKey } });
    if (row) return row;
  }

  return null;
}

function pct(value: number): string {
  return `±${Math.round(value * 100)}%`;
}

export async function loadPrepPack(): Promise<PrepPack | null> {
  const row = await ownBrief();
  if (!row) return null;

  const brief = rowToBrief(row);
  const plan = roomPlan({
    propertyType: brief.propertyType,
    scope: brief.scope,
    household: brief.household,
    budgetMaxPaise: brief.budgetMaxPaise,
  });

  const saved = await prisma.prepRoom.findMany({ where: { briefId: row.id } });
  const byRoom = new Map(saved.map((r) => [r.roomKey, r]));

  const boards = plan.rooms.map((planned) => {
    const stored = byRoom.get(planned.key);

    /**
     * A room nobody has opened gets a seeded board; a room they HAVE opened
     * gets exactly what they left, including an empty board.
     *
     * The row's existence is the flag, not the array's length. Keying off
     * `items.length === 0` instead would re-seed a board the customer had
     * deliberately cleared — they empty it, reload, and their four rejected
     * suggestions are back. That is the single most infuriating bug this
     * feature could have, so the distinction is load-bearing.
     */
    const items = stored
      ? stored.items
      : seedBoard(planned.key, brief.styleLikes, brief.styleDislikes, brief.tier);

    const state: PrepRoomState = {
      roomKey: planned.key,
      shuffle: stored?.shuffle ?? 0,
      chosenOption: stored?.chosenOption ?? null,
      note: stored?.note ?? '',
      items,
    };
    return {
      proposal: proposeRoom(planned.key, brief.styleLikes, brief.styleDislikes, state.shuffle),
      state,
      indicativePaise: planned.indicativePaise,
    };
  });

  // The honest version of "uploading this tightens your quote". Both numbers
  // are the estimator's own, computed for this brief, with the plan absent and
  // present. The upload step also collects carpet area, so `after` reflects
  // both — which is the real reason the gap is worth crossing.
  const hasPlan = Boolean(row.floorPlanPath);
  const before = estimate({
    propertyType: brief.propertyType,
    carpetAreaSqft: brief.carpetAreaSqft,
    scope: brief.scope,
    floorPlanUploaded: hasPlan,
  }).variancePct;
  // The upload step asks for carpet area alongside the file, so `after` assumes
  // both arrive. The stand-in figure only has to be non-null to clear the
  // estimator's "area assumed" penalty — it never reaches a customer.
  const after = estimate({
    propertyType: brief.propertyType,
    carpetAreaSqft:
      brief.carpetAreaSqft ?? TYPICAL_CARPET_SQFT[brief.propertyType ?? 'BHK_2'],
    scope: brief.scope,
    floorPlanUploaded: true,
  }).variancePct;

  return {
    briefId: row.id,
    brief,
    plan,
    boards,
    floorPlanName: row.floorPlanName,
    spread: {
      before: pct(before),
      after: pct(after),
      // A one-point gain is not worth a sentence, and claiming it would make
      // every other number on the page read as sales copy.
      worthSaying: !hasPlan && before - after >= 0.02,
    },
  };
}

export type SavePrepResult = { ok: true } | { ok: false; error: string };

/**
 * Write one room.
 *
 * Every field is optional: the page saves a shuffle, a decision and a note at
 * different moments, and sending all three each time would have a note-in-
 * progress overwritten by a stale copy from the shuffle button.
 */
export async function savePrepRoom(
  roomKey: string,
  patch: { shuffle?: number; chosenOption?: number | null; note?: string; items?: string[] },
): Promise<SavePrepResult> {
  if (!ROOM_KEYS.includes(roomKey as RoomKey)) {
    return { ok: false, error: 'Unknown room.' };
  }

  const row = await ownBrief();
  if (!row) return { ok: false, error: 'We could not find your brief on this device.' };

  const data: {
    shuffle?: number;
    chosenOption?: number | null;
    note?: string | null;
    items?: string[];
  } = {};

  if (patch.items !== undefined) {
    if (!Array.isArray(patch.items)) return { ok: false, error: 'Bad board.' };

    /**
     * Every slug is checked against the catalogue, and unknown ones are
     * DROPPED rather than rejecting the whole save.
     *
     * The array arrives from a client we do not control, so it cannot be
     * trusted — but the realistic cause of an unknown slug is not an attacker,
     * it is a customer with the page open from last week while we retired an
     * element underneath them. Refusing their entire board because one tile no
     * longer exists would punish them for our deployment.
     *
     * Deduplicated for the same reason `candidateStyles` is: a repeat renders
     * as the same tile twice and reads as a bug.
     */
    const cleaned = [...new Set(patch.items.filter((slug) => elementBySlug(slug) !== null))];
    data.items = cleaned.slice(0, MAX_ITEMS);
  }

  if (patch.shuffle !== undefined) {
    // Clamped and truncated. It arrives from a client that we do not control,
    // and `proposeRoom` wraps anyway — but an unbounded integer in a database
    // column is a different problem from an unbounded integer in a function.
    if (!Number.isFinite(patch.shuffle)) return { ok: false, error: 'Bad shuffle value.' };
    data.shuffle = Math.max(0, Math.min(9999, Math.trunc(patch.shuffle)));
  }

  if (patch.chosenOption !== undefined) {
    if (patch.chosenOption === null) data.chosenOption = null;
    else if (!Number.isInteger(patch.chosenOption) || patch.chosenOption < 0 || patch.chosenOption > 9) {
      return { ok: false, error: 'Bad option.' };
    } else data.chosenOption = patch.chosenOption;
  }

  if (patch.note !== undefined) {
    const trimmed = patch.note.trim().slice(0, MAX_NOTE);
    data.note = trimmed || null;
  }

  if (Object.keys(data).length === 0) return { ok: true };

  try {
    await prisma.prepRoom.upsert({
      where: { briefId_roomKey: { briefId: row.id, roomKey } },
      create: { briefId: row.id, roomKey, ...data },
      update: data,
    });
  } catch {
    return { ok: false, error: 'That did not save. Your other answers are safe.' };
  }

  return { ok: true };
}

export interface OpsPrepRoom {
  roomKey: string;
  label: string;
  styleLabel: string | null;
  choice: string | null;
  note: string | null;
  /** The board they composed, as readable labels. */
  board: { label: string; aboveBand: boolean }[];
  /** Only set when the board leans above their band. Null is the common case. */
  budgetFlag: string | null;
}

/**
 * The prep pack as the expert reads it, minutes before the call.
 *
 * Deliberately not gated by `requireRole` here: it is called from a page under
 * /ops, whose layout already redirects anyone without the role, and from
 * `listConsultations`, which checks. Adding a throwing guard to a render-path
 * read is how /ops started returning 500s instead of redirects — a layout and a
 * page render in parallel, so the throw wins the race.
 *
 * Returns only rooms the customer actually touched. An untouched room is not
 * worth a line in something somebody is skimming before a phone call.
 */
export async function prepForBrief(briefId: string): Promise<OpsPrepRoom[]> {
  if (!hasDatabase()) return [];

  const row = await prisma.brief.findUnique({ where: { id: briefId } });
  if (!row) return [];

  const brief = rowToBrief(row);
  const rooms = await prisma.prepRoom.findMany({
    where: { briefId },
    orderBy: { updatedAt: 'desc' },
  });

  return rooms
    .filter(
      (r) =>
        r.chosenOption !== null || (r.note && r.note.trim()) || r.shuffle > 0 || r.items.length > 0,
    )
    .map((r) => {
      const key = r.roomKey as RoomKey;
      const known = ROOM_KEYS.includes(key);
      const proposal = known
        ? proposeRoom(key, brief.styleLikes, brief.styleDislikes, r.shuffle)
        : null;

      const reading = readBoard(r.items, brief.tier);

      return {
        roomKey: r.roomKey,
        label: known ? ROOM_LABELS[key] : r.roomKey,
        styleLabel: proposal?.styleLabel ?? null,
        choice:
          proposal && r.chosenOption !== null
            ? (proposal.decision.options[r.chosenOption]?.label ?? null)
            : null,
        note: r.note,
        // A retired slug is skipped rather than rendered as its raw id. The
        // expert is skimming this thirty seconds before dialling.
        board: r.items.flatMap((slug) => {
          const element = elementBySlug(slug);
          if (!element) return [];
          return [{ label: element.label, aboveBand: isAboveBand(element, brief.tier) }];
        }),
        budgetFlag: reading.message,
      };
    });
}
