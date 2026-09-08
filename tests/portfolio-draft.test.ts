import { describe, it, expect } from 'vitest';
import {
  verifyDraft,
  draftIsClean,
  allowedNumbers,
  parseDraft,
  type PortfolioDraft,
  type PortfolioFacts,
} from '@/modules/studio/portfolio-draft';

const FACTS: PortfolioFacts = {
  tradeName: 'Akara Design Studio',
  about: 'Warm, material-led homes. We supervise our own carpentry.',
  localities: ['kharadi', 'baner'],
  yearsActive: 7,
  teamSize: 8,
  minLakhs: 6,
  maxLakhs: 22,
  projects: [
    {
      title: 'The Kharadi 3 BHK',
      locality: 'kharadi',
      propertyType: 'BHK_3',
      scope: 'FULL_HOME',
      styleTags: ['warm-modern'],
      valueLakhs: 14,
      durationDays: 95,
      completedOn: '2025-11-20',
      isRender: false,
    },
    {
      title: 'Baner kitchen',
      locality: 'baner',
      propertyType: 'BHK_2',
      scope: 'KITCHEN_WARDROBE',
      styleTags: ['contemporary-minimal'],
      valueLakhs: 6,
      durationDays: null,
      completedOn: null,
      isRender: true,
    },
  ],
};

function draft(overrides: Partial<PortfolioDraft> = {}): PortfolioDraft {
  return {
    headline: 'Warm, material-led homes with carpentry supervised in house',
    introduction: 'They take on full homes and kitchens across Kharadi and Baner.',
    projectStories: [
      { title: 'The Kharadi 3 BHK', story: 'A full home in warm modern materials.' },
      { title: 'Baner kitchen', story: 'A compact kitchen, shown as renders.' },
    ],
    notFor: 'Not the studio for a high-gloss classical look, or a budget under six lakh.',
    ...overrides,
  };
}

describe('a clean draft', () => {
  it('passes', () => {
    expect(verifyDraft(draft(), FACTS)).toEqual([]);
    expect(draftIsClean(draft(), FACTS)).toBe(true);
  });
});

/**
 * The reason this module exists. A model writing a plausible number is the
 * failure that would put a false claim on a studio's public profile, and
 * prompting is not a control — this is.
 */
describe('invented numbers', () => {
  it('catches a project count nobody gave it', () => {
    const issues = verifyDraft(
      draft({ introduction: 'Over 200 homes delivered across Pune.' }),
      FACTS,
    );
    expect(issues).toHaveLength(1);
    expect(issues[0].problem).toContain('200');
  });

  it('catches an invented delivery time inside a project story', () => {
    const issues = verifyDraft(
      draft({
        projectStories: [
          { title: 'The Kharadi 3 BHK', story: 'Handed over in 45 days.' },
          { title: 'Baner kitchen', story: 'A compact kitchen, shown as renders.' },
        ],
      }),
      FACTS,
    );
    expect(issues.some((i) => i.problem.includes('45'))).toBe(true);
  });

  it('allows numbers that ARE in the facts', () => {
    const issues = verifyDraft(
      draft({ introduction: 'Seven years, a team of 8, projects from 6 to 22 lakh.' }),
      FACTS,
    );
    expect(issues).toEqual([]);
  });

  it('treats 14,00,000 and 1400000 as the same number', () => {
    const facts: PortfolioFacts = { ...FACTS, teamSize: 1400000 };
    expect(allowedNumbers(facts).has('1400000')).toBe(true);
    expect(verifyDraft(draft({ notFor: 'Budgets under 14,00,000 are not for them.' }), facts)).toEqual([]);
  });

  it('does not care about a trailing decimal zero', () => {
    expect(verifyDraft(draft({ notFor: 'Nothing under 6.0 lakh.' }), FACTS)).toEqual([]);
  });

  it('allows small counts up to the number of projects', () => {
    expect(verifyDraft(draft({ introduction: 'Both of the 2 projects here are recent.' }), FACTS)).toEqual([]);
  });

  it('reports every invented number, not just the first', () => {
    const issues = verifyDraft(
      draft({ headline: '300 homes', introduction: 'Since 1994, with 40 staff.' }),
      FACTS,
    );
    expect(issues.length).toBeGreaterThanOrEqual(3);
  });
});

describe('the render rule', () => {
  it('catches a render described as a photograph', () => {
    const issues = verifyDraft(
      draft({
        projectStories: [
          { title: 'The Kharadi 3 BHK', story: 'A full home in warm modern materials.' },
          { title: 'Baner kitchen', story: 'The photographs show a compact galley kitchen.' },
        ],
      }),
      FACTS,
    );
    expect(issues.some((i) => i.problem === 'Calls a render a photograph.')).toBe(true);
  });

  it('leaves a real project alone', () => {
    const issues = verifyDraft(
      draft({
        projectStories: [
          { title: 'The Kharadi 3 BHK', story: 'The photographs show oak and lime plaster.' },
          { title: 'Baner kitchen', story: 'A compact kitchen, shown as renders.' },
        ],
      }),
      FACTS,
    );
    expect(issues).toEqual([]);
  });
});

describe('structure', () => {
  it('requires notFor — a studio that suits everyone suits no one', () => {
    const issues = verifyDraft(draft({ notFor: '   ' }), FACTS);
    expect(issues.some((i) => i.field === 'notFor')).toBe(true);
  });

  it('catches a headline over the length limit', () => {
    const issues = verifyDraft(draft({ headline: 'x'.repeat(91) }), FACTS);
    expect(issues.some((i) => i.field === 'headline')).toBe(true);
  });

  it('catches a missing project story', () => {
    const issues = verifyDraft(
      draft({ projectStories: [{ title: 'The Kharadi 3 BHK', story: 'One only.' }] }),
      FACTS,
    );
    expect(issues.some((i) => i.problem === '1 stories for 2 projects.')).toBe(true);
  });

  it('catches a story attached to the wrong project', () => {
    const issues = verifyDraft(
      draft({
        projectStories: [
          { title: 'Baner kitchen', story: 'Wrong order.' },
          { title: 'The Kharadi 3 BHK', story: 'Also wrong.' },
        ],
      }),
      FACTS,
    );
    expect(issues.filter((i) => i.problem.includes('but the project is'))).toHaveLength(2);
  });

  it('catches an over-long story', () => {
    const issues = verifyDraft(
      draft({
        projectStories: [
          { title: 'The Kharadi 3 BHK', story: 'word '.repeat(91) },
          { title: 'Baner kitchen', story: 'Short.' },
        ],
      }),
      FACTS,
    );
    expect(issues.some((i) => i.problem.includes('words; the limit'))).toBe(true);
  });
});

describe('parseDraft', () => {
  const valid = JSON.stringify(draft());

  it('reads plain JSON', () => {
    expect(parseDraft(valid)?.headline).toBe(draft().headline);
  });

  it('tolerates a markdown fence the prompt told it not to use', () => {
    expect(parseDraft('```json\n' + valid + '\n```')).not.toBeNull();
    expect(parseDraft('```\n' + valid + '\n```')).not.toBeNull();
  });

  it('tolerates a preamble before the JSON', () => {
    expect(parseDraft("Here's the draft:\n\n" + valid)).not.toBeNull();
  });

  it('returns null rather than a half-built draft when a field is missing', () => {
    expect(parseDraft('{"headline":"x"}')).toBeNull();
    expect(parseDraft('not json at all')).toBeNull();
    expect(parseDraft('')).toBeNull();
  });

  it('drops malformed entries from projectStories rather than trusting them', () => {
    const parsed = parseDraft(
      '{"headline":"h","introduction":"i","notFor":"n","projectStories":[{"title":"a","story":"b"},{"title":42}]}',
    );
    expect(parsed?.projectStories).toHaveLength(1);
  });
});
