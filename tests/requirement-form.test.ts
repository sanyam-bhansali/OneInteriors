import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { QUESTIONS, SECTIONS, answersBySection, checkAnswers, formState, isRequirementFormTask, readAnswers } from '@/modules/project/requirement-form-rules';
import { HAUSPIRE_DESIGN } from '@/modules/studio-design/template';

/** The requirement form (owner, 1 Nov 2026): Hauspire's pre-design form, filled in the app. */

/** A complete set of answers: the first option of every choice, a word in every box. */
const full = (): Record<string, string> => Object.fromEntries(QUESTIONS.map((q) => [q.id, q.kind === 'choice' ? q.options![0]! : `Answer to ${q.id}`]));

describe('the questions', () => {
  it('are Hauspire’s form: 8 sections, 35 questions, every one required, ids unique', () => {
    expect(SECTIONS.map((s) => s.title)).toEqual([
      'General information',
      'Design direction',
      'Functional and technical details',
      'Furniture and space planning',
      'Looks and lighting',
      'Materials and upkeep',
      'Budget and commitment',
      'Confirmation',
    ]);
    expect(QUESTIONS).toHaveLength(35);
    expect(new Set(QUESTIONS.map((q) => q.id)).size).toBe(QUESTIONS.length);
    expect(QUESTIONS.every((q) => q.required)).toBe(true);
  });

  it('the two commitments can only be agreed to', () => {
    const c = QUESTIONS.filter((q) => q.commitment);
    expect(c.map((q) => q.options)).toEqual([['Yes, I agree'], ['Yes']]);
  });

  it('it is the mood-board step’s task', () => {
    expect(HAUSPIRE_DESIGN[0]!.tasks.some(isRequirementFormTask)).toBe(true);
  });
});

describe('sending the form', () => {
  it('takes a complete form, trimmed', () => {
    const a = { ...full(), clientName: '  Monica   Fernandes ', mustHave: '  A big pantry\r\nA tall unit  ' };
    const r = checkAnswers(a);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.answers.clientName).toBe('Monica Fernandes');
      expect(r.answers.mustHave).toBe('A big pantry\nA tall unit');
    }
  });

  it('names the first question that needs an answer', () => {
    const a = full();
    delete a.appliances;
    expect(checkAnswers(a)).toMatchObject({ ok: false, questionId: 'appliances' });
    expect(checkAnswers({ ...full(), commitment: '' })).toMatchObject({ ok: false, questionId: 'commitment', error: expect.stringMatching(/^Please agree/) });
  });

  it('refuses an answer that is not one of the choices, and anything too long', () => {
    expect(checkAnswers({ ...full(), chimney: 'Maybe' })).toMatchObject({ ok: false, questionId: 'chimney' });
    expect(checkAnswers({ ...full(), mood: 'x'.repeat(201) })).toMatchObject({ ok: false, questionId: 'mood' });
    expect(checkAnswers({ ...full(), other: 'x'.repeat(2001) })).toMatchObject({ ok: false, questionId: 'other' });
  });

  it('keeps only the questions it knows', () => {
    const r = checkAnswers({ ...full(), hacker: 'x' });
    expect(r.ok && 'hacker' in r.answers).toBe(false);
    expect(readAnswers({ chimney: 'Ducted', hacker: 'x', gas: 5 })).toEqual({ chimney: 'Ducted' });
    expect(readAnswers(null)).toEqual({});
  });
});

describe('reading it back', () => {
  it('section by section, only what was answered', () => {
    const s = answersBySection({ clientName: 'Monica', chimney: 'Ducted' });
    expect(s).toEqual([
      { title: 'General information', rows: [{ label: 'Client name', answer: 'Monica' }] },
      { title: 'Functional and technical details', rows: [{ label: 'Is the chimney ducted or non-ducted?', answer: 'Ducted' }] },
    ]);
  });

  it('not sent, sent, filled', () => {
    expect(formState(null)).toBe('not-sent');
    expect(formState({ sentAt: new Date(), submittedAt: null })).toBe('sent');
    expect(formState({ sentAt: new Date(), submittedAt: new Date() })).toBe('filled');
  });
});

describe('where it lives', () => {
  it('the client reads it on app.oneinteriors.in and in the phone app, from one API', () => {
    expect(readFileSync('src/lib/host.ts', 'utf8')).toMatch(/'\/app\/requirements'/);
    expect(readFileSync('mobile/src/lib/api.ts', 'utf8')).toMatch(/call<\{ form: RequirementForm \| null \}>\('GET', '\/requirements'\)/);
    expect(readFileSync('src/app/app/requirements/page.tsx', 'utf8')).toMatch(/fetch\('\/api\/app\/v1\/requirements'/);
  });

  it('is sent in once and never edited (the write is guarded on submittedAt: null)', () => {
    const store = readFileSync('src/modules/project/requirement-form.ts', 'utf8');
    expect(store).toMatch(/updateMany\(\{\s*where: \{ id: row\.id, studioId: row\.studioId, submittedAt: null \}/);
  });
});
