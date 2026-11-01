import 'server-only';

/**
 * In-app chat — reads and writes (owner, 1 Nov 2026). The rules are rules.ts.
 *
 * Every call starts from the signed-in user and a project, works out who they
 * are on it (`viewerOn`: its client, family, someone at its studio, or our
 * team) and refuses a conversation they may not see. Threads are made on the
 * first message. Every query on a chat table carries the project's
 * `studioId`. A new message pings the conversation's Realtime channel
 * (live.ts) and the open screens fetch it at once (`since`); without Realtime
 * they check every few seconds. The others in it get a notice.
 */

import { prisma } from '@/lib/prisma';
import type { AuthUser } from '@/modules/auth/session';
import { memberFor } from '@/modules/studio/access';
import { can, projectsVisibleTo } from '@/modules/studio/roles';
import { notify } from '@/modules/notify/service';
import { signedChatUrls, storeChatFile } from '@/modules/storage/project-docs';
import { liveChannel, ping, type LiveChannel } from './live';
import {
  CHAT_KINDS,
  isArchived,
  kindForFile,
  kindsFor,
  mayRead,
  mayTakeBack,
  messageProblem,
  previewOf,
  roleWord,
  searchTerm,
  snagTitleFrom,
  threadTitle,
  tickFor,
  unreadCount,
  type ChatKindName,
  type ChatMessageKindName,
  type ChatSideName,
  type ChatViewer,
} from './rules';

// ── Who is looking ─────────────────────────────────────────────

interface ProjectCtx {
  id: string;
  studioId: string;
  studio: string;
  home: string;
  clientId: string | null;
  designerId: string | null;
  designerName: string | null;
}

const PROJECT_SELECT = {
  id: true,
  designerId: true,
  designer: { select: { user: { select: { name: true } } } },
  introduction: {
    select: {
      studioId: true,
      studio: { select: { tradeName: true } },
      brief: { select: { userId: true, society: true, contactName: true } },
    },
  },
} as const;

async function projectCtx(projectId: string): Promise<ProjectCtx | null> {
  const p = await prisma.homeProject.findFirst({ where: { id: projectId, cancelledAt: null }, select: PROJECT_SELECT });
  if (!p) return null;
  const brief = p.introduction.brief;
  return {
    id: p.id,
    studioId: p.introduction.studioId,
    studio: p.introduction.studio.tradeName,
    home: brief.society?.trim() || brief.contactName?.trim() || 'Home',
    clientId: brief.userId,
    designerId: p.designerId,
    designerName: p.designer?.user.name?.trim() || null,
  };
}

interface Who {
  viewer: ChatViewer;
  name: string;
  /** The line under their name. */
  role: string;
}

/** Who this user is on this project, or null when it is none of theirs. */
async function viewerOn(user: AuthUser, p: ProjectCtx): Promise<Who | null> {
  const name = user.name?.trim() || 'Someone';
  if (p.clientId === user.id) return { viewer: { side: 'CLIENT', userId: user.id }, name, role: roleWord('CLIENT') };
  if (user.role === 'OPS' || user.role === 'ADMIN') return { viewer: { side: 'ONE_INTERIORS', userId: user.id }, name, role: roleWord('ONE_INTERIORS') };
  const family = await prisma.familyMember.findFirst({
    where: { projectId: p.id, userId: user.id, joinedAt: { not: null }, removedAt: null },
    select: { relation: true },
  });
  if (family) return { viewer: { side: 'FAMILY', userId: user.id }, name, role: family.relation?.trim() || roleWord('FAMILY') };
  const member = await memberFor(user.id).catch(() => null);
  if (!member || member.studioId !== p.studioId || member.status === 'SUSPENDED') return null;
  const onTeam = (await prisma.studioProjectMember.findUnique({ where: { homeProjectId_memberId: { homeProjectId: p.id, memberId: member.id } }, select: { id: true } })) !== null;
  const onProject = can(member, 'project.read', { assigned: onTeam }) || p.designerId === member.id;
  const isProjectDesigner = p.designerId === member.id;
  return {
    viewer: { side: 'STUDIO', userId: user.id, role: member.role, designHead: member.designHead === true, isProjectDesigner, onProject },
    name,
    role: roleWord('STUDIO', member.role, { designer: isProjectDesigner }),
  };
}

export type ChatRefusal = 'not_found' | 'not_yours' | 'problem';
export type ChatResult<T> = { ok: true; value: T } | { ok: false; reason: ChatRefusal; error: string };
const refuse = <T,>(reason: ChatRefusal, error: string): ChatResult<T> => ({ ok: false, reason, error });
const NOT_YOURS = 'That conversation is not one of yours.';

async function open(user: AuthUser, projectId: string, kind: string) {
  if (!CHAT_KINDS.includes(kind as ChatKindName)) return refuse<never>('not_found', 'There is no such conversation.');
  const p = await projectCtx(String(projectId).slice(0, 64));
  if (!p) return refuse<never>('not_found', 'That project is not here any more.');
  const who = await viewerOn(user, p);
  if (!who || !mayRead(who.viewer, kind as ChatKindName)) return refuse<never>('not_yours', NOT_YOURS);
  return { ok: true as const, value: { p, who, kind: kind as ChatKindName } };
}

// ── The list of conversations ──────────────────────────────────

export interface ChatSummary {
  projectId: string;
  kind: ChatKindName;
  title: string;
  home: string;
  studio: string;
  last: { preview: string; at: string; from: string; mine: boolean } | null;
  unread: number;
  /** Archived by this person (shown only in their archive). */
  archived: boolean;
}

/** Projects this user takes part in, newest first, at most fifty. */
async function projectsFor(user: AuthUser): Promise<string[]> {
  if (user.role === 'OPS' || user.role === 'ADMIN') {
    const rows = await prisma.chatThread.findMany({ where: { kind: 'ONE_INTERIORS', lastMessageAt: { not: null }, studioId: { not: '' } }, orderBy: { lastMessageAt: 'desc' }, take: 50, select: { projectId: true } });
    return rows.map((r) => r.projectId);
  }
  const member = await memberFor(user.id).catch(() => null);
  if (member) {
    const rows = await prisma.homeProject.findMany({ where: { AND: [projectsVisibleTo(member), { cancelledAt: null }] }, orderBy: { startOn: 'desc' }, take: 50, select: { id: true } });
    const designing = await prisma.homeProject.findMany({ where: { designerId: member.id, cancelledAt: null, introduction: { studioId: member.studioId } }, take: 50, select: { id: true } });
    return [...new Set([...rows, ...designing].map((r) => r.id))];
  }
  const rows = await prisma.homeProject.findMany({
    where: { cancelledAt: null, OR: [{ introduction: { brief: { userId: user.id } } }, { family: { some: { userId: user.id, joinedAt: { not: null }, removedAt: null } } }] },
    orderBy: { startOn: 'desc' },
    take: 10,
    select: { id: true },
  });
  return rows.map((r) => r.id);
}

export async function chatList(user: AuthUser, opts: { archived?: boolean } = {}, now = new Date()): Promise<ChatSummary[]> {
  const out: ChatSummary[] = [];
  const seen: { threadId: string; studioId: string }[] = [];
  for (const projectId of await projectsFor(user)) {
    const p = await projectCtx(projectId);
    if (!p) continue;
    const who = await viewerOn(user, p);
    if (!who) continue;
    const kinds = kindsFor(who.viewer);
    const threads = await prisma.chatThread.findMany({
      where: { projectId, studioId: p.studioId, kind: { in: kinds } },
      select: {
        id: true,
        kind: true,
        lastMessageAt: true,
        reads: { where: { userId: user.id }, select: { lastReadAt: true, archivedAt: true } },
        messages: { orderBy: { createdAt: 'desc' }, take: 50, select: { authorId: true, authorName: true, body: true, kind: true, durationMs: true, deletedAt: true, createdAt: true } },
      },
    });
    for (const kind of kinds) {
      const t = threads.find((x) => x.kind === kind);
      const lastMsg = t?.messages[0] ?? null;
      /* The studio's inbox lists conversations that have started; a client sees all of theirs, ready to start. */
      if (who.viewer.side === 'STUDIO' || who.viewer.side === 'ONE_INTERIORS') {
        if (!lastMsg) continue;
      }
      if (t) seen.push({ threadId: t.id, studioId: p.studioId });
      const archived = isArchived(t?.reads[0]?.archivedAt, t?.lastMessageAt);
      if (archived !== (opts.archived === true)) continue;
      out.push({
        archived,
        projectId,
        kind,
        title: threadTitle(kind, { designer: p.designerName, home: p.home, studio: p.studio, side: who.viewer.side }),
        home: p.home,
        studio: p.studio,
        last: lastMsg
          ? { preview: previewOf(lastMsg), at: lastMsg.createdAt.toISOString(), from: lastMsg.authorName, mine: lastMsg.authorId === user.id }
          : null,
        unread: t ? unreadCount(t.messages, user.id, t.reads[0]?.lastReadAt ?? null) : 0,
      });
    }
  }
  /* Their app has these now: the senders see "delivered". */
  await Promise.all(
    seen.map((t) =>
      prisma.chatRead.upsert({
        where: { threadId_userId: { threadId: t.threadId, userId: user.id } },
        create: { threadId: t.threadId, userId: user.id, studioId: t.studioId, lastReadAt: new Date(0), deliveredAt: now },
        update: { deliveredAt: now },
      }),
    ),
  ).catch(() => undefined);
  return out.sort((a, b) => (b.last?.at ?? '').localeCompare(a.last?.at ?? ''));
}

/** Archive a conversation for myself, or bring it back. A newer message brings it back by itself. */
export async function archiveThread(user: AuthUser, projectId: string, kind: string, archive: boolean, now = new Date()): Promise<ChatResult<{ archived: boolean }>> {
  const o = await open(user, projectId, kind);
  if (!o.ok) return o;
  const thread = await prisma.chatThread.findUnique({ where: { projectId_kind: { projectId: o.value.p.id, kind: o.value.kind } }, select: { id: true, studioId: true } });
  if (!thread || thread.studioId !== o.value.p.studioId) return refuse('problem', 'There is nothing in this conversation to archive yet.');
  await prisma.chatRead.upsert({
    where: { threadId_userId: { threadId: thread.id, userId: user.id } },
    create: { threadId: thread.id, userId: user.id, studioId: thread.studioId, lastReadAt: now, archivedAt: archive ? now : null },
    update: { archivedAt: archive ? now : null },
  });
  return { ok: true, value: { archived: archive } };
}

export interface ChatHit {
  projectId: string;
  kind: ChatKindName;
  title: string;
  home: string;
  from: string;
  preview: string;
  at: string;
}

/** Messages with these words, in conversations this person sees, newest first (at most thirty). */
export async function searchChats(user: AuthUser, raw: unknown): Promise<ChatHit[]> {
  const q = searchTerm(raw);
  if (!q) return [];
  const hits: ChatHit[] = [];
  for (const projectId of await projectsFor(user)) {
    const p = await projectCtx(projectId);
    if (!p) continue;
    const who = await viewerOn(user, p);
    if (!who) continue;
    const rows = await prisma.chatMessage.findMany({
      where: { studioId: p.studioId, deletedAt: null, body: { contains: q, mode: 'insensitive' }, thread: { projectId, kind: { in: kindsFor(who.viewer) } } },
      orderBy: { createdAt: 'desc' },
      take: 30,
      select: { authorName: true, kind: true, body: true, durationMs: true, createdAt: true, thread: { select: { kind: true } } },
    });
    for (const r of rows) {
      hits.push({
        projectId,
        kind: r.thread.kind,
        title: threadTitle(r.thread.kind, { designer: p.designerName, home: p.home, studio: p.studio, side: who.viewer.side }),
        home: p.home,
        from: r.authorName,
        preview: previewOf(r),
        at: r.createdAt.toISOString(),
      });
    }
  }
  return hits.sort((a, b) => b.at.localeCompare(a.at)).slice(0, 30);
}

/**
 * The studio turns a client's message into a snag (the plan: "one tap turns a
 * message into a decision, a snag or a change order, so nothing agreed lives
 * only in chat"). Whoever may accept snags on the project; the message's
 * words become the snag, and the snag says where it came from. A decision
 * or a change order opens its own form with the words filled in.
 */
export async function messageToSnag(user: AuthUser, messageId: string): Promise<ChatResult<{ snagId: string; projectId: string }>> {
  const row = await prisma.chatMessage.findUnique({
    where: { id: String(messageId).slice(0, 40) },
    select: { id: true, studioId: true, body: true, kind: true, authorName: true, deletedAt: true, thread: { select: { projectId: true, kind: true } } },
  });
  if (!row || row.deletedAt) return refuse('not_found', 'That message is not here.');
  const o = await open(user, row.thread.projectId, row.thread.kind);
  if (!o.ok) return o;
  if (o.value.who.viewer.side !== 'STUDIO' || row.studioId !== o.value.p.studioId) return refuse('not_yours', NOT_YOURS);
  const { raiseSnagAsStudio } = await import('@/modules/project/snag-flow');
  const r = await raiseSnagAsStudio(o.value.p.id, {
    title: snagTitleFrom(row.body || (row.kind === 'PHOTO' ? 'From a photo in the chat' : '')),
    note: `From ${row.authorName} in the chat${row.kind === 'PHOTO' ? ' (with a photo, in the conversation)' : ''}.`,
  });
  if (!r.ok) return refuse('problem', r.error);
  return { ok: true, value: { snagId: r.id, projectId: o.value.p.id } };
}

/** Unread messages across every conversation, for the tab badge. */
export async function chatUnread(user: AuthUser): Promise<number> {
  return (await chatList(user)).reduce((n, c) => n + c.unread, 0);
}

// ── One conversation ───────────────────────────────────────────

export interface ChatMessageView {
  id: string;
  from: string;
  role: string;
  side: ChatSideName;
  mine: boolean;
  kind: ChatMessageKindName;
  body: string;
  /** A short-lived link to the photo, voice note or file. */
  url: string | null;
  fileName: string | null;
  durationMs: number | null;
  replyTo: { id: string; from: string; preview: string } | null;
  at: string;
  /** On my own messages. */
  tick: 'sent' | 'delivered' | 'read' | null;
  taken: boolean;
  canTakeBack: boolean;
}

export interface ChatThreadView {
  projectId: string;
  kind: ChatKindName;
  title: string;
  studio: string;
  /** Who is in it, by name and role (never a number). */
  people: { name: string; role: string }[];
  messages: ChatMessageView[];
  /** The newest message's time: ask `since` this next. */
  cursor: string | null;
  /** Where to listen for "something new" (live.ts); null without Realtime here. */
  live: LiveChannel | null;
}

const MESSAGE_SELECT = {
  id: true,
  authorId: true,
  authorName: true,
  authorRole: true,
  side: true,
  kind: true,
  body: true,
  storageKey: true,
  fileName: true,
  durationMs: true,
  replyToId: true,
  createdAt: true,
  deletedAt: true,
} as const;

/**
 * The newest messages (or those after `since`, for the screen's poll), and
 * marks them read. `before` pages back through older ones.
 */
export async function readThread(
  user: AuthUser,
  projectId: string,
  kind: string,
  opts: { since?: string | null; before?: string | null } = {},
  now = new Date(),
): Promise<ChatResult<ChatThreadView>> {
  const o = await open(user, projectId, kind);
  if (!o.ok) return o;
  const { p, who } = o.value;
  const thread = await prisma.chatThread.findUnique({ where: { projectId_kind: { projectId: p.id, kind: o.value.kind } }, select: { id: true, studioId: true } });
  const base = {
    projectId: p.id,
    kind: o.value.kind,
    title: threadTitle(o.value.kind, { designer: p.designerName, home: p.home, studio: p.studio, side: who.viewer.side }),
    studio: p.studio,
    people: await peopleIn(p, o.value.kind),
    live: liveChannel(p.id, o.value.kind),
  };
  if (!thread || thread.studioId !== p.studioId) return { ok: true, value: { ...base, messages: [], cursor: null } };

  const since = opts.since ? new Date(opts.since) : null;
  const before = opts.before ? new Date(opts.before) : null;
  const rows = await prisma.chatMessage.findMany({
    where: {
      threadId: thread.id,
      studioId: p.studioId,
      ...(since && !isNaN(+since) ? { createdAt: { gt: since } } : before && !isNaN(+before) ? { createdAt: { lt: before } } : {}),
    },
    orderBy: { createdAt: 'desc' },
    take: since ? 200 : 60,
    select: MESSAGE_SELECT,
  });
  rows.reverse();
  const reads = await prisma.chatRead.findMany({ where: { threadId: thread.id, studioId: p.studioId }, select: { userId: true, lastReadAt: true, deliveredAt: true } });
  const others = reads.filter((r) => r.userId !== user.id);
  const othersRead = others.map((r) => r.lastReadAt);
  const othersDelivered = others.map((r) => r.deliveredAt).filter((d): d is Date => d !== null);
  const urls = await signedChatUrls(rows.filter((r) => r.storageKey && !r.deletedAt).map((r) => r.storageKey!));
  let u = 0;
  const replyIds = [...new Set(rows.map((r) => r.replyToId).filter((x): x is string => Boolean(x)))];
  const replies = replyIds.length
    ? await prisma.chatMessage.findMany({ where: { id: { in: replyIds }, threadId: thread.id, studioId: p.studioId }, select: { id: true, authorName: true, kind: true, body: true, durationMs: true, deletedAt: true } })
    : [];
  const messages: ChatMessageView[] = rows.map((r) => {
    const url = r.storageKey && !r.deletedAt ? urls[u++] || null : null;
    const reply = r.replyToId ? replies.find((x) => x.id === r.replyToId) : null;
    const mine = r.authorId === user.id;
    return {
      id: r.id,
      from: r.authorName,
      role: r.authorRole,
      side: r.side,
      mine,
      kind: r.kind,
      body: r.deletedAt ? '' : r.body,
      url,
      fileName: r.deletedAt ? null : r.fileName,
      durationMs: r.durationMs,
      replyTo: reply ? { id: reply.id, from: reply.authorName, preview: previewOf(reply) } : null,
      at: r.createdAt.toISOString(),
      tick: mine ? tickFor(r.createdAt, othersRead, othersDelivered) : null,
      taken: r.deletedAt !== null,
      canTakeBack: mayTakeBack(r, user.id, now),
    };
  });
  if (!before) {
    await prisma.chatRead.upsert({
      where: { threadId_userId: { threadId: thread.id, userId: user.id } },
      create: { threadId: thread.id, userId: user.id, studioId: p.studioId, lastReadAt: now, deliveredAt: now },
      update: { lastReadAt: now, deliveredAt: now },
    });
  }
  const newest = rows.length ? rows[rows.length - 1]!.createdAt.toISOString() : (opts.since ?? null);
  return { ok: true, value: { ...base, messages, cursor: newest } };
}

/** Who is in a conversation, by name and role. */
async function peopleIn(p: ProjectCtx, kind: ChatKindName): Promise<{ name: string; role: string }[]> {
  if (kind === 'ONE_INTERIORS') return [{ name: 'One Interiors', role: 'Our team' }];
  const out: { name: string; role: string }[] = [];
  if (p.designerName) out.push({ name: p.designerName, role: 'Designer' });
  if (kind === 'TEAM') {
    const team = await prisma.studioProjectMember.findMany({
      where: { homeProjectId: p.id, member: { studioId: p.studioId, status: 'ACTIVE' } },
      select: { member: { select: { id: true, role: true, user: { select: { name: true } } } } },
    });
    for (const t of team) {
      if (t.member.id === p.designerId) continue;
      out.push({ name: t.member.user.name?.trim() || roleWord('STUDIO', t.member.role), role: roleWord('STUDIO', t.member.role) });
    }
  }
  return out;
}

// ── Sending ────────────────────────────────────────────────────

export interface SendInput {
  body: unknown;
  replyToId?: unknown;
  durationMs?: unknown;
  file?: File | null;
}

export async function sendMessage(user: AuthUser, projectId: string, kind: string, input: SendInput, now = new Date()): Promise<ChatResult<{ id: string }>> {
  const o = await open(user, projectId, kind);
  if (!o.ok) return o;
  const { p, who } = o.value;
  const file = input.file && input.file.size > 0 ? input.file : null;
  const msgKind: ChatMessageKindName = file ? (kindForFile(file.type.split(';')[0]!.trim()) ?? 'FILE') : 'TEXT';
  if (file && !kindForFile(file.type.split(';')[0]!.trim())) return refuse('problem', 'We can take photos, voice notes and PDFs.');
  const body = String(input.body ?? '').replace(/\r\n/g, '\n').trim();
  const durationMs = Number.isFinite(Number(input.durationMs)) && Number(input.durationMs) > 0 ? Math.round(Number(input.durationMs)) : null;
  const problem = messageProblem({ body, kind: msgKind, hasFile: file !== null, durationMs });
  if (problem) return refuse('problem', problem);

  let stored: { path: string; name: string; type: string; bytes: number } | null = null;
  if (file) {
    const r = await storeChatFile(p.id, file);
    if (!r.ok) return refuse('problem', r.error);
    stored = { path: r.path, name: file.name.slice(0, 200) || 'file', type: file.type.split(';')[0]!.trim(), bytes: file.size };
  }

  const replyToId = typeof input.replyToId === 'string' && input.replyToId ? input.replyToId.slice(0, 40) : null;
  const created = await prisma.$transaction(async (tx) => {
    const thread = await tx.chatThread.upsert({
      where: { projectId_kind: { projectId: p.id, kind: o.value.kind } },
      create: { projectId: p.id, studioId: p.studioId, kind: o.value.kind, lastMessageAt: now },
      update: { lastMessageAt: now },
      select: { id: true, studioId: true },
    });
    if (thread.studioId !== p.studioId) throw new Error('chat thread studio mismatch');
    const reply = replyToId ? await tx.chatMessage.findFirst({ where: { id: replyToId, threadId: thread.id, studioId: p.studioId }, select: { id: true } }) : null;
    const msg = await tx.chatMessage.create({
      data: {
        threadId: thread.id,
        studioId: p.studioId,
        authorId: user.id,
        authorName: who.name,
        authorRole: who.role,
        side: who.viewer.side,
        kind: msgKind,
        body,
        storageKey: stored?.path ?? null,
        fileName: stored?.name ?? null,
        contentType: stored?.type ?? null,
        bytes: stored?.bytes ?? null,
        durationMs: msgKind === 'VOICE' ? durationMs : null,
        replyToId: reply?.id ?? null,
        createdAt: now,
      },
      select: { id: true },
    });
    await tx.chatRead.upsert({
      where: { threadId_userId: { threadId: thread.id, userId: user.id } },
      create: { threadId: thread.id, userId: user.id, studioId: p.studioId, lastReadAt: now },
      update: { lastReadAt: now },
    });
    return msg;
  });

  await ping(p.id, o.value.kind);
  void tellOthers(p, o.value.kind, user.id, { from: who.name, preview: previewOf({ kind: msgKind, body, durationMs }) }).catch(() => undefined);
  return { ok: true, value: { id: created.id } };
}

/** A notice to everyone else in the conversation: the client (and family on the home team), and the studio's people in it. */
async function tellOthers(p: ProjectCtx, kind: ChatKindName, fromUserId: string, m: { from: string; preview: string }): Promise<void> {
  const clientSide: string[] = [];
  if (p.clientId) clientSide.push(p.clientId);
  if (kind === 'TEAM') {
    const family = await prisma.familyMember.findMany({ where: { projectId: p.id, joinedAt: { not: null }, removedAt: null, userId: { not: null } }, select: { userId: true } });
    for (const f of family) if (f.userId) clientSide.push(f.userId);
  }
  const studioSide: string[] = [];
  if (kind !== 'ONE_INTERIORS') {
    const team = await prisma.studioProjectMember.findMany({
      where: { homeProjectId: p.id, member: { studioId: p.studioId, status: 'ACTIVE' } },
      select: { member: { select: { id: true, userId: true } } },
    });
    const designer = p.designerId
      ? await prisma.studioMember.findFirst({ where: { id: p.designerId, studioId: p.studioId, status: 'ACTIVE' }, select: { userId: true } })
      : null;
    if (designer) studioSide.push(designer.userId);
    if (kind === 'TEAM') for (const t of team) studioSide.push(t.member.userId);
  }
  const base = { kind: 'chat' as const, projectId: p.id, thread: kind, from: m.from, preview: m.preview };
  for (const id of new Set(clientSide)) if (id !== fromUserId) await notify(id, { ...base, toStudio: false }, { email: false });
  for (const id of new Set(studioSide)) if (id !== fromUserId) await notify(id, { ...base, toStudio: true }, { email: false });
}

/** Take back my own message within the hour: the words and file stop showing. */
export async function takeBack(user: AuthUser, messageId: string, now = new Date()): Promise<ChatResult<{ id: string }>> {
  const row = await prisma.chatMessage.findUnique({
    where: { id: String(messageId).slice(0, 40) },
    select: { id: true, studioId: true, authorId: true, createdAt: true, deletedAt: true, thread: { select: { projectId: true, kind: true } } },
  });
  if (!row) return refuse('not_found', 'That message is not here.');
  const o = await open(user, row.thread.projectId, row.thread.kind);
  if (!o.ok) return o;
  if (row.studioId !== o.value.p.studioId || !mayTakeBack(row, user.id, now)) return refuse('problem', 'Only your own message, within an hour of sending it.');
  await prisma.chatMessage.updateMany({ where: { id: row.id, studioId: row.studioId }, data: { deletedAt: now } });
  await ping(o.value.p.id, o.value.kind);
  return { ok: true, value: { id: row.id } };
}
