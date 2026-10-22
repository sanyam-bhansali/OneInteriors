/**
 * How a lead row and card read (the AxLeads look, 12 Oct 2026; AxLeads
 * LeadsClient.tsx `dueInfo`, `coldDays`, `budgetRange`, the list's
 * swappable columns). Pure, tested in tests/studio-leads-look.test.ts.
 * India time throughout, so the server and the browser agree.
 */

import { addDays, istDay, istMinutesOfDay } from '@/modules/project/working-days';
import { QUIET_AFTER_DAYS, SOURCE_LABELS, type ClientSourceName } from '@/modules/studio-practice/vocabulary';

/** One lead as the list and the board draw it. Built on the server (leads-list.ts). */
export interface LeadView {
  id: string;
  name: string;
  phone: string | null;
  society: string | null;
  locality: string | null;
  city: string | null;
  config: string | null;
  budgetPaise: number | null;
  source: ClientSourceName;
  sourceName: string | null;
  stageId: string;
  stageName: string;
  stageColour: string;
  stageKind: 'OPEN' | 'WON' | 'DONE' | 'LOST';
  assignedToId: string | null;
  assignedToName: string | null;
  /** The pool an unassigned lead sits in: a head's member id, or null for the studio pool (sales roles, 22 Oct 2026). */
  poolTeamId?: string | null;
  createdAt: Date;
  /** The row's last change (the "Last active" sort). */
  updatedAt: Date;
  /** The newest timeline line, if any. */
  lastActivityAt: Date | null;
  lastContactedAt: Date | null;
  nextAction: string | null;
  nextActionOn: Date | null;
  tags: string[];
  latestNote: string | null;
  noteCount: number;
  fields: Record<string, string>;
  isDemo: boolean;
  /** Decided by the same SQL that counts the cards. */
  flags: { stale: boolean; closed: boolean };
}

/**
 * Whether this person sees the whole lead: owner and PM always; a
 * salesperson only their own. A pool lead (or anything not theirs) is a
 * row to claim from — roles.ts: "not the pool lead's own page until they
 * have claimed it".
 *
 * Sales roles (owner, 22 Oct 2026): with team reach (`team` = them and
 * everyone below them), a lead their team has, or one waiting in a team pool
 * of their team, is theirs to see in full — the same rule as
 * sales-access.ts `leadInReach`. A pool they may only claim from (a head's
 * pool above them) stays a row to claim.
 */
export function seesFullLead(
  viewer: { seesAll: boolean; member: { id: string }; team?: readonly string[] | null },
  lead: { assignedToId: string | null; poolTeamId?: string | null },
): boolean {
  if (viewer.seesAll) return true;
  if (lead.assignedToId !== null && lead.assignedToId === viewer.member.id) return true;
  const team = viewer.team;
  if (!team) return false;
  if (lead.assignedToId !== null) return team.includes(lead.assignedToId);
  return typeof lead.poolTeamId === 'string' && team.includes(lead.poolTeamId);
}

/**
 * A lead as a salesperson sees it before claiming it: name, place, stage,
 * source, age and tags. No phone, no notes or next action, none of the
 * studio's own fields. Applied on the server, so none of it reaches the
 * browser.
 */
export function claimableView(v: LeadView): LeadView {
  return { ...v, phone: null, nextAction: null, latestNote: null, noteCount: 0, fields: {} };
}

/** Board columns whose cards wait until opened: won, finished, lost (counts still show). */
export const LAZY_KINDS: readonly string[] = ['WON', 'DONE', 'LOST'];

/**
 * Which board columns to draw and which to fill on the first load. A stage
 * filter picks the columns (unknown ids are ignored; none known means all);
 * of those, open ones load their first cards and won, finished and lost
 * ones are `lazy`. Pipeline order is kept.
 */
export function boardColumnPlan<S extends { id: string; kind: string }>(stages: readonly S[], stageFilter?: readonly string[]): { shown: S[]; eager: string[]; lazy: string[] } {
  const picked = stageFilter?.length ? stages.filter((s) => stageFilter.includes(s.id)) : [];
  const shown = picked.length ? picked : [...stages];
  return {
    shown,
    eager: shown.filter((s) => !LAZY_KINDS.includes(s.kind)).map((s) => s.id),
    lazy: shown.filter((s) => LAZY_KINDS.includes(s.kind)).map((s) => s.id),
  };
}

const DAY = 86_400_000;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export type DueBucket = 'overdue' | 'today' | 'tomorrow' | 'week' | 'later';

/** "3:30 PM" in India. */
export function clock12(at: Date): string {
  const m = istMinutesOfDay(at);
  const h = Math.floor(m / 60);
  return `${h % 12 === 0 ? 12 : h % 12}:${String(m % 60).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
}

/**
 * The next-call badge: "Overdue 3d", "Overdue", "Today 3:30 PM",
 * "Tomorrow", "15 Thu" (within the week), "Oct 30" (later). Null with no call.
 */
export function dueBadge(on: Date | null, now: Date): { bucket: DueBucket; label: string } | null {
  if (!on) return null;
  const today = istDay(now);
  const day = istDay(on);
  if (day < today) {
    const days = Math.round((Date.parse(`${today}T00:00:00Z`) - Date.parse(`${day}T00:00:00Z`)) / DAY);
    return { bucket: 'overdue', label: `Overdue ${days}d` };
  }
  if (day === today) return on.getTime() < now.getTime() ? { bucket: 'overdue', label: 'Overdue' } : { bucket: 'today', label: `Today ${clock12(on)}` };
  if (day === addDays(today, 1)) return { bucket: 'tomorrow', label: 'Tomorrow' };
  const d = new Date(`${day}T00:00:00Z`);
  if (day <= addDays(today, 7)) return { bucket: 'week', label: `${d.getUTCDate()} ${WEEKDAYS[d.getUTCDay()]}` };
  return { bucket: 'later', label: `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}` };
}

/** Whole days since anything happened to the lead (created, contacted, a timeline line). */
export function coldDays(l: Pick<LeadView, 'createdAt' | 'lastContactedAt' | 'lastActivityAt'>, now: Date): number {
  const touch = Math.max(new Date(l.createdAt).getTime(), l.lastContactedAt ? new Date(l.lastContactedAt).getTime() : 0, l.lastActivityAt ? new Date(l.lastActivityAt).getTime() : 0);
  return Math.max(0, Math.floor((now.getTime() - touch) / DAY));
}

/** Show the cold badge: the SQL said stale, and it is at least QUIET_AFTER_DAYS. */
export function coldLabel(l: Pick<LeadView, 'createdAt' | 'lastContactedAt' | 'lastActivityAt' | 'flags'>, now: Date): string | null {
  if (!l.flags.stale) return null;
  const d = coldDays(l, now);
  return d >= QUIET_AFTER_DAYS ? `${d}d cold` : null;
}

/** Arrived today (India), for the "Today" pill. */
export const isNewToday = (createdAt: Date, now: Date): boolean => istDay(new Date(createdAt)) === istDay(now);

/** ₹ in lakhs and crores, as AxLeads writes them: ₹15L, ₹1.2Cr, ₹80K. */
export function inr(paise: number | null): string | null {
  if (paise === null) return null;
  const n = Math.round(paise / 100);
  if (n >= 10_000_000) return `₹${(n / 10_000_000).toFixed(n % 10_000_000 ? 1 : 0)}Cr`;
  if (n >= 100_000) return `₹${(n / 100_000).toFixed(n % 100_000 ? 1 : 0)}L`;
  if (n >= 1000) return `₹${Math.round(n / 1000)}K`;
  return `₹${n}`;
}

/** "2BHK" from "2 BHK", "2bhk"; anything else as written. */
export function bhk(config: string | null): string | null {
  const s = config?.trim();
  if (!s) return null;
  return /^\d\s*bhk/i.test(s) ? s.toUpperCase().replace(/\s+/g, '') : s;
}

/** The card's second line: "2BHK · ₹15L" (only the parts there are). */
export function cardFacts(l: Pick<LeadView, 'config' | 'budgetPaise'>): string {
  return [bhk(l.config), inr(l.budgetPaise)].filter(Boolean).join(' · ');
}

/** Initials for the avatar: two letters, or null for an unnamed lead. */
export function initials(name: string | null): string | null {
  const words = (name ?? '').replace(/^Sample — /, '').trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return null;
  return words
    .slice(0, 2)
    .map((w) => w[0]!)
    .join('')
    .toUpperCase();
}

const AVATAR = ['#1f6f54', '#2f6f9f', '#8a6220', '#7a4fa0', '#a04848', '#3d7d7d', '#5b6b2f', '#6b5a8a'];
/** A stable colour per name, from our palette. */
export function avatarColour(name: string): string {
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return AVATAR[h % AVATAR.length]!;
}

/** "just now", "5m ago", "3h ago", "2d ago", then "12 Oct". */
export function relTime(at: Date | null, now: Date): string {
  if (!at) return '';
  const mins = Math.round((now.getTime() - new Date(at).getTime()) / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return dayLabel(new Date(at));
}

/** "12 Oct" in India. */
export function dayLabel(at: Date): string {
  const d = new Date(`${istDay(new Date(at))}T00:00:00Z`);
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
}

export function sourceLabel(l: Pick<LeadView, 'source' | 'sourceName'>): string {
  return l.sourceName ?? SOURCE_LABELS[l.source];
}

// ── The list's three swappable columns ─────────────────────────────

export interface ColumnChoice {
  value: string;
  label: string;
}

/** AxLeads' column picker: these, then every custom field (`cf:<key>`). */
export const BASE_COLUMNS: readonly ColumnChoice[] = [
  { value: 'timeline', label: 'Timeline' },
  { value: 'notes', label: 'Notes' },
  { value: 'lastactive', label: 'Last active' },
  { value: 'created', label: 'Created' },
  { value: 'city', label: 'City' },
  { value: 'locality', label: 'Locality' },
  { value: 'source', label: 'Source' },
];

export const DEFAULT_COLUMNS: readonly [string, string, string] = ['timeline', 'notes', 'lastactive'];

export function columnChoices(fields: readonly { key: string; label: string }[]): ColumnChoice[] {
  return [...BASE_COLUMNS, ...fields.map((f) => ({ value: `cf:${f.key}`, label: f.label }))];
}

/** A remembered column choice, if it is still one on offer; else the default. */
export function readColumns(raw: unknown, choices: readonly ColumnChoice[]): [string, string, string] {
  const ok = new Set(choices.map((c) => c.value));
  const arr = Array.isArray(raw) ? raw : [];
  return [0, 1, 2].map((i) => (typeof arr[i] === 'string' && ok.has(arr[i]) ? arr[i] : DEFAULT_COLUMNS[i]!)) as [string, string, string];
}

/** The lead's timeline (when they want it done): a field named like timeline, possession, move or when. */
export function leadTimeline(fields: Record<string, string>): string | null {
  for (const [k, v] of Object.entries(fields)) {
    if (/timeline|possession|move|when/i.test(k) && String(v ?? '').trim()) return String(v);
  }
  return null;
}

/** A plain-text column value (not Notes, which draws its own). */
export function columnValue(l: LeadView, field: string, now: Date): string | null {
  switch (field) {
    case 'timeline':
      return leadTimeline(l.fields);
    case 'lastactive':
      return relTime(l.lastActivityAt ?? l.updatedAt ?? l.createdAt, now) || null;
    case 'created':
      return dayLabel(l.createdAt);
    case 'city':
      return l.city;
    case 'locality':
      return l.locality;
    case 'source':
      return sourceLabel(l);
    default:
      if (field.startsWith('cf:')) {
        const v = l.fields[field.slice(3)];
        return v === undefined || v === '' ? null : String(v);
      }
      return null;
  }
}
