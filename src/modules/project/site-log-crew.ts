import 'server-only';

/**
 * The studio's crew list (`StudioCrewMember`): the faces a supervisor taps
 * under "Who is on site?". Studio-wide, managed by the owner and PMs
 * (roles.ts `crew.manage`). A leaver is switched off, never deleted, so the
 * days they were on site keep pointing at them. The phone number is for
 * the studio to call them and never crosses to the customer (the site-log
 * crew rows copy only name and role).
 */

import { prisma } from '@/lib/prisma';
import { currentMember, mayDo } from '@/modules/studio/access';

export interface CrewRow {
  id: string;
  name: string;
  role: string;
  phone: string | null;
  active: boolean;
  /** Days on site in the last 30 days. */
  recentDays: number;
}

export type CrewResult = { ok: true } | { ok: false; error: string };

const NOT_ALLOWED = 'Only the studio owner or a project manager manages the crew list.';

async function manager() {
  const member = await currentMember();
  return member && (await mayDo(member, 'crew.manage')) ? member : null;
}

/** The crew list, for the owner and PMs. Null for anyone else. */
export async function crewList(now = new Date()): Promise<CrewRow[] | null> {
  const member = await manager();
  if (!member) return null;
  const rows = await prisma.studioCrewMember.findMany({
    where: { studioId: member.studioId },
    orderBy: [{ active: 'desc' }, { name: 'asc' }],
    select: {
      id: true,
      name: true,
      role: true,
      phone: true,
      active: true,
      _count: { select: { siteDays: { where: { createdAt: { gte: new Date(now.getTime() - 30 * 86_400_000) } } } } },
    },
  });
  return rows.map((r) => ({ id: r.id, name: r.name, role: r.role, phone: r.phone, active: r.active, recentDays: r._count.siteDays }));
}

const clean = (v: string, max: number) => v.replace(/\s+/g, ' ').trim().slice(0, max);

/** Add someone to the crew list. The phone is optional; any Indian mobile format is kept as typed, tidied. */
export async function addCrewMember(name: string, role: string, phone: string): Promise<CrewResult> {
  const member = await manager();
  if (!member) return { ok: false, error: NOT_ALLOWED };
  const n = clean(name, 60);
  const r = clean(role, 40);
  const digits = phone.replace(/[^\d+]/g, '');
  if (n.length < 2) return { ok: false, error: 'A name, please.' };
  if (r.length < 2) return { ok: false, error: 'What do they do? Carpenter, electrician, helper…' };
  if (digits && !/^(\+91)?[6-9]\d{9}$/.test(digits)) return { ok: false, error: 'That does not look like an Indian mobile number.' };
  await prisma.studioCrewMember.create({ data: { studioId: member.studioId, name: n, role: r, phone: digits || null } });
  return { ok: true };
}

/** Switch someone off the list (they stop showing on site), or back on. */
export async function setCrewActive(id: string, active: boolean): Promise<CrewResult> {
  const member = await manager();
  if (!member) return { ok: false, error: NOT_ALLOWED };
  const r = await prisma.studioCrewMember.updateMany({ where: { id, studioId: member.studioId }, data: { active } });
  return r.count === 1 ? { ok: true } : { ok: false, error: 'That person is not on your crew list.' };
}
