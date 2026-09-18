import { describe, expect, it } from 'vitest';
import {
  MATERIALS,
  findTerms,
  splitSpec,
  material,
  type Material,
} from '@/modules/materials/glossary';
import { QUESTIONS, pickQuestion, questionMaterial } from '@/modules/materials/quiz';
import { ART_KEYS } from '@/components/oi/MaterialArt';
import { CATALOGUE } from '@/modules/quotation/catalogue';

describe('the glossary itself', () => {
  it('gives every material a unique id', () => {
    const ids = MATERIALS.map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  /**
   * The regression these guard against is prose creeping back.
   *
   * This file was three paragraphs per term once. It was accurate and nobody
   * would have read it — somebody choosing a kitchen is excited and on a
   * phone, and an essay at that moment is an obstacle rather than
   * thoroughness. Every card field is sized to be taken in at a glance, and
   * the only way that survives six months of edits is a failing test.
   */
  it('keeps every tagline to about seven words', () => {
    for (const m of MATERIALS) {
      expect(m.tagline.split(/\s+/).length, `${m.id} tagline: "${m.tagline}"`).toBeLessThanOrEqual(8);
    }
  });

  it('keeps both sides of the comparison to five words', () => {
    for (const m of MATERIALS) {
      expect(m.good.split(/\s+/).length, `${m.id} good: "${m.good}"`).toBeLessThanOrEqual(5);
      expect(m.bad.split(/\s+/).length, `${m.id} bad: "${m.bad}"`).toBeLessThanOrEqual(5);
    }
  });

  it('keeps the money to a single short figure', () => {
    for (const m of MATERIALS) {
      expect(m.money.length, `${m.id} money: "${m.money}"`).toBeLessThanOrEqual(18);
    }
  });

  it('hedges every rupee figure rather than quoting one', () => {
    // Order-of-magnitude figures for a Pune 2 BHK. Presenting one as a firm
    // number would be the exact failure the product argues against.
    for (const m of MATERIALS) {
      if (!m.money.includes('₹')) continue;
      expect(m.money, `${m.id}`).toMatch(/≈|about|roughly/);
    }
  });

  it('still keeps a full explanation for whoever wants it', () => {
    // Short on the card is not the same as thin. The long version stays.
    for (const m of MATERIALS) {
      expect(m.detail.length, `${m.id} detail`).toBeGreaterThan(120);
    }
  });

  it('points every material at a drawing that exists', () => {
    for (const m of MATERIALS) {
      expect(ART_KEYS, `${m.id} art key "${m.art}"`).toContain(m.art);
    }
  });

  it('gives each material its own drawing', () => {
    // A drawing that could be swapped for another material's without anybody
    // noticing has failed — it is a label with extra steps.
    const arts = MATERIALS.map((m) => m.art);
    expect(new Set(arts).size).toBe(arts.length);
  });

  it('draws nothing that is never used', () => {
    const used = new Set(MATERIALS.map((m) => m.art));
    for (const key of ART_KEYS) {
      expect(used.has(key), `drawing "${key}" is orphaned`).toBe(true);
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
    // the difference between teaching and scoring. Short, though — this is
    // read on a card while a quote is landing.
    for (const q of QUESTIONS) {
      for (const c of q.choices) {
        expect(c.ifPicked.length, `${q.id}/${c.id} empty`).toBeGreaterThan(20);
        expect(
          c.ifPicked.split(/\s+/).length,
          `${q.id}/${c.id} too long: "${c.ifPicked}"`,
        ).toBeLessThanOrEqual(16);
      }
    }
  });

  it('keeps the question and its options short enough for a card', () => {
    for (const q of QUESTIONS) {
      expect(q.ask.split(/\s+/).length, `${q.id} ask: "${q.ask}"`).toBeLessThanOrEqual(12);
      for (const c of q.choices) {
        expect(c.label.split(/\s+/).length, `${q.id}/${c.id}: "${c.label}"`).toBeLessThanOrEqual(6);
      }
      expect(q.because.split(/\s+/).length, `${q.id} because`).toBeLessThanOrEqual(30);
      expect(q.stakes.split(/\s+/).length, `${q.id} stakes`).toBeLessThanOrEqual(14);
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
