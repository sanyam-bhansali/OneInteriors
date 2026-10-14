import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('@/lib/prisma', () => ({ prisma: {} }));

const { dueWord } = await import('@/modules/studio-practice/clients');

describe('dueWord counts India calendar days', () => {
  // 3:53 pm IST = 10:23 UTC.
  const now = new Date('2026-10-12T10:23:00Z');
  it('two hours later the same evening is today', () => {
    expect(dueWord(new Date('2026-10-12T12:23:00Z'), now)).toBe('today');
  });
  it('just after midnight IST is tomorrow', () => {
    expect(dueWord(new Date('2026-10-12T18:40:00Z'), now)).toBe('tomorrow');
  });
  it('late tonight IST is still today', () => {
    expect(dueWord(new Date('2026-10-12T18:20:00Z'), now)).toBe('today');
  });
});
