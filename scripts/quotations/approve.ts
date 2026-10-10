/**
 * Approve a studio's pending product-master run from the laptop.
 *
 *     npx tsx scripts/quotations/approve.ts <studio-slug> <ops-email>
 *
 * The same writes as "Approve all" on /ops/<slug> (approveDraftRun in
 * src/modules/studio-quote/product-drafts.ts), for when that page cannot be
 * reached — a preview without a database, say. The ops email must belong to an
 * OPS or ADMIN user; it is recorded as the reviewer and in the audit log.
 * Keep the two in step if either changes.
 */

import '../../prisma/load-env';
import { Prisma, PrismaClient } from '@prisma/client';

async function main() {
  const [slug, email] = [process.argv[2]?.trim(), process.argv[3]?.trim().toLowerCase()];
  if (!slug || !email) {
    console.error('Usage: npx tsx scripts/quotations/approve.ts <studio-slug> <ops-email>');
    process.exit(1);
  }

  const prisma = new PrismaClient();
  try {
    const actor = await prisma.user.findUnique({ where: { email }, select: { id: true, role: true } });
    if (!actor || (actor.role !== 'OPS' && actor.role !== 'ADMIN')) {
      console.error(`${email} is not an ops user.`);
      process.exit(1);
    }
    const studio = await prisma.studio.findUnique({ where: { slug }, select: { id: true, tradeName: true } });
    if (!studio) {
      console.error(`No studio with slug "${slug}".`);
      process.exit(1);
    }
    const studioId = studio.id;

    const pending = await prisma.studioProductDraft.findMany({ where: { studioId, state: 'PENDING' } });
    if (pending.length === 0) {
      console.error('Nothing is waiting for approval.');
      process.exit(1);
    }
    const runId = pending.reduce((a, b) => (a.createdAt > b.createdAt ? a : b)).runId;
    const rows = pending.filter((r) => r.runId === runId);
    if (rows.some((r) => r.ratePaise <= BigInt(0))) {
      console.error('Some lines have no rate. Fill them or drop them first.');
      process.exit(1);
    }

    const existing = await prisma.studioProduct.findMany({ where: { studioId }, select: { id: true, name: true } });
    const byName = new Map(existing.map((p) => [p.name.toLowerCase(), p.id]));
    const members = await prisma.studioMember.findMany({ where: { studioId }, select: { userId: true } });
    const now = new Date();

    let created = 0;
    let updated = 0;
    await prisma.$transaction(
      async (tx) => {
        for (const r of rows) {
          const data = {
            code: r.code,
            unit: r.unit,
            details: r.details,
            ratePaise: r.ratePaise,
            rooms: r.rooms,
            defaultWidthMm: r.defaultWidthMm,
            defaultHeightMm: r.defaultHeightMm,
            defaultQty: r.defaultQty,
            inStandardBuild: r.inStandardBuild,
            rules: (r.rules ?? undefined) as Prisma.InputJsonValue | undefined,
            sortOrder: r.sortOrder,
            isActive: true,
          };
          const id = byName.get(r.name.toLowerCase());
          if (id) {
            await tx.studioProduct.update({ where: { id }, data });
            updated += 1;
          } else {
            await tx.studioProduct.create({ data: { studioId, name: r.name, ...data } });
            created += 1;
          }
        }

        await tx.studioProductDraft.updateMany({
          where: { studioId, runId, state: 'PENDING' },
          data: { state: 'APPROVED', reviewedAt: now, reviewedById: actor.id },
        });
        await tx.studio.update({ where: { id: studioId }, data: { ratesFilledAt: now } });

        const archiveIds = [...new Set(rows.map((r) => r.archiveId).filter((x): x is string => Boolean(x)))];
        if (archiveIds.length > 0) {
          await tx.quotationArchive.updateMany({
            where: { id: { in: archiveIds } },
            data: { state: 'FILED', analysisState: 'READ', analysedAt: now },
          });
        }

        if (members.length > 0) {
          await tx.notification.createMany({
            data: members.map((m) => ({
              userId: m.userId,
              channel: 'push',
              template: 'rates.filled',
              payload: { studioId, products: rows.length },
            })),
          });
        }

        await tx.auditLog.create({
          data: {
            actorId: actor.id,
            action: 'products.drafts.approve',
            entityType: 'Studio',
            entityId: studioId,
            after: { runId, created, updated, from: 'laptop' } as Prisma.InputJsonValue,
          },
        });
      },
      { timeout: 60_000 },
    );

    console.log(`${studio.tradeName}: approved ${created} new and ${updated} updated (${runId}).`);
    console.log(`${members.length} studio member(s) asked to check them.`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
