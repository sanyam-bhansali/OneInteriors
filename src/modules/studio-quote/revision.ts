/**
 * What moved since the client was sent the quotation, and where the money is
 * going.
 *
 * Pure, per CONTRIBUTING §9.5 — the builder, the document and the tests all
 * read the same comparison.
 *
 * ## The question this answers
 *
 * A designer sits across from a client holding a printed quotation and is
 * asked, every time: *what changed?* The honest answer is a short list — this
 * came off, that went up, this is new — and without it the conversation
 * becomes two documents being read line by line, which is where trust goes.
 *
 * So the comparison is against the ISSUED copy, not against the last save. A
 * studio may revise a draft nine times before sending it; none of those are
 * changes as far as the client is concerned, because the client never saw
 * them.
 */

import type { Paise } from '@/lib/money';

/** Enough of a line to compare it. Both sides of the diff use this shape. */
export interface ComparableLine {
  room: string;
  product: string;
  amountPaise: Paise;
}

export type ChangeKind = 'ADDED' | 'REMOVED' | 'REPRICED' | 'UNCHANGED';

export interface LineChange {
  kind: ChangeKind;
  room: string;
  product: string;
  /** What the client was quoted. Zero on an added line. */
  wasPaise: Paise;
  /** What it is now. Zero on a removed line. */
  nowPaise: Paise;
  /** now − was. Negative is money off. */
  deltaPaise: Paise;
}

export interface RevisionSummary {
  changes: LineChange[];
  addedCount: number;
  removedCount: number;
  repricedCount: number;
  /** now − was, across everything. The number the client asks for first. */
  deltaPaise: Paise;
  /** True when nothing moved — worth saying out loud rather than showing an empty list. */
  identical: boolean;
}

/**
 * Lines are matched on room plus product name.
 *
 * Not on id, and that is deliberate. The issued copy is frozen JSON; ids in it
 * refer to rows that may since have been deleted and recreated by an edit that
 * a client would describe as "you changed the wardrobe", not "you deleted the
 * wardrobe and added a different one". Matching on what the line SAYS produces
 * the diff a human would write.
 *
 * The cost is honest and worth stating: two lines with the same product in the
 * same room — two wardrobes in the master, say — collapse into one comparison.
 * They are summed rather than paired arbitrarily, because "wardrobes in the
 * master went from ₹1.2L to ₹1.4L" is true, while pairing the first with the
 * first and calling the second new is not.
 */
function key(line: ComparableLine): string {
  return `${line.room}\u0000${line.product}`;
}

function fold(lines: ComparableLine[]): Map<string, { room: string; product: string; paise: Paise }> {
  const map = new Map<string, { room: string; product: string; paise: Paise }>();

  for (const line of lines) {
    const k = key(line);
    const existing = map.get(k);
    if (existing) existing.paise += line.amountPaise;
    else map.set(k, { room: line.room, product: line.product, paise: line.amountPaise });
  }

  return map;
}

export function compareToIssued(
  issued: ComparableLine[],
  current: ComparableLine[],
): RevisionSummary {
  const was = fold(issued);
  const now = fold(current);

  const changes: LineChange[] = [];

  /* Current first, so the list reads in the order of the document in front of
     them rather than the order of the one they are replacing. */
  for (const [k, line] of now) {
    const before = was.get(k);

    if (!before) {
      changes.push({
        kind: 'ADDED',
        room: line.room,
        product: line.product,
        wasPaise: 0,
        nowPaise: line.paise,
        deltaPaise: line.paise,
      });
      continue;
    }

    changes.push({
      kind: before.paise === line.paise ? 'UNCHANGED' : 'REPRICED',
      room: line.room,
      product: line.product,
      wasPaise: before.paise,
      nowPaise: line.paise,
      deltaPaise: line.paise - before.paise,
    });
  }

  for (const [k, line] of was) {
    if (now.has(k)) continue;
    changes.push({
      kind: 'REMOVED',
      room: line.room,
      product: line.product,
      wasPaise: line.paise,
      nowPaise: 0,
      deltaPaise: -line.paise,
    });
  }

  const addedCount = changes.filter((c) => c.kind === 'ADDED').length;
  const removedCount = changes.filter((c) => c.kind === 'REMOVED').length;
  const repricedCount = changes.filter((c) => c.kind === 'REPRICED').length;

  return {
    changes,
    addedCount,
    removedCount,
    repricedCount,
    deltaPaise: changes.reduce((total, c) => total + c.deltaPaise, 0),
    /* Note this is about the LINES, not the total. Two changes that cancel
       out are still two changes, and a client who spots one of them while
       being told nothing moved has caught us in something. */
    identical: addedCount === 0 && removedCount === 0 && repricedCount === 0,
  };
}

export interface RoomTotal {
  room: string;
  paise: Paise;
  /** Share of the whole, in basis points. 2500 = a quarter of the job. */
  shareBps: number;
}

/**
 * Where the money is going, biggest first.
 *
 * The question behind this one is always the same — the client wants the
 * number down and nobody can say where from. A kitchen at 38% of the job is an
 * answer; forty lines in document order is not.
 *
 * Rooms that come to nothing are dropped. An empty room is a room somebody has
 * not got to yet, and putting a 0% slice on the chart for it says the opposite.
 */
export function byRoom(lines: ComparableLine[]): RoomTotal[] {
  const totals = new Map<string, Paise>();

  for (const line of lines) {
    totals.set(line.room, (totals.get(line.room) ?? 0) + line.amountPaise);
  }

  const whole = [...totals.values()].reduce((a, b) => a + b, 0);

  return [...totals.entries()]
    .filter(([, paise]) => paise > 0)
    .map(([room, paise]) => ({
      room,
      paise,
      shareBps: whole > 0 ? Math.round((paise / whole) * 10_000) : 0,
    }))
    .sort((a, b) => b.paise - a.paise);
}
