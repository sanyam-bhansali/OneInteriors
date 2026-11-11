import { describe, expect, it } from 'vitest';
import {
  classifyCall,
  compareSocieties,
  effectiveHeat,
  effectivePriority,
  heatFor,
  parsePossession,
  priorityFor,
  priorityForDate,
  societyKey,
  type CallFact,
} from '@/modules/studio-practice/society-rules';

const NOW = new Date('2026-11-11T06:00:00Z');
const months = (n: number) => new Date(NOW.getTime() + n * 30.44 * 86_400_000);

describe('Society priority from possession', () => {
  it('is P1 from 3 months before to 6 months after possession', () => {
    expect(priorityForDate(months(3), NOW)).toBe('P1');
    expect(priorityForDate(months(0), NOW)).toBe('P1');
    expect(priorityForDate(months(-6), NOW)).toBe('P1');
  });
  it('is P2 from 3 to 9 months before', () => {
    expect(priorityForDate(months(3.5), NOW)).toBe('P2');
    expect(priorityForDate(months(9), NOW)).toBe('P2');
  });
  it('is P3 further out, long after, or with no date', () => {
    expect(priorityForDate(months(9.5), NOW)).toBe('P3');
    expect(priorityForDate(months(-7), NOW)).toBe('P3');
    expect(priorityForDate(null, NOW)).toBe('P3');
  });
  it('takes the best wing, so one early wing lifts the society', () => {
    const r = priorityFor([{ possessionOn: months(14) }, { possessionOn: months(2) }, { possessionOn: null }], NOW);
    expect(r.priority).toBe('P1');
    expect(r.possessionOn?.getTime()).toBe(months(2).getTime());
    expect(r.dateMissing).toBe(false);
  });
  it('flags a society with no dated wing', () => {
    expect(priorityFor([{ possessionOn: null }], NOW)).toEqual({ priority: 'P3', possessionOn: null, dateMissing: true });
    expect(priorityFor([], NOW).dateMissing).toBe(true);
  });
  it('lets a hand-set priority win', () => {
    expect(effectivePriority('P3', 'P1')).toEqual({ priority: 'P1', byHand: true });
    expect(effectivePriority('P2', null)).toEqual({ priority: 'P2', byHand: false });
  });
});

describe('Society heat from calls', () => {
  it('sorts calls into good, neutral and bad, and ignores calls that reached nobody', () => {
    expect(classifyCall({ outcome: 'spoke', reactions: ['interested'] })).toBe('good');
    expect(classifyCall({ outcome: 'met' })).toBe('good');
    expect(classifyCall({ outcome: 'spoke', reactions: ['already_done'] })).toBe('bad');
    expect(classifyCall({ outcome: 'not_interested' })).toBe('bad');
    expect(classifyCall({ outcome: 'wrong_number' })).toBe('bad');
    expect(classifyCall({ outcome: 'busy', reactions: ['call_back'] })).toBe('neutral');
    expect(classifyCall({ outcome: 'spoke', reactions: ['possession'] })).toBe('neutral');
    expect(classifyCall({ outcome: 'no_answer' })).toBeNull();
    expect(classifyCall({ outcome: 'voicemail' })).toBeNull();
    expect(classifyCall(null)).toBeNull();
    expect(classifyCall({})).toBeNull();
  });

  const call = (clientId: string, daysAgo: number, meta: unknown): CallFact => ({ clientId, at: new Date(NOW.getTime() - daysAgo * 86_400_000), meta });
  const many = (n: number, meta: unknown, from = 0) => Array.from({ length: n }, (_, i) => call(`c${from + i}`, 5, meta));
  const GOOD = { outcome: 'spoke', reactions: ['wants_quote'] };
  const BAD = { outcome: 'not_interested' };
  const MEH = { outcome: 'spoke', reactions: ['exploring'] };

  it('says nothing until 5 leads are reached', () => {
    expect(heatFor([...many(4, GOOD), ...many(10, { outcome: 'no_answer' }, 10)], NOW)).toEqual({ heat: null, reached: 4, good: 4, bad: 0 });
  });
  it('is Hot at 3 good leads, or 30% good', () => {
    expect(heatFor([...many(3, GOOD), ...many(20, MEH, 10)], NOW).heat).toBe('HOT');
    expect(heatFor([...many(2, GOOD), ...many(4, MEH, 10)], NOW).heat).toBe('HOT');
  });
  it('is Cold when more than half are bad', () => {
    expect(heatFor([...many(1, GOOD), ...many(6, BAD, 10), ...many(3, MEH, 20)], NOW).heat).toBe('COLD');
  });
  it('is Warm from 10% good, Cold under it', () => {
    expect(heatFor([...many(2, GOOD), ...many(12, MEH, 10)], NOW).heat).toBe('WARM');
    expect(heatFor([...many(1, GOOD), ...many(12, MEH, 10)], NOW).heat).toBe('COLD');
  });
  it('counts each lead once, by its latest call, inside 60 days', () => {
    const calls = [call('a', 30, BAD), call('a', 2, GOOD), call('b', 90, GOOD), ...many(4, MEH, 10)];
    expect(heatFor(calls, NOW)).toEqual({ heat: 'WARM', reached: 5, good: 1, bad: 0 });
  });
  it('lets a hand-set heat win for 30 days', () => {
    const set = new Date(NOW.getTime() - 29 * 86_400_000);
    expect(effectiveHeat('COLD', 'HOT', set, NOW)).toEqual({ heat: 'HOT', byHand: true });
    const old = new Date(NOW.getTime() - 31 * 86_400_000);
    expect(effectiveHeat('COLD', 'HOT', old, NOW)).toEqual({ heat: 'COLD', byHand: false });
  });
});

describe('Society list order and names', () => {
  it('puts P1 first, then nearest possession, then Hot before Cold', () => {
    const rows = [
      { name: 'C', priority: 'P2' as const, possessionOn: months(5), heat: 'HOT' as const },
      { name: 'B', priority: 'P1' as const, possessionOn: months(2), heat: 'COLD' as const },
      { name: 'A', priority: 'P1' as const, possessionOn: months(2), heat: 'HOT' as const },
      { name: 'D', priority: 'P1' as const, possessionOn: months(-1), heat: null },
    ];
    expect(rows.sort((a, b) => compareSocieties(a, b, NOW)).map((r) => r.name)).toEqual(['D', 'A', 'B', 'C']);
  });
  it('keys a society by its letters and digits', () => {
    expect(societyKey('Life Republic R-10')).toBe(societyKey('life republic r10'));
  });
  it('reads possession months the way sheets write them', () => {
    const iso = (d: Date | null) => d?.toISOString().slice(0, 7);
    expect(iso(parsePossession('2027-03'))).toBe('2027-03');
    expect(iso(parsePossession('03/2027'))).toBe('2027-03');
    expect(iso(parsePossession('15/03/2027'))).toBe('2027-03');
    expect(iso(parsePossession('Mar 2027'))).toBe('2027-03');
    expect(iso(parsePossession('March-27'))).toBe('2027-03');
    expect(iso(parsePossession(46447))).toBe('2027-03');
    expect(parsePossession('soon')).toBeNull();
    expect(parsePossession('')).toBeNull();
  });
});
