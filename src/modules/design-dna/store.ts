import 'server-only';

/**
 * Design DNA, the database half: whose brief, what they built and answered,
 * drawing a round of mock-ups, and the limits that keep the image bill sane.
 *
 * Ownership is the prep pack's rule (modules/prepare/prep.ts): the signed-in
 * customer's brief (cookie on the website, bearer token in the app), or the
 * brief this browser's anonymous cookie points at. Never an id from the client.
 *
 * Opens once the Home Profile is finished and an expert call has been asked
 * for (owner, 4 Nov 2026: "after the flow completes and the sign up for expert
 * consultation").
 */

import { prisma } from '@/lib/prisma';
import { hasDatabase } from '@/lib/env';
import { getCurrentUser } from '@/modules/auth/session';
import { readAnonKey } from '@/modules/brief/repository';
import { rowToBrief } from '@/modules/brief/mapping';
import { BEDROOMS } from '@/modules/quotation/estimate';
import { STYLE_TAGS, type StyleTag } from '@/modules/brief/types';
import { mockupLinks, storeMockup } from '@/modules/storage/design-mockups';
import { designDna, NO_REASONS, type DesignDna, type MockupAnswer, type NoReason } from './dna';
import { MOCKUP_ROOM_LABELS, MOCKUP_ROOMS, mockupVariants, type MockupRoom } from './prompt';
import { drawRoom } from './image';
import { loadPrepPack } from '@/modules/prepare/prep';

/** Pictures one customer may have drawn in a day: four rounds of three. */
export const DAILY_PER_CUSTOMER = 12;

/** Pictures drawn across everyone in a day, unless DESIGN_MOCKUPS_DAILY_MAX says otherwise. */
function dailyCap(): number {
  const n = Number(process.env.DESIGN_MOCKUPS_DAILY_MAX);
  return Number.isFinite(n) && n > 0 ? n : 300;
}

async function ownBrief() {
  if (!hasDatabase()) return null;
  const user = await getCurrentUser();
  if (user) {
    const row = await prisma.brief.findUnique({ where: { userId: user.id } });
    if (row) return row;
  }
  const anonKey = await readAnonKey();
  return anonKey ? prisma.brief.findUnique({ where: { anonKey } }) : null;
}

type BriefRow = NonNullable<Awaited<ReturnType<typeof ownBrief>>>;

async function isOpen(row: BriefRow): Promise<{ open: boolean; why: 'no_profile' | 'no_call' | null }> {
  if (!row.completedAt) return { open: false, why: 'no_profile' };
  const calls = await prisma.consultation.count({ where: { briefId: row.id, status: { not: 'cancelled' } } });
  return calls > 0 ? { open: true, why: null } : { open: false, why: 'no_call' };
}

const isStyle = (s: string): s is StyleTag => (STYLE_TAGS as readonly string[]).includes(s);

function toAnswer(m: { style: string; light: string; density: string; verdict: string | null; reason: string | null }): MockupAnswer | null {
  if (!m.verdict || !isStyle(m.style)) return null;
  return {
    style: m.style,
    light: m.light === 'light' || m.light === 'deep' ? m.light : 'balanced',
    density: m.density === 'layered' ? 'layered' : 'calm',
    verdict: m.verdict === 'up' ? 'up' : 'down',
    reason: (NO_REASONS as readonly string[]).includes(m.reason ?? '') ? (m.reason as NoReason) : null,
  };
}

async function dnaFor(row: BriefRow) {
  const brief = rowToBrief(row);
  // The boards exactly as the customer sees them: saved rooms, and the
  // suggested starting board for rooms they have not touched yet.
  const [prep, mockups] = await Promise.all([
    loadPrepPack(),
    prisma.designMockup.findMany({ where: { briefId: row.id }, orderBy: { createdAt: 'asc' } }),
  ]);
  const boards = (prep?.briefId === row.id ? prep.boards : []).map((b) => ({ roomKey: b.proposal.room, items: b.state.items }));
  const dna = designDna({
    likes: brief.styleLikes,
    dislikes: brief.styleDislikes,
    tier: brief.tier,
    boards: boards.map((b) => ({ room: b.roomKey, items: b.items })),
    answers: mockups.map(toAnswer).filter((a): a is MockupAnswer => a !== null),
  });
  return { brief, dna, mockups };
}

export interface MockupView {
  id: string;
  round: number;
  variant: string;
  caption: string;
  url: string | null;
  verdict: 'up' | 'down' | null;
  reason: NoReason | null;
  sample: boolean;
}

export type DesignView =
  | { open: false; why: 'no_profile' | 'no_call' | 'no_brief' }
  | {
      open: true;
      dna: DesignDna;
      rooms: { room: MockupRoom; label: string; mockups: MockupView[] }[];
      /** Pictures they can still have drawn today. */
      left: number;
    };

export async function loadDesign(): Promise<DesignView> {
  const row = await ownBrief();
  if (!row) return { open: false, why: 'no_brief' };
  const gate = await isOpen(row);
  if (!gate.open) return { open: false, why: gate.why ?? 'no_profile' };

  const { dna, mockups } = await dnaFor(row);
  const links = await mockupLinks(mockups.map((m) => m.imagePath));
  const today = mockups.filter((m) => m.createdAt >= startOfDay()).length;

  const rooms = MOCKUP_ROOMS.map((room) => ({
    room,
    label: MOCKUP_ROOM_LABELS[room],
    // Newest round first, A B C within it.
    mockups: mockups
      .filter((m) => m.roomKey === room)
      .sort((a, b) => b.round - a.round || a.variant.localeCompare(b.variant))
      .map((m) => ({
        id: m.id,
        round: m.round,
        variant: m.variant,
        caption: m.caption,
        url: links.get(m.imagePath) ?? null,
        verdict: m.verdict === 'up' ? ('up' as const) : m.verdict === 'down' ? ('down' as const) : null,
        reason: (NO_REASONS as readonly string[]).includes(m.reason ?? '') ? (m.reason as NoReason) : null,
        sample: m.model === 'placeholder',
      })),
  }));

  return { open: true, dna, rooms, left: Math.max(0, DAILY_PER_CUSTOMER - today) };
}

function startOfDay(now = new Date()): Date {
  // India's day, so the allowance resets at midnight in Pune, not in UTC.
  const ist = new Date(now.getTime() + 5.5 * 3600_000);
  ist.setUTCHours(0, 0, 0, 0);
  return new Date(ist.getTime() - 5.5 * 3600_000);
}

export type DrawRoundResult = { ok: true; drawn: number } | { ok: false; error: string };

export async function drawRound(roomKey: string): Promise<DrawRoundResult> {
  if (!(MOCKUP_ROOMS as readonly string[]).includes(roomKey)) return { ok: false, error: 'Unknown room.' };
  const room = roomKey as MockupRoom;
  const row = await ownBrief();
  if (!row) return { ok: false, error: 'Sign in to see room ideas.' };
  const gate = await isOpen(row);
  if (!gate.open) return { ok: false, error: gate.why === 'no_call' ? 'Room ideas open once your expert call is booked.' : 'Finish your Home Profile first.' };

  const since = startOfDay();
  const [mine, everyone] = await Promise.all([
    prisma.designMockup.count({ where: { briefId: row.id, createdAt: { gte: since } } }),
    prisma.designMockup.count({ where: { createdAt: { gte: since }, model: { not: 'placeholder' } } }),
  ]);
  if (mine + 3 > DAILY_PER_CUSTOMER) return { ok: false, error: 'That is today’s room ideas. More tomorrow.' };
  if (everyone + 3 > dailyCap()) return { ok: false, error: 'Room ideas are busy today. Try again tomorrow.' };

  const { brief, dna, mockups } = await dnaFor(row);
  const round = Math.max(0, ...mockups.filter((m) => m.roomKey === room).map((m) => m.round)) + 1;
  const bhk = brief.propertyType ? `${BEDROOMS[brief.propertyType]} BHK` : null;
  const variants = mockupVariants(dna, room, round, bhk);

  const drawn = await Promise.all(
    variants.map(async (v, i) => {
      const seed = hashSeed(`${row.id}:${room}:${round}:${v.variant}`);
      const pic = await drawRoom(v.prompt, seed, v.caption);
      if (!pic.ok) return pic;
      const stored = await storeMockup(row.id, room, pic.bytes, pic.mediaType);
      if (!stored.ok) return stored;
      await prisma.designMockup.create({
        data: {
          briefId: row.id,
          roomKey: room,
          round,
          variant: v.variant,
          style: v.style,
          blend: v.blend,
          light: v.light,
          density: v.density,
          caption: v.caption,
          prompt: v.prompt,
          imagePath: stored.path,
          model: pic.model,
        },
      });
      return { ok: true as const, i };
    }),
  );
  const ok = drawn.filter((d) => d.ok).length;
  if (ok === 0) {
    const first = drawn.find((d) => !d.ok) as { ok: false; error: string } | undefined;
    return { ok: false, error: first?.error ?? 'We could not draw this room just now.' };
  }
  return { ok: true, drawn: ok };
}

export type AnswerResult = { ok: true } | { ok: false; error: string };

export async function answerMockup(id: string, verdict: string, reason: string | null): Promise<AnswerResult> {
  if (verdict !== 'up' && verdict !== 'down') return { ok: false, error: 'Pick yes or no.' };
  const why = verdict === 'down' && reason && (NO_REASONS as readonly string[]).includes(reason) ? reason : null;
  const row = await ownBrief();
  if (!row) return { ok: false, error: 'Sign in to answer.' };
  // Scoped to their own brief: an id from someone else's board matches nothing.
  const updated = await prisma.designMockup.updateMany({
    where: { id, briefId: row.id },
    data: { verdict, reason: why, answeredAt: new Date() },
  });
  return updated.count === 1 ? { ok: true } : { ok: false, error: 'We could not find that picture.' };
}

function hashSeed(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return (h >>> 0) % 2147483647;
}
