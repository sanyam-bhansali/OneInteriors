/**
 * The daily site log's rules (studio workspace Phase 2). Pure — no database,
 * no session — so tests/site-log.test.ts can pin them, and so the site
 * screens (client) and site-log.ts (server) read the same ones.
 *
 * - One UPDATE or NOBODY per project per IST day (the partial unique index
 *   `home_site_logs_one_per_day_key`). A second post that day is a
 *   CORRECTION shown beside the first, never an edit: site logs are
 *   append-only (tests/append-only.test.ts).
 * - The day is the IST day of `postedAt`, the moment the supervisor pressed
 *   Post on the phone — so a post saved offline and sent the next morning is
 *   still yesterday's update, not a late one.
 * - `clientRef` is the phone's id for one post: an offline queue that sends
 *   twice lands once.
 * - Nobody on site needs a reason. Waiting for the customer's decision and
 *   the customer asking us not to come do not count against the studio.
 */

import { istDay } from './working-days';

export type NobodyReasonName = 'WAITING_MATERIAL' | 'WAITING_CUSTOMER_DECISION' | 'CREW_ELSEWHERE' | 'HOLIDAY' | 'CUSTOMER_ASKED' | 'OTHER';

export const NOBODY_REASONS: readonly NobodyReasonName[] = [
  'WAITING_MATERIAL',
  'WAITING_CUSTOMER_DECISION',
  'CREW_ELSEWHERE',
  'HOLIDAY',
  'CUSTOMER_ASKED',
  'OTHER',
];

/** Whether a nobody-on-site day with this reason counts in the studio's delay. */
export function countsAgainstStudio(reason: NobodyReasonName): boolean {
  return reason !== 'WAITING_CUSTOMER_DECISION' && reason !== 'CUSTOMER_ASKED';
}

export const isNobodyReason = (v: unknown): v is NobodyReasonName => typeof v === 'string' && (NOBODY_REASONS as readonly string[]).includes(v);

/** The reason as the wire and the apps name it: 'waiting-material'. */
export const reasonSlug = (r: NobodyReasonName): string => r.toLowerCase().replace(/_/g, '-');

/** Plain English, for the website and the office (the phone apps translate the slug). */
export const REASON_WORDS: Record<NobodyReasonName, string> = {
  WAITING_MATERIAL: 'Waiting for material',
  WAITING_CUSTOMER_DECISION: 'Waiting for your decision',
  CREW_ELSEWHERE: 'The crew was on another job',
  HOLIDAY: 'Holiday',
  CUSTOMER_ASKED: 'You asked the studio not to come',
  OTHER: 'Another reason',
};

/** The same, as the studio reads it in the office. */
export const REASON_WORDS_STUDIO: Record<NobodyReasonName, string> = {
  WAITING_MATERIAL: 'Waiting for material',
  WAITING_CUSTOMER_DECISION: 'Waiting for customer decision',
  CREW_ELSEWHERE: 'Crew on another job',
  HOLIDAY: 'Holiday',
  CUSTOMER_ASKED: 'Customer asked us not to come',
  OTHER: 'Other',
};

export const MAX_PHOTOS = 12;
export const MAX_CREW = 30;
export const MAX_TICKS = 200;
export const MAX_TEXT = 2000;
export const MAX_SENTENCE = 280;
/** How old an offline post may be when it finally arrives. */
export const MAX_AGE_DAYS = 30;
/** A phone's clock may run a little fast. */
const CLOCK_SLACK_MS = 10 * 60_000;

export type SpeechLangName = 'en' | 'hi' | 'mr';

export interface SpokenInput {
  voicePath: string | null;
  transcript: string | null;
  transcriptLang: SpeechLangName | null;
  customerText: string | null;
  customerLang: SpeechLangName | null;
}

export interface PhotoInput extends SpokenInput {
  path: string;
  takenAt: Date;
  fromGallery: boolean;
  lat: number | null;
  lng: number | null;
}

export type CrewInput =
  | { crewMemberId: string; arrivedAt: Date | null }
  | { crewMemberId: null; name: string; role: string; arrivedAt: Date | null; save: boolean };

export interface TickInput {
  itemId: string;
  source: 'TICK' | 'VOICE';
}

export interface PostInput {
  projectId: string;
  clientRef: string;
  kind: 'UPDATE' | 'NOBODY';
  postedAt: Date;
  reason: NobodyReasonName | null;
  photos: PhotoInput[];
  /** "Say something else": the note not about any one photo. */
  voice: SpokenInput | null;
  crew: CrewInput[];
  ticks: TickInput[];
}

export type ParseError = 'invalid' | 'too_old' | 'in_future' | 'empty' | 'bad_path' | 'no_reason';

const ID_RE = /^[A-Za-z0-9_-]{1,64}$/;
const REF_RE = /^[A-Za-z0-9_-]{8,64}$/;

const obj = (v: unknown): Record<string, unknown> | null => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null);
const str = (v: unknown, max: number): string | null => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null);
const date = (v: unknown): Date | null => {
  if (typeof v !== 'string' && typeof v !== 'number') return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
};
const lang = (v: unknown): SpeechLangName | null => (v === 'en' || v === 'hi' || v === 'mr' ? v : null);
const coord = (v: unknown, limit: number): number | null => (typeof v === 'number' && Number.isFinite(v) && Math.abs(v) <= limit ? v : null);

/** Storage paths a post may name: this project's own photo or voice prefix (`unstored` = local development with no storage). */
export function ownsPath(projectId: string, path: string, kind: 'site' | 'voice', unstored = false): boolean {
  if (!/^[A-Za-z0-9_./-]{1,200}$/.test(path) || path.includes('..')) return false;
  if (unstored && path.startsWith(`dev-unstored/${kind}/`)) return true;
  return path.startsWith(`project_${projectId}/${kind}/`);
}

/** Where a new upload goes: `project_<id>/site/<uuid>.jpg` or `project_<id>/voice/<uuid>.webm`. */
export function uploadPath(projectId: string, kind: 'site' | 'voice', uuid: string, ext: string): string {
  return `project_${projectId}/${kind}/${uuid}.${ext}`;
}

function spoken(o: Record<string, unknown>, projectId: string, unstored: boolean): SpokenInput | 'bad_path' {
  const voicePath = str(o.voicePath, 200);
  if (voicePath && !ownsPath(projectId, voicePath, 'voice', unstored)) return 'bad_path';
  const customerText = str(o.customerText, MAX_SENTENCE);
  return {
    voicePath,
    transcript: str(o.transcript, MAX_TEXT),
    transcriptLang: lang(o.transcriptLang),
    customerText,
    customerLang: customerText ? lang(o.customerLang) : null,
  };
}

/**
 * The phone's post, checked. Everything the client sends is re-read here
 * field by field; nothing is trusted for its shape.
 */
export function parsePost(raw: unknown, now: Date, opts: { unstored?: boolean } = {}): { ok: true; input: PostInput } | { ok: false; error: ParseError } {
  const o = obj(raw);
  if (!o) return { ok: false, error: 'invalid' };
  const projectId = typeof o.projectId === 'string' && ID_RE.test(o.projectId) ? o.projectId : null;
  const clientRef = typeof o.clientRef === 'string' && REF_RE.test(o.clientRef) ? o.clientRef : null;
  const kind = o.kind === 'UPDATE' || o.kind === 'NOBODY' ? o.kind : null;
  const postedAt = date(o.postedAt);
  if (!projectId || !clientRef || !kind || !postedAt) return { ok: false, error: 'invalid' };
  if (postedAt.getTime() > now.getTime() + CLOCK_SLACK_MS) return { ok: false, error: 'in_future' };
  if (postedAt.getTime() < now.getTime() - MAX_AGE_DAYS * 86_400_000) return { ok: false, error: 'too_old' };
  const unstored = opts.unstored === true;

  if (kind === 'NOBODY') {
    if (!isNobodyReason(o.reason)) return { ok: false, error: 'no_reason' };
    return { ok: true, input: { projectId, clientRef, kind, postedAt, reason: o.reason, photos: [], voice: null, crew: [], ticks: [] } };
  }

  const photos: PhotoInput[] = [];
  for (const p of Array.isArray(o.photos) ? o.photos.slice(0, MAX_PHOTOS) : []) {
    const r = obj(p);
    const path = r ? str(r.path, 200) : null;
    if (!r || !path) return { ok: false, error: 'invalid' };
    if (!ownsPath(projectId, path, 'site', unstored)) return { ok: false, error: 'bad_path' };
    const said = spoken(r, projectId, unstored);
    if (said === 'bad_path') return { ok: false, error: 'bad_path' };
    let takenAt = date(r.takenAt) ?? postedAt;
    // A photo cannot be taken after the post, nor (believably) weeks before it.
    if (takenAt.getTime() > postedAt.getTime() + CLOCK_SLACK_MS || takenAt.getTime() < postedAt.getTime() - MAX_AGE_DAYS * 86_400_000) takenAt = postedAt;
    const lat = coord(r.lat, 90);
    const lng = coord(r.lng, 180);
    photos.push({ path, takenAt, fromGallery: r.fromGallery === true, lat: lat !== null && lng !== null ? lat : null, lng: lat !== null && lng !== null ? lng : null, ...said });
  }

  let voice: SpokenInput | null = null;
  const v = obj(o.voice);
  if (v) {
    const said = spoken(v, projectId, unstored);
    if (said === 'bad_path') return { ok: false, error: 'bad_path' };
    voice = said.voicePath || said.customerText ? said : null;
  }

  const crew: CrewInput[] = [];
  const seen = new Set<string>();
  for (const c of Array.isArray(o.crew) ? o.crew.slice(0, MAX_CREW) : []) {
    const r = obj(c);
    if (!r) continue;
    const arrivedAt = date(r.arrivedAt);
    if (typeof r.crewMemberId === 'string' && ID_RE.test(r.crewMemberId)) {
      if (seen.has(r.crewMemberId)) continue;
      seen.add(r.crewMemberId);
      crew.push({ crewMemberId: r.crewMemberId, arrivedAt });
      continue;
    }
    const name = str(r.name, 60);
    if (!name) continue;
    crew.push({ crewMemberId: null, name, role: str(r.role, 40) ?? 'Crew', arrivedAt, save: r.save === true });
  }

  const ticks: TickInput[] = [];
  const ticked = new Set<string>();
  for (const t of Array.isArray(o.ticks) ? o.ticks.slice(0, MAX_TICKS) : []) {
    const r = obj(t);
    if (!r || typeof r.itemId !== 'string' || !ID_RE.test(r.itemId) || ticked.has(r.itemId)) continue;
    ticked.add(r.itemId);
    ticks.push({ itemId: r.itemId, source: r.source === 'VOICE' ? 'VOICE' : 'TICK' });
  }

  if (photos.length === 0 && !voice && ticks.length === 0) return { ok: false, error: 'empty' };
  return { ok: true, input: { projectId, clientRef, kind, postedAt, reason: null, photos, voice, crew, ticks } };
}

/** The IST day a post is for. */
export const postDay = (postedAt: Date): string => istDay(postedAt);

/**
 * What kind of row a post becomes: the day's first UPDATE/NOBODY, or a
 * CORRECTION of it when the day already has one.
 */
export function logKind(requested: 'UPDATE' | 'NOBODY', original: { id: string } | null): { kind: 'UPDATE' | 'NOBODY' | 'CORRECTION'; correctsId: string | null } {
  return original ? { kind: 'CORRECTION', correctsId: original.id } : { kind: requested, correctsId: null };
}

/** A crew member's first name only: all of them the customer ever sees. */
export const crewFirstName = (name: string): string => name.trim().split(/\s+/)[0] ?? '';
