import { describe, expect, it } from 'vitest';
import { checked } from '@/modules/app/geio';
import { geioFacts } from '@/modules/app/geio-facts';

const facts = geioFacts('Priya', 'Swarupa');

describe('GEIO facts', () => {
  it('carries the project and its figures', () => {
    expect(facts.text).toContain('Flat 1204, Baner');
    expect(facts.text).toContain('₹86,000');
    expect(facts.text).toContain('Swarupa');
  });

  it('never shows a rate per square foot', () => {
    expect(facts.text).not.toMatch(/per sq|\/sq/i);
  });
});

describe('GEIO answer checks', () => {
  it('keeps an answer whose figures are all in the facts', () => {
    const r = checked(
      { paragraphs: ['The TV unit is line 14 at ₹86,000. Walnut grain adds ₹14,500.'], hand_to_expert: false, follow_ups: ['Will handover still be 14 Dec?'] },
      facts.allowed,
      'Priya',
      'tv unit?',
    );
    expect(r.paragraphs).toHaveLength(1);
    expect(r.handover).toBeNull();
    expect(r.follow).toEqual(['Will handover still be 14 Dec?']);
  });

  it('allows the gap between two known figures', () => {
    // ₹14,500 − ₹8,200 between the two upgrade options
    const r = checked({ paragraphs: ['Walnut costs ₹6,300 more than off-white.'], hand_to_expert: false }, facts.allowed, 'Priya', 'q');
    expect(r.handover).toBeNull();
  });

  it('hands over an answer with an invented price', () => {
    const r = checked({ paragraphs: ['You could get the TV unit for ₹60,000.'], hand_to_expert: false }, facts.allowed, 'Priya', 'cheaper tv unit?');
    expect(r.handover).toContain('cheaper tv unit?');
    expect(r.paragraphs[0]).not.toContain('₹60,000');
  });

  it('hands over an answer that promises or quotes per square foot', () => {
    expect(checked({ paragraphs: ['I promise it will be done by Friday.'], hand_to_expert: false }, facts.allowed, 'P', 'q').handover).not.toBeNull();
    expect(checked({ paragraphs: ['That works out to ₹1,800 per sq ft.'], hand_to_expert: false }, facts.allowed, 'P', 'q').handover).not.toBeNull();
  });

  it('keeps the model handover note, and cleans its fields', () => {
    const r = checked(
      {
        paragraphs: ['**Fair** question.', ''],
        hand_to_expert: true,
        handover_note: 'Priya wants a lower price on the TV unit.',
        what_i_see: [{ what: 'Hairline gap', verdict: 'Common', needs_attention: false }, { what: '', verdict: 'x' }, 'junk'],
      },
      facts.allowed,
      'Priya',
      'q',
    );
    expect(r.paragraphs).toEqual(['Fair question.']);
    expect(r.handover).toBe('Priya wants a lower price on the TV unit.');
    expect(r.see).toEqual([{ what: 'Hairline gap', verdict: 'Common', watch: false }]);
  });

  it('hands over when the model says nothing', () => {
    expect(checked({ hand_to_expert: false }, facts.allowed, 'P', 'q').handover).not.toBeNull();
  });
});
