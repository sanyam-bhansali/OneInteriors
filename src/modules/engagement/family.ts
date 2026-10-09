import 'server-only';

/**
 * Family on a project (v79 design): the owner invites people on WhatsApp;
 * they join by signing in with the number they were invited on. Family see
 * the project — site updates, stages, snags, documents — and vote on
 * decisions. Only the owner chooses an option and approves payments.
 *
 * Every call checks the signed-in user against the project here, never
 * trusting what the screen sent.
 */

import { randomBytes } from 'node:crypto';
import { prisma } from '@/lib/prisma';
import { normalisePhone } from '@/modules/studio/phone';

export type FamilyResult = { ok: true; id?: string; token?: string } | { ok: false; error: string };

export const MAX_FAMILY = 6;
const RELATIONS = ['Husband', 'Wife', 'Partner', 'Father', 'Mother', 'Son', 'Daughter', 'Brother', 'Sister', 'Other'] as const;

/** The project this user owns (their brief's), newest first. */
async function ownedProject(userId: string, projectId: string) {
  return prisma.homeProject.findFirst({
    where: { id: projectId, introduction: { brief: { userId } } },
    select: { id: true },
  });
}

export async function inviteFamily(
  userId: string,
  projectId: string,
  input: { name: unknown; relation: unknown; phone: unknown },
): Promise<FamilyResult> {
  if (!(await ownedProject(userId, projectId))) return { ok: false, error: 'Only the owner of the project can invite family.' };
  const name = typeof input.name === 'string' ? input.name.trim().slice(0, 40) : '';
  if (name.length < 2) return { ok: false, error: 'Their name, please.' };
  const phone = normalisePhone(typeof input.phone === 'string' ? input.phone : '');
  if (!phone) return { ok: false, error: 'A 10-digit Indian mobile number, please.' };
  const relation = typeof input.relation === 'string' && (RELATIONS as readonly string[]).includes(input.relation) ? input.relation : null;

  const me = await prisma.user.findUnique({ where: { id: userId }, select: { phone: true } });
  if (me?.phone && normalisePhone(me.phone) === phone) return { ok: false, error: 'That is your own number.' };

  const count = await prisma.familyMember.count({ where: { projectId, removedAt: null } });
  if (count >= MAX_FAMILY) return { ok: false, error: `Up to ${MAX_FAMILY} family members.` };

  const token = randomBytes(18).toString('base64url');
  try {
    const row = await prisma.familyMember.upsert({
      where: { projectId_phone: { projectId, phone } },
      create: { projectId, phone, name, relation, invitedById: userId, inviteToken: token },
      update: { name, relation, removedAt: null, inviteToken: token },
      select: { id: true, inviteToken: true },
    });
    return { ok: true, id: row.id, token: row.inviteToken };
  } catch {
    return { ok: false, error: 'That did not save. Try again.' };
  }
}

export async function removeFamily(userId: string, memberId: string): Promise<FamilyResult> {
  const m = await prisma.familyMember.findFirst({
    where: { id: memberId, project: { introduction: { brief: { userId } } } },
    select: { id: true },
  });
  if (!m) return { ok: false, error: 'Only the owner can remove family.' };
  await prisma.familyMember.update({ where: { id: m.id }, data: { removedAt: new Date() } });
  return { ok: true };
}

export interface InviteView {
  ownerName: string | null;
  studio: string;
  name: string;
  /** True when the signed-in user's number is the invited one. */
  matches: boolean;
  joined: boolean;
}

/** What an invite link shows, for the person holding it. */
export async function inviteView(token: string, userId: string | null): Promise<InviteView | null> {
  const m = await prisma.familyMember.findUnique({
    where: { inviteToken: token },
    select: {
      name: true,
      phone: true,
      userId: true,
      removedAt: true,
      project: { select: { introduction: { select: { studio: { select: { tradeName: true } }, brief: { select: { contactName: true } } } } } },
    },
  });
  if (!m || m.removedAt) return null;
  const user = userId ? await prisma.user.findUnique({ where: { id: userId }, select: { phone: true } }) : null;
  return {
    ownerName: m.project.introduction.brief.contactName,
    studio: m.project.introduction.studio.tradeName,
    name: m.name,
    matches: Boolean(user?.phone && normalisePhone(user.phone) === m.phone),
    joined: Boolean(userId && m.userId === userId),
  };
}

/** Join with the invite: only when the signed-in number is the one invited. */
export async function joinFamily(token: string, userId: string): Promise<FamilyResult> {
  const view = await inviteView(token, userId);
  if (!view) return { ok: false, error: 'This invite has been withdrawn.' };
  if (!view.matches) return { ok: false, error: 'Sign in with the number you were invited on.' };
  await prisma.familyMember.update({ where: { inviteToken: token }, data: { userId, joinedAt: new Date() } });
  return { ok: true };
}

/** The projects this user may see as family (joined, not removed). */
export async function familyProjectIds(userId: string): Promise<string[]> {
  const rows = await prisma.familyMember.findMany({ where: { userId, joinedAt: { not: null }, removedAt: null }, select: { projectId: true } });
  return rows.map((r) => r.projectId);
}

/** A family vote on an open decision. The owner still chooses; a vote can be changed until then. */
export async function voteDecision(userId: string, decisionId: string, index: unknown, note: unknown): Promise<FamilyResult> {
  const d = await prisma.homeDecision.findFirst({
    where: { id: decisionId, project: { family: { some: { userId, joinedAt: { not: null }, removedAt: null } } } },
    select: { id: true, options: true, chosenIndex: true, dueOn: true },
  });
  if (!d) return { ok: false, error: 'Only family on this project can vote.' };
  const options = Array.isArray(d.options) ? d.options : [];
  if (!Number.isInteger(index) || (index as number) < 0 || (index as number) >= options.length) return { ok: false, error: 'Pick one of the options.' };
  if (d.chosenIndex !== null) return { ok: false, error: 'This one has been decided.' };
  const text = typeof note === 'string' ? note.trim().slice(0, 120) || null : null;
  await prisma.decisionVote.upsert({
    where: { decisionId_userId: { decisionId: d.id, userId } },
    create: { decisionId: d.id, userId, optionIndex: index as number, note: text },
    update: { optionIndex: index as number, note: text },
  });
  return { ok: true };
}

export interface FamilyRow {
  id: string;
  name: string;
  relation: string | null;
  joined: boolean;
  token: string;
}

/** The owner's family list for a project. */
export async function familyOf(userId: string, projectId: string): Promise<FamilyRow[] | null> {
  if (!(await ownedProject(userId, projectId))) return null;
  const rows = await prisma.familyMember.findMany({
    where: { projectId, removedAt: null },
    orderBy: { createdAt: 'asc' },
    select: { id: true, name: true, relation: true, joinedAt: true, inviteToken: true },
  });
  return rows.map((r) => ({ id: r.id, name: r.name, relation: r.relation, joined: Boolean(r.joinedAt), token: r.inviteToken }));
}

export { RELATIONS };
