import 'server-only';

/**
 * Where a customer's Discover saves are kept once they have a Home Profile
 * (`Brief.discoverSaves`), so the expert sees them before the call and the
 * phone app and the website show the same boards.
 */

import { prisma } from '@/lib/prisma';
import { hasDatabase } from '@/lib/env';
import { cleanSaves } from './feed';

export async function readSaves(briefId: string): Promise<string[]> {
  if (!hasDatabase()) return [];
  const row = await prisma.brief.findUnique({ where: { id: briefId }, select: { discoverSaves: true } });
  return cleanSaves(row?.discoverSaves ?? []);
}

export async function storeSaves(briefId: string, saves: unknown): Promise<string[]> {
  const clean = cleanSaves(saves);
  if (!hasDatabase()) return clean;
  await prisma.brief.update({ where: { id: briefId }, data: { discoverSaves: clean } });
  return clean;
}
