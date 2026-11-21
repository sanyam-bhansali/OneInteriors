import { describe, expect, it } from 'vitest';
import { designDna, type DnaInput, type MockupAnswer } from '@/modules/design-dna/dna';
import { mockupVariants } from '@/modules/design-dna/prompt';

/** Design DNA (owner, 4 Nov 2026): Home Profile + mood boards + yes/no on mock-ups. */

const base: DnaInput = { likes: ['warm-modern', 'japandi'], dislikes: [], tier: 'PREMIUM', boards: [], answers: [] };

describe('Design DNA', () => {
  it('starts from the Home Profile: liked styles, as whole percentages adding to 100', () => {
    const dna = designDna(base);
    expect(dna.shares.map((s) => s.tag)).toEqual(['warm-modern', 'japandi']);
    expect(dna.shares.reduce((s, x) => s + x.pct, 0)).toBe(100);
    expect(dna.confidence).toBe('first guess');
    expect(dna.palette).toHaveLength(5);
  });

  it('never shows a style they ruled out, whatever the board or the answers say', () => {
    const answers: MockupAnswer[] = [{ style: 'luxe-glam', light: 'balanced', density: 'calm', verdict: 'up', reason: null }];
    const dna = designDna({ ...base, dislikes: ['luxe-glam'], boards: [{ room: 'LIVING', items: ['italian-marble'] }], answers });
    expect(dna.shares.some((s) => s.tag === 'luxe-glam')).toBe(false);
  });

  it('reads the board: its materials and its floor colour come into the DNA', () => {
    const dna = designDna({ ...base, boards: [{ room: 'LIVING', items: ['wood-look-tile'] }] });
    expect(dna.materials[0]).toBe('Wood-look tile');
    expect(dna.palette[1]).toBe('#C9A87C');
    expect(dna.evidence.boardItems).toBe(1);
  });

  it('a yes moves a style up; a "not my colours" no moves it down harder', () => {
    const up: MockupAnswer = { style: 'japandi', light: 'balanced', density: 'calm', verdict: 'up', reason: null };
    const lifted = designDna({ ...base, answers: [up, up, up] });
    expect(lifted.shares[0]!.tag).toBe('japandi');

    const no = (reason: MockupAnswer['reason']): MockupAnswer => ({ style: 'warm-modern', light: 'balanced', density: 'calm', verdict: 'down', reason });
    const plain = designDna({ ...base, answers: [no(null)] });
    const colours = designDna({ ...base, answers: [no('wrong_colours')] });
    const share = (d: ReturnType<typeof designDna>) => d.shares.find((s) => s.tag === 'warm-modern')?.pct ?? 0;
    expect(share(colours)).toBeLessThan(share(plain));
  });

  it('"too dark" makes it lighter and "too busy" calms it', () => {
    const no = (reason: MockupAnswer['reason']): MockupAnswer => ({ style: 'warm-modern', light: 'deep', density: 'layered', verdict: 'down', reason });
    const moody = designDna({ ...base, likes: ['industrial'] });
    const brighter = designDna({ ...base, likes: ['industrial'], answers: [no('too_dark'), no('too_dark'), no('too_dark')] });
    const order = ['deep', 'balanced', 'light'];
    expect(order.indexOf(brighter.light)).toBeGreaterThanOrEqual(order.indexOf(moody.light));

    const busy = designDna({ ...base, likes: ['classical-ornate'] });
    expect(busy.density).toBe('layered');
    const calmer = designDna({ ...base, likes: ['classical-ornate'], answers: [no('too_busy')] });
    expect(calmer.density).toBe('calm');
  });

  it('says when a board leans above their budget band', () => {
    const dna = designDna({ ...base, tier: 'ESSENTIAL', boards: [{ room: 'LIVING', items: ['italian-marble', 'engineered-wood-floor'] }] });
    expect(dna.budget.stretching).toBe(true);
  });

  it('is the same every time for the same inputs', () => {
    expect(designDna(base)).toEqual(designDna(base));
  });
});

describe('room mock-ups', () => {
  it('draws the room three ways: the lead, a blend, and a twist', () => {
    const dna = designDna(base);
    const v = mockupVariants(dna, 'LIVING', 1, '3 BHK');
    expect(v.map((x) => x.variant)).toEqual(['A', 'B', 'C']);
    expect(v[0]!.style).toBe('warm-modern');
    expect(v[1]!.blend).toBe('japandi');
    expect(v[2]!.light !== dna.light || v[2]!.density !== dna.density).toBe(true);
  });

  it('asks for a photo of a Pune flat in their palette, with no people or text', () => {
    const v = mockupVariants(designDna(base), 'KITCHEN', 1, '2 BHK')[0]!;
    expect(v.prompt).toContain('modular kitchen in a 2 BHK apartment in Pune, India');
    expect(v.prompt).toContain('Warm Modern');
    expect(v.prompt).toContain('No people, no text');
  });

  it('a later round is not the same set again', () => {
    const dna = designDna(base);
    expect(mockupVariants(dna, 'LIVING', 2, null)[2]).not.toEqual(mockupVariants(dna, 'LIVING', 1, null)[2]);
  });
});
