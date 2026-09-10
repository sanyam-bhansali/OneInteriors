/**
 * The event vocabulary — pure, so the shape of the funnel is testable and so
 * a typo in an event name fails at compile time rather than at the point
 * someone asks a question of the data three months from now.
 *
 * ## Two rules
 *
 * 1. **Names are a closed set.** A funnel assembled from free-form strings
 *    becomes unanswerable the first time someone writes `quiz_complete`
 *    alongside `quiz.complete`.
 * 2. **Props carry no personal data.** Counts, slugs and enum values only.
 *    Never a name, phone number, email, or anything a person typed. The
 *    question "which question loses people" needs a step number, not a person.
 */

export const EVENTS = [
  'quiz.start',
  'quiz.step.view',
  'quiz.step.complete',
  'quiz.abandon',
  'quiz.complete',
  'reveal.view',
  'tier.select',
  'match.view',
  'quote.view',
  'compare.view',
  'studio.view',
  'enquiry.sent',
  'signin.requested',
  'signin.completed',
  'brief.claimed',
  // The second decision-maker. `share.created` is the customer asking for a
  // link; `share.view` is somebody opening one. The ratio between them is the
  // only read we get on whether the person who answered the questions is
  // actually the person who decides.
  'share.created',
  'share.view',
] as const;

export type EventName = (typeof EVENTS)[number];

/** Values allowed in `props`. Deliberately narrow. */
export type PropValue = number | boolean | string | null;

export interface EventProps {
  [key: string]: PropValue;
}

/**
 * Keys that must never appear in props, and the patterns of value that give
 * away a leak even under an innocent key name.
 */
const FORBIDDEN_KEYS = [
  'name',
  'email',
  'phone',
  'mobile',
  'address',
  'about',
  'message',
  'note',
  'notes',
  'query',
  'text',
  'comment',
  'contactname',
  'tradename',
  'legalname',
];

const EMAIL = /[\w.+-]+@[\w-]+\.[\w.-]{2,}/;
const PHONE = /(?:\+?91[\s-]?)?[6-9]\d{9}/;

export interface PropIssue {
  key: string;
  problem: string;
}

/**
 * Check a props object before it is written.
 *
 * This is a real guard rather than documentation: analytics props are exactly
 * where personal data leaks into a system nobody thinks of as holding personal
 * data, and under the DPDP Act that is a problem with the same weight as
 * leaking it anywhere else. It is easier to block it at the write than to find
 * it in a year of rows later.
 */
export function checkProps(props: EventProps): PropIssue[] {
  const issues: PropIssue[] = [];

  for (const [key, value] of Object.entries(props)) {
    const lower = key.toLowerCase();

    if (FORBIDDEN_KEYS.some((f) => lower === f || lower.endsWith(f))) {
      issues.push({ key, problem: 'Looks like personal data. Analytics props hold counts and slugs.' });
      continue;
    }

    if (typeof value === 'string') {
      if (EMAIL.test(value)) {
        issues.push({ key, problem: 'Contains an email address.' });
      } else if (PHONE.test(value.replace(/\s/g, ''))) {
        issues.push({ key, problem: 'Contains what looks like a phone number.' });
      } else if (value.length > 64) {
        // Long strings are free text, and free text is where a person's own
        // words end up.
        issues.push({ key, problem: `${value.length} characters — too long to be a slug or enum.` });
      }
    }
  }

  return issues;
}

/** Strip anything `checkProps` objects to, so a bad call loses a field rather than the event. */
export function sanitiseProps(props: EventProps): EventProps {
  const issues = checkProps(props);
  if (issues.length === 0) return props;

  const bad = new Set(issues.map((i) => i.key));
  const clean: EventProps = {};
  for (const [key, value] of Object.entries(props)) {
    if (!bad.has(key)) clean[key] = value;
  }
  clean.droppedProps = issues.length;
  return clean;
}

/**
 * Turn a set of step-view counts into per-question drop-off.
 *
 * The number that matters is *drop-off at this step*, not cumulative
 * completion: cumulative always slopes down and always looks alarming, which
 * makes it useless for finding the one question that is actually the problem.
 */
export interface StepFunnel {
  step: number;
  views: number;
  completions: number;
  /** Share of people who saw this step and did not finish it. */
  dropOff: number | null;
}

export function stepFunnel(
  views: Record<number, number>,
  completions: Record<number, number>,
  steps: number,
): StepFunnel[] {
  const out: StepFunnel[] = [];
  for (let step = 1; step <= steps; step += 1) {
    const v = views[step] ?? 0;
    const c = completions[step] ?? 0;
    out.push({
      step,
      views: v,
      completions: c,
      // Null rather than 0 when nobody has reached the step. "0% drop-off" on
      // a step nobody saw reads as a triumph; it is an absence of data.
      dropOff: v === 0 ? null : Math.max(0, (v - c) / v),
    });
  }
  return out;
}

/** The step with the worst drop-off, ignoring steps with too little traffic. */
export function worstStep(funnel: StepFunnel[], minViews = 20): StepFunnel | null {
  const eligible = funnel.filter((s) => s.views >= minViews && s.dropOff !== null);
  if (eligible.length === 0) return null;
  return eligible.reduce((worst, s) => ((s.dropOff ?? 0) > (worst.dropOff ?? 0) ? s : worst));
}
