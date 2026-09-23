import { describe, it, expect } from 'vitest';
import { compareToIssued, byRoom, type ComparableLine } from '@/modules/studio-quote/revision';

/**
 * "What changed?" — the question a designer is asked across a table, every
 * time, while the client holds the printed copy.
 *
 * Getting this wrong is worse than not having it: a list that says nothing
 * moved while the client can see that something did is not a bug, it is being
 * caught in something.
 */

const line = (room: string, product: string, rupees: number): ComparableLine => ({
  room,
  product,
  amountPaise: rupees * 100,
});

describe('compareToIssued', () => {
  it('says plainly when nothing moved', () => {
    const lines = [line('Kitchen', 'Base cabinets', 100_000)];
    const result = compareToIssued(lines, lines);
    expect(result.identical).toBe(true);
    expect(result.deltaPaise).toBe(0);
  });

  it('finds an added line', () => {
    const result = compareToIssued(
      [line('Kitchen', 'Base cabinets', 100_000)],
      [line('Kitchen', 'Base cabinets', 100_000), line('Kitchen', 'Tall unit', 40_000)],
    );
    expect(result.addedCount).toBe(1);
    expect(result.deltaPaise).toBe(40_000_00);
    expect(result.changes.find((c) => c.kind === 'ADDED')?.product).toBe('Tall unit');
  });

  it('finds a removed line, and the money coming off with it', () => {
    const result = compareToIssued(
      [line('Living and dining', 'Sofa', 80_000), line('Kitchen', 'Base cabinets', 100_000)],
      [line('Kitchen', 'Base cabinets', 100_000)],
    );
    expect(result.removedCount).toBe(1);
    expect(result.deltaPaise).toBe(-80_000_00);
  });

  it('finds a reprice, both ways', () => {
    const up = compareToIssued(
      [line('Kitchen', 'Base cabinets', 100_000)],
      [line('Kitchen', 'Base cabinets', 120_000)],
    );
    expect(up.repricedCount).toBe(1);
    expect(up.changes[0]!.deltaPaise).toBe(20_000_00);

    const down = compareToIssued(
      [line('Kitchen', 'Base cabinets', 100_000)],
      [line('Kitchen', 'Base cabinets', 90_000)],
    );
    expect(down.changes[0]!.deltaPaise).toBe(-10_000_00);
  });

  it('treats the same product in two rooms as two lines', () => {
    /* A wardrobe in the master and a wardrobe in the kids room are not one
       thing that changed price. The room is half the identity. */
    const result = compareToIssued(
      [line('Master bedroom', 'Wardrobe', 100_000)],
      [line('Master bedroom', 'Wardrobe', 100_000), line('Kids bedroom', 'Wardrobe', 80_000)],
    );
    expect(result.addedCount).toBe(1);
    expect(result.repricedCount).toBe(0);
  });

  it('sums two lines of the same product in one room rather than pairing them', () => {
    /**
     * Two wardrobes in the master. Pairing the first with the first and
     * calling the second new would produce a diff nobody could reconcile
     * against the document; summing produces a true sentence — "wardrobes in
     * the master went from ₹1.8L to ₹2L".
     */
    const result = compareToIssued(
      [line('Master bedroom', 'Wardrobe', 100_000), line('Master bedroom', 'Wardrobe', 80_000)],
      [line('Master bedroom', 'Wardrobe', 120_000), line('Master bedroom', 'Wardrobe', 80_000)],
    );
    expect(result.changes).toHaveLength(1);
    expect(result.changes[0]!.wasPaise).toBe(180_000_00);
    expect(result.changes[0]!.nowPaise).toBe(200_000_00);
  });

  it('two changes that cancel out are still two changes', () => {
    /* The total is unmoved and the document is not. A client who spots one of
       them while being told nothing changed has caught us. */
    const result = compareToIssued(
      [line('Kitchen', 'Base cabinets', 100_000), line('Living and dining', 'TV unit', 50_000)],
      [line('Kitchen', 'Base cabinets', 120_000), line('Living and dining', 'TV unit', 30_000)],
    );
    expect(result.deltaPaise).toBe(0);
    expect(result.identical).toBe(false);
    expect(result.repricedCount).toBe(2);
  });

  it('reads in the order of the document in front of them', () => {
    /* Current lines first; what came off is appended, because it is not on
       the page they are both looking at. */
    const result = compareToIssued(
      [line('Kitchen', 'Gone', 10_000), line('Kitchen', 'Kept', 10_000)],
      [line('Kitchen', 'Kept', 10_000), line('Kitchen', 'New', 10_000)],
    );
    expect(result.changes.map((c) => c.product)).toEqual(['Kept', 'New', 'Gone']);
  });

  it('handles a first issue with nothing to compare against', () => {
    const result = compareToIssued([], [line('Kitchen', 'Base cabinets', 100_000)]);
    expect(result.addedCount).toBe(1);
    expect(result.identical).toBe(false);
  });
});

describe('byRoom', () => {
  it('orders by money, biggest first', () => {
    const rooms = byRoom([
      line('Living and dining', 'TV unit', 50_000),
      line('Kitchen', 'Base cabinets', 200_000),
      line('Master bedroom', 'Wardrobe', 100_000),
    ]);
    expect(rooms.map((r) => r.room)).toEqual(['Kitchen', 'Master bedroom', 'Living and dining']);
  });

  it('adds up the lines within a room', () => {
    const rooms = byRoom([
      line('Kitchen', 'Base cabinets', 100_000),
      line('Kitchen', 'Wall cabinets', 60_000),
    ]);
    expect(rooms).toHaveLength(1);
    expect(rooms[0]!.paise).toBe(160_000_00);
    expect(rooms[0]!.shareBps).toBe(10_000);
  });

  it('gives a share in basis points that sums to about the whole', () => {
    const rooms = byRoom([
      line('Kitchen', 'A', 250_000),
      line('Master bedroom', 'B', 250_000),
      line('Living and dining', 'C', 500_000),
    ]);
    expect(rooms.map((r) => r.shareBps)).toEqual([5_000, 2_500, 2_500]);
  });

  it('drops a room that comes to nothing', () => {
    /* An empty room is one somebody has not got to. A 0% slice says the
       opposite — that it was costed and came to nothing. */
    const rooms = byRoom([line('Kitchen', 'A', 100_000), line('Study', 'B', 0)]);
    expect(rooms.map((r) => r.room)).toEqual(['Kitchen']);
  });

  it('survives an empty quotation', () => {
    expect(byRoom([])).toEqual([]);
  });
});
