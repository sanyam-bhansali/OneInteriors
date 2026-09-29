import { describe, it, expect } from 'vitest';
import { INSPIRATION_PROMPT, readInspiration } from '@/modules/inspiration/reading';
import { STYLE_TAGS } from '@/modules/brief/types';

describe('reading an inspiration photo', () => {
  it('offers every style the matcher knows, and only those', () => {
    for (const t of STYLE_TAGS) expect(INSPIRATION_PROMPT).toContain(`- ${t}:`);
  });

  it('keeps our styles, strongest first, at most three, no repeats', () => {
    const r = readInspiration(
      'Here you go: {"styles":[{"style":"japandi","why":"low oak bench, linen"},{"style":"boho","why":"x"},{"style":"japandi","why":"again"},{"style":"scandinavian","why":"white walls"},{"style":"warm-modern","why":"a"},{"style":"coastal-light","why":"b"}]}',
    );
    expect(r.ok && r.picks.map((p) => p.style)).toEqual(['japandi', 'scandinavian', 'warm-modern']);
    expect(r.ok && r.picks[0]!.label).toBe('Japandi');
  });

  it('says so when it is not an interior, or not readable', () => {
    expect(readInspiration('{"styles":[]}')).toEqual({ ok: false, reason: 'not-interior' });
    expect(readInspiration('no json here')).toEqual({ ok: false, reason: 'unreadable' });
  });
});
