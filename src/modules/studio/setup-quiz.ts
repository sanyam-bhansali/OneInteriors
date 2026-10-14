/**
 * "Set up your studio": the owner's personalisation quiz (owner, 14 Oct
 * 2026). Two or three minutes, one question per screen, on the owner's first
 * sign-in after their studio's software opens; retaken from Settings.
 *
 * This file is the pure half: the questions' answers, read safely, and what
 * they would change in the studio's existing settings (`planSetup`). The
 * server half (`setup-quiz-store.ts`) reads the studio's current settings,
 * shows the plan, and applies only the changes the owner ticks, each through
 * the settings function the Settings screen itself uses, so every permission
 * and check still holds. Tested in tests/studio-setup-quiz.test.ts.
 *
 * ## Never silently overwriting
 *
 * Every change is listed with what it was and what it becomes. A change that
 * would replace something the studio already set itself (its own payment
 * stages, design steps, a discount, a renamed column, a material row, its
 * tile order) is marked `overwrites` and starts unticked. Additions (a lead
 * source, a new material row) never remove anything.
 */

import { HAUSPIRE_PIPELINE, planPreset, presetSummary, type ExistingStage } from '@/modules/studio-practice/pipeline-preset';
import { HAUSPIRE_TEMPLATE, DEFAULT_REFUND_DAYS, readStages, type PaymentStage } from '@/modules/studio-sales/payment-template';
import { HAUSPIRE_DESIGN, readDesignTemplate, type DesignTemplateStep } from '@/modules/studio-design/template';
import { APPS, type AppKey } from './apps';

export const QUIZ_VERSION = 1;

export type SourceKey = 'META' | 'GOOGLE' | 'WALK_IN' | 'REFERRAL' | 'INSTAGRAM' | 'ARCHITECT' | 'OTHER';
export type LeadsBand = 'UNDER_20' | '20_TO_50' | '50_TO_150' | 'OVER_150';
export type PipelineStyle = 'HAUSPIRE' | 'SIMPLE';
export type Production = 'FACTORY' | 'CARPENTERS' | 'OUTSOURCED';
export type SizeBand = 'UNDER_5L' | '5_TO_10L' | '10_TO_20L' | 'OVER_20L';
export type TeamRole = 'sales' | 'designers' | 'pms' | 'supervisors' | 'accounts';
export type BrandKey = 'plywood' | 'laminate' | 'hardware' | 'kitchen' | 'paint';

export const SOURCE_KEYS: readonly SourceKey[] = ['META', 'GOOGLE', 'WALK_IN', 'REFERRAL', 'INSTAGRAM', 'ARCHITECT', 'OTHER'];
export const LEADS_BANDS: readonly LeadsBand[] = ['UNDER_20', '20_TO_50', '50_TO_150', 'OVER_150'];
export const PRODUCTIONS: readonly Production[] = ['FACTORY', 'CARPENTERS', 'OUTSOURCED'];
export const SIZE_BANDS: readonly SizeBand[] = ['UNDER_5L', '5_TO_10L', '10_TO_20L', 'OVER_20L'];
export const TEAM_ROLES: readonly TeamRole[] = ['sales', 'designers', 'pms', 'supervisors', 'accounts'];
export const BRAND_KEYS: readonly BrandKey[] = ['plywood', 'laminate', 'hardware', 'kitchen', 'paint'];

export const SOURCE_LABEL: Record<SourceKey, string> = {
  META: 'Meta (Facebook)',
  GOOGLE: 'Google',
  WALK_IN: 'Walk-in',
  REFERRAL: 'Referral',
  INSTAGRAM: 'Instagram',
  ARCHITECT: 'Architects',
  OTHER: 'Other',
};
export const LEADS_LABEL: Record<LeadsBand, string> = { UNDER_20: 'Under 20', '20_TO_50': '20 to 50', '50_TO_150': '50 to 150', OVER_150: 'Over 150' };
export const PRODUCTION_LABEL: Record<Production, string> = { FACTORY: 'Our own factory', CARPENTERS: 'Our own carpenters on site', OUTSOURCED: 'Outsourced to a factory or contractor' };
export const SIZE_LABEL: Record<SizeBand, string> = { UNDER_5L: 'Under ₹5 lakh', '5_TO_10L': '₹5 to 10 lakh', '10_TO_20L': '₹10 to 20 lakh', OVER_20L: 'Over ₹20 lakh' };
export const TEAM_LABEL: Record<TeamRole, string> = { sales: 'Salespeople', designers: 'Designers', pms: 'Project managers', supervisors: 'Site supervisors', accounts: 'Accounts' };
/** The material specification rows the quiz asks about, as the quotation PDF prints them. */
export const BRAND_ITEM: Record<BrandKey, string> = { plywood: 'Plywood', laminate: 'Laminates', hardware: 'Hardware', kitchen: 'Kitchen accessories', paint: 'Paint' };

export interface QuizAnswers {
  team: Record<TeamRole, number>;
  sources: SourceKey[];
  /** The "Other" source's name, when they have one. */
  otherSource: string;
  leadsPerMonth: LeadsBand | null;
  pipeline: PipelineStyle | null;
  designInHouse: boolean | null;
  production: Production | null;
  projectSize: SizeBand | null;
  bhk: 1 | 2 | 3 | 4 | null;
  civil: boolean | null;
  /** The modular discount, percent (0 to 50). */
  discountPct: number | null;
  feeOn: boolean | null;
  gstOn: boolean | null;
  validityDays: number | null;
  /** Brand and grade per material, in their words ("Century BWP 710, 18 mm"). Empty: not asked to print. */
  brands: Record<BrandKey, string>;
}

export const EMPTY_ANSWERS: QuizAnswers = {
  team: { sales: 0, designers: 0, pms: 0, supervisors: 0, accounts: 0 },
  sources: [],
  otherSource: '',
  leadsPerMonth: null,
  pipeline: null,
  designInHouse: null,
  production: null,
  projectSize: null,
  bhk: null,
  civil: null,
  discountPct: null,
  feeOn: null,
  gstOn: null,
  validityDays: null,
  brands: { plywood: '', laminate: '', hardware: '', kitchen: '', paint: '' },
};

const oneOf = <T extends string>(v: unknown, list: readonly T[]): T | null => (typeof v === 'string' && (list as readonly string[]).includes(v) ? (v as T) : null);
const bool = (v: unknown): boolean | null => (v === true ? true : v === false ? false : null);
const text = (v: unknown, max: number): string => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max) : '');
function num(v: unknown, min: number, max: number, step = 1): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  if (!Number.isFinite(n) || n < min || n > max) return null;
  return Math.round(n / step) * step;
}

/** Answers from anything (a form, the stored JSON): whatever is unreadable is "not answered". */
export function parseAnswers(raw: unknown): QuizAnswers {
  const r = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const t = r.team && typeof r.team === 'object' ? (r.team as Record<string, unknown>) : {};
  const b = r.brands && typeof r.brands === 'object' ? (r.brands as Record<string, unknown>) : {};
  const team = Object.fromEntries(TEAM_ROLES.map((k) => [k, num(t[k], 0, 200) ?? 0])) as Record<TeamRole, number>;
  const sources = Array.isArray(r.sources) ? SOURCE_KEYS.filter((k) => (r.sources as unknown[]).includes(k)) : [];
  const bhkN = num(r.bhk, 1, 4);
  return {
    team,
    sources,
    otherSource: sources.includes('OTHER') ? text(r.otherSource, 40) : '',
    leadsPerMonth: oneOf(r.leadsPerMonth, LEADS_BANDS),
    pipeline: oneOf(r.pipeline, ['HAUSPIRE', 'SIMPLE'] as const),
    designInHouse: bool(r.designInHouse),
    production: oneOf(r.production, PRODUCTIONS),
    projectSize: oneOf(r.projectSize, SIZE_BANDS),
    bhk: bhkN === null ? null : (bhkN as 1 | 2 | 3 | 4),
    civil: bool(r.civil),
    discountPct: num(r.discountPct, 0, 50, 0.01),
    feeOn: bool(r.feeOn),
    gstOn: bool(r.gstOn),
    validityDays: num(r.validityDays, 1, 365),
    brands: Object.fromEntries(BRAND_KEYS.map((k) => [k, text(b[k], 120)])) as Record<BrandKey, string>,
  };
}

/** The pipeline the quiz suggests before they choose: Hauspire's detailed one from 50 leads a month. */
export function suggestedPipeline(band: LeadsBand | null): PipelineStyle {
  return band === '50_TO_150' || band === 'OVER_150' ? 'HAUSPIRE' : 'SIMPLE';
}

// ── What is stored on the studio ───────────────────────────────

export interface QuizRecord {
  v: number;
  status: 'done' | 'skipped';
  at: string;
  answers: QuizAnswers | null;
  /** The change ids the owner applied. */
  applied: string[];
}

export function readQuizRecord(raw: unknown): QuizRecord | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const status = r.status === 'done' || r.status === 'skipped' ? r.status : null;
  if (!status) return null;
  return {
    v: typeof r.v === 'number' ? r.v : QUIZ_VERSION,
    status,
    at: typeof r.at === 'string' ? r.at : '',
    answers: r.answers ? parseAnswers(r.answers) : null,
    applied: Array.isArray(r.applied) ? r.applied.filter((x): x is string => typeof x === 'string').slice(0, 60) : [],
  };
}

/** What the owner's home does: the quiz (never asked), the "Set up your studio" card (skipped), or nothing. */
export function quizPrompt(raw: unknown): 'quiz' | 'card' | null {
  const rec = readQuizRecord(raw);
  if (!rec) return 'quiz';
  return rec.status === 'skipped' ? 'card' : null;
}

// ── The presets the answers choose between ─────────────────────

/** A simpler schedule than Hauspire's six, for a studio without its own factory. Percentages total 100. */
export const SIMPLE_PAYMENTS: readonly PaymentStage[] = [
  { label: 'Booking advance', note: 'Your designer is assigned and your layout begins.', kind: 'FIXED', amountPaise: 2_500_000, refundDays: DEFAULT_REFUND_DAYS },
  { label: 'Design sign-off', note: 'Your design and final quotation are agreed.', kind: 'PCT', pct: 10 },
  { label: 'Work starts', note: 'Materials are bought and work begins at your home.', kind: 'PCT', pct: 50 },
  { label: 'Installation', note: 'Your furniture is installed and finishing begins.', kind: 'PCT', pct: 35 },
  { label: 'Handover', note: 'We close the snag list and hand over your home.', kind: 'PCT', pct: 5 },
];

/** Hauspire's design steps, shortened for a studio that does not run a full design team in-house. */
const SHORT_LABELS = [
  'Project allocation (sales hands over to design)',
  'Site visit and measurement',
  '2D layout and furniture layout final',
  'First draft (FD) meeting',
  'Material selection',
  'First 3D and renders',
  'Design closure',
  'BOQ',
  'Handover to execution',
];
export const SHORT_DESIGN: readonly DesignTemplateStep[] = HAUSPIRE_DESIGN.filter((s) => SHORT_LABELS.includes(s.label));

// ── The plan ───────────────────────────────────────────────────

export interface MaterialRow {
  item: string;
  brand?: string;
  spec: string;
}

/** The studio's settings as they are now, read by the server half. */
export interface StudioNow {
  /** The pilot switch: design steps and the team are full-software settings. */
  full: boolean;
  /** Its own lead source names (ours are always on every list). */
  customSources: readonly string[];
  stages: readonly ExistingStage[];
  /** `Studio.paymentTemplate` as stored (null: Hauspire's default). */
  paymentTemplate: unknown;
  /** `Studio.designTemplate` as stored (null: Hauspire's default). */
  designTemplate: unknown;
  /** The quotation defaults (null: no branding row yet, so the defaults). */
  branding: { discountBps: number; feeBps: number; gstBps: number; validityDays: number; materialSpec: readonly MaterialRow[] } | null;
  /** The owner's saved tile order (empty: the role's order). */
  homeOrder: readonly AppKey[];
}

interface Base {
  id: string;
  /** One line: what changes. */
  title: string;
  /** What it was and what it becomes. */
  detail: string;
  /** Replaces something the studio set itself: shown, and unticked until they tick it. */
  overwrites: boolean;
}
export type SetupChange =
  | (Base & { kind: 'source'; name: string })
  | (Base & { kind: 'pipeline' })
  | (Base & { kind: 'payments'; stages: PaymentStage[] })
  | (Base & { kind: 'design'; steps: DesignTemplateStep[] | null })
  | (Base & { kind: 'discount'; bps: number })
  | (Base & { kind: 'fee'; on: boolean })
  | (Base & { kind: 'gst'; on: boolean })
  | (Base & { kind: 'validity'; days: number })
  | (Base & { kind: 'materials'; rows: MaterialRow[] })
  | (Base & { kind: 'home'; order: AppKey[] });

export interface SetupPlan {
  changes: SetupChange[];
  /** Answers saved without changing anything, and why. */
  kept: string[];
}

const DEFAULTS = { discountBps: 0, feeBps: 700, gstBps: 0, validityDays: 30 };
const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ');
const pct = (bps: number) => `${(bps / 100).toLocaleString('en-IN', { maximumFractionDigits: 2 })}%`;

/** Our own source names, already on every list (studio-practice/vocabulary.ts SOURCE_LABELS). */
const BUILT_IN: Partial<Record<SourceKey, string>> = { META: 'Facebook', WALK_IN: 'Walk-in', REFERRAL: 'Referral', INSTAGRAM: 'Instagram', ARCHITECT: 'Architect' };

function stageKey(s: PaymentStage): string {
  return [s.label.trim(), s.kind, s.kind === 'FIXED' ? s.amountPaise ?? 0 : s.pct ?? 0].join('|');
}
function sameStages(a: readonly PaymentStage[], b: readonly PaymentStage[]): boolean {
  return a.length === b.length && a.every((s, i) => stageKey(s) === stageKey(b[i]!));
}
function designKey(s: DesignTemplateStep): string {
  return [s.label, s.responsible, s.days, s.weight, s.gate ?? '', s.needsDocument, s.milestone].join('|');
}
function sameDesign(a: readonly DesignTemplateStep[], b: readonly DesignTemplateStep[]): boolean {
  return a.length === b.length && a.every((s, i) => designKey(s) === designKey(b[i]!));
}

/** The tile order the team suggests for the owner's home, or null to keep the role's own. */
export function suggestedHomeOrder(team: Record<TeamRole, number>, full: boolean): AppKey[] | null {
  const delivery = team.designers + team.pms + team.supervisors;
  if (delivery === 0) return ['clients', 'quotes', 'today', 'calendar', 'rates'];
  if (full && team.pms + team.supervisors > 0) return ['today', 'projects', 'site', 'clients', 'quotes'];
  return null;
}

/** What these answers would change in the studio's settings as they are now. Pure. */
export function planSetup(a: QuizAnswers, now: StudioNow): SetupPlan {
  const changes: SetupChange[] = [];
  const kept: string[] = [];

  /* Team: counts are saved; the team itself is invited on Settings → Team. */
  const people = TEAM_ROLES.reduce((n, k) => n + a.team[k], 0);
  if (people > 0 && !now.full) kept.push('Your team: saved. Inviting designers, project managers, supervisors and accounts opens with the full studio software.');

  /* Lead sources: add the ones missing; never remove one. */
  const have = new Set(now.customSources.map(norm));
  const wanted: string[] = [];
  for (const k of a.sources) {
    if (BUILT_IN[k]) continue;
    const name = k === 'OTHER' ? a.otherSource : SOURCE_LABEL[k];
    if (name.length >= 2 && !have.has(norm(name)) && !wanted.some((w) => norm(w) === norm(name))) wanted.push(name);
  }
  for (const name of wanted) {
    changes.push({ id: `source:${norm(name)}`, kind: 'source', name, title: `Add “${name}” as a lead source`, detail: 'It shows on every lead form, the board’s filter and import. Your other sources stay.', overwrites: false });
  }

  /* Pipeline: Hauspire's detailed one through the existing preset; "simple" keeps theirs. */
  if (a.pipeline === 'HAUSPIRE') {
    const plan = planPreset(now.stages, HAUSPIRE_PIPELINE);
    const sorted = [...now.stages].sort((x, y) => x.sortOrder - y.sortOrder);
    const intake = sorted.find((s) => s.isIntake)?.id;
    const same = plan.creates.length === 0 && plan.renames.length === 0 && plan.intake === intake && plan.order.every((id, i) => sorted[i]?.id === id);
    if (!same) {
      changes.push({ id: 'pipeline', kind: 'pipeline', title: 'Use Hauspire’s detailed pipeline', detail: presetSummary(plan), overwrites: plan.renames.length > 0 });
    }
  } else if (a.pipeline === 'SIMPLE') {
    kept.push('Pipeline: your columns stay as they are.');
  }

  /* Payment stages: Hauspire's six for a studio with its own factory, a simpler schedule otherwise. */
  if (a.production) {
    const target = a.production === 'FACTORY' ? HAUSPIRE_TEMPLATE : SIMPLE_PAYMENTS;
    const stored = readStages(now.paymentTemplate);
    const current = stored ?? HAUSPIRE_TEMPLATE;
    if (!sameStages(current, target)) {
      const own = stored !== null && !sameStages(stored, HAUSPIRE_TEMPLATE) && !sameStages(stored, SIMPLE_PAYMENTS);
      changes.push({
        id: 'payments',
        kind: 'payments',
        stages: target.map((s) => ({ ...s })),
        title: a.production === 'FACTORY' ? 'Payment stages: Hauspire’s six' : 'Payment stages: a simpler five',
        detail: `${target.map((s) => (s.kind === 'FIXED' ? `${s.label} ₹${((s.amountPaise ?? 0) / 100).toLocaleString('en-IN')}` : `${s.label} ${s.pct}%`)).join(' · ')}${own ? '. Replaces the stages you set yourself.' : ''}`,
        overwrites: own,
      });
    }
  }

  /* Design steps: a full-software setting. */
  if (a.designInHouse !== null) {
    if (!now.full) {
      kept.push('Design steps: saved. They open with the full studio software.');
    } else {
      const target = a.designInHouse ? HAUSPIRE_DESIGN : SHORT_DESIGN;
      const custom = now.designTemplate !== null && now.designTemplate !== undefined;
      const current = readDesignTemplate(custom ? now.designTemplate : null);
      if (!sameDesign(current, target)) {
        const own = custom && !sameDesign(current, HAUSPIRE_DESIGN) && !sameDesign(current, SHORT_DESIGN);
        changes.push({
          id: 'design',
          kind: 'design',
          steps: a.designInHouse ? null : target.map((s) => ({ ...s })),
          title: a.designInHouse ? `Design steps: Hauspire’s ${HAUSPIRE_DESIGN.length}` : `Design steps: a shorter ${SHORT_DESIGN.length}`,
          detail: `New projects start with them; running projects keep their own.${own ? ' Replaces the steps you set yourself.' : ''}`,
          overwrites: own,
        });
      }
    }
  }

  if (a.projectSize || a.bhk || a.civil !== null) {
    kept.push('Project size, flat size and civil work: saved. Every project still starts from the standard execution steps; mark a step not in scope (civil work, say) on the project’s plan.');
  }

  /* Quotation defaults. */
  const b = now.branding ?? { ...DEFAULTS, materialSpec: [] };
  if (a.discountPct !== null) {
    const bps = Math.round(a.discountPct * 100);
    if (bps !== b.discountBps) {
      changes.push({ id: 'discount', kind: 'discount', bps, title: `Modular discount ${pct(bps)}`, detail: `Was ${pct(b.discountBps)}. New quotations start with it; sent ones keep theirs.`, overwrites: b.discountBps !== DEFAULTS.discountBps });
    }
  }
  if (a.feeOn !== null && a.feeOn !== b.feeBps > 0) {
    changes.push({ id: 'fee', kind: 'fee', on: a.feeOn, title: a.feeOn ? 'Professional fee 7%: on for new quotations' : 'Professional fee: off for new quotations', detail: 'Still switched on or off per quotation. The fee is 7% for every studio.', overwrites: !(b.feeBps > 0) });
  }
  if (a.gstOn !== null && a.gstOn !== b.gstBps > 0) {
    changes.push({ id: 'gst', kind: 'gst', on: a.gstOn, title: a.gstOn ? 'GST at 18% on new quotations' : 'No GST on new quotations', detail: a.gstOn ? 'Was off.' : 'Was on.', overwrites: b.gstBps !== DEFAULTS.gstBps });
  }
  if (a.validityDays !== null && a.validityDays !== b.validityDays) {
    changes.push({ id: 'validity', kind: 'validity', days: a.validityDays, title: `Quotations hold their prices for ${a.validityDays} days`, detail: `Was ${b.validityDays} days.`, overwrites: b.validityDays !== DEFAULTS.validityDays });
  }

  /* Material specification: their brands, added or replacing the same item's row. */
  const rows = b.materialSpec.map((r) => ({ ...r }));
  let added = 0;
  const replaced: string[] = [];
  for (const k of BRAND_KEYS) {
    const spec = a.brands[k];
    if (!spec) continue;
    const item = BRAND_ITEM[k];
    const at = rows.findIndex((r) => norm(r.item) === norm(item));
    if (at < 0) {
      rows.push({ item, spec });
      added += 1;
    } else if (norm(rows[at]!.spec) !== norm(spec) || rows[at]!.brand) {
      replaced.push(`${item}: “${[rows[at]!.brand, rows[at]!.spec].filter(Boolean).join(' ')}”`);
      rows[at] = { item, spec };
    }
  }
  if (added + replaced.length > 0) {
    changes.push({
      id: 'materials',
      kind: 'materials',
      rows: rows.slice(0, 40),
      title: 'Material specification on your quotation PDF',
      detail: `${added > 0 ? `Adds ${added} row${added === 1 ? '' : 's'}.` : ''}${replaced.length ? ` Replaces ${replaced.join(', ')}.` : ''} Your other rows stay.`.trim(),
      overwrites: replaced.length > 0,
    });
  }

  /* The owner's home: what to put first, from the team they have. */
  const order = suggestedHomeOrder(a.team, now.full);
  if (order && people > 0) {
    const same = now.homeOrder.length > 0 && order.every((k, i) => now.homeOrder[i] === k);
    if (!same) {
      changes.push({ id: 'home', kind: 'home', order, title: 'Your home: the apps you use most, first', detail: `${order.map((k) => APPS.find((x) => x.key === k)?.name ?? k).join(', ')}, then the rest.`, overwrites: now.homeOrder.length > 0 });
    }
  }

  return { changes, kept };
}

/** The ids ticked by default: every change that does not replace something the studio set itself. */
export function defaultTicks(plan: SetupPlan): string[] {
  return plan.changes.filter((c) => !c.overwrites).map((c) => c.id);
}
