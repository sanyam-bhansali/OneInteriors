/**
 * The portfolio draft contract — pure, and the honesty guard that goes with it.
 *
 * ## Why this file exists separately from the agent
 *
 * The agent writes copy that appears on a page where somebody decides how to
 * spend eight lakh rupees. The failure mode that matters is not bad prose, it
 * is **invention** — a model writing "delivered in 40 days" or "over 200 homes"
 * because it reads well, when nobody measured it. Prompting reduces that. It
 * does not eliminate it, and "we asked it nicely" is not a control.
 *
 * So every draft is checked against the facts it was given, mechanically,
 * before a human ever sees it. `verifyDraft` is that check, and it is pure so
 * it can be tested exhaustively without an API key.
 *
 * The rule it enforces: **every number in the draft must appear in the source
 * facts.** Numbers are where invention does real damage — a wrong adjective is
 * a matter of taste, a wrong delivery time is a false claim we published on a
 * studio's behalf.
 */

export interface PortfolioFacts {
  tradeName: string;
  about: string | null;
  localities: string[];
  yearsActive: number | null;
  teamSize: number | null;
  minLakhs: number | null;
  maxLakhs: number | null;
  projects: {
    title: string;
    locality: string | null;
    propertyType: string | null;
    scope: string | null;
    styleTags: string[];
    valueLakhs: number | null;
    durationDays: number | null;
    completedOn: string | null;
    isRender: boolean;
  }[];
}

export interface PortfolioDraft {
  /** One line, under 90 characters. Appears under the studio name. */
  headline: string;
  /** Two or three paragraphs. The studio's approach, in plain words. */
  introduction: string;
  /** One per project, in the same order as `facts.projects`. */
  projectStories: { title: string; story: string }[];
  /** What this studio is genuinely not for. Its presence is the point. */
  notFor: string;
}

export interface VerificationIssue {
  field: string;
  problem: string;
}

const MAX_HEADLINE = 90;
const MAX_STORY_WORDS = 90;

/**
 * Numbers that are safe anywhere because they carry no claim: "2 BHK" comes
 * from the property type, ordinals and years within the studio's own record are
 * checked separately. Everything else must be traceable.
 */
function numbersIn(text: string): string[] {
  // Strip separators so "8,50,000" and "850000" compare equal, and drop a
  // trailing decimal zero so "3.0" matches "3".
  return [...text.matchAll(/\d[\d,.]*/g)]
    .map((m) => m[0].replace(/,/g, '').replace(/\.0+$/, '').replace(/\.$/, ''))
    .filter((n) => n.length > 0);
}

/** Every number the model was actually told, in the same normalised shape. */
export function allowedNumbers(facts: PortfolioFacts): Set<string> {
  const allowed = new Set<string>();

  const add = (value: number | string | null | undefined) => {
    if (value === null || value === undefined) return;
    for (const n of numbersIn(String(value))) allowed.add(n);
  };

  add(facts.yearsActive);
  add(facts.teamSize);
  add(facts.minLakhs);
  add(facts.maxLakhs);
  add(facts.projects.length);
  if (facts.about) add(facts.about);

  for (const p of facts.projects) {
    add(p.valueLakhs);
    add(p.durationDays);
    add(p.title);
    add(p.propertyType); // BHK_2 → "2"
    add(p.completedOn); // the year, and the month number
    if (p.completedOn) {
      const year = new Date(p.completedOn).getFullYear();
      if (!Number.isNaN(year)) allowed.add(String(year));
    }
  }

  // Small counts are how prose refers to things it was told — "three projects",
  // "both homes". Written as digits they are still bounded by the project
  // count, so allow up to that and no further.
  for (let i = 0; i <= facts.projects.length; i += 1) allowed.add(String(i));

  return allowed;
}

/**
 * Check a draft against its facts. Returns every problem found, not just the
 * first — an ops reviewer should see the whole picture in one pass.
 */
export function verifyDraft(draft: PortfolioDraft, facts: PortfolioFacts): VerificationIssue[] {
  const issues: VerificationIssue[] = [];
  const allowed = allowedNumbers(facts);

  const checkNumbers = (field: string, text: string) => {
    for (const n of numbersIn(text)) {
      if (!allowed.has(n)) {
        issues.push({
          field,
          problem: `Contains the number ${n}, which is not in the studio's record.`,
        });
      }
    }
  };

  if (!draft.headline?.trim()) {
    issues.push({ field: 'headline', problem: 'Missing.' });
  } else if (draft.headline.length > MAX_HEADLINE) {
    issues.push({
      field: 'headline',
      problem: `${draft.headline.length} characters; the limit is ${MAX_HEADLINE}.`,
    });
  }

  if (!draft.introduction?.trim()) {
    issues.push({ field: 'introduction', problem: 'Missing.' });
  }

  if (!draft.notFor?.trim()) {
    // A studio that is "right for everyone" is the exact claim this product
    // exists to disbelieve, so an empty answer here is a failed draft.
    issues.push({
      field: 'notFor',
      problem: 'Missing. Every studio is wrong for someone; say who.',
    });
  }

  checkNumbers('headline', draft.headline ?? '');
  checkNumbers('introduction', draft.introduction ?? '');
  checkNumbers('notFor', draft.notFor ?? '');

  const stories = draft.projectStories ?? [];
  if (stories.length !== facts.projects.length) {
    issues.push({
      field: 'projectStories',
      problem: `${stories.length} stories for ${facts.projects.length} projects.`,
    });
  }

  stories.forEach((story, i) => {
    const field = `projectStories[${i}]`;
    const source = facts.projects[i];

    if (!story.story?.trim()) {
      issues.push({ field, problem: 'Empty story.' });
      return;
    }

    const words = story.story.trim().split(/\s+/).length;
    if (words > MAX_STORY_WORDS) {
      issues.push({ field, problem: `${words} words; the limit is ${MAX_STORY_WORDS}.` });
    }

    if (source && story.title !== source.title) {
      issues.push({
        field,
        problem: `Titled "${story.title}" but the project is "${source.title}".`,
      });
    }

    // A render described as a photograph is the single claim that would cost a
    // studio its place on the roster, so it is checked rather than trusted.
    if (source?.isRender && /\bphotograph|\bphoto\b|\bshot on\b/i.test(story.story)) {
      issues.push({
        field,
        problem: 'Calls a render a photograph.',
      });
    }

    checkNumbers(field, story.story);
  });

  return issues;
}

/** A draft with no issues is publishable; anything else needs a human. */
export function draftIsClean(draft: PortfolioDraft, facts: PortfolioFacts): boolean {
  return verifyDraft(draft, facts).length === 0;
}

/**
 * Parse the model's reply. Tolerates a markdown fence even though the prompt
 * forbids one, because being strict here turns a cosmetic deviation into a
 * total failure for no benefit.
 */
export function parseDraft(raw: string): PortfolioDraft | null {
  let text = raw.trim();

  const fence = text.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
  if (fence) text = fence[1].trim();

  if (!text.startsWith('{')) {
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start === -1 || end <= start) return null;
    text = text.slice(start, end + 1);
  }

  try {
    const parsed = JSON.parse(text) as Partial<PortfolioDraft>;
    if (typeof parsed.headline !== 'string') return null;
    if (typeof parsed.introduction !== 'string') return null;
    if (typeof parsed.notFor !== 'string') return null;
    if (!Array.isArray(parsed.projectStories)) return null;

    return {
      headline: parsed.headline,
      introduction: parsed.introduction,
      notFor: parsed.notFor,
      projectStories: parsed.projectStories
        .filter((s): s is { title: string; story: string } =>
          Boolean(s) && typeof s.title === 'string' && typeof s.story === 'string',
        )
        .map((s) => ({ title: s.title, story: s.story })),
    };
  } catch {
    return null;
  }
}
