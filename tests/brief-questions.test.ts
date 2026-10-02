import { describe, it, expect } from 'vitest';
import { MAX_BRIEF_QUESTIONS, briefQuestions } from '@/modules/consultation/brief-questions';

const none = { possessionStatus: null, possessionOn: null, household: null, needs: [] };

describe('questions from the brief', () => {
  it('opens on the possession date, in their month', () => {
    const q = briefQuestions({ ...none, possessionStatus: 'EXPECTED', possessionOn: '2026-12-01' });
    expect(q[0]).toBe('Possession is expected in December 2026 — when should design start so work begins when I get the keys?');
  });

  it('asks about the people who live there', () => {
    const q = briefQuestions({
      ...none,
      household: { adults: 2, children: 2, elderly: 1, pets: true, worksFromHome: false },
    });
    expect(q).toEqual([
      'Someone elderly lives with us — what should change in the bathroom and bedroom for them?',
      'We have 2 children — which edges, finishes and fittings are safe, and what should their room grow into?',
      'We have pets — which laminates, fabrics and floors stand up to them?',
    ]);
  });

  it('asks about what the home needs, and stops at four', () => {
    const q = briefQuestions({
      possessionStatus: 'HAVE_KEYS',
      possessionOn: null,
      household: { adults: 2, children: 0, elderly: 0, pets: false, worksFromHome: true },
      needs: ['VASTU', 'POOJA_ROOM', 'SMART_HOME'],
    });
    expect(q).toHaveLength(MAX_BRIEF_QUESTIONS);
    expect(q[0]).toMatch(/^I have the keys now/);
    expect(q).toContain('Which of these studios can plan to vastu without losing usable space?');
  });

  it('asks nothing it has no answer to base it on', () => {
    expect(briefQuestions(none)).toEqual([]);
  });
});
