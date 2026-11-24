import 'server-only';

/**
 * Employee records (owner, 21 Nov 2026): the writes and the views. Rules in
 * rules.ts. Owner and accounts only (not view-only); everyone else gets
 * nothing, not even that a record exists.
 */

import { prisma } from '@/lib/prisma';
import { fromDb, toDb } from '@/lib/money';
import { currentMember, type StudioMemberRef } from '@/modules/studio/access';
import { deleteStaffDoc, signedStaffLinks, storeStaffDoc } from '@/modules/storage/staff-docs';
import { dayFromDb, dayToDb, isDay, istDay } from '@/modules/project/working-days';
import {
  parseRupees,
  cleanFileName,
  cleanText,
  incentiveTotals,
  isStaffDocKind,
  parseMonth,
  REQUIRED_DOCS,
  salaryOn,
  STAFF_DOC_KINDS,
  staffFileError,
  type StaffDocKind,
} from './rules';

export type StaffResult = { ok: true; message: string } | { ok: false; error: string };

/** Owner and accounts keep employee records. */
export const mayKeepStaff = (m: StudioMemberRef | null): m is StudioMemberRef => m !== null && m.status === 'ACTIVE' && !m.viewOnly && (m.role === 'OWNER' || m.role === 'ACCOUNTS');
const NO = { ok: false as const, error: 'Only the owner or accounts keeps employee records.' };

async function keeper(): Promise<StudioMemberRef | null> {
  const m = await currentMember();
  return mayKeepStaff(m) ? m : null;
}

async function memberOf(studioId: string, memberId: unknown) {
  if (typeof memberId !== 'string' || !memberId) return null;
  return prisma.studioMember.findFirst({ where: { id: memberId, studioId }, select: { id: true, role: true, status: true, createdAt: true, user: { select: { name: true, phone: true, email: true } } } });
}

const ROLE_WORDS: Record<string, string> = { OWNER: 'Owner', PM: 'Project manager', SUPERVISOR: 'Site supervisor', ACCOUNTS: 'Accounts', SALES: 'Sales', DESIGNER: 'Designer' };

// ── Views ─────────────────────────────────────────────────────

export interface StaffListRow {
  memberId: string;
  name: string;
  role: string;
  designation: string | null;
  salaryPaise: number | null;
  missingDocs: string[];
  devicesOut: number;
  incentivesOwedPaise: number;
  active: boolean;
}

export async function staffList(now = new Date()): Promise<StaffListRow[] | null> {
  const me = await keeper();
  if (!me) return null;
  const today = istDay(now);
  const [members, records, docs, salaries, devices, incentives] = await Promise.all([
    prisma.studioMember.findMany({ where: { studioId: me.studioId }, select: { id: true, role: true, status: true, user: { select: { name: true } } } }),
    prisma.studioStaffRecord.findMany({ where: { studioId: me.studioId }, select: { memberId: true, designation: true } }),
    prisma.studioStaffDoc.findMany({ where: { studioId: me.studioId, removedAt: null }, select: { memberId: true, kind: true } }),
    prisma.studioStaffSalary.findMany({ where: { studioId: me.studioId }, select: { memberId: true, monthlyPaise: true, fromDay: true } }),
    prisma.studioStaffDevice.findMany({ where: { studioId: me.studioId, returnedOn: null }, select: { memberId: true } }),
    prisma.studioStaffIncentive.findMany({ where: { studioId: me.studioId, paidOn: null }, select: { memberId: true, amountPaise: true } }),
  ]);
  return members
    .map((m) => {
      const has = new Set(docs.filter((d) => d.memberId === m.id).map((d) => d.kind));
      const sal = salaryOn(
        salaries.filter((s) => s.memberId === m.id).map((s) => ({ fromDay: dayFromDb(s.fromDay), monthlyPaise: fromDb(s.monthlyPaise) })),
        today,
      );
      return {
        memberId: m.id,
        name: m.user.name?.trim() || 'Someone',
        role: ROLE_WORDS[m.role] ?? m.role,
        designation: records.find((r) => r.memberId === m.id)?.designation ?? null,
        salaryPaise: sal?.monthlyPaise ?? null,
        missingDocs: REQUIRED_DOCS.filter((k) => !has.has(k)).map((k) => STAFF_DOC_KINDS[k]),
        devicesOut: devices.filter((d) => d.memberId === m.id).length,
        incentivesOwedPaise: incentives.filter((i) => i.memberId === m.id).reduce((a, i) => a + fromDb(i.amountPaise), 0),
        active: m.status === 'ACTIVE',
      };
    })
    .sort((a, b) => Number(b.active) - Number(a.active) || a.name.localeCompare(b.name));
}

export interface StaffRecordView {
  memberId: string;
  name: string;
  role: string;
  phone: string | null;
  email: string | null;
  active: boolean;
  profile: { designation: string; joinedOn: string; address: string };
  docs: { id: string; kind: StaffDocKind; kindLabel: string; fileName: string; bytes: number; url: string | null; on: string }[];
  usedBytes: number;
  missingDocs: string[];
  salaries: { id: string; monthlyPaise: number; fromDay: string; note: string | null; current: boolean }[];
  incentives: { id: string; month: string; amountPaise: number; reason: string; paidOn: string | null }[];
  incentiveTotals: { earned: number; paid: number; owed: number };
  devices: { id: string; kind: string; model: string; serial: string | null; givenOn: string; returnedOn: string | null; note: string | null }[];
  today: string;
}

export async function staffRecord(memberId: unknown, now = new Date()): Promise<StaffRecordView | null> {
  const me = await keeper();
  if (!me) return null;
  const m = await memberOf(me.studioId, memberId);
  if (!m) return null;
  const today = istDay(now);
  const [rec, docs, salaries, incentives, devices] = await Promise.all([
    prisma.studioStaffRecord.findUnique({ where: { memberId: m.id } }),
    prisma.studioStaffDoc.findMany({ where: { studioId: me.studioId, memberId: m.id, removedAt: null }, orderBy: { createdAt: 'desc' } }),
    prisma.studioStaffSalary.findMany({ where: { studioId: me.studioId, memberId: m.id }, orderBy: [{ fromDay: 'desc' }, { createdAt: 'desc' }] }),
    prisma.studioStaffIncentive.findMany({ where: { studioId: me.studioId, memberId: m.id }, orderBy: [{ month: 'desc' }, { createdAt: 'desc' }] }),
    prisma.studioStaffDevice.findMany({ where: { studioId: me.studioId, memberId: m.id }, orderBy: { givenOn: 'desc' } }),
  ]);
  const links = await signedStaffLinks(docs.map((d) => d.path));
  const sal = salaries.map((s) => ({ id: s.id, monthlyPaise: fromDb(s.monthlyPaise), fromDay: dayFromDb(s.fromDay), note: s.note }));
  const current = salaryOn(sal, today);
  const has = new Set(docs.map((d) => d.kind));
  const inc = incentives.map((i) => ({ id: i.id, month: i.month, amountPaise: fromDb(i.amountPaise), reason: i.reason, paidOn: i.paidOn ? dayFromDb(i.paidOn) : null }));
  return {
    memberId: m.id,
    name: m.user.name?.trim() || 'Someone',
    role: ROLE_WORDS[m.role] ?? m.role,
    phone: m.user.phone,
    email: m.user.email,
    active: m.status === 'ACTIVE',
    profile: { designation: rec?.designation ?? '', joinedOn: rec?.joinedOn ? dayFromDb(rec.joinedOn) : '', address: rec?.address ?? '' },
    docs: docs.map((d) => ({
      id: d.id,
      kind: (isStaffDocKind(d.kind) ? d.kind : 'OTHER') as StaffDocKind,
      kindLabel: STAFF_DOC_KINDS[isStaffDocKind(d.kind) ? d.kind : 'OTHER'],
      fileName: d.fileName,
      bytes: d.bytes,
      url: links.get(d.path) ?? null,
      on: istDay(d.createdAt),
    })),
    usedBytes: docs.reduce((a, d) => a + d.bytes, 0),
    missingDocs: REQUIRED_DOCS.filter((k) => !has.has(k)).map((k) => STAFF_DOC_KINDS[k]),
    salaries: sal.map((s) => ({ ...s, current: current?.id === s.id })),
    incentives: inc,
    incentiveTotals: incentiveTotals(inc.map((i) => ({ amountPaise: i.amountPaise, paid: i.paidOn !== null }))),
    devices: devices.map((d) => ({ id: d.id, kind: d.kind, model: d.model, serial: d.serial, givenOn: dayFromDb(d.givenOn), returnedOn: d.returnedOn ? dayFromDb(d.returnedOn) : null, note: d.note })),
    today,
  };
}

// ── Writes ────────────────────────────────────────────────────

export async function saveProfile(input: { memberId: unknown; designation: unknown; joinedOn: unknown; address: unknown }): Promise<StaffResult> {
  const me = await keeper();
  if (!me) return NO;
  const m = await memberOf(me.studioId, input.memberId);
  if (!m) return { ok: false, error: 'That person is not on your team.' };
  const joined = isDay(input.joinedOn) ? input.joinedOn : null;
  const data = { designation: cleanText(input.designation, 80) || null, joinedOn: joined ? dayToDb(joined) : null, address: cleanText(input.address, 300) || null, updatedById: me.userId };
  await prisma.studioStaffRecord.upsert({ where: { memberId: m.id }, create: { studioId: me.studioId, memberId: m.id, ...data }, update: data });
  return { ok: true, message: 'Saved.' };
}

export async function uploadDoc(form: FormData, now = new Date()): Promise<StaffResult> {
  const me = await keeper();
  if (!me) return NO;
  const m = await memberOf(me.studioId, form.get('memberId'));
  if (!m) return { ok: false, error: 'That person is not on your team.' };
  const kind = form.get('kind');
  if (!isStaffDocKind(kind)) return { ok: false, error: 'Say which document it is.' };
  const file = form.get('file');
  if (!(file instanceof File)) return { ok: false, error: 'Pick the file.' };
  const used = await prisma.studioStaffDoc.aggregate({ where: { studioId: me.studioId, memberId: m.id, removedAt: null }, _sum: { bytes: true } });
  const bad = staffFileError(file, used._sum.bytes ?? 0);
  if (bad) return { ok: false, error: bad };
  const stored = await storeStaffDoc(me.studioId, m.id, kind, file);
  if (!stored.ok) return stored;
  await prisma.studioStaffDoc.create({
    data: { studioId: me.studioId, memberId: m.id, kind, fileName: cleanFileName(file.name, kind), path: stored.path, bytes: file.size, contentType: file.type, uploadedById: me.userId, createdAt: now },
  });
  return { ok: true, message: `${STAFF_DOC_KINDS[kind]} added.` };
}

export async function removeDoc(docId: unknown, now = new Date()): Promise<StaffResult> {
  const me = await keeper();
  if (!me) return NO;
  const doc = await prisma.studioStaffDoc.findFirst({ where: { id: typeof docId === 'string' ? docId : '', studioId: me.studioId, removedAt: null }, select: { id: true, path: true } });
  if (!doc) return { ok: false, error: 'That file is not there any more. Reload the page.' };
  await prisma.studioStaffDoc.update({ where: { id: doc.id }, data: { removedAt: now } });
  await deleteStaffDoc(doc.path);
  return { ok: true, message: 'Removed.' };
}

export async function addSalary(input: { memberId: unknown; amount: unknown; fromDay: unknown; note: unknown }): Promise<StaffResult> {
  const me = await keeper();
  if (!me) return NO;
  const m = await memberOf(me.studioId, input.memberId);
  if (!m) return { ok: false, error: 'That person is not on your team.' };
  const paise = parseRupees(input.amount);
  if (paise === null) return { ok: false, error: 'Write the monthly salary in rupees, like 35000.' };
  if (!isDay(input.fromDay)) return { ok: false, error: 'Pick the day it starts from.' };
  await prisma.studioStaffSalary.create({ data: { studioId: me.studioId, memberId: m.id, monthlyPaise: toDb(paise), fromDay: dayToDb(input.fromDay), note: cleanText(input.note, 200) || null, byId: me.userId } });
  return { ok: true, message: 'Salary saved.' };
}

export async function addIncentive(input: { memberId: unknown; month: unknown; amount: unknown; reason: unknown }): Promise<StaffResult> {
  const me = await keeper();
  if (!me) return NO;
  const m = await memberOf(me.studioId, input.memberId);
  if (!m) return { ok: false, error: 'That person is not on your team.' };
  const month = parseMonth(input.month);
  if (!month) return { ok: false, error: 'Pick the month it was earned in.' };
  const paise = parseRupees(input.amount);
  if (paise === null) return { ok: false, error: 'Write the incentive in rupees, like 5000.' };
  const reason = cleanText(input.reason, 200);
  if (reason.length < 3) return { ok: false, error: 'Say what it is for, like "3 bookings in October".' };
  await prisma.studioStaffIncentive.create({ data: { studioId: me.studioId, memberId: m.id, month, amountPaise: toDb(paise), reason, byId: me.userId } });
  return { ok: true, message: 'Incentive added. Mark it paid when it goes out.' };
}

export async function markIncentivePaid(id: unknown, paidOn: unknown, now = new Date()): Promise<StaffResult> {
  const me = await keeper();
  if (!me) return NO;
  const day = isDay(paidOn) && paidOn <= istDay(now) ? paidOn : istDay(now);
  const { count } = await prisma.studioStaffIncentive.updateMany({ where: { id: typeof id === 'string' ? id : '', studioId: me.studioId, paidOn: null }, data: { paidOn: dayToDb(day), paidById: me.userId } });
  return count === 1 ? { ok: true, message: 'Marked paid.' } : { ok: false, error: 'That incentive is already paid or gone. Reload the page.' };
}

export async function addDevice(input: { memberId: unknown; kind: unknown; model: unknown; serial: unknown; givenOn: unknown; note: unknown }): Promise<StaffResult> {
  const me = await keeper();
  if (!me) return NO;
  const m = await memberOf(me.studioId, input.memberId);
  if (!m) return { ok: false, error: 'That person is not on your team.' };
  const kind = cleanText(input.kind, 40);
  const model = cleanText(input.model, 120);
  if (!kind || model.length < 2) return { ok: false, error: 'Say what the device is, like "Laptop · Dell Inspiron 15".' };
  if (!isDay(input.givenOn)) return { ok: false, error: 'Pick the day it was given.' };
  await prisma.studioStaffDevice.create({
    data: { studioId: me.studioId, memberId: m.id, kind, model, serial: cleanText(input.serial, 80) || null, givenOn: dayToDb(input.givenOn), note: cleanText(input.note, 200) || null, byId: me.userId },
  });
  return { ok: true, message: 'Device added.' };
}

export async function returnDevice(id: unknown, returnedOn: unknown, now = new Date()): Promise<StaffResult> {
  const me = await keeper();
  if (!me) return NO;
  const day = isDay(returnedOn) && returnedOn <= istDay(now) ? returnedOn : istDay(now);
  const { count } = await prisma.studioStaffDevice.updateMany({ where: { id: typeof id === 'string' ? id : '', studioId: me.studioId, returnedOn: null }, data: { returnedOn: dayToDb(day) } });
  return count === 1 ? { ok: true, message: 'Marked returned.' } : { ok: false, error: 'That device is already returned or gone. Reload the page.' };
}
