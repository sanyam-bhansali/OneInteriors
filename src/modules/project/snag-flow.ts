import 'server-only';

/**
 * Snags, written (STUDIO-WORKSPACE-BUILD.md Phase 4; PHASES-2-5-FOUNDATION.md
 * §5 "Phase 4"). Every step is one transaction:
 *
 * 1. the `HomeSnagEvent` row (append-only — never updated or deleted),
 * 2. one `HomeProjectEvent` through `recordEventOnce` (`snag.*`), whose
 *    dedupe key is "this snag, moving on from this event": two taps racing
 *    on the same state write one step, never two,
 * 3. the legacy `HomeSnag` columns kept in step for the readers that still
 *    use them — `status` `'FIXED'` for fixed or closed, `'OPEN'` otherwise
 *    (never any other value), `fixBy`, `assigneeId`, and on a fix `fixedAt`,
 *    `fixedNote` (the customer's sentence) and `fixedPhotoPaths`.
 *
 * Whether a step may happen is `snag-status.ts canWrite`, against the
 * events read inside the transaction. The rules that matter:
 *
 * - **A snag cannot close on the studio's tap.** The studio's FIXED waits
 *   for the customer: CONFIRMED (or REOPENED — "not fixed"), or seven days
 *   with no answer, after which the cron writes AUTO_CLOSED and tells them.
 * - **Mark fixed needs the after photo.** No photo, no FIXED row.
 * - The customer's answers are the owner's (the person whose brief it is);
 *   family can see, not close.
 * - Studio steps go through `studio/access.ts memberOnProject` with the
 *   brief's actions: `snag.accept` (accept, fix-by, assign, dispute, raise,
 *   the handover walk-through) and `snag.fix` (after photo, mark fixed).
 *   Ops may do any of them.
 *
 * Customer-visible words: `note` (dispute reason, "not fixed" reason) and
 * `customerText` (the fix sentence). Never shown to the customer:
 * `internalNote` (the PM's note to the fixer), `voicePath`, `transcript`,
 * `assigneeId` (who on the crew).
 */

import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { getCurrentUser, hasRole } from '@/modules/auth/session';
import { memberOnProject } from '@/modules/studio/access';
import type { StudioAction } from '@/modules/studio/roles';
import { storeSitePhoto } from '@/modules/storage/site-photos';
import { notify, notifyStudio } from '@/modules/notify/service';
import { checkSnag, SNAG_LIMITS } from '@/modules/portal/snags';
import { dedupeKey, recordEvent, recordEventOnce, SNAG_EVENT_TYPE, type ProjectActor } from './events';
import { addDays, dayFromDb, isDay, istDay } from './working-days';
import { applyPhaseEvent } from './lifecycle';
import { effectivePhase, isPhase } from './lifecycle-rules';
import { asSpeechLang, listen } from '@/modules/speech';
import { ownsPath } from './site-log-rules';
import { readVoice, unstoredAllowed } from './site-log-storage';
import { canWrite, eventsOrLegacy, legacySnagStatus, openSnagCount, snagStatus, type SnagEventKind, type SnagEventLike } from './snag-status';

export type SnagResult = { ok: true; id: string } | { ok: false; error: string };

export const SNAG_FLOW_LIMITS = {
  reason: 300,
  internalNote: 300,
  sentence: 300,
  transcript: 2_000,
  /** The handover walk-through: one sitting, one list. */
  bulk: 40,
  /** How far ahead a fix-by date may be set. */
  fixByDays: 120,
} as const;

export const SNAG_ERRORS = {
  gone: 'That snag is gone.',
  notYours: 'That snag is not on your project.',
  ownerOnly: 'Only the person whose home it is can answer this.',
  raced: 'Someone just changed this snag. Refresh to see the latest.',
  needsAfter: 'Take the after photo first. The customer sees it beside theirs.',
  needsPhoto: 'Add a photo of the problem.',
  warrantyOver: 'Your warranty has ended, so new snags cannot be raised here. Call your studio.',
  fixBy: 'Pick the date it will be fixed by.',
  fixByPast: 'The fix-by date cannot be in the past.',
  fixByFar: 'Pick a date within the next four months.',
  assignee: 'Pick who on your team will fix it.',
  reason: 'Say why, in a few words. The customer reads this.',
  notNow: {
    ACCEPTED: 'This snag is already closed.',
    DISPUTED: 'This snag can no longer be disputed.',
    FIXED: 'This snag is not waiting for a fix.',
    CONFIRMED: 'There is no fix to confirm yet.',
    REOPENED: 'There is no fix to answer yet.',
    AUTO_CLOSED: 'Not due yet.',
    RAISED: 'Already raised.',
  } satisfies Record<SnagEventKind, string>,
  /** Seven days after a fix, the customer can no longer answer it. */
  closed: 'This snag has closed. Raise a new one if something is still wrong.',
} as const;

const clean = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().replace(/\s+/g, ' ').slice(0, max) : '');

/** `User.locale` ("en-IN", "hi-IN", "mr") → the app's language code. */
export function langOf(locale: string | null | undefined): 'en' | 'hi' | 'mr' {
  const l = (locale ?? '').toLowerCase();
  return l.startsWith('hi') ? 'hi' : l.startsWith('mr') ? 'mr' : 'en';
}

/** A refusal inside the transaction: rolls it back and becomes the error the person reads. */
class Refused extends Error {
  constructor(readonly reason: string) {
    super(reason);
    this.name = 'Refused';
  }
}

// ── Who is acting ──────────────────────────────────────────────

type Staff =
  | { ok: true; userId: string; actor: ProjectActor; studioId: string; customerId: string | null; customerLocale: string | null }
  | { ok: false; error: string };

const PROJECT_PEOPLE = {
  introduction: { select: { studioId: true, brief: { select: { userId: true, user: { select: { locale: true } } } } } },
} satisfies Prisma.HomeProjectSelect;

/** The signed-in studio member (with `action` on this project) or ops. */
async function staffOn(projectId: string, action: StudioAction): Promise<Staff> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: 'Sign in first.' };
  const project = await prisma.homeProject.findUnique({ where: { id: projectId }, select: PROJECT_PEOPLE });
  if (!project) return { ok: false, error: 'That project is gone.' };
  const intro = project.introduction;
  const base = {
    userId: user.id,
    studioId: intro.studioId,
    customerId: intro.brief.userId ?? null,
    customerLocale: intro.brief.user?.locale ?? null,
  };
  if (hasRole(user, 'OPS')) return { ok: true, ...base, actor: { type: 'OPS', id: user.id } };
  const check = await memberOnProject(projectId, action);
  if (!check.ok) return check;
  return { ok: true, ...base, actor: { type: 'STUDIO', id: user.id } };
}

const SNAG_FOR_WRITE = {
  id: true,
  projectId: true,
  title: true,
  room: true,
  status: true,
  createdAt: true,
  fixBy: true,
  fixedAt: true,
  fixedNote: true,
  fixedPhotoPaths: true,
  photoPaths: true,
  assigneeId: true,
  raisedByStudio: true,
} satisfies Prisma.HomeSnagSelect;

const EVENT_FOR_RULES = { id: true, kind: true, at: true, fixBy: true, assigneeId: true, photoPaths: true, customerText: true, note: true } satisfies Prisma.HomeSnagEventSelect;

type SnagRow = Prisma.HomeSnagGetPayload<{ select: typeof SNAG_FOR_WRITE }>;

async function snagById(snagId: string): Promise<SnagRow | null> {
  if (!snagId) return null;
  return prisma.homeSnag.findUnique({ where: { id: snagId.slice(0, 64) }, select: SNAG_FOR_WRITE });
}

// ── The one writer ─────────────────────────────────────────────

interface Step {
  kind: Exclude<SnagEventKind, 'RAISED'>;
  actor: ProjectActor;
  /** HomeSnagEvent columns beyond kind/actor/by. */
  event?: Omit<Prisma.HomeSnagEventUncheckedCreateInput, 'snagId' | 'kind' | 'actorType' | 'byId'>;
  /** Legacy HomeSnag columns to keep in step (status is set here, from the new state). */
  legacy?: Prisma.HomeSnagUncheckedUpdateInput;
  /** Bookkeeping for the project event (no notes, no transcripts). */
  payload?: Record<string, string | number | boolean | null>;
  at?: Date;
}

/**
 * Append one step to a snag, inside one transaction, if the rules allow it
 * from the state the events are in right now. Returns the new state.
 */
async function step(snagId: string, s: Step, now: Date): Promise<{ ok: true; state: ReturnType<typeof snagStatus>['state'] } | { ok: false; error: string }> {
  try {
    const state = await prisma.$transaction(async (tx) => {
      const snag = await tx.homeSnag.findUnique({ where: { id: snagId }, select: { ...SNAG_FOR_WRITE, events: { select: EVENT_FOR_RULES } } });
      if (!snag) throw new Refused(SNAG_ERRORS.gone);
      const events: SnagEventLike[] = [...eventsOrLegacy(snag.events, snag)];
      if (snag.events.length === 0) {
        /* A snag written by the old code after the migration ran (so the
           backfill missed it): write its history the way the backfill did,
           so the step below has a RAISED to follow. */
        for (const e of events) {
          await tx.homeSnagEvent.create({
            data: {
              snagId: snag.id,
              kind: e.kind as SnagEventKind,
              at: e.at,
              photoPaths: e.photoPaths ?? [],
              fixBy: e.fixBy ?? null,
              customerText: e.customerText ?? null,
              actorType: snag.raisedByStudio || e.kind !== 'RAISED' ? 'STUDIO' : 'CUSTOMER',
              byId: null,
            },
            select: { id: true },
          });
        }
      }
      if (!canWrite(events, s.kind, now)) {
        const written = snagStatus(events, now);
        throw new Refused(written.state === 'closed' ? SNAG_ERRORS.closed : SNAG_ERRORS.notNow[s.kind]);
      }
      const last = snagStatus(events).last;
      // Moving on from this exact event happens once: a racing second tap finds the key taken.
      const fresh = await recordEventOnce(tx, {
        projectId: snag.projectId,
        type: SNAG_EVENT_TYPE[s.kind],
        actor: s.actor,
        refId: snag.id,
        payload: { kind: s.kind, ...(s.payload ?? {}) },
        dedupeKey: dedupeKey('snag', snag.id, last?.id ?? 'legacy'),
        ...(s.at ? { at: s.at } : {}),
      });
      if (!fresh) throw new Refused(SNAG_ERRORS.raced);
      /* Never before the step it follows: the status is read in time order,
         and the database's clock (RAISED's default) and this server's may differ. */
      const wanted = s.at ?? now;
      const at = last && wanted.getTime() <= last.at.getTime() ? new Date(last.at.getTime() + 1) : wanted;
      const row = { ...(s.event ?? {}), kind: s.kind, at };
      await tx.homeSnagEvent.create({
        data: { ...row, snagId: snag.id, actorType: s.actor.type, byId: s.actor.type === 'SYSTEM' ? null : s.actor.id },
        select: { id: true },
      });
      const next = snagStatus([...events, { ...row, id: 'new' } as SnagEventLike], now).state;
      await tx.homeSnag.update({ where: { id: snag.id }, data: { ...(s.legacy ?? {}), status: legacySnagStatus(next) }, select: { id: true } });
      return next;
    });
    return { ok: true, state };
  } catch (error) {
    if (error instanceof Refused) return { ok: false, error: error.reason };
    throw error;
  }
}

async function storePhotos(projectId: string, photos: File[]): Promise<{ ok: true; paths: string[] } | { ok: false; error: string }> {
  const files = photos.filter((f) => f && f.size > 0);
  if (files.length > SNAG_LIMITS.photos) return { ok: false, error: `At most ${SNAG_LIMITS.photos} photos.` };
  const paths: string[] = [];
  for (const f of files) {
    const stored = await storeSitePhoto(projectId, f);
    if (!stored.ok) return { ok: false, error: stored.error };
    paths.push(stored.path);
  }
  return { ok: true, paths };
}

/** A new snag and its RAISED event, in one transaction. */
async function createSnag(
  tx: Prisma.TransactionClient,
  input: { projectId: string; title: string; room: string | null; note: string | null; photoPaths: string[]; raisedById: string; byStudio: boolean; actor: ProjectActor; walkThrough?: boolean; warranty?: boolean },
): Promise<string> {
  const snag = await tx.homeSnag.create({
    data: {
      projectId: input.projectId,
      title: input.title,
      room: input.room,
      note: input.note,
      photoPaths: input.photoPaths,
      raisedById: input.raisedById,
      raisedByStudio: input.byStudio,
      status: 'OPEN',
      warranty: input.warranty === true,
    },
    select: { id: true },
  });
  await tx.homeSnagEvent.create({
    data: { snagId: snag.id, kind: 'RAISED', at: new Date(), photoPaths: input.photoPaths, actorType: input.actor.type, byId: input.raisedById },
    select: { id: true },
  });
  await recordEvent(tx, {
    projectId: input.projectId,
    type: 'snag.raised',
    actor: input.actor,
    refId: snag.id,
    payload: { photos: input.photoPaths.length, byStudio: input.byStudio, ...(input.walkThrough ? { walkThrough: true } : {}), ...(input.warranty ? { warranty: true } : {}) },
  });
  return snag.id;
}

// ── The customer ───────────────────────────────────────────────

/**
 * The customer (the owner of the brief, as before) raises a snag: a photo,
 * a line, the room. The studio hears about it.
 */
export async function raiseSnagAsCustomer(
  userId: string,
  projectId: string,
  input: { title: unknown; room?: unknown; note?: unknown },
  photos: File[] = [],
): Promise<SnagResult> {
  const project = await prisma.homeProject.findUnique({
    where: { id: projectId },
    select: { phase: true, warrantyEndsOn: true, introduction: { select: { studioId: true, brief: { select: { userId: true } } } } },
  });
  if (!project || project.introduction.brief.userId !== userId) return { ok: false, error: 'That project is not yours.' };
  /* The project lifecycle (owner, 13 Oct 2026): after the handover sign-off a snag is a warranty snag; after the warranty, none. */
  const phase = isPhase(project.phase) ? effectivePhase(project.phase, project.warrantyEndsOn ? dayFromDb(project.warrantyEndsOn) : null, new Date()) : 'DESIGN';
  if (phase === 'CLOSED') return { ok: false, error: SNAG_ERRORS.warrantyOver };
  const check = checkSnag(input);
  if (!check.ok) return check;
  if (!photos.some((f) => f && f.size > 0)) return { ok: false, error: SNAG_ERRORS.needsPhoto };
  const stored = await storePhotos(projectId, photos);
  if (!stored.ok) return stored;
  const id = await prisma.$transaction((tx) =>
    createSnag(tx, { projectId, ...check.value, photoPaths: stored.paths, raisedById: userId, byStudio: false, actor: { type: 'CUSTOMER', id: userId }, warranty: phase === 'WARRANTY' }),
  );
  void notifyStudio(project.introduction.studioId, { kind: 'snag-raised', snagId: id, title: check.value.title, room: check.value.room });
  return { ok: true, id };
}

/** The snag, if `userId` is the owner of the brief it is on. */
async function ownersSnag(userId: string, snagId: string): Promise<{ ok: true; snag: SnagRow; studioId: string } | { ok: false; error: string }> {
  const snag = await snagById(snagId);
  if (!snag) return { ok: false, error: SNAG_ERRORS.gone };
  const project = await prisma.homeProject.findUnique({
    where: { id: snag.projectId },
    select: {
      introduction: { select: { studioId: true, brief: { select: { userId: true } } } },
      family: { where: { userId, joinedAt: { not: null }, removedAt: null }, select: { userId: true } },
    },
  });
  if (!project) return { ok: false, error: SNAG_ERRORS.gone };
  if (project.introduction.brief.userId !== userId) {
    return { ok: false, error: project.family.length > 0 ? SNAG_ERRORS.ownerOnly : SNAG_ERRORS.notYours };
  }
  return { ok: true, snag, studioId: project.introduction.studioId };
}

/** The customer confirms the fix (or agrees with the studio's dispute). The snag closes. */
export async function confirmSnag(userId: string, snagId: string, now = new Date()): Promise<SnagResult> {
  const mine = await ownersSnag(userId, snagId);
  if (!mine.ok) return mine;
  const r = await step(mine.snag.id, { kind: 'CONFIRMED', actor: { type: 'CUSTOMER', id: userId } }, now);
  return r.ok ? { ok: true, id: mine.snag.id } : r;
}

/** The customer says it is not fixed, with an optional line. It goes back to the studio. */
export async function reportNotFixed(userId: string, snagId: string, reason: unknown, now = new Date()): Promise<SnagResult> {
  const mine = await ownersSnag(userId, snagId);
  if (!mine.ok) return mine;
  const note = clean(reason, SNAG_FLOW_LIMITS.reason) || null;
  const r = await step(
    mine.snag.id,
    { kind: 'REOPENED', actor: { type: 'CUSTOMER', id: userId }, event: { note }, legacy: {} },
    now,
  );
  if (!r.ok) return r;
  void notifyStudio(mine.studioId, { kind: 'snag-not-fixed', snagId: mine.snag.id, projectId: mine.snag.projectId, title: mine.snag.title });
  const assignee = mine.snag.assigneeId
    ? await prisma.studioMember.findUnique({ where: { id: mine.snag.assigneeId }, select: { userId: true, role: true, status: true } })
    : null;
  // The office hears through notifyStudio; a supervisor fixing it hears directly.
  if (assignee && assignee.status === 'ACTIVE' && assignee.role === 'SUPERVISOR') {
    void notify(assignee.userId, { kind: 'snag-not-fixed', snagId: mine.snag.id, projectId: mine.snag.projectId, title: mine.snag.title, site: true }, { email: false });
  }
  return { ok: true, id: mine.snag.id };
}

// ── The studio ─────────────────────────────────────────────────

/** A snag the studio found itself, with photos. */
export async function raiseSnagAsStudio(
  projectId: string,
  input: { title: unknown; room?: unknown; note?: unknown },
  photos: File[] = [],
): Promise<SnagResult> {
  const staff = await staffOn(projectId, 'snag.accept');
  if (!staff.ok) return staff;
  const check = checkSnag(input);
  if (!check.ok) return check;
  const stored = await storePhotos(projectId, photos);
  if (!stored.ok) return stored;
  const id = await prisma.$transaction((tx) =>
    createSnag(tx, { projectId, ...check.value, photoPaths: stored.paths, raisedById: staff.userId, byStudio: staff.actor.type === 'STUDIO', actor: staff.actor }),
  );
  return { ok: true, id };
}

export type BulkResult = { ok: true; ids: string[] } | { ok: false; error: string };

/**
 * The handover walk-through: the studio walks the flat with the customer and
 * adds everything at once — one line and a room each, no photos needed (the
 * customer is standing there). One transaction: all or none.
 */
export async function raiseHandoverSnags(projectId: string, items: { title: unknown; room?: unknown }[]): Promise<BulkResult> {
  const staff = await staffOn(projectId, 'snag.accept');
  if (!staff.ok) return staff;
  const rows: { title: string; room: string | null }[] = [];
  for (const [i, item] of (Array.isArray(items) ? items : []).entries()) {
    if (!clean(item?.title, SNAG_LIMITS.title) && !clean(item?.room, SNAG_LIMITS.room)) continue; // an empty line
    const check = checkSnag({ title: item?.title, room: item?.room });
    if (!check.ok) return { ok: false, error: `Line ${i + 1}: ${check.error}` };
    rows.push({ title: check.value.title, room: check.value.room });
  }
  if (rows.length === 0) return { ok: false, error: 'Add at least one snag.' };
  if (rows.length > SNAG_FLOW_LIMITS.bulk) return { ok: false, error: `At most ${SNAG_FLOW_LIMITS.bulk} at a time.` };
  const ids = await prisma.$transaction(async (tx) => {
    const out: string[] = [];
    for (const r of rows) {
      out.push(
        await createSnag(tx, {
          projectId,
          title: r.title,
          room: r.room,
          note: null,
          photoPaths: [],
          raisedById: staff.userId,
          byStudio: staff.actor.type === 'STUDIO',
          actor: staff.actor,
          walkThrough: true,
        }),
      );
    }
    return out;
  });
  return { ok: true, ids };
}

/** "YYYY-MM-DD" → the instant stored (midday UTC, as the legacy column always was). */
const fixByInstant = (day: string) => new Date(`${day}T12:00:00Z`);

export function checkFixBy(day: unknown, now: Date): { ok: true; day: string } | { ok: false; error: string } {
  if (!isDay(day)) return { ok: false, error: SNAG_ERRORS.fixBy };
  const today = istDay(now);
  if (day < today) return { ok: false, error: SNAG_ERRORS.fixByPast };
  if (day > addDays(today, SNAG_FLOW_LIMITS.fixByDays)) return { ok: false, error: SNAG_ERRORS.fixByFar };
  return { ok: true, day };
}

/**
 * Who a snag may be given to: an active owner, or a PM or supervisor on this
 * project. Accounts never fix things.
 */
export async function assigneesFor(projectId: string, studioId: string): Promise<{ id: string; name: string; role: string }[]> {
  const members = await prisma.studioMember.findMany({
    where: {
      studioId,
      status: 'ACTIVE',
      OR: [{ role: 'OWNER' }, { role: { in: ['PM', 'SUPERVISOR'] }, projects: { some: { homeProjectId: projectId } } }],
    },
    select: { id: true, role: true, user: { select: { name: true } } },
    orderBy: { createdAt: 'asc' },
    take: 50,
  });
  return members.map((m) => ({ id: m.id, name: m.user.name ?? 'Team member', role: m.role }));
}

/**
 * The studio accepts: a fix-by date, who will fix it, and an optional note for
 * them that only the team sees. Accepting again moves the date or the person.
 */
export async function acceptSnag(
  snagId: string,
  input: { fixBy: unknown; assigneeId: unknown; internalNote?: unknown },
  now = new Date(),
  /** The older "set fix-by" form (ProjectWork.tsx) has no person picker: keep whoever it is with. */
  opts: { assigneeOptional?: boolean } = {},
): Promise<SnagResult> {
  const snag = await snagById(snagId);
  if (!snag) return { ok: false, error: SNAG_ERRORS.gone };
  const staff = await staffOn(snag.projectId, 'snag.accept');
  if (!staff.ok) return staff;
  const date = checkFixBy(input.fixBy, now);
  if (!date.ok) return date;
  const picked = typeof input.assigneeId === 'string' ? input.assigneeId.slice(0, 64) : '';
  const assigneeId = picked || (opts.assigneeOptional ? snag.assigneeId : null);
  if (picked || !opts.assigneeOptional) {
    const choices = await assigneesFor(snag.projectId, staff.studioId);
    if (!choices.some((c) => c.id === assigneeId)) return { ok: false, error: SNAG_ERRORS.assignee };
  }
  const internalNote = clean(input.internalNote, SNAG_FLOW_LIMITS.internalNote) || null;
  const fixBy = fixByInstant(date.day);
  const r = await step(
    snag.id,
    {
      kind: 'ACCEPTED',
      actor: staff.actor,
      event: { fixBy, assigneeId, internalNote },
      legacy: { fixBy, assigneeId },
      payload: { fixBy: date.day },
    },
    now,
  );
  if (!r.ok) return r;
  if (staff.customerId) void notify(staff.customerId, { kind: 'snag-accepted', snagId: snag.id, title: snag.title, fixByLabel: dayLabel(fixBy) });
  return { ok: true, id: snag.id };
}

/** The studio says it is not a defect, with a reason the customer reads. The snag stays open. */
export async function disputeSnag(snagId: string, reason: unknown, now = new Date()): Promise<SnagResult> {
  const snag = await snagById(snagId);
  if (!snag) return { ok: false, error: SNAG_ERRORS.gone };
  const staff = await staffOn(snag.projectId, 'snag.accept');
  if (!staff.ok) return staff;
  const note = clean(reason, SNAG_FLOW_LIMITS.reason);
  if (note.length < 3) return { ok: false, error: SNAG_ERRORS.reason };
  const r = await step(snag.id, { kind: 'DISPUTED', actor: staff.actor, event: { note } }, now);
  if (!r.ok) return r;
  if (staff.customerId) void notify(staff.customerId, { kind: 'snag-disputed', snagId: snag.id, title: snag.title });
  return { ok: true, id: snag.id };
}

export interface FixInput {
  /** The after photos, from the same spot, as files (the older office form). */
  photos?: File[];
  /**
   * Or as paths already uploaded to this project's `site/` folder through
   * site mode's signed upload (`/api/studio/site/upload`, site-log-storage.ts).
   */
  photoPaths?: string[];
  /** True when the photo came from the phone's gallery, not the camera (recorded; shown to the team). */
  fromGallery?: boolean;
  /**
   * What the fixer said, already heard and turned into the customer's
   * sentence on the phone ("Say what you fixed" → shown → kept). The
   * recording is stored with it so the sentence can be checked against what
   * was said; the customer never hears it.
   */
  voice?: { path: string | null; transcript: string; lang: string | null; customerText: string } | null;
  /** A typed sentence, when they would rather type (never required). */
  text?: string | null;
}

/**
 * Mark fixed: the after photo is required. The snag waits for the customer —
 * it does not close here.
 */
export async function markSnagFixed(snagId: string, input: FixInput, now = new Date()): Promise<SnagResult> {
  const snag = await snagById(snagId);
  if (!snag) return { ok: false, error: SNAG_ERRORS.gone };
  const staff = await staffOn(snag.projectId, 'snag.fix');
  if (!staff.ok) return staff;
  const files = (input.photos ?? []).filter((f) => f && f.size > 0);
  const uploaded = (input.photoPaths ?? []).filter(Boolean).slice(0, SNAG_LIMITS.photos);
  if (files.length === 0 && uploaded.length === 0) return { ok: false, error: SNAG_ERRORS.needsAfter };
  if (uploaded.some((p) => !ownsPath(snag.projectId, p, 'site', unstoredAllowed()))) return { ok: false, error: 'That photo is not from this project.' };
  const voice = input.voice ?? null;
  if (voice?.path && !ownsPath(snag.projectId, voice.path, 'voice', unstoredAllowed())) return { ok: false, error: 'That recording is not from this project.' };
  // Before storing anything: is it waiting for a fix at all?
  const events = await prisma.homeSnagEvent.findMany({ where: { snagId: snag.id }, select: EVENT_FOR_RULES });
  if (!canWrite(eventsOrLegacy(events, snag), 'FIXED', now)) return { ok: false, error: SNAG_ERRORS.notNow.FIXED };
  const stored = files.length ? await storePhotos(snag.projectId, files) : ({ ok: true, paths: uploaded } as const);
  if (!stored.ok) return stored;
  const customerText = clean(voice?.customerText ?? input.text, SNAG_FLOW_LIMITS.sentence) || null;
  const r = await step(
    snag.id,
    {
      kind: 'FIXED',
      actor: staff.actor,
      event: {
        photoPaths: stored.paths,
        voicePath: voice?.path ?? null,
        transcript: voice ? clean(voice.transcript, SNAG_FLOW_LIMITS.transcript) || null : null,
        transcriptLang: voice?.lang?.slice(0, 12) ?? null,
        customerText,
        customerLang: customerText ? langOf(staff.customerLocale) : null,
      },
      legacy: { fixedAt: now, fixedNote: customerText, fixedPhotoPaths: stored.paths },
      payload: { photos: stored.paths.length, voice: Boolean(voice?.path), fromGallery: Boolean(input.fromGallery) },
    },
    now,
  );
  if (!r.ok) return r;
  if (staff.customerId) void notify(staff.customerId, { kind: 'snag-fixed', snagId: snag.id, title: snag.title });
  return { ok: true, id: snag.id };
}

/**
 * "Say what you fixed": what was heard and the sentence the customer will
 * read, shown to the fixer (with Redo) before Mark fixed. Nothing is saved
 * here; the recording was uploaded through site mode's signed upload. Null
 * `heard` when no speech provider is on — they can still mark it fixed.
 */
export async function hearSnagFix(
  snagId: string,
  voicePath: unknown,
  lang: unknown,
): Promise<{ ok: true; heard: { transcript: string; transcriptLang: string; customerText: string; customerLang: string; provider: string } | null } | { ok: false; error: string }> {
  const snag = await snagById(snagId);
  if (!snag) return { ok: false, error: SNAG_ERRORS.gone };
  const staff = await staffOn(snag.projectId, 'snag.fix');
  if (!staff.ok) return staff;
  const path = typeof voicePath === 'string' ? voicePath : '';
  if (!path || !ownsPath(snag.projectId, path, 'voice', unstoredAllowed())) return { ok: false, error: 'That recording is not from this project.' };
  const heard = await listen({
    audio: () => readVoice(path),
    langHint: asSpeechLang(lang),
    customerLang: langOf(staff.customerLocale),
    context: { room: snag.room, stage: null, items: [snag.title] },
    items: [],
  });
  return {
    ok: true,
    heard: heard
      ? { transcript: heard.transcript, transcriptLang: heard.transcriptLang, customerText: heard.customerText, customerLang: heard.customerLang, provider: heard.provider }
      : null,
  };
}

// ── The seven-day close (cron) ─────────────────────────────────

/**
 * Close every fix nobody answered within seven days, and tell the customer.
 * Idempotent: the dedupe key on the project event means a second run (or two
 * at once) writes nothing twice. Reads only snags whose legacy column says
 * FIXED — every fix sets it, and only a REOPENED unsets it.
 */
export async function autoCloseSnags(now = new Date(), limit = 500): Promise<{ closed: number }> {
  const candidates = await prisma.homeSnag.findMany({
    where: { status: 'FIXED', fixedAt: { lte: new Date(now.getTime() - 7 * 86_400_000) } },
    select: {
      ...SNAG_FOR_WRITE,
      events: { select: EVENT_FOR_RULES },
      project: { select: { introduction: { select: { brief: { select: { userId: true } } } } } },
    },
    take: limit,
  });
  let closed = 0;
  for (const snag of candidates) {
    const s = snagStatus(eventsOrLegacy(snag.events, snag), now);
    if (!s.autoCloseDue || !s.fix) continue;
    const dueAt = new Date(s.fix.at.getTime() + 7 * 86_400_000);
    const r = await step(snag.id, { kind: 'AUTO_CLOSED', actor: { type: 'SYSTEM' }, at: dueAt }, now);
    if (!r.ok) continue;
    closed += 1;
    const customer = snag.project.introduction.brief.userId;
    if (customer) await notify(customer, { kind: 'snag-auto-closed', snagId: snag.id, title: snag.title });
  }
  return { closed };
}

// ── The final-payment gate ─────────────────────────────────────

/** Every snag's events on a project, for `snag-status.ts finalPaymentGate` / `hasOpenSnags`. */
export async function snagEventsOn(projectId: string): Promise<SnagEventLike[][]> {
  const snags = await prisma.homeSnag.findMany({
    where: { projectId },
    select: { createdAt: true, status: true, fixBy: true, fixedAt: true, events: { select: EVENT_FOR_RULES } },
    take: 500,
  });
  return snags.map((s) => [...eventsOrLegacy(s.events, s)]);
}

// ── The client signs off the handover (project lifecycle) ─────

/**
 * The client (the owner of the brief) signs off the handover once every
 * snag is closed (owner, 13 Oct 2026: the client signs off, not the
 * designer). Moves the project to WARRANTY, with its end day from the
 * studio's warranty months (lifecycle.ts), in one transaction with the
 * event. A fix still waiting for the client's confirmation counts as open.
 */
export async function signOffHandover(userId: string, projectId: string, now = new Date()): Promise<{ ok: true; warrantyEndsOn: string } | { ok: false; error: string }> {
  const project = await prisma.homeProject.findUnique({
    where: { id: projectId },
    select: { cancelledAt: true, introduction: { select: { studioId: true, brief: { select: { userId: true } } } } },
  });
  if (!project || project.cancelledAt) return { ok: false, error: 'That project is not yours.' };
  if (project.introduction.brief.userId !== userId) return { ok: false, error: SNAG_ERRORS.ownerOnly };
  const actor: ProjectActor = { type: 'CUSTOMER', id: userId };
  const r = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "home_projects" WHERE "id" = ${projectId} FOR UPDATE`;
    const snags = await tx.homeSnag.findMany({
      where: { projectId },
      select: { createdAt: true, status: true, fixBy: true, fixedAt: true, events: { select: EVENT_FOR_RULES } },
      take: 500,
    });
    const openSnags = openSnagCount(snags.map((s) => [...eventsOrLegacy(s.events, s)]), now);
    const m = await applyPhaseEvent(tx, projectId, { kind: 'handover.signed', openSnags }, actor, now);
    if (!m.ok) return m;
    await recordEvent(tx, { projectId, type: 'handover.signed', actor, at: now, payload: { openSnags } });
    const p = await tx.homeProject.findUnique({ where: { id: projectId }, select: { warrantyEndsOn: true } });
    return { ok: true as const, warrantyEndsOn: p?.warrantyEndsOn ? dayFromDb(p.warrantyEndsOn) : istDay(now) };
  });
  // No notice: the studio sees it on the project and the designer's My Snags (phase WARRANTY).
  return r;
}

/** Open snags on a project now (fixes waiting for the customer count as open). */
export async function openSnagsOn(projectId: string, now = new Date()): Promise<number> {
  return openSnagCount(await snagEventsOn(projectId), now);
}

function dayLabel(d: Date): string {
  return d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'Asia/Kolkata' }).replace(',', '');
}
