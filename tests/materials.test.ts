import { describe, expect, it } from 'vitest';
import {
  MATERIALS,
  findTerms,
  splitSpec,
  material,
  type Material,
} from '@/modules/materials/glossary';
import { QUESTIONS, pickQuestion, questionMaterial } from '@/modules/materials/quiz';
import { CATALOGUE } from '@/modules/quotation/catalogue';

describe('the glossary itself', () => {
  it('gives every material a unique id', () => {
    const ids = MATERIALS.map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('never leaves cheaperCosts vague', () => {
    // The load-bearing field. A glossary that only defines terms teaches
    // vocabulary; this is the half that teaches somebody to read a quotation.
    for (const m of MATERIALS) {
      expect(m.cheaperCosts.length, `${m.id} cheaperCosts`).toBeGreaterThan(40);
    }
  });

  it('quotes a saving only when it names what is being given up', () => {
    for (const m of MATERIALS) {
      if (m.cheaperSaves === null) continue;
      expect(m.cheaperAlt, `${m.id} quotes a saving with no alternative named`).not.toBeNull();
    }
  });

  it('hedges every rupee figure rather than quoting one', () => {
    // These are order-of-magnitude figures for a Pune 2 BHK. Presenting one as
    // a firm number would be the exact failure the product argues against.
    for (const m of MATERIALS) {
      if (!m.cheaperSaves) continue;
      expect(m.cheaperSaves, `${m.id}`).toMatch(/roughly|about|a few/i);
    }
  });
});

describe('findTerms', () => {
  it('finds a term in an ordinary catalogue spec', () => {
    const found = findTerms('18mm BWP carcass · laminate shutter · soft-close hinges');
    const ids = found.map((f) => f.material.id);
    expect(ids).toContain('mm18');
    expect(ids).toContain('bwp');
    expect(ids).toContain('laminate');
    expect(ids).toContain('softclose');
  });

  it('prefers the longest alias and never overlaps', () => {
    const found = findTerms('Marine-ply carcass · laminate · mirror unit');
    const marine = found.find((f) => f.material.id === 'bwp');
    expect(marine?.text).toBe('Marine-ply');

    // No two matches may share a character, or the renderer nests buttons.
    for (let i = 1; i < found.length; i += 1) {
      expect(found[i]!.start).toBeGreaterThanOrEqual(found[i - 1]!.end);
    }
  });

  it('is case-insensitive but reports the source spelling', () => {
    const found = findTerms('bwp ply and BWP ply');
    expect(found[0]!.text).toBe('bwp');
    expect(found[0]!.material.id).toBe('bwp');
  });

  it('will not match inside a longer word', () => {
    // The bug this guards: "MR" lighting up inside "MRP", "ply" inside
    // "supply", "cove" inside "recovery".
    expect(findTerms('supply chain')).toHaveLength(0);
    expect(findTerms('MRP printed on the box')).toHaveLength(0);
    expect(findTerms('recovery of the deposit')).toHaveLength(0);
  });

  it('returns matches in source order', () => {
    const found = findTerms('soft-close hinges on an 18mm BWP carcass');
    const starts = found.map((f) => f.start);
    expect([...starts].sort((a, b) => a - b)).toEqual(starts);
  });

  it('finds nothing in a string with no materials in it', () => {
    expect(findTerms('Queen · upholstered headboard')).toHaveLength(0);
  });
});

describe('splitSpec', () => {
  it('reassembles to exactly the source string', () => {
    // The whole risk of index arithmetic is dropping or duplicating a
    // character, and nobody would notice it in a 13px note under a price.
    for (const item of CATALOGUE) {
      const rebuilt = splitSpec(item.spec)
        .map((p) => p.text)
        .join('');
      expect(rebuilt, item.code).toBe(item.spec);
    }
  });

  it('makes each material tappable at most once per spec', () => {
    // "Putty · primer · two coats emulsion" matches the paint entry four
    // times. Four adjacent buttons opening the same panel is one piece of
    // information and three distractions.
    const parts = splitSpec('Putty · primer · two coats emulsion');
    const ids = parts.filter((p) => p.kind === 'term').map((p) => (p as { material: Material }).material.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('returns the whole string as one text part when nothing matches', () => {
    const parts = splitSpec('Queen · upholstered headboard');
    expect(parts).toEqual([{ kind: 'text', text: 'Queen · upholstered headboard' }]);
  });
});

describe('the catalogue is covered', () => {
  it('finds at least one explainable term in most catalogue specs', () => {
    // Not all — "Queen · upholstered headboard · hydraulic storage" is mostly
    // plain English. But a spec column nobody can read is the failure this
    // module exists to fix, so the majority has to be reachable.
    const withTerms = CATALOGUE.filter((c) => findTerms(c.spec).length > 0);
    expect(withTerms.length / CATALOGUE.length).toBeGreaterThan(0.75);
  });
});

describe('the quiz', () => {
  it('gives every question exactly one correct answer', () => {
    for (const q of QUESTIONS) {
      const right = q.choices.filter((c) => c.correct);
      expect(right, q.id).toHaveLength(1);
    }
  });

  it('replies specifically to every option, right or wrong', () => {
    // A wrong answer deserves a specific reply. In almost every case the wrong
    // option is the right answer somewhere else in the flat, and saying so is
    // the difference between teaching and scoring.
    for (const q of QUESTIONS) {
      for (const c of q.choices) {
        expect(c.ifPicked.length, `${q.id}/${c.id}`).toBeGreaterThan(30);
      }
    }
  });

  it('points every question at a glossary entry that exists', () => {
    for (const q of QUESTIONS) {
      expect(material(q.materialId), q.id).toBeDefined();
      expect(() => questionMaterial(q)).not.toThrow();
    }
  });

  it('gives every question at least three options', () => {
    for (const q of QUESTIONS) {
      expect(q.choices.length, q.id).toBeGreaterThanOrEqual(3);
    }
  });

  it('states the money at stake on every question', () => {
    for (const q of QUESTIONS) {
      expect(q.stakes, q.id).toMatch(/₹/);
    }
  });

  it('uses unique question ids', () => {
    const ids = QUESTIONS.map((q) => q.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('pickQuestion', () => {
  it('is stable for the same seed, so a re-render does not reshuffle', () => {
    const a = pickQuestion('teakline-studio');
    const b = pickQuestion('teakline-studio');
    expect(a.id).toBe(b.id);
  });

  it('never repeats a question the customer has already been asked', () => {
    const seen: string[] = [];
    for (let i = 0; i < QUESTIONS.length; i += 1) {
      const q = pickQuestion(`studio-${i}`, seen);
      expect(seen, `round ${i}`).not.toContain(q.id);
      seen.push(q.id);
    }
    expect(seen).toHaveLength(QUESTIONS.length);
  });

  it('starts again rather than returning nothing once all are seen', () => {
    const all = QUESTIONS.map((q) => q.id);
    expect(pickQuestion('anything', all)).toBeDefined();
  });
});
