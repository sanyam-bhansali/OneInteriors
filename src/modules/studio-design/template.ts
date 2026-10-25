/**
 * A studio's design steps (Studio OS Phase 2, docs/studio-os/PHASE-2-DESIGN.md
 * §2): Hauspire's 19 by default, editable in Settings, Design steps (owner).
 * Pure, and tested (tests/studio-design-template.test.ts).
 *
 * ## The shape
 *
 * Each step has a name, who does it, whether ticking it needs a file, an
 * optional payment gate, its days after the previous step (for a 2 BHK, the
 * size Hauspire's gaps were taken from) and a relative weight. The gate is a
 * WORD that names a payment stage ("design advance"), not an index: a
 * project's payment stages are its own (the sales final's), so the word is
 * matched against them when the plan is built (rules.ts `gateIndexFor`), and
 * a project with no such stage simply has no gate there.
 *
 * ## Where it lives
 *
 * `Studio.designTemplate` (JSON). Copied onto each new project's DESIGN stage
 * at booking or signing (portal/quote-to-plan.ts), where the studio may edit
 * the steps for that project. A stored value that fails the checks reads as
 * Hauspire's default rather than half a list.
 */

export const RESPONSIBLES = ['DESIGNER', 'SALES', 'ACCOUNTS', 'PM', 'CLIENT'] as const;
export type Responsible = (typeof RESPONSIBLES)[number];

export const RESPONSIBLE_LABEL: Record<Responsible, string> = {
  DESIGNER: 'Designer',
  SALES: 'Sales',
  ACCOUNTS: 'Accounts',
  PM: 'Project manager',
  CLIENT: 'Client',
};

export const isResponsible = (v: unknown): v is Responsible => typeof v === 'string' && (RESPONSIBLES as readonly string[]).includes(v);

/** What approves a client's approval step in the app, so the client's answer ticks it (DESIGN-PROCESS-PLAN.md Decision 4). */
export const APPROVAL_KINDS = {
  LAYOUT_2D: 'The client approves the 2D layout',
  RENDER_3D: 'The client approves the 3D',
  WORKING: 'The client approves the working drawings',
  DESIGN_FINAL: 'The client signs the Design final quotation',
} as const;
export type ApprovalKind = keyof typeof APPROVAL_KINDS;
export const isApprovalKind = (v: unknown): v is ApprovalKind => typeof v === 'string' && v in APPROVAL_KINDS;

/** The step's group inside the DESIGN stage (the step's `room` column): design, then pre-execution. */
export const DESIGN_GROUP = 'Design';
export const PRE_EXECUTION_GROUP = 'Pre-execution';
export const STEP_GROUPS = [DESIGN_GROUP, PRE_EXECUTION_GROUP] as const;
export type StepGroup = (typeof STEP_GROUPS)[number];
export const isStepGroup = (v: unknown): v is StepGroup => typeof v === 'string' && (STEP_GROUPS as readonly string[]).includes(v);

export interface DesignTemplateStep {
  label: string;
  responsible: Responsible;
  /** Ticking needs a file, filed in the locker. */
  needsDocument: boolean;
  /** A word naming the payment stage that must be recorded first ("design advance"); null for no gate. Every later step waits on it too. */
  gate: string | null;
  /** Days after the previous step, for a 2 BHK (0 = the same day as the previous step). */
  days: number;
  /** Effort for a 2 BHK, in minutes. The step's share of design progress is its effort over the total; a client's step is 0. */
  effortMin: number;
  /** Design, or pre-execution (from where the execution team owns the project; DESIGN-PROCESS-PLAN.md Decision 10). */
  group: StepGroup;
  /** On a client's approval step: what approves it in the app. */
  approval: ApprovalKind | null;
  /** Small to-dos seeded inside the step on each new project. */
  tasks: string[];
  /**
   * Starred: one of the milestones (owner, 12 Oct 2026;
   * docs/studio-os/CUSTOMER-MILESTONES.md). The client sees every design
   * step now (DESIGN-PROCESS-PLAN.md Decision 11); the stars still mark the
   * big moments on the studio's side.
   */
  milestone: boolean;
}

export const DESIGN_STEPS_MIN = 1;
export const DESIGN_STEPS_MAX = 40;
export const DESIGN_LABEL_MAX = 120;
export const GATE_MAX = 40;
export const DAYS_MAX = 30;
/** 40 hours: a week of one person. */
export const EFFORT_MAX_MIN = 40 * 60;
export const TASKS_MAX = 10;
export const TASK_LABEL_MAX = 120;

/** The DESIGN stage's share of the whole project, as before Phase 2: execution percentages do not change. */
export const DESIGN_SHARE_BP = 200;

/** Hauspire's milestones: the steps starred by default (and, for an older saved template, by name). */
export const DESIGN_MILESTONES: readonly string[] = ['Site visit', 'Final 3D & renders', 'Working drawings final'];

const H = 60;
const s = (
  label: string,
  responsible: Responsible,
  days: number,
  effortMin: number,
  opts: { doc?: boolean; gate?: string; pre?: boolean; approval?: ApprovalKind; tasks?: string[] } = {},
): DesignTemplateStep => ({
  label,
  responsible,
  needsDocument: opts.doc === true,
  gate: opts.gate ?? null,
  days,
  effortMin,
  group: opts.pre ? PRE_EXECUTION_GROUP : DESIGN_GROUP,
  approval: opts.approval ?? null,
  tasks: opts.tasks ?? [],
  milestone: DESIGN_MILESTONES.includes(label),
});

/**
 * Hauspire's design process (owner and the design team, 24 Oct 2026;
 * docs/studio-os/DESIGN-PROCESS-PLAN.md section 1.1), for a 2 BHK. Design is
 * 19 steps: 28 days and 72 hours. Pre-execution is 7 more: 15 days. The
 * meeting gave no effort for the two site visits and the electrical
 * drawings; those three are ours (2 h, 3 h, 2 h).
 */
export const HAUSPIRE_DESIGN: readonly DesignTemplateStep[] = [
  s('Project allocation + mood board', 'DESIGNER', 0, 30, { tasks: ['Send the requirement form with the mood board'] }),
  s('Site visit', 'DESIGNER', 1, 2 * H),
  s('2D layout', 'DESIGNER', 1, 2 * H, { doc: true }),
  s('2D approval', 'CLIENT', 0, 0, { approval: 'LAYOUT_2D' }),
  s('Final 2D', 'DESIGNER', 0, 1 * H),
  s('First draft (3D)', 'DESIGNER', 4, 16 * H, { gate: 'design advance' }),
  s('Design changes', 'DESIGNER', 1, 4 * H),
  s('Material selection', 'DESIGNER', 2, 4 * H),
  s('Final 3D & renders', 'DESIGNER', 3, 4 * H, { doc: true }),
  s('Final 3D approval', 'CLIENT', 0, 0, { approval: 'RENDER_3D' }),
  s('Final design quotation', 'DESIGNER', 3, 30),
  s('Final quotation meeting', 'DESIGNER', 1, 3 * H),
  s('Post-quotation changes', 'DESIGNER', 1, 4 * H),
  s('Final design approval', 'CLIENT', 0, 0, { approval: 'DESIGN_FINAL' }),
  s('Site visit with electrician & carpenter', 'DESIGNER', 3, 3 * H, { gate: 'design closure' }),
  s('Electrical drawings & quotation', 'DESIGNER', 1, 2 * H, { doc: true }),
  s('Working drawings', 'DESIGNER', 5, 24 * H, { doc: true }),
  s('Working drawings approval', 'CLIENT', 0, 0, { approval: 'WORKING' }),
  s('Working drawings final', 'DESIGNER', 2, 2 * H, { doc: true }),
  s('Site validation', 'PM', 3, 4 * H, { pre: true }),
  s('Post-validation changes', 'DESIGNER', 1, 2 * H, { pre: true }),
  s('Post-validation approval', 'CLIENT', 0, 0, { pre: true, approval: 'WORKING' }),
  s('Final documentation for handover', 'DESIGNER', 3, 4 * H, { pre: true, doc: true }),
  s('Agreement signed', 'CLIENT', 0, 0, { pre: true }),
  s('Handover to execution team', 'PM', 3, 2 * H, { pre: true }),
  s('Material procurement & vendor alignment', 'PM', 5, 0, { pre: true }),
];

/** The size of flat Hauspire's days are for. */
export const BASE_BHK = 2;

/**
 * How a flat's size scales the days and the effort (DESIGN-PROCESS-PLAN.md
 * Decision 2): the meeting's "a 3 BHK adds 20% everywhere"; 1 BHK and 4 BHK
 * are ours.
 */
export const SIZE_FACTOR: Readonly<Record<1 | 2 | 3 | 4, number>> = { 1: 0.8, 2: 1, 3: 1.2, 4: 1.4 };

/** The size factor for this flat; a 2 BHK's when the size is not known. */
export const sizeFactor = (bhk: number | null | undefined): number => SIZE_FACTOR[(bhk ? Math.min(4, Math.max(1, Math.round(bhk))) : BASE_BHK) as 1 | 2 | 3 | 4];

/**
 * A 2 BHK's days after each step, for this flat. The running total is
 * scaled and rounded, not each step on its own, so the whole plan is exactly
 * the factor longer or shorter (rounding a 1-day step on its own would make
 * a 1 BHK no shorter and a 3 BHK far longer), and a same-day step stays on
 * the same day.
 */
export function scaledGaps(days: readonly number[], bhk: number | null | undefined): number[] {
  const f = sizeFactor(bhk);
  let base = 0;
  let prev = 0;
  return days.map((d) => {
    base += Number.isFinite(d) && d > 0 ? d : 0;
    const at = Math.round(base * f);
    const gap = Math.max(0, at - prev);
    prev = Math.max(prev, at);
    return gap;
  });
}

/** A 2 BHK's effort for this flat, in whole minutes. */
export const scaledEffort = (effortMin: number, bhk: number | null | undefined): number => Math.max(0, Math.round(effortMin * sizeFactor(bhk)));

/** The DESIGN stage's length in days for this flat: every step's days, scaled, end to end (at least a day). */
export const designLengthFor = (template: readonly Pick<DesignTemplateStep, 'days'>[], bhk: number | null | undefined): number =>
  Math.max(1, scaledGaps(template.map((t) => t.days), bhk).reduce((a, b) => a + b, 0));

/** Designer-days a project takes, by flat size (Hauspire's capacity sheet; 4 BHK is our estimate). */
export const DESIGNER_DAYS: Readonly<Record<1 | 2 | 3 | 4, number>> = { 1: 14, 2: 20, 3: 27, 4: 32 };

/** Working days a designer has in a month (Hauspire's sheet). */
export const DESIGNER_MONTH_DAYS = 25;

/** A brief's property type as a flat size 1–4, or null when it is not a flat size (villa counts as 4). */
export function bhkOf(propertyType: string | null | undefined): 1 | 2 | 3 | 4 | null {
  switch (propertyType) {
    case 'BHK_1':
      return 1;
    case 'BHK_2':
      return 2;
    case 'BHK_3':
      return 3;
    case 'BHK_4_PLUS':
    case 'VILLA':
      return 4;
    default:
      return null;
  }
}


/** Designer-days for this flat size; a 2 BHK when it is not known. */
export const designerDaysFor = (bhk: number | null | undefined): number => DESIGNER_DAYS[(bhk ? Math.min(4, Math.max(1, Math.round(bhk))) : BASE_BHK) as 1 | 2 | 3 | 4];

const clean = (v: unknown, max: number): string => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max + 1) : '');

export type TemplateCheck = { ok: true; steps: DesignTemplateStep[] } | { ok: false; error: string };

/** A template the owner saved, checked step by step; the first problem is said in plain words. */
export function checkDesignTemplate(raw: unknown): TemplateCheck {
  if (!Array.isArray(raw)) return { ok: false, error: 'Add at least one design step.' };
  if (raw.length < DESIGN_STEPS_MIN) return { ok: false, error: 'Add at least one design step.' };
  if (raw.length > DESIGN_STEPS_MAX) return { ok: false, error: `Keep it to ${DESIGN_STEPS_MAX} steps.` };
  // Pre-execution comes after design, never in between.
  const groups = raw.map((r) => (r && typeof r === 'object' && isStepGroup((r as Record<string, unknown>).group) ? (r as Record<string, unknown>).group : DESIGN_GROUP));
  if (groups.some((g, i) => g === DESIGN_GROUP && groups.slice(0, i).includes(PRE_EXECUTION_GROUP))) return { ok: false, error: 'Keep the pre-execution steps after the design steps.' };
  const steps: DesignTemplateStep[] = [];
  for (const [i, r] of raw.entries()) {
    const n = i + 1;
    if (!r || typeof r !== 'object') return { ok: false, error: `Step ${n} is empty.` };
    const o = r as Record<string, unknown>;
    const label = clean(o.label, DESIGN_LABEL_MAX);
    if (label.length < 2) return { ok: false, error: `Give step ${n} a name.` };
    if (label.length > DESIGN_LABEL_MAX) return { ok: false, error: `Keep step ${n}'s name under ${DESIGN_LABEL_MAX} characters.` };
    if (!isResponsible(o.responsible)) return { ok: false, error: `Pick who does step ${n}.` };
    const gate = clean(o.gate, GATE_MAX);
    if (gate.length > GATE_MAX) return { ok: false, error: `Keep step ${n}'s payment name under ${GATE_MAX} characters.` };
    const days = Number(o.days);
    if (!Number.isInteger(days) || days < 0 || days > DAYS_MAX) return { ok: false, error: `Step ${n}: days after the previous step is a whole number from 0 to ${DAYS_MAX}.` };
    // A template saved before effort existed has a 1 to 10 weight: an hour per point.
    const effortMin =
      o.effortMin === undefined || o.effortMin === null || o.effortMin === ''
        ? Math.max(1, Math.min(10, Number(o.weight) || 1)) * 60
        : Number(o.effortMin);
    if (!Number.isInteger(effortMin) || effortMin < 0 || effortMin > EFFORT_MAX_MIN) return { ok: false, error: `Step ${n}: effort is from 0 to ${EFFORT_MAX_MIN / 60} hours.` };
    const group: StepGroup = isStepGroup(o.group) ? o.group : DESIGN_GROUP;
    const approval = isApprovalKind(o.approval) ? o.approval : null;
    if (approval && o.responsible !== 'CLIENT') return { ok: false, error: `Step ${n} is approved by the client in the app, so the client does it.` };
    const rawTasks = Array.isArray(o.tasks) ? o.tasks.map((t) => clean(t, TASK_LABEL_MAX)).filter((t) => t.length >= 2) : [];
    if (rawTasks.length > TASKS_MAX) return { ok: false, error: `Step ${n}: keep it to ${TASKS_MAX} tasks.` };
    if (rawTasks.some((t) => t.length > TASK_LABEL_MAX)) return { ok: false, error: `Step ${n}: keep each task under ${TASK_LABEL_MAX} characters.` };
    // A template saved before stars existed has no `milestone`: it gets Hauspire's stars by name.
    const milestone = o.milestone === undefined ? DESIGN_MILESTONES.includes(label) : o.milestone === true;
    steps.push({ label, responsible: o.responsible, needsDocument: o.needsDocument === true, gate: gate || null, days, effortMin, group, approval, tasks: rawTasks, milestone });
  }
  return { ok: true, steps };
}

/** The studio's design steps: what it saved when that passes the checks, else Hauspire's. */
export function readDesignTemplate(raw: unknown): DesignTemplateStep[] {
  if (raw === null || raw === undefined) return HAUSPIRE_DESIGN.map((x) => ({ ...x }));
  const c = checkDesignTemplate(raw);
  return c.ok ? c.steps : HAUSPIRE_DESIGN.map((x) => ({ ...x }));
}
