import 'server-only';

/**
 * The studio's warranty length (owner, 13 Oct 2026; docs/studio-os/PROJECT-LIFECYCLE.md):
 * months from the client's handover sign-off, default 12 (Hauspire 12).
 * Settings, Warranty (months). Set by the owner — the same right as the
 * studio's other commercial terms (`payments.template`); read by the office
 * (owner, PM). A running warranty keeps the end day it was given.
 */

import { prisma } from '@/lib/prisma';
import { readWarrantyMonths, WARRANTY_MONTHS_MAX } from '@/modules/project/lifecycle-rules';
import { can, currentMember } from './access';

export async function myWarranty(): Promise<{ months: number; canEdit: boolean } | null> {
  const member = await currentMember();
  if (!member || !['OWNER', 'PM'].includes(member.role)) return null;
  const s = await prisma.studio.findUnique({ where: { id: member.studioId }, select: { warrantyMonths: true } });
  return { months: readWarrantyMonths(s?.warrantyMonths), canEdit: can(member, 'payments.template') };
}

export async function saveWarrantyMonths(raw: unknown): Promise<{ ok: true; message: string } | { ok: false; error: string }> {
  const member = await currentMember();
  if (!member || !can(member, 'payments.template')) return { ok: false, error: 'Only the studio owner sets the warranty.' };
  const t = typeof raw === 'string' ? raw.trim() : String(raw ?? '');
  const n = Number(t);
  if (!/^\d+$/.test(t) || n > WARRANTY_MONTHS_MAX) return { ok: false, error: `The warranty is a whole number of months, from 0 to ${WARRANTY_MONTHS_MAX}.` };
  await prisma.studio.update({ where: { id: member.studioId }, data: { warrantyMonths: n } });
  return { ok: true, message: `Saved: ${n} month${n === 1 ? '' : 's'} from the client’s handover sign-off. Warranties already running keep their end day.` };
}
