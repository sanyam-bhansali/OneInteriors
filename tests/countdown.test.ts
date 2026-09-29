import { describe, it, expect } from 'vitest';
import { countdownFor } from '@/modules/portal/countdown';

const today = new Date('2026-09-30T00:00:00Z');

describe('the possession countdown', () => {
  it('counts the days to the keys and lays the plan against them', () => {
    const c = countdownFor({ possessionStatus: 'EXPECTED', possessionOn: '2026-12-01', scope: 'FULL_HOME' }, today)!;
    expect(c.headline).toBe('Keys in 62 days');
    expect(c.plan[0]).toBe('Start design by November 2026, so work can begin when you get the keys');
    expect(c.plan[1]).toBe('Keys expected in December 2026');
    expect(c.plan[2]).toMatch(/^Ready between /);
  });

  it('says so when they already have the keys, and says nothing without an answer', () => {
    expect(countdownFor({ possessionStatus: 'HAVE_KEYS', possessionOn: null, scope: 'KITCHEN_WARDROBE' }, today)!.headline).toBe('You have the keys');
    expect(countdownFor({ possessionStatus: 'NOT_SURE', possessionOn: null, scope: 'FULL_HOME' }, today)).toBeNull();
  });
});
