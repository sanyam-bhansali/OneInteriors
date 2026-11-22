import 'server-only';

/**
 * Petty cash (owner, 21 Nov 2026): the writes and the views. The rules are in
 * rules.ts. Accounts = anyone who records payments (the owner, the accounts
 * role). Anyone on the team who is not view-only may spend and put in their
 * expenses; their phone shows their own cash only.
 */

import { createHash } from 'node:crypto';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { fromDb, toDb } from '@/lib/money';
import { can, currentMember, type StudioMemberRef } from '@/modules/studio/access';
import { projectName } from '@/modules/studio-crews/store';
import { signedSitePhotoUrls, storeSitePhoto } from '@/modules/storage/site-photos';
import { dayFromDb, dayToDb, isDay, istDay } from '@/modules/project/working-days';
import { readBill } from './reader';
import { balanceOf, cleanNote, flagsFor, parseRupees, readFlags, vendorKey, type Flag } from './rules';

export type PettyResult = { ok: true; message: string } | { ok: false; error: string };

const writer = (m: StudioMemberRef | null): m is StudioMemberRef => m !== null && !m.viewOnly;
const isAccounts = (m: StudioMemberRef) => can(m, 'payment.record');
/** Projects money can be spent on: running ones, from design to snags. */
const RUNNING = { cancelledAt: null, phase: { in: ['DESIGN', 'PRE_EXECUTION', 'EXECUTION', 'CLOSURE', 'SNAGS'] } } satisfies Prisma.HomeProjectWhereInput;
const BRIEF = { select: { society: true, locality: true, propertyType: true, contactName: true, user: { select: { name: true } } } } as const;

async function nameOf(userId: string): Promise<string> {
  const u = await prisma.user.findUnique({ where: { id: userId }, select: { name: true } });
  return u?.name?.trim() || 'Someone';
}

const dayShort = (d: string) => new Date(`${d}T00:00:00Z`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: 'UTC' });

// ── Accounts gives cash ───────────────────────────────────────

export async function giveCash(input: { memberId: unknown; amount: unknown; givenOn: unknown; note: unknown }, now = new Date()): Promise<PettyResult> {
  const me = await currentMember();
  if (!writer(me) || !isAccounts(me)) return { ok: false, error: 'Only the owner or accounts enters petty cash given.' };
  const memberId = typeof input.memberId === 'string' ? input.memberId : '';
  const to = await prisma.studioMember.findFirst({ where: { id: memberId, studioId: me.studioId, status: 'ACTIVE' }, select: { id: true, userId: true } });
  if (!to) return { ok: false, error: 'Pick who it was given to.' };
  const amount = parseRupees(input.amount);
  if (amount === null) return { ok: false, error: 'Write the amount in rupees, like 50000.' };
  const givenOn = isDay(input.givenOn) ? input.givenOn : istDay(now);
  await prisma.studioPettyCash.create({
    data: { studioId: me.studioId, memberId: to.id, amountPaise: toDb(amount), givenOn: dayToDb(givenOn), note: cleanNote(input.note) || null, byId: me.userId, byName: await nameOf(me.userId) },
  });
  return { ok: true, message: `₹${Math.round(amount / 100).toLocaleString('en-IN')} entered. It shows on their phone to mark received.` };
}

/** The person marks cash given to them as received. */
export async function markReceived(cashId: unknown, now = new Date()): Promise<PettyResult> {
  const me = await currentMember();
  if (!writer(me)) return { ok: false, error: 'Sign in to your studio.' };
  const { count } = await prisma.studioPettyCash.updateMany({ where: { id: typeof cashId === 'string' ? cashId : '', memberId: me.id, receivedAt: null }, data: { receivedAt: now } });
  return count === 1 ? { ok: true, message: 'Marked received.' } : { ok: false, error: 'That is not waiting for you to mark received. Reload the page.' };
}

// ── An expense ────────────────────────────────────────────────

/**
 * Puts an expense under a project with its bill (mandatory). Any running
 * project of the studio may be tagged; flags are worked out here, with their
 * reasons, and never stop the expense.
 */
export async function logExpense(form: FormData, now = new Date()): Promise<PettyResult> {
  const me = await currentMember();
  if (!writer(me)) return { ok: false, error: 'Sign in to your studio.' };
  const amount = parseRupees(form.get('amount'));
  if (amount === null) return { ok: false, error: 'Write the amount in rupees, like 450.' };
  const projectId = String(form.get('projectId') ?? '');
  const project = await prisma.homeProject.findFirst({
    where: { id: projectId, introduction: { studioId: me.studioId }, ...RUNNING },
    select: { id: true, introduction: { select: { brief: BRIEF } }, team: { select: { memberId: true, member: { select: { role: true, user: { select: { name: true } } } } } } },
  });
  if (!project) return { ok: false, error: 'Pick the project it was spent on.' };
  const note = cleanNote(form.get('note'));
  if (note.length < 3) return { ok: false, error: 'Say what it was for, like "Hinges and screws".' };
  const spentRaw = String(form.get('spentOn') ?? '');
  const spentOn = isDay(spentRaw) && spentRaw <= istDay(now) ? spentRaw : istDay(now);
  const bill = form.get('bill');
  if (!(bill instanceof File) || bill.size === 0) return { ok: false, error: 'Add the bill photo or a screenshot of the payment. It is needed.' };

  const bytes = Buffer.from(await bill.arrayBuffer());
  const billHash = createHash('sha256').update(bytes).digest('hex');
  const stored = await storeSitePhoto(project.id, bill);
  if (!stored.ok) return { ok: false, error: stored.error };
  const read = await readBill({ mediaType: bill.type, base64: bytes.toString('base64') });

  const memberName = await nameOf(me.userId);
  const pName = projectName(project.introduction.brief);
  const [history, sameHash, sameDetails] = await Promise.all([
    prisma.studioPettyExpense.findMany({ where: { studioId: me.studioId, rejected: false }, orderBy: { createdAt: 'desc' }, take: 200, select: { amountPaise: true } }),
    prisma.studioPettyExpense.findMany({ where: { studioId: me.studioId, billHash }, take: 5, select: { memberId: true, memberName: true, spentOn: true, homeProjectId: true } }),
    read.ok && read.amountPaise !== null && read.day
      ? prisma.studioPettyExpense.findMany({ where: { studioId: me.studioId, readDay: read.day, readAmountPaise: toDb(read.amountPaise), NOT: { billHash } }, take: 10, select: { memberName: true, spentOn: true, homeProjectId: true, readVendor: true } })
      : Promise.resolve([]),
  ]);
  const names = await projectNames([...sameHash.map((h) => h.homeProjectId), ...sameDetails.map((h) => h.homeProjectId)]);
  const siteTeam = project.team.filter((t) => t.member.role === 'SUPERVISOR' || t.member.role === 'PM').map((t) => t.member.user.name?.trim() || 'Someone');
  const flags: Flag[] = flagsFor({
    amountPaise: amount,
    memberId: me.id,
    memberName,
    projectName: pName,
    onSite: project.team.some((t) => t.memberId === me.id),
    siteTeam,
    history: history.map((h) => fromDb(h.amountPaise)),
    sameHash: sameHash.map((h) => ({ memberId: h.memberId, memberName: h.memberName, day: dayShort(dayFromDb(h.spentOn)), projectName: names.get(h.homeProjectId) ?? 'a project' })),
    sameDetails: sameDetails
      .filter((d) => read.ok && vendorKey(d.readVendor) === vendorKey(read.vendor))
      .map((d) => ({ memberName: d.memberName, day: dayShort(dayFromDb(d.spentOn)), projectName: names.get(d.homeProjectId) ?? 'a project' })),
    read: read.ok ? { isBill: read.isBill, amountPaise: read.amountPaise, why: read.why } : null,
  });

  await prisma.studioPettyExpense.create({
    data: {
      studioId: me.studioId,
      memberId: me.id,
      memberName,
      homeProjectId: project.id,
      amountPaise: toDb(amount),
      spentOn: dayToDb(spentOn),
      note,
      billPath: stored.path,
      billHash,
      readAmountPaise: read.ok && read.amountPaise !== null ? toDb(read.amountPaise) : null,
      readDay: read.ok ? read.day : null,
      readVendor: read.ok ? read.vendor : null,
      readSummary: read.ok ? read.summary || null : null,
      flags: flags as unknown as Prisma.InputJsonValue,
    },
  });
  return { ok: true, message: flags.length ? 'Saved. Accounts will take a look at it.' : 'Saved.' };
}

async function projectNames(ids: readonly string[]): Promise<Map<string, string>> {
  if (ids.length === 0) return new Map();
  const rows = await prisma.homeProject.findMany({ where: { id: { in: [...new Set(ids)] } }, select: { id: true, introduction: { select: { brief: BRIEF } } } });
  return new Map(rows.map((r) => [r.id, projectName(r.introduction.brief)]));
}

/** Accounts clears an expense's flags, or rejects it (it stops counting: the money is still with the person). */
export async function reviewExpense(id: unknown, action: 'clear' | 'reject' | 'undo', note: unknown, now = new Date()): Promise<PettyResult> {
  const me = await currentMember();
  if (!writer(me) || !isAccounts(me)) return { ok: false, error: 'Only the owner or accounts reviews expenses.' };
  const text = cleanNote(note);
  if (action !== 'undo' && text.length < 3) return { ok: false, error: 'Write a short note on why.' };
  const data =
    action === 'undo'
      ? { reviewedAt: null, reviewedById: null, reviewNote: null, rejected: false }
      : { reviewedAt: now, reviewedById: me.userId, reviewNote: text, rejected: action === 'reject' };
  const { count } = await prisma.studioPettyExpense.updateMany({ where: { id: typeof id === 'string' ? id : '', studioId: me.studioId }, data });
  if (count !== 1) return { ok: false, error: 'That expense is not there any more. Reload the page.' };
  return { ok: true, message: action === 'reject' ? 'Rejected: it no longer counts, and the money shows as still with them.' : action === 'clear' ? 'Cleared.' : 'Back to review.' };
}

// ── Views ─────────────────────────────────────────────────────

export interface ExpenseRow {
  id: string;
  who: string;
  memberId: string;
  projectId: string;
  project: string;
  amountPaise: number;
  spentOn: string;
  note: string;
  billUrl: string | null;
  read: string | null;
  flags: Flag[];
  reviewed: { note: string | null; rejected: boolean } | null;
}

type ExpenseDb = {
  id: string;
  memberId: string;
  memberName: string;
  homeProjectId: string;
  amountPaise: bigint;
  spentOn: Date;
  note: string;
  billPath: string;
  readAmountPaise: bigint | null;
  readVendor: string | null;
  readSummary: string | null;
  flags: unknown;
  reviewedAt: Date | null;
  reviewNote: string | null;
  rejected: boolean;
};
const EXPENSE_SELECT = {
  id: true,
  memberId: true,
  memberName: true,
  homeProjectId: true,
  amountPaise: true,
  spentOn: true,
  note: true,
  billPath: true,
  readAmountPaise: true,
  readVendor: true,
  readSummary: true,
  flags: true,
  reviewedAt: true,
  reviewNote: true,
  rejected: true,
} as const;

async function toRows(list: readonly ExpenseDb[]): Promise<ExpenseRow[]> {
  const [names, urls] = await Promise.all([projectNames(list.map((e) => e.homeProjectId)), signedSitePhotoUrls(list.map((e) => e.billPath))]);
  return list.map((e, i) => ({
    id: e.id,
    who: e.memberName,
    memberId: e.memberId,
    projectId: e.homeProjectId,
    project: names.get(e.homeProjectId) ?? 'A project',
    amountPaise: fromDb(e.amountPaise),
    spentOn: dayFromDb(e.spentOn),
    note: e.note,
    billUrl: urls.length === list.length ? urls[i]! : null,
    read: e.readSummary || e.readVendor ? [e.readVendor, e.readSummary, e.readAmountPaise !== null ? `₹${Math.round(fromDb(e.readAmountPaise) / 100).toLocaleString('en-IN')}` : null].filter(Boolean).join(' · ') : null,
    flags: readFlags(e.flags),
    reviewed: e.reviewedAt ? { note: e.reviewNote, rejected: e.rejected } : null,
  }));
}

export interface CashRow {
  id: string;
  amountPaise: number;
  givenOn: string;
  note: string | null;
  by: string;
  received: boolean;
}

/** The person's own petty cash: on their phone. */
export async function myCash(): Promise<{
  balance: ReturnType<typeof balanceOf>;
  cash: CashRow[];
  expenses: ExpenseRow[];
  mine: { id: string; name: string }[];
  others: { id: string; name: string }[];
  today: string;
} | null> {
  const me = await currentMember();
  if (!me) return null;
  const [cash, expenses, projects] = await Promise.all([
    prisma.studioPettyCash.findMany({ where: { studioId: me.studioId, memberId: me.id }, orderBy: { givenOn: 'desc' }, take: 100 }),
    prisma.studioPettyExpense.findMany({ where: { studioId: me.studioId, memberId: me.id }, orderBy: { createdAt: 'desc' }, take: 50, select: EXPENSE_SELECT }),
    prisma.homeProject.findMany({ where: { introduction: { studioId: me.studioId }, ...RUNNING }, select: { id: true, introduction: { select: { brief: BRIEF } }, team: { where: { memberId: me.id }, select: { id: true } } }, take: 300 }),
  ]);
  const allSpent = await prisma.studioPettyExpense.findMany({ where: { studioId: me.studioId, memberId: me.id }, select: { amountPaise: true, rejected: true } });
  const named = projects.map((p) => ({ id: p.id, name: projectName(p.introduction.brief), mine: p.team.length > 0 })).sort((a, b) => a.name.localeCompare(b.name));
  return {
    balance: balanceOf(
      cash.map((c) => ({ amountPaise: fromDb(c.amountPaise), received: c.receivedAt !== null })),
      allSpent.map((s) => ({ amountPaise: fromDb(s.amountPaise), rejected: s.rejected })),
    ),
    cash: cash.map((c) => ({ id: c.id, amountPaise: fromDb(c.amountPaise), givenOn: dayFromDb(c.givenOn), note: c.note, by: c.byName, received: c.receivedAt !== null })),
    expenses: await toRows(expenses),
    // Owner, 21 Nov 2026: they may tag any project, but see their own first.
    mine: named.filter((p) => p.mine).map(({ id, name }) => ({ id, name })),
    others: named.filter((p) => !p.mine).map(({ id, name }) => ({ id, name })),
    today: istDay(new Date()),
  };
}

export interface PersonBalance {
  memberId: string;
  name: string;
  given: number;
  received: number;
  spent: number;
  pending: number;
  waitingToMark: number;
}

/** Accounts' desk: everyone's balance, flags to review, recent expenses, and who cash can go to. */
export async function pettyDesk(): Promise<{ people: PersonBalance[]; flagged: ExpenseRow[]; recent: ExpenseRow[]; team: { id: string; name: string }[]; today: string } | null> {
  const me = await currentMember();
  if (!me || !isAccounts(me)) return null;
  const [members, cash, spent, flaggedDb, recentDb] = await Promise.all([
    prisma.studioMember.findMany({ where: { studioId: me.studioId, status: 'ACTIVE' }, select: { id: true, user: { select: { name: true } } } }),
    prisma.studioPettyCash.findMany({ where: { studioId: me.studioId }, select: { memberId: true, amountPaise: true, receivedAt: true } }),
    prisma.studioPettyExpense.findMany({ where: { studioId: me.studioId }, select: { memberId: true, amountPaise: true, rejected: true } }),
    prisma.studioPettyExpense.findMany({ where: { studioId: me.studioId, reviewedAt: null, NOT: { flags: { equals: [] } } }, orderBy: { createdAt: 'desc' }, take: 100, select: EXPENSE_SELECT }),
    prisma.studioPettyExpense.findMany({ where: { studioId: me.studioId }, orderBy: { createdAt: 'desc' }, take: 30, select: EXPENSE_SELECT }),
  ]);
  const name = new Map(members.map((m) => [m.id, m.user.name?.trim() || 'Someone']));
  const ids = [...new Set([...cash.map((c) => c.memberId), ...spent.map((s) => s.memberId)])];
  const people = ids
    .map((id) => {
      const b = balanceOf(
        cash.filter((c) => c.memberId === id).map((c) => ({ amountPaise: fromDb(c.amountPaise), received: c.receivedAt !== null })),
        spent.filter((s) => s.memberId === id).map((s) => ({ amountPaise: fromDb(s.amountPaise), rejected: s.rejected })),
      );
      return { memberId: id, name: name.get(id) ?? 'Former member', ...b, waitingToMark: b.given - b.received };
    })
    .sort((a, b) => b.pending - a.pending);
  return {
    people,
    flagged: (await toRows(flaggedDb)).filter((e) => e.flags.length > 0),
    recent: await toRows(recentDb),
    team: members.map((m) => ({ id: m.id, name: name.get(m.id)! })).sort((a, b) => a.name.localeCompare(b.name)),
    today: istDay(new Date()),
  };
}

/** How many flagged expenses wait for review (a count for accounts' pages). */
export async function flaggedCount(studioId: string): Promise<number> {
  return prisma.studioPettyExpense.count({ where: { studioId, reviewedAt: null, NOT: { flags: { equals: [] } } } }).catch(() => 0);
}

/** A project's petty-cash expenses, for its money tab: who paid, what, the bill. */
export async function projectExpenses(projectId: string): Promise<{ rows: ExpenseRow[]; totalPaise: number }> {
  const me = await currentMember();
  if (!me || !can(me, 'payment.read')) return { rows: [], totalPaise: 0 };
  const list = await prisma.studioPettyExpense.findMany({ where: { studioId: me.studioId, homeProjectId: projectId }, orderBy: { spentOn: 'desc' }, take: 200, select: EXPENSE_SELECT });
  const rows = await toRows(list);
  return { rows, totalPaise: rows.filter((r) => !r.reviewed?.rejected).reduce((a, r) => a + r.amountPaise, 0) };
}
