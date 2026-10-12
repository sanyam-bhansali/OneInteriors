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

export interface DesignTemplateStep {
  label: string;
  responsible: Responsible;
  /** Ticking needs a file, filed in the locker. */
  needsDocument: boolean;
  /** A word naming the payment stage that must be recorded first ("design advance"); null for no gate. */
  gate: string | null;
  /** Days after the previous step, for a 2 BHK (the first step's is 0). */
  days: number;
  /** Relative weight inside the design phase (1 to 10). */
  weight: number;
  /**
   * Starred: one of the design milestones the client sees (owner, 12 Oct
   * 2026; docs/studio-os/CUSTOMER-MILESTONES.md). Every other step is the
   * studio's own.
   */
  milestone: boolean;
}

export const DESIGN_STEPS_MIN = 1;
export const DESIGN_STEPS_MAX = 40;
export const DESIGN_LABEL_MAX = 120;
export const GATE_MAX = 40;
export const DAYS_MAX = 30;
export const WEIGHT_MAX = 10;

/** The DESIGN stage's share of the whole project, as before Phase 2: execution percentages do not change. */
export const DESIGN_SHARE_BP = 200;

/** The group the design steps are filed under inside the DESIGN stage (the step's `room` column). */
export const DESIGN_GROUP = 'Design';

/** Hauspire's design milestones: the steps starred by default (and in the migration's backfill, by name). */
export const DESIGN_MILESTONES: readonly string[] = ['Site visit and measurement', 'First 3D and renders', 'Design closure'];

const s = (label: string, responsible: Responsible, days: number, weight: number, opts: { doc?: boolean; gate?: string } = {}): DesignTemplateStep => ({
  label,
  responsible,
  needsDocument: opts.doc === true,
  gate: opts.gate ?? null,
  days,
  weight,
  milestone: DESIGN_MILESTONES.includes(label),
});

/** Hauspire's design steps, in order (their tracker, owner 12 Oct 2026). The days add up to 24: a 2 BHK. */
export const HAUSPIRE_DESIGN: readonly DesignTemplateStep[] = [
  s('Project allocation (sales hands over to design)', 'SALES', 0, 1),
  s('Site visit and measurement', 'DESIGNER', 1, 2),
  s('Mood board shared', 'DESIGNER', 1, 1),
  s('2D layout and furniture layout final', 'DESIGNER', 3, 3),
  s('First draft (FD) meeting', 'DESIGNER', 2, 2, { gate: 'design advance' }),
  s('Design changes', 'DESIGNER', 2, 2),
  s('Material selection', 'DESIGNER', 2, 2),
  s('First 3D and renders', 'DESIGNER', 3, 3),
  s('Design closure', 'DESIGNER', 2, 2),
  s('Final design quotation', 'ACCOUNTS', 1, 1),
  s('BOQ', 'DESIGNER', 1, 2, { doc: true, gate: 'design closure' }),
  s('Site visit with carpenter and electrician', 'PM', 1, 1),
  s('Working drawings: false ceiling', 'DESIGNER', 1, 2, { doc: true }),
  s('Manual and factory work split, material list', 'DESIGNER', 1, 1, { doc: true }),
  s('Working drawings: factory', 'DESIGNER', 1, 2, { doc: true }),
  s('Electrical drawing and quotation', 'DESIGNER', 1, 2, { doc: true }),
  s('Final documentation for handover', 'DESIGNER', 0, 1, { doc: true }),
  s('Agreement signed', 'PM', 1, 1),
  s('Handover to execution', 'PM', 0, 1),
];

/** The size of flat Hauspire's days are for. */
export const BASE_BHK = 2;

/** Days from allocation to material procurement, by flat size (Hauspire's tracker). */
export const DESIGN_DAYS: Readonly<Record<1 | 2 | 3 | 4, number>> = { 1: 14, 2: 24, 3: 27, 4: 29 };

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

/** Design's length in days for this flat size; null when the size is not known. */
export const designDaysFor = (bhk: number | null | undefined): number | null => (bhk ? DESIGN_DAYS[Math.min(4, Math.max(1, Math.round(bhk))) as 1 | 2 | 3 | 4] : null);

/** Designer-days for this flat size; a 2 BHK when it is not known. */
export const designerDaysFor = (bhk: number | null | undefined): number => DESIGNER_DAYS[(bhk ? Math.min(4, Math.max(1, Math.round(bhk))) : BASE_BHK) as 1 | 2 | 3 | 4];

const clean = (v: unknown, max: number): string => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max + 1) : '');

export type TemplateCheck = { ok: true; steps: DesignTemplateStep[] } | { ok: false; error: string };

/** A template the owner saved, checked step by step; the first problem is said in plain words. */
export function checkDesignTemplate(raw: unknown): TemplateCheck {
  if (!Array.isArray(raw)) return { ok: false, error: 'Add at least one design step.' };
  if (raw.length < DESIGN_STEPS_MIN) return { ok: false, error: 'Add at least one design step.' };
  if (raw.length > DESIGN_STEPS_MAX) return { ok: false, error: `Keep it to ${DESIGN_STEPS_MAX} steps.` };
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
    const weight = o.weight === undefined || o.weight === null || o.weight === '' ? 1 : Number(o.weight);
    if (!Number.isInteger(weight) || weight < 1 || weight > WEIGHT_MAX) return { ok: false, error: `Step ${n}: weight is a whole number from 1 to ${WEIGHT_MAX}.` };
    // A template saved before stars existed has no `milestone`: it gets Hauspire's stars by name.
    const milestone = o.milestone === undefined ? DESIGN_MILESTONES.includes(label) : o.milestone === true;
    steps.push({ label, responsible: o.responsible, needsDocument: o.needsDocument === true, gate: gate || null, days, weight, milestone });
  }
  return { ok: true, steps };
}

/** The studio's design steps: what it saved when that passes the checks, else Hauspire's. */
export function readDesignTemplate(raw: unknown): DesignTemplateStep[] {
  if (raw === null || raw === undefined) return HAUSPIRE_DESIGN.map((x) => ({ ...x }));
  const c = checkDesignTemplate(raw);
  return c.ok ? c.steps : HAUSPIRE_DESIGN.map((x) => ({ ...x }));
}
