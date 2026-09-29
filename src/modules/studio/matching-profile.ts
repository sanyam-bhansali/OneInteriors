/**
 * The studio's matching profile — what we need from a studio to match it
 * well (docs/STUDIO-PROFILE-REQUIREMENTS.md, sections 2 and 4–9).
 *
 * ## One JSON column, read through this file
 *
 * Studios differ in shape, not just in values: a modular-only studio has a
 * factory and hardware brands and no carpenters; a carpenter-led one has the
 * opposite; most are mixed. Thirty nullable columns would make every one of
 * those a migration. So the profile is one `matchingProfile` JSON on Studio,
 * and this module is the only way in or out: `profileFromForm` validates what
 * the studio sends, `readProfile` validates what is stored, and anything
 * unrecognised is dropped rather than trusted — the same rule the portfolio
 * style tags follow.
 *
 * ## Unknown is not no
 *
 * Every field is nullable, and null means "the studio has not said". Matching
 * scores a null as not known yet, never as a no — a studio that has not told
 * us it designs before possession is not a studio that does not.
 *
 * Pure, and tested.
 */

import {
  LANGUAGES,
  SCOPE_LABELS,
  type Involvement,
  type Language,
  type ScopeType,
} from '@/modules/brief/types';

// ── Vocabulary ───────────────────────────────────────────────────

export const SCOPES: readonly ScopeType[] = ['FULL_HOME', 'KITCHEN_WARDROBE', 'SINGLE_ROOM', 'RENOVATION'];

/** How the studio builds. The fork that decides how its quotes are read. */
export const WORK_MIXES = ['MODULAR', 'CARPENTRY', 'MIXED'] as const;
export type WorkMix = (typeof WORK_MIXES)[number];
export const WORK_MIX_LABELS: Record<WorkMix, { label: string; detail: string }> = {
  MODULAR: { label: 'Modular', detail: 'Factory-made units, installed on site' },
  CARPENTRY: { label: 'Carpentry', detail: 'Built on site by your carpenters' },
  MIXED: { label: 'Both', detail: 'Modular kitchens and wardrobes, carpentry for the rest' },
};

export const CIVIL_OPTIONS = ['OWN_TEAM', 'PARTNER', 'NONE'] as const;
export type Civil = (typeof CIVIL_OPTIONS)[number];
export const CIVIL_LABELS: Record<Civil, string> = {
  OWN_TEAM: 'Our own team',
  PARTNER: 'A regular partner',
  NONE: 'We do not do civil work',
};

export const HOME_TYPES = ['BHK_1', 'BHK_2', 'BHK_3', 'BHK_4_PLUS', 'VILLA'] as const;
export type HomeType = (typeof HOME_TYPES)[number];
export const HOME_TYPE_LABELS: Record<HomeType, string> = {
  BHK_1: '1 BHK',
  BHK_2: '2 BHK',
  BHK_3: '3 BHK',
  BHK_4_PLUS: '4 BHK+',
  VILLA: 'Villa / row house',
};

/** The studio's side of the customer's involvement question — same three answers. */
export const WORKING_STYLES: readonly Involvement[] = ['DECIDE_FOR_ME', 'COLLABORATE', 'APPROVE_EVERYTHING'];
export const WORKING_STYLE_LABELS: Record<Involvement, string> = {
  DECIDE_FOR_ME: 'We take it from brief to handover, and bring decisions to you at the key points',
  COLLABORATE: 'We design it with you, together at each stage',
  APPROVE_EVERYTHING: 'You approve every drawing and every material before we proceed',
};

export const VIEWS_3D = ['NONE', 'KEY_ROOMS', 'EVERY_ROOM'] as const;
export type Views3d = (typeof VIEWS_3D)[number];
export const VIEWS_3D_LABELS: Record<Views3d, string> = {
  NONE: 'None',
  KEY_ROOMS: 'Key rooms',
  EVERY_ROOM: 'Every room',
};

export const UPDATE_CHANNELS = ['WHATSAPP', 'WEEKLY_REPORT', 'SITE_VISITS'] as const;
export type UpdateChannel = (typeof UPDATE_CHANNELS)[number];
export const UPDATE_LABELS: Record<UpdateChannel, string> = {
  WHATSAPP: 'A WhatsApp group',
  WEEKLY_REPORT: 'A weekly report',
  SITE_VISITS: 'Site visits together',
};

export const CARCASSES = ['BWP_PLY', 'MR_PLY', 'HDHMR', 'MDF', 'SOLID_WOOD'] as const;
export type Carcass = (typeof CARCASSES)[number];
export const CARCASS_LABELS: Record<Carcass, string> = {
  BWP_PLY: 'BWP ply',
  MR_PLY: 'MR ply',
  HDHMR: 'HDHMR',
  MDF: 'MDF',
  SOLID_WOOD: 'Solid wood',
};

export const FINISHES = ['LAMINATE', 'ACRYLIC', 'VENEER', 'LACQUER', 'PU', 'MEMBRANE'] as const;
export type Finish = (typeof FINISHES)[number];
export const FINISH_LABELS: Record<Finish, string> = {
  LAMINATE: 'Laminate',
  ACRYLIC: 'Acrylic',
  VENEER: 'Veneer',
  LACQUER: 'Lacquer glass',
  PU: 'PU paint',
  MEMBRANE: 'Membrane',
};

export const PRODUCTION = ['OWN_FACTORY', 'OUTSOURCED'] as const;
export type Production = (typeof PRODUCTION)[number];
export const PRODUCTION_LABELS: Record<Production, string> = {
  OWN_FACTORY: 'Our own factory or workshop',
  OUTSOURCED: 'Outsourced to a factory',
};

/**
 * What a studio has delivered at least twice. Each maps to a customer answer
 * — the household (children, elderly parents, pets, working from home) or a
 * home need — which is what makes it a matching signal and not a brochure.
 */
export const SPECIALISMS = [
  'CHILDREN',
  'ELDERLY',
  'PETS',
  'HOME_OFFICE',
  'VASTU',
  'POOJA_ROOM',
  'EXTRA_STORAGE',
  'SMART_HOME',
  'BESPOKE_FURNITURE',
  'FAST_RENTAL',
] as const;
export type Specialism = (typeof SPECIALISMS)[number];
export const SPECIALISM_LABELS: Record<Specialism, string> = {
  CHILDREN: "Children's rooms",
  ELDERLY: 'Homes for elderly parents',
  PETS: 'Pet-friendly homes',
  HOME_OFFICE: 'Home offices',
  VASTU: 'Vastu-compliant layouts',
  POOJA_ROOM: 'Pooja rooms',
  EXTRA_STORAGE: 'Storage-heavy small homes',
  SMART_HOME: 'Smart home / automation',
  BESPOKE_FURNITURE: 'Bespoke furniture',
  FAST_RENTAL: 'Fast turnarounds for rentals',
};

// ── The profile ──────────────────────────────────────────────────

export interface MatchingProfile {
  // 2 · The work you take on
  workMix: WorkMix | null;
  scopes: ScopeType[];
  /** Minimum project value per scope, in lakhs. */
  minimumLakhs: Partial<Record<ScopeType, number>>;
  civil: Civil | null;
  homeTypes: HomeType[];
  // 3 · Where you work (the areas themselves are Studio.localities)
  cityWide: boolean | null;
  societies: string[];
  // 4 · Capacity and timing
  concurrentProjects: number | null;
  runningNow: number | null;
  /** YYYY-MM-DD. Treated as unknown once `earliestStartSetOn` is 60 days old. */
  earliestStart: string | null;
  earliestStartSetOn: string | null;
  /** Sign-off to handover, per scope, in days. */
  durationDays: Partial<Record<ScopeType, number>>;
  designBeforePossession: boolean | null;
  // 5 · How you work
  workingStyle: Involvement | null;
  revisions: number | null;
  views3d: Views3d | null;
  dedicatedDesigner: boolean | null;
  dedicatedPM: boolean | null;
  updates: UpdateChannel[];
  // 6 · Materials and workmanship
  carcass: Carcass[];
  finishes: Finish[];
  hardware: string[];
  warrantyYears: number | null;
  production: Production | null;
  ownInstallers: boolean | null;
  // 7–9
  specialisms: Specialism[];
  languages: Language[];
  introVideoUrl: string | null;
  // Commercial
  /** The One Interiors discount, % — a line on every quote. Agreed in the studio agreement. */
  curatedDiscountPct: number | null;
}

export const EMPTY_PROFILE: MatchingProfile = {
  workMix: null,
  scopes: [],
  minimumLakhs: {},
  civil: null,
  homeTypes: [],
  cityWide: null,
  societies: [],
  concurrentProjects: null,
  runningNow: null,
  earliestStart: null,
  earliestStartSetOn: null,
  durationDays: {},
  designBeforePossession: null,
  workingStyle: null,
  revisions: null,
  views3d: null,
  dedicatedDesigner: null,
  dedicatedPM: null,
  updates: [],
  carcass: [],
  finishes: [],
  hardware: [],
  warrantyYears: null,
  production: null,
  ownInstallers: null,
  specialisms: [],
  languages: [],
  introVideoUrl: null,
  curatedDiscountPct: null,
};

export const LIMITS = {
  minimumLakhs: [0.5, 500],
  concurrentProjects: [1, 200],
  durationDays: [7, 730],
  revisions: [0, 20],
  warrantyYears: [0, 30],
  curatedDiscountPct: [0, 30],
  societies: 30,
  hardware: 8,
  textMax: 80,
} as const;

// ── Reading, from anywhere ───────────────────────────────────────

const oneOf = <T extends string>(list: readonly T[], v: unknown): T | null =>
  typeof v === 'string' && (list as readonly string[]).includes(v) ? (v as T) : null;

const manyOf = <T extends string>(list: readonly T[], v: unknown): T[] =>
  Array.isArray(v) ? [...new Set(v.filter((x): x is T => oneOf(list, x) !== null))] : [];

const bool = (v: unknown): boolean | null => (typeof v === 'boolean' ? v : null);

function num(v: unknown, [lo, hi]: readonly [number, number], integer = true): number | null {
  const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() ? Number(v) : NaN;
  if (!Number.isFinite(n) || n < lo || n > hi) return null;
  return integer ? Math.round(n) : Math.round(n * 100) / 100;
}

function texts(v: unknown, max: number): string[] {
  if (!Array.isArray(v)) return [];
  const out: string[] = [];
  for (const x of v) {
    if (typeof x !== 'string') continue;
    const t = x.replace(/\s+/g, ' ').trim().slice(0, LIMITS.textMax);
    if (t && !out.some((o) => o.toLowerCase() === t.toLowerCase())) out.push(t);
    if (out.length >= max) break;
  }
  return out;
}

function perScope(v: unknown, range: readonly [number, number], integer: boolean): Partial<Record<ScopeType, number>> {
  const out: Partial<Record<ScopeType, number>> = {};
  if (!v || typeof v !== 'object') return out;
  for (const s of SCOPES) {
    const n = num((v as Record<string, unknown>)[s], range, integer);
    if (n !== null) out[s] = n;
  }
  return out;
}

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const date = (v: unknown): string | null =>
  typeof v === 'string' && DATE.test(v) && !Number.isNaN(Date.parse(v)) ? v : null;

/** Only https links, and only to where a phone video actually lives. */
export function cleanVideoUrl(v: unknown): string | null {
  if (typeof v !== 'string' || !v.trim()) return null;
  try {
    const url = new URL(v.trim());
    if (url.protocol !== 'https:') return null;
    const host = url.hostname.replace(/^www\./, '');
    const ok = ['youtube.com', 'youtu.be', 'm.youtube.com', 'vimeo.com', 'instagram.com', 'drive.google.com'];
    return ok.includes(host) ? url.toString() : null;
  } catch {
    return null;
  }
}

/** A stored profile, validated field by field. Anything unrecognised is dropped. */
export function readProfile(raw: unknown): MatchingProfile {
  if (!raw || typeof raw !== 'object') return EMPTY_PROFILE;
  const r = raw as Record<string, unknown>;
  const scopes = manyOf(SCOPES, r.scopes);
  return {
    workMix: oneOf(WORK_MIXES, r.workMix),
    scopes,
    minimumLakhs: perScope(r.minimumLakhs, LIMITS.minimumLakhs, false),
    civil: oneOf(CIVIL_OPTIONS, r.civil),
    homeTypes: manyOf(HOME_TYPES, r.homeTypes),
    cityWide: bool(r.cityWide),
    societies: texts(r.societies, LIMITS.societies),
    concurrentProjects: num(r.concurrentProjects, LIMITS.concurrentProjects),
    runningNow: num(r.runningNow, [0, LIMITS.concurrentProjects[1]]),
    earliestStart: date(r.earliestStart),
    earliestStartSetOn: date(r.earliestStartSetOn),
    durationDays: perScope(r.durationDays, LIMITS.durationDays, true),
    designBeforePossession: bool(r.designBeforePossession),
    workingStyle: oneOf(WORKING_STYLES, r.workingStyle),
    revisions: num(r.revisions, LIMITS.revisions),
    views3d: oneOf(VIEWS_3D, r.views3d),
    dedicatedDesigner: bool(r.dedicatedDesigner),
    dedicatedPM: bool(r.dedicatedPM),
    updates: manyOf(UPDATE_CHANNELS, r.updates),
    carcass: manyOf(CARCASSES, r.carcass),
    finishes: manyOf(FINISHES, r.finishes),
    hardware: texts(r.hardware, LIMITS.hardware),
    warrantyYears: num(r.warrantyYears, LIMITS.warrantyYears),
    production: oneOf(PRODUCTION, r.production),
    ownInstallers: bool(r.ownInstallers),
    specialisms: manyOf(SPECIALISMS, r.specialisms),
    languages: manyOf(LANGUAGES, r.languages),
    introVideoUrl: cleanVideoUrl(r.introVideoUrl),
    curatedDiscountPct: num(r.curatedDiscountPct, LIMITS.curatedDiscountPct, false),
  };
}

// ── From the form ────────────────────────────────────────────────

/** The shape a FormData reads as: one or many strings per name. */
export interface FormLike {
  get(name: string): unknown;
  getAll(name: string): unknown[];
}

const yesNo = (v: unknown): boolean | null => (v === 'yes' ? true : v === 'no' ? false : null);
const lines = (v: unknown): string[] =>
  typeof v === 'string' ? v.split(/[,\n]+/).map((s) => s.trim()).filter(Boolean) : [];

export interface ProfileResult {
  profile: MatchingProfile;
  errors: Record<string, string>;
}

/**
 * The form, as a profile, plus what is wrong with it.
 *
 * Blank is allowed everywhere — it means "not said yet". What is refused is a
 * value that is present and wrong: a minimum of ₹0.1 L, a video link to a
 * site we cannot embed, more projects running than the studio can run.
 */
export function profileFromForm(form: FormLike, today: string, previous: MatchingProfile): ProfileResult {
  const errors: Record<string, string> = {};
  const raw = (name: string) => {
    const v = form.get(name);
    return typeof v === 'string' ? v.trim() : '';
  };
  const numberField = (name: string, range: readonly [number, number], integer = true, message?: string) => {
    const v = raw(name);
    if (!v) return null;
    const n = num(v, range, integer);
    if (n === null) errors[name] = message ?? `Between ${range[0]} and ${range[1]}.`;
    return n;
  };

  const scopes = manyOf(SCOPES, form.getAll('scopes'));
  const minimumLakhs: Partial<Record<ScopeType, number>> = {};
  const durationDays: Partial<Record<ScopeType, number>> = {};
  for (const s of scopes) {
    const m = numberField(`minimum_${s}`, LIMITS.minimumLakhs, false, `${SCOPE_LABELS[s]}: a minimum between ₹0.5 L and ₹500 L.`);
    if (m !== null) minimumLakhs[s] = m;
    const d = numberField(`duration_${s}`, LIMITS.durationDays, true, `${SCOPE_LABELS[s]}: between 7 and 730 days.`);
    if (d !== null) durationDays[s] = d;
  }

  const concurrentProjects = numberField('concurrentProjects', LIMITS.concurrentProjects);
  const runningNow = numberField('runningNow', [0, LIMITS.concurrentProjects[1]]);
  if (concurrentProjects !== null && runningNow !== null && runningNow > concurrentProjects * 2) {
    errors.runningNow = 'That is more than twice what you can run at once — check the two numbers.';
  }

  const startRaw = raw('earliestStart');
  const earliestStart = startRaw ? date(startRaw) : null;
  if (startRaw && !earliestStart) errors.earliestStart = 'A date, please.';
  // Saving the date, changed or not, confirms it as of today — which is what
  // keeps it from going stale.
  const earliestStartSetOn = earliestStart ? today : null;

  const videoRaw = raw('introVideoUrl');
  const introVideoUrl = cleanVideoUrl(videoRaw);
  if (videoRaw && !introVideoUrl) {
    errors.introVideoUrl = 'A https link to YouTube, Vimeo, Instagram or Google Drive.';
  }

  const civil = scopes.includes('RENOVATION') ? oneOf(CIVIL_OPTIONS, raw('civil')) : null;

  const profile: MatchingProfile = {
    workMix: oneOf(WORK_MIXES, raw('workMix')),
    scopes,
    minimumLakhs,
    civil,
    homeTypes: manyOf(HOME_TYPES, form.getAll('homeTypes')),
    cityWide: yesNo(raw('cityWide')),
    societies: texts(lines(raw('societies')), LIMITS.societies),
    concurrentProjects,
    runningNow,
    earliestStart,
    earliestStartSetOn,
    durationDays,
    designBeforePossession: yesNo(raw('designBeforePossession')),
    workingStyle: oneOf(WORKING_STYLES, raw('workingStyle')),
    revisions: numberField('revisions', LIMITS.revisions),
    views3d: oneOf(VIEWS_3D, raw('views3d')),
    dedicatedDesigner: yesNo(raw('dedicatedDesigner')),
    dedicatedPM: yesNo(raw('dedicatedPM')),
    updates: manyOf(UPDATE_CHANNELS, form.getAll('updates')),
    carcass: manyOf(CARCASSES, form.getAll('carcass')),
    finishes: manyOf(FINISHES, form.getAll('finishes')),
    hardware: texts(lines(raw('hardware')), LIMITS.hardware),
    warrantyYears: numberField('warrantyYears', LIMITS.warrantyYears),
    production: oneOf(PRODUCTION, raw('production')),
    ownInstallers: yesNo(raw('ownInstallers')),
    specialisms: manyOf(SPECIALISMS, form.getAll('specialisms')),
    languages: manyOf(LANGUAGES, form.getAll('languages')),
    introVideoUrl,
    // Agreed in the studio agreement and recorded by ops — never from this form.
    curatedDiscountPct: previous.curatedDiscountPct,
  };
  return { profile, errors };
}

/** For the JSON column: a plain object Prisma will accept. */
export function profileJson(p: MatchingProfile): Record<string, unknown> {
  return JSON.parse(JSON.stringify(p)) as Record<string, unknown>;
}

// ── Freshness ────────────────────────────────────────────────────

/** An earliest-start date older than this is treated as unknown. */
export const START_STALE_DAYS = 60;

/** The earliest start, or null when it was never given or has gone stale. */
export function earliestStartKnown(p: MatchingProfile, today: string): string | null {
  if (!p.earliestStart || !p.earliestStartSetOn) return null;
  const age = (Date.parse(today) - Date.parse(p.earliestStartSetOn)) / 86_400_000;
  return age > START_STALE_DAYS ? null : p.earliestStart;
}

// ── Completeness ─────────────────────────────────────────────────

export type SectionId = 'work' | 'where' | 'timing' | 'how' | 'materials' | 'experience' | 'languages' | 'video';

export interface SectionStatus {
  id: SectionId;
  title: string;
  required: boolean;
  done: boolean;
  /** What finishing it gets them, in one line — the reason to do it. */
  gets: string;
  missing: string[];
}

/**
 * Section by section, as the studio sees it (requirements doc Part C).
 *
 * The required sections gate the step; the recommended ones never block, and
 * each says what it would get them rather than scolding.
 */
export function profileSections(p: MatchingProfile, localities: string[], today: string): SectionStatus[] {
  const need = (cond: boolean, what: string, into: string[]) => {
    if (!cond) into.push(what);
  };

  const work: string[] = [];
  need(p.workMix !== null, 'modular, carpentry or both', work);
  need(p.scopes.length > 0, 'the kinds of work you take', work);
  need(p.scopes.every((s) => p.minimumLakhs[s] !== undefined), 'a minimum for each kind of work', work);
  need(!p.scopes.includes('RENOVATION') || p.civil !== null, 'who does your civil work', work);
  need(p.homeTypes.length > 0, 'the home types you take', work);

  const where: string[] = [];
  need(p.cityWide === true || localities.length > 0, 'your areas, or "anywhere in Pune"', where);

  const timing: string[] = [];
  need(p.concurrentProjects !== null, 'how many projects you can run at once', timing);
  need(earliestStartKnown(p, today) !== null, p.earliestStart ? 'your earliest start date, confirmed in the last 60 days' : 'your earliest start date', timing);
  need(p.scopes.every((s) => p.durationDays[s] !== undefined), 'a typical duration for each kind of work', timing);
  need(p.designBeforePossession !== null, 'whether you design before possession', timing);

  const how: string[] = [];
  need(p.workingStyle !== null, 'which of the three is closest to how you work', how);
  need(p.views3d !== null, 'the 3D views you include', how);
  need(p.updates.length > 0, 'how clients get updates', how);

  const materials: string[] = [];
  need(p.carcass.length > 0, 'your standard carcass material', materials);
  need(p.finishes.length > 0, 'the shutter finishes you offer', materials);
  need(p.warrantyYears !== null, 'your warranty in years', materials);
  need(p.production !== null || p.workMix === 'CARPENTRY', 'where your units are made', materials);
  need(p.workMix === 'CARPENTRY' || p.hardware.length > 0, 'the hardware brands you use', materials);

  return [
    { id: 'work', title: 'The work you take on', required: true, done: work.length === 0, missing: work, gets: 'Decides which briefs reach you at all — scope, size and home type.' },
    { id: 'where', title: 'Where you work', required: true, done: where.length === 0, missing: where, gets: 'Buyers in your areas see you first. Societies you have done add "they have done flats in your building".' },
    { id: 'timing', title: 'Capacity and timing', required: true, done: timing.length === 0, missing: timing, gets: 'Buyers getting possession soon are matched on your earliest start.' },
    { id: 'how', title: 'How you work', required: true, done: how.length === 0, missing: how, gets: 'Matched against how involved each buyer wants to be — the commonest cause of a falling-out.' },
    { id: 'materials', title: 'Materials and workmanship', required: true, done: materials.length === 0, missing: materials, gets: 'Buyers who rank material quality first are matched on this, and it is compared line by line.' },
    { id: 'experience', title: 'What you are experienced in', required: false, done: p.specialisms.length > 0, missing: p.specialisms.length > 0 ? [] : ['anything you have delivered at least twice'], gets: 'Families with children, elderly parents or pets are matched to studios who have done it.' },
    { id: 'languages', title: 'Languages', required: false, done: p.languages.length > 0, missing: p.languages.length > 0 ? [] : ['the languages you can meet clients in'], gets: 'A tie-breaker for buyers who would rather talk in Hindi or Marathi.' },
    { id: 'video', title: 'Meet the studio', required: false, done: p.introVideoUrl !== null, missing: p.introVideoUrl ? [] : ['a 20–30 second intro video'], gets: 'Shown on your match card — buyers pick people, not logos.' },
  ];
}

/** Whole percent of all sections done, required and recommended alike. */
export function profileScore(sections: SectionStatus[]): number {
  if (sections.length === 0) return 0;
  return Math.round((sections.filter((s) => s.done).length / sections.length) * 100);
}
