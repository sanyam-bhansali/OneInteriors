import { describe, it, expect } from 'vitest';
import { roomPlan, ROOM_KEYS, ROOM_LABELS, type RoomKey } from '@/modules/prepare/rooms';
import { proposeRoom, candidateStyles } from '@/modules/prepare/moodboard';
import { estimate } from '@/modules/quotation/estimate';
import { lakhsToPaise } from '@/lib/money';
import { EMPTY_BRIEF, STYLE_TAGS, type StyleTag } from '@/modules/brief/types';
import { briefToRow, rowToBrief } from '@/modules/brief/mapping';

/**
 * The prep pack's pure half.
 *
 * Two of these are load-bearing and the rest are documentation:
 *
 *  - the room split must sum to the customer's own budget, exactly, because
 *    they will add it up; and
 *  - a disliked style must never be proposed, because Q5 is a hard filter
 *    everywhere else in the product and a mood board that ignores it says we do
 *    not read the answers.
 */

const HOUSEHOLD = { adults: 2, children: 0, elderly: 0, pets: false, worksFromHome: false };

describe('roomPlan', () => {
  it('splits the budget so the rooms sum to exactly the budget', () => {
    const budget = lakhsToPaise(9);
    const plan = roomPlan({
      propertyType: 'BHK_3',
      scope: 'FULL_HOME',
      household: HOUSEHOLD,
      budgetMaxPaise: budget,
    });

    const total = plan.rooms.reduce((sum, r) => sum + (r.indicativePaise ?? 0), 0);
    expect(total).toBe(budget);
  });

  /**
   * The awkward budget is the one that catches a naive `total * weight / sum`.
   * A customer who adds nine figures up and lands ₹3 away from their own number
   * has been given a reason to distrust everything else we show them.
   */
  it('sums exactly for a budget that does not divide cleanly', () => {
    const budget = 777_777_777;
    const plan = roomPlan({
      propertyType: 'BHK_2',
      scope: 'FULL_HOME',
      household: HOUSEHOLD,
      budgetMaxPaise: budget,
    });

    expect(plan.rooms.reduce((s, r) => s + (r.indicativePaise ?? 0), 0)).toBe(budget);
  });

  it('gives every room an integer number of paise', () => {
    const plan = roomPlan({
      propertyType: 'BHK_4_PLUS',
      scope: 'FULL_HOME',
      household: HOUSEHOLD,
      budgetMaxPaise: 1_234_567,
    });

    for (const room of plan.rooms) {
      expect(Number.isInteger(room.indicativePaise)).toBe(true);
    }
  });

  it('scales bedrooms with the property type', () => {
    const bedroomsIn = (type: 'BHK_1' | 'BHK_2' | 'BHK_3' | 'BHK_4_PLUS') =>
      roomPlan({
        propertyType: type,
        scope: 'FULL_HOME',
        household: HOUSEHOLD,
        budgetMaxPaise: lakhsToPaise(10),
      }).rooms.filter((r) => r.key.startsWith('BEDROOM')).length;

    expect(bedroomsIn('BHK_1')).toBe(1);
    expect(bedroomsIn('BHK_2')).toBe(2);
    expect(bedroomsIn('BHK_3')).toBe(3);
    expect(bedroomsIn('BHK_4_PLUS')).toBe(4);
  });

  it('offers a study only to someone who works from home', () => {
    const withoutStudy = roomPlan({
      propertyType: 'BHK_2',
      scope: 'FULL_HOME',
      household: HOUSEHOLD,
      budgetMaxPaise: lakhsToPaise(10),
    });
    expect(withoutStudy.rooms.some((r) => r.key === 'STUDY')).toBe(false);

    const withStudy = roomPlan({
      propertyType: 'BHK_2',
      scope: 'FULL_HOME',
      household: { ...HOUSEHOLD, worksFromHome: true },
      budgetMaxPaise: lakhsToPaise(10),
    });
    expect(withStudy.rooms.some((r) => r.key === 'STUDY')).toBe(true);
  });

  it('keeps a kitchen-and-wardrobes customer out of the living room', () => {
    const plan = roomPlan({
      propertyType: 'BHK_2',
      scope: 'KITCHEN_WARDROBE',
      household: HOUSEHOLD,
      budgetMaxPaise: lakhsToPaise(6),
    });

    expect(plan.rooms.map((r) => r.key)).toEqual(['KITCHEN', 'BEDROOM_MAIN', 'BEDROOM_2']);
    expect(plan.budgetSplit).toBe(true);
  });

  /**
   * We know the budget but not which room it belongs to. Putting a confident
   * rupee figure against the wrong wall is worse than showing none.
   */
  it('refuses to split a budget across rooms when the scope is one room', () => {
    const plan = roomPlan({
      propertyType: 'BHK_2',
      scope: 'SINGLE_ROOM',
      household: HOUSEHOLD,
      budgetMaxPaise: lakhsToPaise(4),
    });

    expect(plan.budgetSplit).toBe(false);
    expect(plan.rooms.every((r) => r.indicativePaise === null)).toBe(true);
    expect(plan.rooms.length).toBeGreaterThan(0);
  });

  it('shows rooms with no figures when there is no budget yet', () => {
    const plan = roomPlan({
      propertyType: 'BHK_2',
      scope: 'FULL_HOME',
      household: null,
      budgetMaxPaise: null,
    });

    expect(plan.budgetSplit).toBe(false);
    expect(plan.rooms.length).toBeGreaterThan(0);
  });

  it('falls back to a 2 BHK full home rather than rendering nothing', () => {
    const plan = roomPlan({
      propertyType: null,
      scope: null,
      household: null,
      budgetMaxPaise: lakhsToPaise(8),
    });

    expect(plan.rooms.some((r) => r.key === 'KITCHEN')).toBe(true);
    expect(plan.rooms.filter((r) => r.key.startsWith('BEDROOM'))).toHaveLength(2);
  });

  it('labels every room key it can produce', () => {
    for (const key of ROOM_KEYS) {
      expect(ROOM_LABELS[key]).toBeTruthy();
    }
  });
});

describe('candidateStyles', () => {
  /** THE test. Q5 is a hard filter and this is the surface most likely to leak it. */
  it('never proposes a style the customer ruled out', () => {
    const dislikes: StyleTag[] = ['luxe-glam', 'classical-ornate'];
    const candidates = candidateStyles(['japandi', 'scandinavian'], dislikes);

    for (const banned of dislikes) {
      expect(candidates).not.toContain(banned);
    }
  });

  it('drops a style the customer both liked and ruled out, rather than trusting the like', () => {
    const candidates = candidateStyles(['industrial'], ['industrial']);
    expect(candidates).not.toContain('industrial');
  });

  it('leads with the customer’s own picks, in their order', () => {
    const candidates = candidateStyles(['art-deco', 'japandi'], []);
    expect(candidates.slice(0, 2)).toEqual(['art-deco', 'japandi']);
  });

  it('puts styles sharing a motif with a liked one ahead of the rest', () => {
    // Japandi's motif is `organic`, shared with rustic-earthy and nothing else.
    const candidates = candidateStyles(['japandi'], []);
    const rustic = candidates.indexOf('rustic-earthy');
    const deco = candidates.indexOf('art-deco');

    expect(rustic).toBeGreaterThan(0);
    expect(rustic).toBeLessThan(deco);
  });

  it('offers the whole vocabulary to someone who has picked nothing', () => {
    expect(candidateStyles([], [])).toHaveLength(STYLE_TAGS.length);
  });

  /**
   * A duplicate in `styleLikes` must not survive into the candidate list.
   *
   * The quiz does not produce one, but `styleLikes` comes out of Postgres
   * through a bare `as StyleTag[]` cast with no runtime validation, so the
   * array is whatever is in the column. The symptom of a repeat is not a crash
   * or a wrong board — it is two adjacent shuffle positions showing the same
   * room, which reads as a broken Shuffle button.
   */
  it('does not repeat a style, even when the stored likes contain one', () => {
    const candidates = candidateStyles(['japandi', 'japandi', 'scandinavian'], []);

    expect(new Set(candidates).size).toBe(candidates.length);
    expect(candidates.slice(0, 2)).toEqual(['japandi', 'scandinavian']);
  });

  it('never shows the same room twice in a row when shuffled through a duplicate', () => {
    const likes: StyleTag[] = ['japandi', 'japandi', 'scandinavian'];

    for (let shuffle = 0; shuffle < 15; shuffle++) {
      const here = proposeRoom('KITCHEN', likes, [], shuffle);
      const next = proposeRoom('KITCHEN', likes, [], shuffle + 1);
      expect(next.style).not.toBe(here.style);
    }
  });

  /** A customer can ban everything. A page mid-way through must not crash. */
  it('still returns something when every style is ruled out', () => {
    const candidates = candidateStyles([], [...STYLE_TAGS]);
    expect(candidates).toHaveLength(1);
  });
});

describe('proposeRoom', () => {
  const LIKES: StyleTag[] = ['japandi', 'scandinavian'];

  it('is deterministic — the same shuffle gives the same board', () => {
    const a = proposeRoom('KITCHEN', LIKES, [], 3);
    const b = proposeRoom('KITCHEN', LIKES, [], 3);
    expect(a.style).toBe(b.style);
    expect(a.materials).toEqual(b.materials);
  });

  it('moves to a different style when shuffled', () => {
    const first = proposeRoom('KITCHEN', LIKES, [], 0);
    const second = proposeRoom('KITCHEN', LIKES, [], 1);
    expect(second.style).not.toBe(first.style);
  });

  it('wraps back round rather than running out', () => {
    const first = proposeRoom('KITCHEN', LIKES, [], 0);
    const wrapped = proposeRoom('KITCHEN', LIKES, [], first.optionCount);
    expect(wrapped.style).toBe(first.style);
  });

  /**
   * `%` keeps the sign of the dividend in JavaScript, so a negative counter
   * would index off the front of the array and return undefined — which would
   * then be read for `.materials` and throw inside a render.
   */
  it('survives a negative or absurd shuffle count from the database', () => {
    for (const shuffle of [-1, -97, 1e9, Number.NaN]) {
      const proposal = proposeRoom('LIVING', LIKES, [], shuffle);
      expect(STYLE_TAGS).toContain(proposal.style);
      expect(proposal.materials).toHaveLength(3);
    }
  });

  it('never proposes a ruled-out style at any shuffle position', () => {
    const dislikes: StyleTag[] = ['luxe-glam', 'art-deco', 'classical-ornate'];
    for (let shuffle = 0; shuffle < 40; shuffle++) {
      const proposal = proposeRoom('BEDROOM_MAIN', ['japandi'], dislikes, shuffle);
      expect(dislikes).not.toContain(proposal.style);
    }
  });

  it('gives every room a decision with at least two options', () => {
    for (const room of ROOM_KEYS) {
      const proposal = proposeRoom(room as RoomKey, LIKES, [], 0);
      expect(proposal.decision.question).toBeTruthy();
      expect(proposal.decision.options.length).toBeGreaterThanOrEqual(2);
      for (const option of proposal.decision.options) {
        expect(option.label).toBeTruthy();
        expect(option.note).toBeTruthy();
        expect(['less', 'middle', 'more']).toContain(option.direction);
      }
    }
  });

  /**
   * Every room's options must span the price range. A decision whose choices
   * all push the same way is not a decision, it is an upsell.
   */
  it('offers a cheaper and a dearer direction in every room', () => {
    for (const room of ROOM_KEYS) {
      const directions = proposeRoom(room as RoomKey, LIKES, [], 0).decision.options.map(
        (o) => o.direction,
      );
      expect(directions).toContain('less');
      expect(directions).toContain('more');
    }
  });
});

/**
 * The floor-plan payoff the prep page states in words.
 *
 * These assert the ESTIMATOR, not the copy, because the copy reads its numbers
 * from here. If somebody changes the variance model, this fails and the
 * sentence on the page changes with it — which is the whole point of computing
 * it rather than writing "±22% to ±8%" into a paragraph.
 */
describe('floor-plan variance credit', () => {
  const BRIEF = { propertyType: 'BHK_2' as const, scope: 'FULL_HOME' as const };

  it('tightens the band when a plan is present', () => {
    const without = estimate({ ...BRIEF, carpetAreaSqft: 900, floorPlanUploaded: false });
    const with_ = estimate({ ...BRIEF, carpetAreaSqft: 900, floorPlanUploaded: true });

    expect(with_.variancePct).toBeLessThan(without.variancePct);
  });

  /** Absent must mean absent. A missing field may never quietly tighten a band. */
  it('treats an omitted flag exactly like a missing plan', () => {
    const omitted = estimate({ ...BRIEF, carpetAreaSqft: 900 });
    const explicit = estimate({ ...BRIEF, carpetAreaSqft: 900, floorPlanUploaded: false });

    expect(omitted.variancePct).toBe(explicit.variancePct);
  });

  it('is worth less than the carpet area itself', () => {
    const base = estimate({ ...BRIEF, carpetAreaSqft: 900 }).variancePct;
    const planGain = base - estimate({ ...BRIEF, carpetAreaSqft: 900, floorPlanUploaded: true }).variancePct;
    const areaGain =
      estimate({ ...BRIEF, carpetAreaSqft: null }).variancePct - base;

    expect(planGain).toBeLessThan(areaGain);
  });

  /**
   * The floor. This model has never seen the flat, and no combination of
   * answers may let it present itself as tighter than ±11% — that number
   * belongs to a site visit.
   */
  it('never claims a band tighter than the floor', () => {
    const best = estimate({ ...BRIEF, carpetAreaSqft: 900, floorPlanUploaded: true });
    expect(best.variancePct).toBeGreaterThanOrEqual(0.11);
  });

  it('still caps a very thin brief at the wide end', () => {
    const thin = estimate({ propertyType: null, carpetAreaSqft: null, scope: null });
    expect(thin.variancePct).toBeLessThanOrEqual(0.45);
  });
});

/**
 * The floor plan is written by the upload action and READ by the brief mapper.
 * It must never travel the other way.
 *
 * If `briefToRow` ever learns about these columns, every quiz sync — and the
 * quiz syncs on each answer — would write the domain object's `floorPlanName`
 * back over the database's. The domain object is built from `EMPTY_BRIEF` in a
 * dozen places, where that field is null. So the failure mode is: customer
 * uploads a plan, changes one answer, plan silently detaches from the brief
 * while the file sits in the bucket. Nothing throws and nothing logs.
 */
describe('the floor plan is read-only through the brief mapper', () => {
  it('is not in the writable row shape', () => {
    const row = briefToRow({ ...EMPTY_BRIEF, floorPlanName: 'plan.pdf' }) as Record<string, unknown>;

    expect(Object.keys(row)).not.toContain('floorPlanName');
    expect(Object.keys(row)).not.toContain('floorPlanPath');
  });

  it('comes back out when the database has one', () => {
    const brief = rowToBrief({
      ...briefToRow(EMPTY_BRIEF),
      propertyType: null,
      scope: null,
      involvement: null,
      floorPlanName: '2bhkplan.pdf',
    });

    expect(brief.floorPlanName).toBe('2bhkplan.pdf');
  });

  it('reads as absent, not undefined, when the column is null', () => {
    const brief = rowToBrief({
      ...briefToRow(EMPTY_BRIEF),
      propertyType: null,
      scope: null,
      involvement: null,
    });

    expect(brief.floorPlanName).toBeNull();
  });
});
