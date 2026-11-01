/**
 * In-app chat — the rules (owner, 1 Nov 2026: "a chat option in our app only
 * that works very smooth like WhatsApp", instead of anything from us on
 * WhatsApp). Pure, tested in tests/chat-rules.test.ts; the reads and writes
 * are store.ts.
 *
 * Three conversations per project:
 *   DESIGNER       the client and their designer. The studio's owner, design
 *                  head and project managers may read and answer too, so a
 *                  client is never left waiting on one person.
 *   TEAM           the home team: the client, family who joined, and every
 *                  studio person on the project (site head included).
 *   ONE_INTERIORS  the client and us: our notices, and Meera.
 * A family member sees the home team only. Phone numbers are never shown.
 */

import type { StudioRoleName } from '@/modules/studio/roles';

export type ChatKindName = 'DESIGNER' | 'TEAM' | 'ONE_INTERIORS';
export type ChatSideName = 'CLIENT' | 'FAMILY' | 'STUDIO' | 'ONE_INTERIORS';
export type ChatMessageKindName = 'TEXT' | 'PHOTO' | 'VOICE' | 'FILE';

export const CHAT_KINDS: readonly ChatKindName[] = ['DESIGNER', 'TEAM', 'ONE_INTERIORS'];

/** Who is looking: the project's owner, a family member, someone at the studio, or our team. */
export type ChatViewer =
  | { side: 'CLIENT' | 'FAMILY'; userId: string }
  | { side: 'STUDIO'; userId: string; role: StudioRoleName; designHead: boolean; isProjectDesigner: boolean; onProject: boolean }
  | { side: 'ONE_INTERIORS'; userId: string };

/** The conversations this person sees on a project. */
export function kindsFor(v: ChatViewer): ChatKindName[] {
  switch (v.side) {
    case 'CLIENT':
      return ['DESIGNER', 'TEAM', 'ONE_INTERIORS'];
    case 'FAMILY':
      return ['TEAM'];
    case 'ONE_INTERIORS':
      return ['ONE_INTERIORS'];
    case 'STUDIO': {
      if (!v.onProject) return [];
      const lead = v.role === 'OWNER' || v.role === 'PM' || v.designHead || v.isProjectDesigner;
      return lead ? ['DESIGNER', 'TEAM'] : ['TEAM'];
    }
  }
}

export const mayRead = (v: ChatViewer, kind: ChatKindName) => kindsFor(v).includes(kind);

/** The longest message, in characters: about a full phone screen. */
export const MAX_BODY = 4000;
/** A voice note's longest length. */
export const MAX_VOICE_MS = 5 * 60_000;

export type MessageInput = { body: string; kind: ChatMessageKindName; hasFile: boolean; durationMs: number | null };

/** Why a message cannot go, in the sender's words; null when it can. */
export function messageProblem(m: MessageInput): string | null {
  const body = m.body.trim();
  if (m.kind === 'TEXT') {
    if (!body) return 'Write something first.';
  } else if (!m.hasFile) {
    return m.kind === 'VOICE' ? 'The voice note did not record. Try again.' : 'Add the photo or file first.';
  }
  if (body.length > MAX_BODY) return `Messages can be up to ${MAX_BODY.toLocaleString('en-IN')} characters. Send it in two.`;
  if (m.kind === 'VOICE' && m.durationMs !== null && m.durationMs > MAX_VOICE_MS) return 'Voice notes can be up to five minutes.';
  return null;
}

/** What kind of message a file makes, from its type. */
export function kindForFile(contentType: string): ChatMessageKindName | null {
  if (/^image\/(jpeg|png|webp|heic|heif)$/.test(contentType)) return 'PHOTO';
  if (/^audio\//.test(contentType)) return 'VOICE';
  if (contentType === 'application/pdf') return 'FILE';
  return null;
}

/** The line under a person's name. */
export function roleWord(side: ChatSideName, studioRole?: StudioRoleName | null, opts: { designer?: boolean } = {}): string {
  if (side === 'CLIENT') return 'Home owner';
  if (side === 'FAMILY') return 'Family';
  if (side === 'ONE_INTERIORS') return 'One Interiors';
  if (opts.designer || studioRole === 'DESIGNER') return 'Designer';
  switch (studioRole) {
    case 'OWNER':
      return 'Studio owner';
    case 'PM':
      return 'Project manager';
    case 'SUPERVISOR':
      return 'Site head';
    case 'ACCOUNTS':
      return 'Accounts';
    case 'SALES':
      return 'Sales';
    default:
      return 'Studio';
  }
}

/** The inbox line for a message: its words, or what it carries. */
export function previewOf(m: { kind: ChatMessageKindName; body: string; deletedAt?: Date | string | null; durationMs?: number | null }): string {
  if (m.deletedAt) return 'Message taken back';
  const words = m.body.trim().replace(/\s+/g, ' ');
  if (m.kind === 'PHOTO') return words ? `Photo: ${words}` : 'Photo';
  if (m.kind === 'VOICE') return `Voice note${m.durationMs ? ` ${clock(m.durationMs)}` : ''}`;
  if (m.kind === 'FILE') return words ? `File: ${words}` : 'File';
  return words;
}

/** "0:42". */
export function clock(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** Messages after this person last read, not their own. */
export function unreadCount(messages: { createdAt: Date; authorId: string | null }[], userId: string, lastReadAt: Date | null): number {
  return messages.filter((m) => m.authorId !== userId && (!lastReadAt || m.createdAt > lastReadAt)).length;
}

/**
 * The ticks on my own message, as on WhatsApp: sent; delivered once anyone
 * else's app has fetched it; read once anyone else has opened the
 * conversation past it (in a group, at least one other person).
 */
export function tickFor(createdAt: Date, othersReadAt: Date[], othersDeliveredAt: Date[] = []): 'sent' | 'delivered' | 'read' {
  if (othersReadAt.some((r) => r >= createdAt)) return 'read';
  if (othersDeliveredAt.some((r) => r >= createdAt)) return 'delivered';
  return 'sent';
}

/** Archived conversations stay hidden until a message newer than the archiving. */
export const isArchived = (archivedAt: Date | null | undefined, lastMessageAt: Date | null | undefined) =>
  Boolean(archivedAt && (!lastMessageAt || lastMessageAt <= archivedAt));

/** A search: at least two characters, at most sixty. */
export function searchTerm(raw: unknown): string | null {
  const q = typeof raw === 'string' ? raw.trim().replace(/\s+/g, ' ').slice(0, 60) : '';
  return q.length >= 2 ? q : null;
}

/** A snag's title from a chat message: its first line, at most 120 characters. */
export function snagTitleFrom(body: string): string {
  const first = body.trim().split('\n')[0]!.trim();
  return (first.length > 120 ? `${first.slice(0, 117)}…` : first) || 'From the chat';
}

/** A message may be taken back by its author within an hour. */
export const TAKE_BACK_MS = 60 * 60_000;
export const mayTakeBack = (m: { authorId: string | null; createdAt: Date; deletedAt: Date | null }, userId: string, now = new Date()) =>
  m.authorId === userId && !m.deletedAt && now.getTime() - m.createdAt.getTime() <= TAKE_BACK_MS;

/** The conversation's name, for the person looking. */
export function threadTitle(kind: ChatKindName, ctx: { designer: string | null; home: string; studio: string; side: ChatSideName }): string {
  if (kind === 'ONE_INTERIORS') return 'One Interiors';
  if (kind === 'TEAM') return `${ctx.home} · Home team`;
  return ctx.side === 'STUDIO' ? `${ctx.home} · Client` : (ctx.designer ?? `${ctx.studio} · Designer`);
}
