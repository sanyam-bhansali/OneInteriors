import { describe, it, expect } from 'vitest';
import { readSeen, welcomeBack } from '@/modules/matching/welcome-back';

const now = new Date('2026-10-02T10:00:00Z');

describe('welcome back', () => {
  it('names the new studios and when they were last seen', () => {
    const seen = { ids: ['a', 'b'], at: '2026-09-29T10:00:00Z' };
    expect(welcomeBack(seen, ['a', 'b', 'c'], now)).toBe('Welcome back — one new studio fits your brief since Tuesday.');
    expect(welcomeBack(seen, ['a', 'c', 'd'], now)).toMatch(/2 new studios fit/);
  });

  it('says nothing on a first visit or when nothing is new', () => {
    expect(welcomeBack(null, ['a'], now)).toBeNull();
    expect(welcomeBack({ ids: ['a'], at: '2026-10-01T10:00:00Z' }, ['a'], now)).toBeNull();
  });

  it('ignores storage it cannot read', () => {
    expect(readSeen('not json')).toBeNull();
    expect(readSeen(JSON.stringify({ ids: 'x', at: 'y' }))).toBeNull();
  });
});
