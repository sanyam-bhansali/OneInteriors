/**
 * The words the practice modules use.
 *
 * Pure, and deliberately with NO `server-only` — CONTRIBUTING §9.5.
 *
 * ## Why this file exists
 *
 * A stage name and its label are needed in two places at once: the server
 * modules that query on them, and the client components that render them. They
 * lived in `clients.ts`, `projects.ts` and `vendors.ts`, which all carry
 * `server-only` — so the moment a client component imported `STAGE_LABELS`,
 * which is a VALUE and not a type, Next pulled the whole Prisma module into the
 * browser bundle and the build stopped with:
 *
 *   You're importing a component that needs "server-only"
 *
 * A `import type { … }` is erased at compile time and would have been fine. A
 * label map is not a type. That distinction is the entire bug, and it is easy
 * to miss precisely because the two imports look identical at a glance.
 *
 * So the vocabulary lives here, the server modules re-export it for their own
 * callers, and client components import from this file directly.
 */

// ── The pipeline ───────────────────────────────────────────────

/**
 * What a stage means, as against what it is called.
 *
 * The stage list belongs to the studio: they name it, order it, colour it and
 * decide how long it is. What cannot belong to them is meaning, because four
 * other parts of this software need answers that survive a rename — Projects
 * needs to know a job was won before it will start one, the dashboard needs to
 * know who is still in play, the ledger needs to know when a site is finished.
 *
 * So every query in the codebase asks the KIND and never the name. A studio
 * calling its won column "Advance received" is a studio we keep working for.
 */
export type StageKindName = 'OPEN' | 'WON' | 'DONE' | 'LOST';

export const STAGE_KIND_LABELS: Record<StageKindName, string> = {
  OPEN: 'In play',
  WON: 'Signed',
  DONE: 'Finished',
  LOST: 'Gone',
};

/** What each kind licenses, in the studio's own words. For the settings screen. */
export const STAGE_KIND_NOTES: Record<StageKindName, string> = {
  OPEN: 'Still being chased. Counts on the board and in “waiting on you”.',
  WON: 'They have said yes. A project can only be started from a column of this kind.',
  DONE: 'Handed over. Comes off the board.',
  LOST: 'Gone, and asks for a reason.',
};

/** The columns drawn on the board. The rest fold underneath it. */
export const BOARD_KINDS: StageKindName[] = ['OPEN', 'WON'];
export const CLOSED_KINDS: StageKindName[] = ['DONE', 'LOST'];

/**
 * The eight colours a stage may be.
 *
 * Tokens rather than hex from a picker, for two reasons. A free colour picker
 * produces a board that is eight different pinks by the third month, and a
 * stored hex cannot be translated if this surface ever gets a dark mode —
 * a token can.
 */
export type ColourToken =
  | 'slate' | 'blue' | 'teal' | 'green' | 'amber' | 'orange' | 'rose' | 'violet';

export const STAGE_COLOURS: Record<ColourToken, { dot: string; wash: string; ink: string }> = {
  slate: { dot: '#6b7280', wash: '#eceef0', ink: '#414a54' },
  blue: { dot: '#3b74b8', wash: '#e4edf7', ink: '#2c557f' },
  teal: { dot: '#2f8a80', wash: '#dff0ed', ink: '#23655e' },
  green: { dot: '#3f7a46', wash: '#e0eddf', ink: '#2e5a34' },
  amber: { dot: '#c08a23', wash: '#f6ecd6', ink: '#7d5a12' },
  orange: { dot: '#c0613c', wash: '#f6e6de', ink: '#8a4429' },
  rose: { dot: '#a8453a', wash: '#f6e3e0', ink: '#7d332b' },
  violet: { dot: '#7a5aa8', wash: '#ece5f5', ink: '#56407a' },
};

export const COLOUR_TOKENS = Object.keys(STAGE_COLOURS) as ColourToken[];

export function colourOf(token: string): { dot: string; wash: string; ink: string } {
  return STAGE_COLOURS[token as ColourToken] ?? STAGE_COLOURS.slate;
}

/**
 * What a studio starts with.
 *
 * The six the enum used to hold, under the names the interface already showed,
 * so nobody's board rearranges itself the morning this ships. They are a
 * starting point and not a recommendation — every one of them can be renamed,
 * recoloured, reordered or deleted on the day it arrives.
 */
export const DEFAULT_STAGES: {
  name: string;
  kind: StageKindName;
  colour: ColourToken;
  isIntake: boolean;
}[] = [
  { name: 'Enquiry', kind: 'OPEN', colour: 'blue', isIntake: true },
  { name: 'Quoted', kind: 'OPEN', colour: 'amber', isIntake: false },
  { name: 'Booked', kind: 'WON', colour: 'violet', isIntake: false },
  { name: 'On site', kind: 'WON', colour: 'teal', isIntake: false },
  { name: 'Handed over', kind: 'DONE', colour: 'green', isIntake: false },
  { name: 'Lost', kind: 'LOST', colour: 'rose', isIntake: false },
];

// ── Custom fields ──────────────────────────────────────────────

export type FieldTypeName = 'TEXT' | 'NUMBER' | 'DATE' | 'SELECT';

export const FIELD_TYPE_LABELS: Record<FieldTypeName, string> = {
  TEXT: 'Text',
  NUMBER: 'Number',
  DATE: 'Date',
  SELECT: 'Pick from a list',
};

/** Only these can group the list. A free-text field would make one row per client. */
export const GROUPABLE_TYPES: FieldTypeName[] = ['TEXT', 'SELECT', 'DATE'];

/**
 * A label becomes a key once, at creation, and then never again.
 *
 * The key is what the captured values are stored under. If renaming
 * "Society" to "Project / Society" moved the key, every value already
 * captured would be orphaned — present in the row, invisible in the
 * interface, and impossible to explain.
 */
export function fieldKeyFrom(label: string): string {
  return label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 40);
}

// ── Clients ────────────────────────────────────────────────────

export type ClientSourceName =
  | 'ONE_INTERIORS' | 'REFERRAL' | 'REPEAT_CLIENT' | 'INSTAGRAM'
  | 'WEBSITE' | 'WALK_IN' | 'ARCHITECT' | 'OTHER';

export type LostReasonName =
  | 'BUDGET' | 'TIMELINE' | 'WENT_ELSEWHERE' | 'NO_RESPONSE'
  | 'NOT_SERIOUS' | 'POSTPONED' | 'OTHER';

export const SOURCE_LABELS: Record<ClientSourceName, string> = {
  ONE_INTERIORS: 'One Interiors',
  REFERRAL: 'Referral',
  REPEAT_CLIENT: 'Repeat client',
  INSTAGRAM: 'Instagram',
  WEBSITE: 'Website',
  WALK_IN: 'Walk-in',
  ARCHITECT: 'Architect',
  OTHER: 'Other',
};

export const LOST_LABELS: Record<LostReasonName, string> = {
  BUDGET: 'Budget',
  TIMELINE: 'Timeline',
  WENT_ELSEWHERE: 'Went elsewhere',
  NO_RESPONSE: 'Stopped replying',
  NOT_SERIOUS: 'Not serious',
  POSTPONED: 'Postponed',
  OTHER: 'Other',
};

// ── Projects ───────────────────────────────────────────────────

export type ProjectStageName = 'DESIGN' | 'EXECUTION' | 'FINISHING' | 'HANDOVER' | 'CLOSED';

export const PROJECT_STAGES: ProjectStageName[] = [
  'DESIGN',
  'EXECUTION',
  'FINISHING',
  'HANDOVER',
  'CLOSED',
];

export const PROJECT_STAGE_LABELS: Record<ProjectStageName, string> = {
  DESIGN: 'Design',
  EXECUTION: 'Execution',
  FINISHING: 'Finishing',
  HANDOVER: 'Handover',
  CLOSED: 'Closed',
};

/** Everything that is not finished. Used by the dashboard and the ledger. */
export const LIVE_PROJECT_STAGES: ProjectStageName[] = [
  'DESIGN',
  'EXECUTION',
  'FINISHING',
  'HANDOVER',
];

// ── Vendors ────────────────────────────────────────────────────

export type PaymentModeName = 'BANK' | 'UPI' | 'CASH' | 'CHEQUE';

export const MODE_LABELS: Record<PaymentModeName, string> = {
  BANK: 'Bank transfer',
  UPI: 'UPI',
  CASH: 'Cash',
  CHEQUE: 'Cheque',
};

/**
 * The trades a studio usually subcontracts.
 *
 * A suggestion offered in a datalist, not a constraint — the column is free
 * text because every studio's list differs, and an enum cannot have a value
 * added by the person using it.
 */
export const COMMON_TRADES = [
  'Carpentry',
  'Modular installation',
  'False ceiling',
  'Painting',
  'Electrical',
  'Plumbing',
  'Civil',
  'Glass & mirror',
  'Upholstery',
  'Fabrication',
  'Stone & granite',
  'Hardware',
] as const;
