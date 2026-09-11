import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { passesHardFilters, scoreMatch, rankStudios } from '@/modules/matching/score';
import { STUDIOS } from '@/data/studios';
import { EMPTY_BRIEF, type Brief } from '@/modules/brief/types';
import { lakhsToPaise } from '@/lib/money';

/**
 * The governance rule, enforced by tests rather than by memory.
 *
 * A subscription buys VOLUME — how many briefs a studio is shown for. It never
 * buys POSITION. Pay-to-rank dressed as "recommended" is the exact mechanic
 * behind the complaints this product is positioned against; it is provable from
 * the outside by anyone who cares to look; and the day it exists the
 * verification tiers stop being worth anything.
 *
 * Policy does not survive a deadline. These tests are the thing that does.
 */

const brief: Brief = {
  ...EMPTY_BRIEF,
  propertyType: 'BHK_2',
  carpetAreaSqft: 850,
  locality: 'baner',
  scope: 'FULL_HOME',
  budgetMinPaise: lakhsToPaise(8),
  budgetMaxPaise: lakhsToPaise(16),
  styleLikes: ['contemporary-minimal'],
  involvement: 'COLLABORATE',
  priorityRanking: ['BUDGET'],
  lastStep: 9,
  completedAt: new Date().toISOString(),
};

describe('pausing removes, it never promotes', () => {
  it('excludes a paused studio outright', () => {
    // Pick a studio that already passes for THIS brief. Picking any live studio
    // was the earlier mistake: locality and style are hard filters, so most of
    // the roster legitimately fails a given brief and the test proved nothing.
    const live = STUDIOS.find((s) => passesHardFilters(brief, s));
    expect(live, 'fixtures should contain a studio matching this brief').toBeDefined();

    expect(passesHardFilters(brief, live!)).toBe(true);
    expect(
      passesHardFilters(brief, { ...live!, pausedAt: new Date().toISOString() }),
    ).toBe(false);
    expect(scoreMatch(brief, { ...live!, pausedAt: new Date().toISOString() })).toBeNull();
  });

  /**
   * The defensive half. A studio object that reaches the engine without the
   * field at all — an old fixture, a mapper someone forgot to update — must be
   * treated as live, not as paused. The opposite emptied every customer's
   * results at once and looked like a matching bug rather than a missing field.
   */
  it('treats a missing pausedAt as live rather than paused', () => {
    const live = STUDIOS.find((s) => passesHardFilters(brief, s))!;
    const withoutField = { ...live } as Record<string, unknown>;
    delete withoutField.pausedAt;

    expect(passesHardFilters(brief, withoutField as unknown as typeof live)).toBe(true);
  });

  /**
   * The asymmetry is the point. Pausing can only ever shorten the list; there
   * is no value of any allocation field that lengthens it or reorders it.
   */
  it('changes nobody else\'s position when one studio is paused', () => {
    const before = rankStudios(brief, STUDIOS, 20);
    expect(before.length).toBeGreaterThan(2);

    const target = before[1].studioId;
    const paused = STUDIOS.map((s) =>
      s.id === target ? { ...s, pausedAt: new Date().toISOString() } : s,
    );
    const after = rankStudios(brief, paused, 20);

    expect(after.map((m) => m.studioId)).not.toContain(target);
    // Everyone else keeps their order and their score.
    const expected = before.filter((m) => m.studioId !== target);
    expect(after.map((m) => m.studioId)).toEqual(expected.map((m) => m.studioId));
    expect(after.map((m) => m.score)).toEqual(expected.map((m) => m.score));
  });

  it('ignores declared capacity entirely when ranking', () => {
    const base = rankStudios(brief, STUDIOS, 20);
    const boasting = STUDIOS.map((s) => ({ ...s, capacityPerMonth: 60 }));
    const modest = STUDIOS.map((s) => ({ ...s, capacityPerMonth: 1 }));

    expect(rankStudios(brief, boasting, 20).map((m) => m.studioId)).toEqual(
      base.map((m) => m.studioId),
    );
    expect(rankStudios(brief, modest, 20).map((m) => m.studioId)).toEqual(
      base.map((m) => m.studioId),
    );
  });
});

/**
 * A source-level guard, because the strongest version of this rule is that the
 * ranking code has no way to express it. If someone adds a subscription lookup
 * or a boost field to the matching engine, this fails before anyone has to
 * notice it in review.
 */
describe('the matching engine cannot see money', () => {
  const source = readFileSync(
    join(process.cwd(), 'src/modules/matching/score.ts'),
    'utf8',
  );

  /**
   * Named identifiers, not loose words.
   *
   * "priority" on its own is a false positive: `priorityAlignment` and
   * `priorityRanking` are the CUSTOMER's priorities — what they told us matters
   * most — and that is one of the six scoring factors. Banning the substring
   * would ban a legitimate part of the engine and train whoever hits it to
   * delete the assertion.
   *
   * What must never appear is a way to read what a studio pays, or a field that
   * exists to move one up.
   */
  it('never reads money or a placement field', () => {
    const forbidden = [
      'subscription',
      'monthlyPaise',
      'allocationPriority',
      'priorityUntil',
      'boost',
      'sponsored',
      'promoted',
      'featured',
    ];
    for (const name of forbidden) {
      expect(source.toLowerCase(), `score.ts references "${name}"`).not.toContain(
        name.toLowerCase(),
      );
    }
  });

  /**
   * Asserted on which fields appear, not on how the check is written.
   *
   * The first version pinned the exact expression `studio.pausedAt !== null`
   * and broke the moment that comparison was changed — for a good reason, as it
   * happens. A test that fails on a correct refactor is a test people learn to
   * edit rather than heed, which is the opposite of what a governance check is
   * for. What matters is the SET of allocation fields the engine can see.
   */
  it('reads exactly one allocation field, and only to exclude', () => {
    expect(source, 'the engine should still honour a pause').toContain('studio.pausedAt');

    // Everything else about allocation is invisible to ranking. `pauseCause`
    // included: why a studio is out makes no difference to who fits a brief.
    for (const field of ['capacityPerMonth', 'pauseCause', 'pausedReason']) {
      expect(source, `score.ts reads ${field}`).not.toContain(field);
    }

    // And the one field it does read may only ever remove a studio. If
    // `pausedAt` ever appears outside the hard filters, this stops being true.
    const filterBody = source.slice(
      source.indexOf('export function passesHardFilters'),
      source.indexOf('// ── Factors'),
    );
    expect(filterBody).toContain('studio.pausedAt');
    expect(source.split('studio.pausedAt').length - 1, 'pausedAt read more than once').toBe(1);
  });
});
