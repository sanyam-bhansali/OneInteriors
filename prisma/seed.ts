/**
 * Seed the database from the fixture studios.
 *
 * Run with `npm run db:seed`. Idempotent — re-running replaces each studio's
 * checks and portfolio rather than duplicating them, so it is safe to run
 * repeatedly while developing.
 *
 * ⚠️ These are INVENTED studios with deliberately invalid GSTINs. This script
 * is for local and preview databases only. It refuses to run against a
 * database that already holds studios it did not create, so it cannot quietly
 * scribble over the real pilot cohort once that exists.
 */

import { PrismaClient, Prisma } from '@prisma/client';
import { STUDIOS } from '../src/data/studios';
import type { Studio } from '../src/modules/studio/types';

const prisma = new PrismaClient();

/** Domain uses integer paise; Prisma columns are BigInt. Convert at the edge. */
function toDb(paise: number | null): bigint | null {
  if (paise === null) return null;
  if (!Number.isInteger(paise)) throw new Error(`Money must be integer paise, got ${paise}`);
  return BigInt(paise);
}

function date(iso: string | null): Date | null {
  return iso ? new Date(iso) : null;
}

async function seedStudio(s: Studio) {
  const data = {
    slug: s.slug,
    legalName: s.legalName,
    tradeName: s.tradeName,
    about: s.about,
    city: s.city,
    localities: s.localities,
    status: s.status,
    tier: s.tier,
    gstin: s.gstin,
    yearsActive: s.yearsActive,
    teamSize: s.teamSize,
    minProjectPaise: toDb(s.minProjectPaise),
    maxProjectPaise: toDb(s.maxProjectPaise),
    completedProjects: s.completedProjects,
    avgVarianceDays: s.avgVarianceDays,
    upheldDisputes: s.upheldDisputes,
    specComplianceRate: s.specComplianceRate,
    communicationRating: s.communicationRating,
    autonomyProfile: s.autonomyProfile,
  } satisfies Omit<Prisma.StudioCreateInput, 'id'>;

  const studio = await prisma.studio.upsert({
    where: { slug: s.slug },
    create: { id: s.id, ...data },
    update: data,
  });

  // Replace rather than merge — a fixture edit should be reflected exactly.
  await prisma.verificationCheck.deleteMany({ where: { studioId: studio.id } });
  await prisma.verificationCheck.createMany({
    data: s.checks.map((c) => ({
      studioId: studio.id,
      type: c.type,
      result: c.result,
      source: c.source,
      notes: c.detail,
      checkedAt: date(c.checkedAt),
    })),
  });

  await prisma.portfolioProject.deleteMany({ where: { studioId: studio.id } });
  await prisma.portfolioProject.createMany({
    data: s.portfolio.map((p) => ({
      id: p.id,
      studioId: studio.id,
      title: p.title,
      locality: p.locality,
      propertyType: p.propertyType,
      scope: p.scope,
      styleTags: p.styleTags,
      valuePaise: toDb(p.valuePaise),
      durationDays: p.durationDays,
      completedOn: date(p.completedOn),
      images: p.images,
      isRender: p.isRender,
      clientConsented: false,
    })),
  });

  return studio.tradeName;
}

async function main() {
  const fixtureSlugs = new Set(STUDIOS.map((s) => s.slug));
  const existing = await prisma.studio.findMany({ select: { slug: true, tradeName: true } });
  const foreign = existing.filter((s) => !fixtureSlugs.has(s.slug));

  if (foreign.length > 0 && !process.env.SEED_FORCE) {
    console.error(
      `\nRefusing to seed: this database holds ${foreign.length} studio(s) that are not fixtures —\n` +
        foreign.map((s) => `  · ${s.tradeName} (${s.slug})`).join('\n') +
        `\n\nThese look like real records. Seeding would add invented studios with invalid\n` +
        `GSTINs alongside them. If you are certain, re-run with SEED_FORCE=1.\n`,
    );
    process.exitCode = 1;
    return;
  }

  console.log(`Seeding ${STUDIOS.length} fixture studios…`);
  for (const s of STUDIOS) {
    const name = await seedStudio(s);
    console.log(`  ✓ ${name}`);
  }
  console.log(
    `\nDone. Remember: these are invented studios and none of their GSTINs are real\n` +
      `registrations. Delete them before the pilot cohort goes in.\n`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
