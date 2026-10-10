/**
 * Put a studio's product master back as it was before an approval.
 *
 *     npx tsx scripts/quotations/restore.ts <studio-slug>            # list backups
 *     npx tsx scripts/quotations/restore.ts <studio-slug> <backup-id>  # restore one
 *
 * Every approval of a quotation read (ops page or approve.ts) first copies the
 * whole product master into `studio_product_backups`. Restoring replaces the
 * product master with that copy, in one transaction, and takes a fresh backup
 * of what it replaces — so a restore can itself be undone.
 *
 * Quotations already written are untouched: their lines are copies.
 * Rates are private; this runs on the laptop, like the reading itself.
 */

import '../../prisma/load-env';
import { Prisma, PrismaClient } from '@prisma/client';

async function main() {
  const [slug, backupId] = [process.argv[2]?.trim(), process.argv[3]?.trim()];
  if (!slug) {
    console.error('Usage: npx tsx scripts/quotations/restore.ts <studio-slug> [backup-id]');
    process.exit(1);
  }

  const prisma = new PrismaClient();
  try {
    const studio = await prisma.studio.findUnique({ where: { slug }, select: { id: true, tradeName: true } });
    if (!studio) {
      console.error(`No studio with slug "${slug}".`);
      process.exit(1);
    }

    if (!backupId) {
      const backups = await prisma.studioProductBackup.findMany({
        where: { studioId: studio.id },
        orderBy: { takenAt: 'desc' },
        take: 20,
        select: { id: true, takenAt: true, reason: true, rows: true },
      });
      if (backups.length === 0) console.log(`${studio.tradeName}: no backups yet.`);
      for (const b of backups) {
        const n = Array.isArray(b.rows) ? b.rows.length : 0;
        console.log(`${b.id}  ${b.takenAt.toISOString().slice(0, 16)}  ${n} products  ${b.reason}`);
      }
      return;
    }

    const backup = await prisma.studioProductBackup.findFirst({ where: { id: backupId, studioId: studio.id } });
    if (!backup || !Array.isArray(backup.rows)) {
      console.error('No such backup for this studio.');
      process.exit(1);
    }
    const rows = backup.rows as Record<string, unknown>[];

    await prisma.$transaction(
      async (tx) => {
        const current = await tx.studioProduct.findMany({ where: { studioId: studio.id } });
        await tx.studioProductBackup.create({
          data: {
            studioId: studio.id,
            reason: `before restoring ${backup.id}`,
            rows: current.map((p) => ({ ...p, ratePaise: String(p.ratePaise) })) as unknown as Prisma.InputJsonValue,
          },
        });
        await tx.studioProduct.deleteMany({ where: { studioId: studio.id } });
        await tx.studioProduct.createMany({
          data: rows.map((r) => ({
            studioId: studio.id,
            name: String(r.name),
            code: r.code as 'MODULAR' | 'ONSITE',
            unit: r.unit as 'AREA' | 'SQFT' | 'RFT' | 'UNIT',
            details: (r.details as string | null) ?? null,
            ratePaise: BigInt(String(r.ratePaise ?? '0')),
            rooms: (r.rooms as string[]) ?? [],
            defaultWidthMm: (r.defaultWidthMm as number | null) ?? null,
            defaultHeightMm: (r.defaultHeightMm as number | null) ?? null,
            defaultQty: (r.defaultQty as number | null) ?? null,
            inStandardBuild: r.inStandardBuild === true,
            isActive: r.isActive !== false,
            sortOrder: Number(r.sortOrder ?? 900),
            rules: r.rules ? (r.rules as Prisma.InputJsonValue) : Prisma.DbNull,
          })),
        });
      },
      { timeout: 60_000 },
    );
    console.log(`${studio.tradeName}: restored ${rows.length} products from ${backup.takenAt.toISOString().slice(0, 16)} (${backup.reason}).`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
