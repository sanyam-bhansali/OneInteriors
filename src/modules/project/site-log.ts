import 'server-only';

/**
 * The daily site log against the database (studio workspace Phase 2): the
 * supervisor's post and nobody-on-site, what site mode reads, the speech
 * step, and the office's Site log tab. Rules in site-log-rules.ts and
 * reminder-rules.ts (pure, tested).
 *
 * ## Every write
 *
 * - goes through studio/access.ts `memberOnProject(projectId, 'update.post')`
 *   (and `checklist.tick` for ticks): an owner, or a PM or supervisor
 *   assigned to the project. A supervisor cannot post to a site they are
 *   not on (tests/site-log.test.ts);
 * - is one `$transaction`: the `HomeSiteLog` with its photos and crew, the
 *   checklist ticks, and the `HomeProjectEvent`s (`site.posted` /
 *   `site.nobody` / `site.corrected`, `checklist.ticked`);
 * - is append-only: a site log is never updated or deleted. A second post on
 *   the same day becomes a CORRECTION beside the first.
 *
 * ## Offline
 *
 * The phone keeps the post (IndexedDB) and sends it when it has signal,
 * with the `postedAt` of the moment Post was pressed and its own
 * `clientRef`. A resend of the same post finds the row by `clientRef` and
 * answers success; the day stays the day it was taken.
 */

import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { notify } from '@/modules/notify/service';
import { ACCESS_ERRORS, can, currentMember, memberOnProject, projectsVisibleTo, type StudioMemberRef } from '@/modules/studio/access';
import { usesOffice } from '@/modules/studio/surfaces';
import { firstName, homeLabel } from '@/modules/studio/workspace-view';
import { langOfLocale } from '@/modules/i18n/studio';
import { asSpeechLang, listen, type Heard, type SpeechLang, type TickItem } from '@/modules/speech';
import { recordEvent } from './events';
import { addDays, calendarOf, dayFromDb, dayToDb, istDay, isWorkingDay } from './working-days';
import { activeSinceOf, combineScores, missedDays, needsDailyPost, updateScore, type UpdateScore } from './reminder-rules';
import {
  REASON_WORDS,
  logKind,
  ownsPath,
  parsePost,
  postDay,
  type NobodyReasonName,
  type ParseError,
  type PostInput,
  type SpokenInput,
} from './site-log-rules';
import { readVoice, signedPhotoMap, unstoredAllowed } from './site-log-storage';

export type SiteError = ParseError | 'sign_in' | 'not_yours' | 'not_your_role' | 'gone' | 'crew' | 'items' | 'busy';

const ACCESS_CODE: Record<string, SiteError> = {
  [ACCESS_ERRORS.signIn]: 'sign_in',
  [ACCESS_ERRORS.notYours]: 'not_yours',
  [ACCESS_ERRORS.notYourRole]: 'not_your_role',
};

const BRIEF = {
  select: {
    society: true,
    locality: true,
    propertyType: true,
    contactName: true,
    userId: true,
    user: { select: { name: true, locale: true } },
  },
} as const;

type BriefRow = { society: string | null; locality: string | null; propertyType: string | null; contactName: string | null; user: { name: string | null; locale: string } | null };

const customerFirst = (b: BriefRow) => firstName(b.contactName?.trim() || b.user?.name?.trim() || null);
const customerLang = (b: BriefRow): SpeechLang => asSpeechLang(langOfLocale(b.user?.locale));

/* ------------------------------------------------------------------ post */

export interface PostSummary {
  id: string;
  kind: 'UPDATE' | 'NOBODY' | 'CORRECTION';
  day: string;
  photos: number;
  crew: number;
  ticked: number;
  stage: string | null;
  customerFirst: string;
  /** Already there from an earlier send of the same post. */
  duplicate: boolean;
}

export type PostResult = { ok: true; post: PostSummary } | { ok: false; error: SiteError };

const isUnique = (e: unknown): e is Prisma.PrismaClientKnownRequestError =>
  e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002';

async function existing(clientRef: string, projectId: string): Promise<PostSummary | null> {
  const row = await prisma.homeSiteLog.findUnique({
    where: { clientRef },
    select: {
      id: true,
      projectId: true,
      kind: true,
      date: true,
      stage: { select: { name: true } },
      _count: { select: { photos: true, crew: true, ticked: true } },
      project: { select: { introduction: { select: { brief: BRIEF } } } },
    },
  });
  if (!row || row.projectId !== projectId) return null;
  return {
    id: row.id,
    kind: row.kind,
    day: dayFromDb(row.date),
    photos: row._count.photos,
    crew: row._count.crew,
    ticked: row._count.ticked,
    stage: row.stage?.name ?? null,
    customerFirst: customerFirst(row.project.introduction.brief),
    duplicate: true,
  };
}

/** Speech for notes recorded offline: written on arrival (the supervisor could not preview them). */
async function fillSpeech(said: SpokenInput, lang: SpeechLang, items: TickItem[], stage: string | null): Promise<SpokenInput> {
  if (!said.voicePath || said.customerText) return said;
  const path = said.voicePath;
  const heard = await listen({
    audio: () => readVoice(path),
    langHint: asSpeechLang(said.transcriptLang ?? lang),
    customerLang: lang,
    context: { stage, items: items.map((i) => i.label) },
    items,
  });
  if (!heard) return said;
  return { ...said, transcript: said.transcript ?? heard.transcript, transcriptLang: said.transcriptLang ?? heard.transcriptLang, customerText: heard.customerText, customerLang: heard.customerLang };
}

/**
 * Post today's update, or nobody on site, from the phone's queue. Safe to
 * send twice. Answers with what changed, for the confirmation screen.
 */
export async function postSiteLog(raw: unknown, now = new Date()): Promise<PostResult> {
  const parsed = parsePost(raw, now, { unstored: unstoredAllowed() });
  if (!parsed.ok) return parsed;
  const input = parsed.input;

  const check = await memberOnProject(input.projectId, 'update.post');
  if (!check.ok) return { ok: false, error: ACCESS_CODE[check.error] ?? 'not_yours' };
  if (input.ticks.length && !check.access.may('checklist.tick')) return { ok: false, error: 'not_your_role' };

  const again = await existing(input.clientRef, input.projectId);
  if (again) return { ok: true, post: again };

  const project = await prisma.homeProject.findUnique({
    where: { id: input.projectId },
    select: {
      introduction: { select: { brief: BRIEF, studio: { select: { tradeName: true } } } },
      stages: {
        orderBy: { sortOrder: 'asc' },
        select: { id: true, name: true, actualEnd: true, items: { select: { id: true, room: true, label: true, doneAt: true } } },
      },
    },
  });
  if (!project) return { ok: false, error: 'gone' };
  const brief = project.introduction.brief;
  const lang = customerLang(brief);
  const stage = project.stages.find((s) => s.actualEnd === null) ?? null;
  const allItems = new Map(project.stages.flatMap((s) => s.items.map((i) => [i.id, i] as const)));
  if (input.ticks.some((t) => !allItems.has(t.itemId))) return { ok: false, error: 'items' };

  const member = check.member;
  const known = input.crew.filter((c): c is Extract<typeof c, { crewMemberId: string }> => c.crewMemberId !== null);
  const crewRows = known.length
    ? await prisma.studioCrewMember.findMany({ where: { id: { in: known.map((c) => c.crewMemberId) }, studioId: member.studioId }, select: { id: true, name: true, role: true } })
    : [];
  if (crewRows.length !== known.length) return { ok: false, error: 'crew' };
  const crewById = new Map(crewRows.map((c) => [c.id, c]));

  const openItems: TickItem[] = (stage?.items ?? []).filter((i) => i.doneAt === null).map((i) => ({ id: i.id, label: i.label, room: i.room }));
  const photos = await Promise.all(input.photos.map(async (p) => ({ ...p, ...(await fillSpeech(p, lang, openItems, stage?.name ?? null)) })));
  const voice = input.voice ? await fillSpeech(input.voice, lang, openItems, stage?.name ?? null) : null;

  const write = () => writePost(input, { photos, voice, crewById, member, stageId: stage?.id ?? null, now });
  let result: { id: string; kind: PostSummary['kind']; ticked: number };
  try {
    result = await write();
  } catch (e) {
    if (!isUnique(e)) throw e;
    const dup = await existing(input.clientRef, input.projectId);
    if (dup) return { ok: true, post: dup };
    // Another post for the same day landed first: this one becomes its correction.
    try {
      result = await write();
    } catch (e2) {
      if (isUnique(e2)) return { ok: false, error: 'busy' };
      throw e2;
    }
  }

  const userId = brief.userId;
  if (userId) {
    const first = photos.find((p) => p.customerText)?.customerText ?? voice?.customerText ?? null;
    const note =
      input.kind === 'NOBODY' && input.reason
        ? `Nobody on site today: ${REASON_WORDS[input.reason].toLowerCase()}.`
        : (first ?? (photos.length ? 'New photos from site.' : 'Work from site, ticked off.'));
    void notify(userId, {
      kind: 'update',
      studio: project.introduction.studio.tradeName,
      note: result.kind === 'CORRECTION' ? `Added to today's update: ${note}` : note,
      photos: photos.length,
    });
  }

  return {
    ok: true,
    post: {
      id: result.id,
      kind: result.kind,
      day: postDay(input.postedAt),
      photos: photos.length,
      crew: input.crew.length,
      ticked: result.ticked,
      stage: stage?.name ?? null,
      customerFirst: customerFirst(brief),
      duplicate: false,
    },
  };
}

async function writePost(
  input: PostInput,
  ctx: {
    photos: (PostInput['photos'][number] & SpokenInput)[];
    voice: SpokenInput | null;
    crewById: Map<string, { id: string; name: string; role: string }>;
    member: StudioMemberRef;
    stageId: string | null;
    now: Date;
  },
): Promise<{ id: string; kind: PostSummary['kind']; ticked: number }> {
  const day = postDay(input.postedAt);
  const date = dayToDb(day);
  const saveCrew = can(ctx.member, 'crew.manage');
  return prisma.$transaction(async (tx) => {
    const original = await tx.homeSiteLog.findFirst({
      where: { projectId: input.projectId, date, kind: { in: ['UPDATE', 'NOBODY'] } },
      select: { id: true },
    });
    const { kind, correctsId } = logKind(input.kind, original);

    /* A new face on site: saved to the studio's crew list when this member
       manages the crew (owner, PM), else recorded on this day only. */
    const crew: Prisma.HomeSiteLogCrewCreateWithoutSiteLogInput[] = [];
    for (const c of input.crew) {
      if (c.crewMemberId !== null) {
        const row = ctx.crewById.get(c.crewMemberId)!;
        crew.push({ crewMember: { connect: { id: row.id } }, crewName: row.name, crewRole: row.role, arrivedAt: c.arrivedAt });
      } else if (c.save && saveCrew) {
        const made = await tx.studioCrewMember.create({ data: { studioId: ctx.member.studioId, name: c.name, role: c.role }, select: { id: true } });
        crew.push({ crewMember: { connect: { id: made.id } }, crewName: c.name, crewRole: c.role, arrivedAt: c.arrivedAt });
      } else {
        crew.push({ crewName: c.name, crewRole: c.role, arrivedAt: c.arrivedAt });
      }
    }

    const log = await tx.homeSiteLog.create({
      data: {
        projectId: input.projectId,
        date,
        kind,
        reason: input.kind === 'NOBODY' ? input.reason : null,
        voicePath: ctx.voice?.voicePath ?? null,
        transcript: ctx.voice?.transcript ?? null,
        transcriptLang: ctx.voice?.transcriptLang ?? null,
        customerText: ctx.voice?.customerText ?? null,
        customerLang: ctx.voice?.customerLang ?? null,
        stageId: ctx.stageId,
        postedById: ctx.member.userId,
        postedAt: input.postedAt,
        clientRef: input.clientRef,
        correctsId,
        photos: {
          create: ctx.photos.map((p, i) => ({
            storagePath: p.path,
            takenAt: p.takenAt,
            lat: p.lat,
            lng: p.lng,
            fromGallery: p.fromGallery,
            voicePath: p.voicePath,
            transcript: p.transcript,
            transcriptLang: p.transcriptLang,
            customerText: p.customerText,
            customerLang: p.customerLang,
            sortOrder: i,
          })),
        },
        crew: { create: crew },
      },
      select: { id: true },
    });

    // Ticks: only items still open, so a resend or a correction never re-dates one.
    const ticked: string[] = [];
    for (const t of input.ticks) {
      const r = await tx.homeChecklistItem.updateMany({
        where: { id: t.itemId, doneAt: null, stage: { projectId: input.projectId } },
        data: { doneAt: input.postedAt, doneById: ctx.member.userId, doneSource: t.source, doneSiteLogId: log.id },
      });
      if (r.count === 1) ticked.push(t.itemId);
    }

    const actor = { type: 'STUDIO' as const, id: ctx.member.userId };
    const offline = ctx.now.getTime() - input.postedAt.getTime() > 10 * 60_000;
    await recordEvent(tx, {
      projectId: input.projectId,
      type: kind === 'CORRECTION' ? 'site.corrected' : kind === 'NOBODY' ? 'site.nobody' : 'site.posted',
      actor,
      refId: log.id,
      at: input.postedAt,
      payload: {
        day,
        photos: ctx.photos.length,
        crew: crew.length,
        ticked: ticked.length,
        reason: input.kind === 'NOBODY' ? input.reason : null,
        correctsId,
        offline,
      },
    });
    if (ticked.length) {
      await recordEvent(tx, { projectId: input.projectId, type: 'checklist.ticked', actor, refId: log.id, at: input.postedAt, payload: { items: ticked, siteLogId: log.id } });
    }
    return { id: log.id, kind, ticked: ticked.length };
  });
}

/* ------------------------------------------------------------- site mode */

export interface SiteToday {
  kind: 'UPDATE' | 'NOBODY';
  postedAt: string;
  photos: number;
  reason: NobodyReasonName | null;
  corrections: number;
}

export interface SiteCard {
  id: string;
  home: string;
  customerFirst: string;
  stage: string | null;
  /** Day n of the project, of m planned. */
  day: number;
  of: number;
  /** A post is expected today (started, past design, a working day for the studio). */
  expected: boolean;
  today: SiteToday | null;
  openSnags: number;
}

/** The signed-in member's sites, for "My sites today". Only the ones they may post to. */
export async function mySitesToday(now = new Date()): Promise<{ cards: SiteCard[]; studio: string | null } | null> {
  const member = await currentMember();
  if (!member) return null;
  const today = istDay(now);
  const [studio, projects] = await Promise.all([
    prisma.studio.findUnique({ where: { id: member.studioId }, select: { tradeName: true, workingDays: true, holidays: { where: { day: dayToDb(today) }, select: { day: true } } } }),
    prisma.homeProject.findMany({
      where: projectsVisibleTo(member),
      orderBy: { startOn: 'desc' },
      select: {
        id: true,
        startOn: true,
        totalDays: true,
        doneStages: true,
        introduction: { select: { brief: BRIEF } },
        stages: { orderBy: { sortOrder: 'asc' }, select: { kind: true, name: true, actualEnd: true } },
        siteLogs: {
          where: { date: dayToDb(today) },
          orderBy: { postedAt: 'asc' },
          select: { kind: true, postedAt: true, reason: true, _count: { select: { photos: true } } },
        },
        snags: { where: { status: 'OPEN' }, select: { id: true } },
      },
    }),
  ]);
  const cal = calendarOf({ workingDays: studio?.workingDays, holidays: studio?.holidays ?? [] });
  const working = isWorkingDay(today, cal);
  const cards = projects.map((p): SiteCard => {
    const original = p.siteLogs.find((l) => l.kind !== 'CORRECTION') ?? null;
    const current = p.stages.find((s) => s.actualEnd === null) ?? null;
    const day = Math.max(1, Math.floor((now.getTime() - p.startOn.getTime()) / 86_400_000) + 1);
    return {
      id: p.id,
      home: homeLabel(p.introduction.brief),
      customerFirst: customerFirst(p.introduction.brief),
      stage: current?.name ?? null,
      day,
      of: p.totalDays,
      expected: working && needsDailyPost({ startOn: p.startOn, now, stages: p.stages, doneStages: p.doneStages }),
      today: original
        ? {
            kind: original.kind === 'NOBODY' ? 'NOBODY' : 'UPDATE',
            postedAt: original.postedAt.toISOString(),
            photos: p.siteLogs.reduce((a, l) => a + l._count.photos, 0),
            reason: original.reason,
            corrections: p.siteLogs.length - 1,
          }
        : null,
      openSnags: p.snags.length,
    };
  });
  return { cards, studio: studio?.tradeName ?? null };
}

export interface PostContext {
  projectId: string;
  home: string;
  customerFirst: string;
  customerLang: SpeechLang;
  stage: { name: string } | null;
  items: { id: string; room: string; label: string; done: boolean }[];
  rooms: string[];
  crew: { id: string; name: string; role: string }[];
  /** Owners and PMs save a new face to the crew list; a supervisor adds them for today. */
  canSaveCrew: boolean;
  canTick: boolean;
  /** Today's first post, when there is one: a new post becomes its correction. */
  today: { kind: 'UPDATE' | 'NOBODY'; postedAt: string } | null;
}

/** Everything "Post today's update" needs for one site. */
export async function postContext(projectId: string, now = new Date()): Promise<{ ok: true; context: PostContext } | { ok: false; error: SiteError }> {
  const check = await memberOnProject(projectId, 'update.post');
  if (!check.ok) return { ok: false, error: ACCESS_CODE[check.error] ?? 'not_yours' };
  const p = await prisma.homeProject.findUnique({
    where: { id: projectId },
    select: {
      introduction: { select: { brief: BRIEF } },
      stages: {
        orderBy: { sortOrder: 'asc' },
        select: { name: true, actualEnd: true, items: { orderBy: { sortOrder: 'asc' }, select: { id: true, room: true, label: true, doneAt: true } } },
      },
      siteLogs: { where: { date: dayToDb(istDay(now)), kind: { in: ['UPDATE', 'NOBODY'] } }, take: 1, select: { kind: true, postedAt: true } },
    },
  });
  if (!p) return { ok: false, error: 'gone' };
  const crew = await prisma.studioCrewMember.findMany({
    where: { studioId: check.member.studioId, active: true },
    orderBy: { name: 'asc' },
    select: { id: true, name: true, role: true },
    take: 60,
  });
  const stage = p.stages.find((s) => s.actualEnd === null) ?? null;
  const items = (stage?.items ?? []).map((i) => ({ id: i.id, room: i.room, label: i.label, done: i.doneAt !== null }));
  const original = p.siteLogs[0];
  return {
    ok: true,
    context: {
      projectId,
      home: homeLabel(p.introduction.brief),
      customerFirst: customerFirst(p.introduction.brief),
      customerLang: customerLang(p.introduction.brief),
      stage: stage ? { name: stage.name } : null,
      items,
      rooms: [...new Set(items.map((i) => i.room))],
      crew,
      canSaveCrew: can(check.member, 'crew.manage'),
      canTick: check.access.may('checklist.tick'),
      today: original ? { kind: original.kind === 'NOBODY' ? 'NOBODY' : 'UPDATE', postedAt: original.postedAt.toISOString() } : null,
    },
  };
}

/**
 * The speech step for one voice note, while the supervisor is still on the
 * screen: what was heard, the customer's sentence (shown before posting)
 * and the checklist items it seems to mention.
 */
export async function hearVoiceNote(
  raw: unknown,
): Promise<{ ok: true; heard: Heard } | { ok: false; error: SiteError | 'speech_off' }> {
  const o = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : null;
  const projectId = typeof o?.projectId === 'string' && /^[A-Za-z0-9_-]{1,64}$/.test(o.projectId) ? o.projectId : null;
  if (!o || !projectId) return { ok: false, error: 'invalid' };
  const voicePath = typeof o.voicePath === 'string' ? o.voicePath : null;
  if (voicePath && !ownsPath(projectId, voicePath, 'voice', unstoredAllowed())) return { ok: false, error: 'bad_path' };
  const room = typeof o.room === 'string' ? o.room.trim().slice(0, 60) || null : null;

  const check = await memberOnProject(projectId, 'update.post');
  if (!check.ok) return { ok: false, error: ACCESS_CODE[check.error] ?? 'not_yours' };
  const p = await prisma.homeProject.findUnique({
    where: { id: projectId },
    select: {
      introduction: { select: { brief: BRIEF } },
      stages: { orderBy: { sortOrder: 'asc' }, select: { name: true, actualEnd: true, items: { where: { doneAt: null }, orderBy: { sortOrder: 'asc' }, select: { id: true, room: true, label: true } } } },
    },
  });
  if (!p) return { ok: false, error: 'gone' };
  const stage = p.stages.find((s) => s.actualEnd === null) ?? null;
  const items: TickItem[] = stage?.items ?? [];
  const inRoom = room ? items.filter((i) => i.room.toLowerCase() === room.toLowerCase()) : items;
  const heard = await listen({
    audio: () => (voicePath ? readVoice(voicePath) : Promise.resolve(null)),
    langHint: asSpeechLang(o.lang),
    customerLang: customerLang(p.introduction.brief),
    context: { room, stage: stage?.name ?? null, items: (inRoom.length ? inRoom : items).map((i) => i.label) },
    items,
  });
  return heard ? { ok: true, heard } : { ok: false, error: 'speech_off' };
}

/* ---------------------------------------------------------------- office */

export interface OfficeSpoken {
  transcript: string | null;
  transcriptLang: string | null;
  customerText: string | null;
}

export interface OfficeLog {
  id: string;
  kind: 'UPDATE' | 'NOBODY' | 'CORRECTION';
  reason: NobodyReasonName | null;
  postedAt: Date;
  /** When it reached us; later than `postedAt` for a post sent from an offline phone. */
  arrivedAt: Date;
  postedBy: string;
  voice: (OfficeSpoken & { hasRecording: boolean }) | null;
  photos: (OfficeSpoken & { url: string | null; takenAt: Date; fromGallery: boolean; hasRecording: boolean })[];
  crew: { name: string; role: string; arrivedAt: Date | null }[];
  ticked: { room: string; label: string }[];
}

export interface OfficeDay {
  day: string;
  original: OfficeLog | null;
  corrections: OfficeLog[];
}

export interface OfficeSiteLog {
  days: OfficeDay[];
  missed: string[];
  score: UpdateScore;
  canPost: boolean;
}

/** The Site log tab: every day of the last month, with what only the team sees (transcripts). */
export async function siteLogForOffice(projectId: string, now = new Date()): Promise<OfficeSiteLog | null> {
  const check = await memberOnProject(projectId, 'project.read');
  if (!check.ok) return null;
  const since = addDays(istDay(now), -29);
  const p = await prisma.homeProject.findUnique({
    where: { id: projectId },
    select: {
      startOn: true,
      stages: { orderBy: { sortOrder: 'asc' }, select: { kind: true, actualEnd: true } },
      introduction: { select: { studio: { select: { workingDays: true, holidays: { select: { day: true } } } } } },
      siteLogs: {
        where: { date: { gte: dayToDb(since) } },
        orderBy: [{ date: 'desc' }, { postedAt: 'asc' }],
        select: {
          id: true,
          date: true,
          kind: true,
          reason: true,
          postedAt: true,
          createdAt: true,
          postedById: true,
          correctsId: true,
          voicePath: true,
          transcript: true,
          transcriptLang: true,
          customerText: true,
          photos: {
            orderBy: { sortOrder: 'asc' },
            select: { storagePath: true, takenAt: true, fromGallery: true, voicePath: true, transcript: true, transcriptLang: true, customerText: true },
          },
          crew: { select: { crewName: true, crewRole: true, arrivedAt: true } },
          ticked: { select: { room: true, label: true } },
        },
      },
    },
  });
  if (!p) return null;
  const first = await prisma.homeSiteLog.findFirst({ where: { projectId }, orderBy: { date: 'asc' }, select: { date: true } });
  const [urls, people] = await Promise.all([
    signedPhotoMap(p.siteLogs.flatMap((l) => l.photos.map((ph) => ph.storagePath))),
    prisma.user.findMany({ where: { id: { in: [...new Set(p.siteLogs.map((l) => l.postedById))] } }, select: { id: true, name: true } }),
  ]);
  const names = new Map(people.map((u) => [u.id, u.name?.trim() || 'Your team']));
  const view = (l: (typeof p.siteLogs)[number]): OfficeLog => ({
    id: l.id,
    kind: l.kind,
    reason: l.reason,
    postedAt: l.postedAt,
    arrivedAt: l.createdAt,
    postedBy: names.get(l.postedById) ?? 'Your team',
    voice: l.voicePath || l.customerText ? { transcript: l.transcript, transcriptLang: l.transcriptLang, customerText: l.customerText, hasRecording: Boolean(l.voicePath) } : null,
    photos: l.photos.map((ph) => ({
      url: urls.get(ph.storagePath) ?? null,
      takenAt: ph.takenAt,
      fromGallery: ph.fromGallery,
      transcript: ph.transcript,
      transcriptLang: ph.transcriptLang,
      customerText: ph.customerText,
      hasRecording: Boolean(ph.voicePath),
    })),
    crew: l.crew.map((c) => ({ name: c.crewName, role: c.crewRole, arrivedAt: c.arrivedAt })),
    ticked: l.ticked,
  });
  const byDay = new Map<string, OfficeDay>();
  for (const l of p.siteLogs) {
    const day = dayFromDb(l.date);
    const d = byDay.get(day) ?? { day, original: null, corrections: [] };
    if (l.kind === 'CORRECTION') d.corrections.push(view(l));
    else d.original = view(l);
    byDay.set(day, d);
  }
  const cal = calendarOf(p.introduction.studio);
  const posted = new Set([...byDay.values()].filter((d) => d.original).map((d) => d.day));
  const activeSince = activeSinceOf({ startOn: p.startOn, stages: p.stages, firstPostDay: first ? dayFromDb(first.date) : null });
  const input = { now, calendar: cal, postedDays: posted, activeSince };
  const active = needsDailyPost({ startOn: p.startOn, now, stages: p.stages });
  return {
    days: [...byDay.values()].sort((a, b) => (a.day < b.day ? 1 : -1)),
    missed: active ? missedDays(since, istDay(now), input) : [],
    score: updateScore(input),
    canPost: check.access.may('update.post'),
  };
}

/**
 * The studio's daily-update score for the office's Projects header: over
 * the last 30 days, the share of working days with a post, across the live
 * projects this member can see. Null for anyone outside the office.
 */
export async function studioUpdateScore(now = new Date()): Promise<UpdateScore | null> {
  const member = await currentMember();
  if (!member || !usesOffice(member)) return null;
  const since = addDays(istDay(now), -29);
  const [studio, projects] = await Promise.all([
    prisma.studio.findUnique({ where: { id: member.studioId }, select: { workingDays: true, holidays: { where: { day: { gte: dayToDb(since) } }, select: { day: true } } } }),
    prisma.homeProject.findMany({
      where: projectsVisibleTo(member),
      select: {
        id: true,
        startOn: true,
        doneStages: true,
        stages: { orderBy: { sortOrder: 'asc' }, select: { kind: true, actualEnd: true } },
        siteLogs: { where: { date: { gte: dayToDb(since) }, kind: { in: ['UPDATE', 'NOBODY'] } }, select: { date: true } },
      },
      take: 200,
    }),
  ]);
  const cal = calendarOf({ workingDays: studio?.workingDays, holidays: studio?.holidays ?? [] });
  const scores = projects
    .filter((p) => needsDailyPost({ startOn: p.startOn, now, stages: p.stages, doneStages: p.doneStages }))
    .map((p) => {
      const posted = new Set(p.siteLogs.map((l) => dayFromDb(l.date)));
      const firstPostDay = [...posted].sort()[0] ?? null;
      return updateScore({ now, calendar: cal, postedDays: posted, activeSince: activeSinceOf({ startOn: p.startOn, stages: p.stages, firstPostDay }) });
    });
  return combineScores(scores);
}
