/**
 * The requirement form (walkthrough, 27 Oct 2026: "the client input form we
 * send as a Google Form, implement it here, better"; owner, 1 Nov 2026, with
 * the form itself): Hauspire's "Pre-Design Client Input & Commitment Form",
 * question for question. The designer sends it with the mood board; the
 * client fills it in the app, once. Once sent in it is the commitment
 * reference: it is never edited, and a change after it is said in writing
 * (chat, a decision).
 *
 * Pure, and tested in tests/requirement-form.test.ts. The reads and writes
 * are requirement-form.ts.
 */

export type QuestionKind = 'text' | 'long' | 'choice';

export interface Question {
  /** Stable: answers are stored by it. */
  id: string;
  label: string;
  kind: QuestionKind;
  options?: readonly string[];
  /** Shown under the question. */
  help?: string;
  /** An answer is needed to send the form (every question on Hauspire's form is). */
  required: boolean;
  /** A commitment: the only answer is the agreement itself. */
  commitment?: boolean;
}

export interface Section {
  id: string;
  title: string;
  questions: readonly Question[];
}

const t = (id: string, label: string, o: Partial<Question> = {}): Question => ({ id, label, kind: 'text', required: true, ...o });
const l = (id: string, label: string, o: Partial<Question> = {}): Question => ({ id, label, kind: 'long', required: true, ...o });
const c = (id: string, label: string, options: readonly string[], o: Partial<Question> = {}): Question => ({ id, label, kind: 'choice', options, required: true, ...o });

export const FORM_TITLE = 'Pre-design client input and commitment form';
export const FORM_INTRO = 'This form helps us understand your preferences, technical requirements and commitments before the design begins.';

/** Hauspire's form, 1 Nov 2026 (docs.google.com/forms … "Hauspire – Pre-Design Client Input & Commitment Form"). */
export const SECTIONS: readonly Section[] = [
  {
    id: 'general',
    title: 'General information',
    questions: [t('clientName', 'Client name'), t('address', 'Project address')],
  },
  {
    id: 'direction',
    title: 'Design direction',
    questions: [
      t('mood', 'Preferred overall colour theme or mood (for example warm, minimal, vibrant, neutral)'),
      c('modular', 'Do you understand the difference between modular and non-modular furniture?', ['Yes', 'No'], {
        help: 'Modular furniture is made in the factory in standard units and put together at your home; non-modular is made at your home. Please ask us before the design begins if this is not clear.',
      }),
    ],
  },
  {
    id: 'technical',
    title: 'Functional and technical details',
    questions: [
      l('appliances', 'List all major appliances (with brand and model if known)'),
      t('applianceSizes', 'Approximate sizes (L × W × H) of your main appliances'),
      c('chimney', 'Is the chimney ducted or non-ducted?', ['Ducted', 'Non-ducted', 'Not yet decided']),
      c('gas', 'Do you have a gas pipeline, or should we plan for a cylinder?', ['Pipeline already available', 'Cylinder (plan storage space)']),
      c('ac', 'Should AC provisions be considered in the design?', ['Yes', 'No', 'Maybe later']),
      c('inverter', 'Do you need an inverter provision or relocation?', ['Yes, include it in the design', 'No', 'Unsure']),
      c('pipes', 'Should we box or conceal the balcony or service-area pipes?', ['Yes', 'No', 'Maybe', 'To be discussed']),
      c('wifi', 'Do you need Wi-Fi or network points planned into the design?', ['Yes', 'No']),
      c('tv', 'For the TV unit, should we include HDMI, DP or set-top box provision?', ['Yes', 'No', 'Not sure yet']),
      l('study', 'For the study or workstation: the monitor size, and whether a printer or scanner needs space'),
      c('studyTable', 'Should the study table be designed for a laptop or a full workstation?', ['Laptop setup', 'Full workstation', 'To be discussed']),
      l('users', 'Who will mainly use each room?'),
    ],
  },
  {
    id: 'furniture',
    title: 'Furniture and space planning',
    questions: [
      c('kitchenFinish', 'Preferred kitchen finish', ['Laminates', 'Acrylic', 'PU / paint', 'To be suggested by the designer']),
      c('dressing', 'A separate dressing unit, or one with the wardrobe?', ['Separate dressing', 'With the wardrobe']),
      c('crockery', 'Would you like a crockery unit near the dining area?', ['Yes', 'No']),
      t('diningSeats', 'How many seats should the dining table have?'),
      c('entranceSeat', 'Would you like seating near the entrance (bench or storage)?', ['Yes', 'No']),
      c('livingStorage', 'Do you need more storage or display shelves in the living room?', ['Storage', 'Display', 'Both', 'None']),
      c('guestRoom', 'How often will the guest room or kids’ room be used?', ['Often', 'Sometimes', 'Rarely']),
    ],
  },
  {
    id: 'looks',
    title: 'Looks and lighting',
    questions: [
      c('lighting', 'What lighting mood do you prefer?', ['Warm', 'Neutral', 'Bright white', 'A mix / ambient']),
      c('edges', 'Curved or straight edges on the furniture?', ['Curved', 'Straight', 'No preference']),
      c('featureWall', 'Are you happy to have back-wall or feature-wall designs?', ['Yes', 'No', 'To be discussed']),
    ],
  },
  {
    id: 'materials',
    title: 'Materials and upkeep',
    questions: [
      c('materialLevel', 'Do you prefer materials that cost less, or luxurious ones?', ['Cost-effective', 'A mid-range balance', 'Premium / luxury']),
      c('maintenance', 'How much upkeep are you comfortable with (cleaning surfaces, handles, finishes)?', ['Low upkeep', 'Moderate', 'High-end finishes are fine']),
      l('mustHave', 'What are your must-have requirements?'),
    ],
  },
  {
    id: 'budget',
    title: 'Budget and commitment',
    questions: [
      c('budgetStretch', 'How far are you comfortable going over the estimate, if needed?', ['Up to 5%', 'Up to 10%', 'Up to 20%', 'No flexibility']),
      c('quoteBasis', 'Do you agree that the first design and concept are made on the quotation you committed to, so the first and final quotations differ as little as possible?', ['Yes, I agree', 'No, it needs a discussion']),
      l('extras', 'Anything you may want to add later, outside the agreed scope? List it here.', { help: 'Write “None” if there is nothing.' }),
    ],
  },
  {
    id: 'confirm',
    title: 'Confirmation',
    questions: [
      c('commitment', 'Do you agree that this form and its answers are your commitment reference, and that no change counts unless it is said clearly in writing afterwards?', ['Yes, I agree'], { commitment: true }),
      c('accurate', 'Do you confirm that everything above is accurate and can be used for the design?', ['Yes'], { commitment: true }),
      l('other', 'Any other requests or preferences?', { help: 'Write “None” if there is nothing.' }),
    ],
  },
];

export const QUESTIONS: readonly Question[] = SECTIONS.flatMap((s) => s.questions);
const BY_ID = new Map(QUESTIONS.map((q) => [q.id, q]));

export const TEXT_MAX = 200;
export const LONG_MAX = 2000;

export type Answers = Record<string, string>;

/**
 * The answers as sent: every question known, each trimmed and clipped, a
 * choice one of its options. The first problem, by question, when one is
 * missing or wrong; every question on the form must be answered.
 */
export function checkAnswers(raw: unknown): { ok: true; answers: Answers } | { ok: false; error: string; questionId: string } {
  const src = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const out: Answers = {};
  for (const q of QUESTIONS) {
    const v = typeof src[q.id] === 'string' ? (src[q.id] as string).replace(/\r\n/g, '\n').trim() : '';
    const max = q.kind === 'long' ? LONG_MAX : TEXT_MAX;
    if (q.kind === 'choice') {
      if (!v && q.required) return { ok: false, error: q.commitment ? `Please agree: ${q.label}` : `Pick an answer: ${q.label}`, questionId: q.id };
      if (v && !q.options!.includes(v)) return { ok: false, error: `Pick one of the answers given: ${q.label}`, questionId: q.id };
    } else {
      if (!v && q.required) return { ok: false, error: `Please answer: ${q.label}`, questionId: q.id };
      if (v.length > max) return { ok: false, error: `Keep it under ${max} characters: ${q.label}`, questionId: q.id };
    }
    if (v) out[q.id] = q.kind === 'text' ? v.replace(/\s+/g, ' ') : v;
  }
  return { ok: true, answers: out };
}

/** What was answered, section by section, for the studio and the client to read back. Unknown ids are left out. */
export function answersBySection(answers: Answers): { title: string; rows: { label: string; answer: string }[] }[] {
  return SECTIONS.map((s) => ({
    title: s.title,
    rows: s.questions.filter((q) => answers[q.id]).map((q) => ({ label: q.label, answer: answers[q.id]! })),
  })).filter((s) => s.rows.length > 0);
}

/** Saved answers read back from the database: only known questions, only strings. */
export function readAnswers(stored: unknown): Answers {
  const out: Answers = {};
  if (!stored || typeof stored !== 'object') return out;
  for (const [k, v] of Object.entries(stored as Record<string, unknown>)) if (BY_ID.has(k) && typeof v === 'string') out[k] = v;
  return out;
}

export type FormState = 'not-sent' | 'sent' | 'filled';

export const formState = (row: { sentAt: Date | null; submittedAt: Date | null } | null): FormState =>
  !row || !row.sentAt ? 'not-sent' : row.submittedAt ? 'filled' : 'sent';

/** The design step's task this form is (template.ts: "Send the requirement form with the mood board"). */
export const isRequirementFormTask = (label: string): boolean => /requirement form/i.test(label);
