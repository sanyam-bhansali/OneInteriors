import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/prisma', () => ({ prisma: {} }));

import { boardColumns } from '@/modules/studio/lifecycle-store';

/* Pre-execution in the Design tab, after the design projects, under its own heading (owner, 12 Nov 2026). */

const card = (client: string, phase: string, o: Partial<{ priority: number | null; lateDays: number }> = {}) => ({ client, phase, priority: null, lateDays: 0, snags: [], ...o }) as never;

describe('the board columns', () => {
  const cols = boardColumns([
    card('Asha', 'DESIGN'),
    card('Rahul', 'PRE_EXECUTION'),
    card('Meena', 'EXECUTION'),
    card('Kiran', 'PRE_EXECUTION', { priority: 3 }),
    card('Om', 'CLOSURE'),
  ]) as unknown as Record<string, { client: string }[]>;
  const names = (k: string) => cols[k]!.map((c) => c.client);

  it('pre-execution has its own list, stars first', () => {
    expect(names('preExecution')).toEqual(['Kiran', 'Rahul']);
  });
  it('design and execution no longer hold pre-execution projects', () => {
    expect(names('design')).toEqual(['Asha']);
    expect(names('execution')).toEqual(['Om', 'Meena']);
  });
});
