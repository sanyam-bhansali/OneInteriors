/**
 * "Use the Hauspire pipeline" for a studio, from the command line (owner,
 * 22 Oct 2026: Hauspire's production studio still had the default columns,
 * and nobody of theirs had signed in yet to press the button in Settings →
 * Pipeline). The same plan (pipeline-preset.ts `planPreset`) and the same
 * writes (preset-apply.ts `writePresetPlan`) as that button: it adds and
 * renames, never deletes a column, Junk is a lost column, Calling 1–4 are
 * calling steps.
 *
 *     npx tsx scripts/apply-hauspire-pipeline.ts --studio <slug> --dry-run
 *     npx tsx scripts/apply-hauspire-pipeline.ts --studio <slug>
 *
 * The database is DATABASE_URL from the environment; the host is printed
 * first, never the credentials. One AuditLog row (`studio.pipeline.hauspire`).
 */
import { PrismaClient } from '@prisma/client';
import { planPreset, presetSummary, type ExistingStage } from '../src/modules/studio-practice/pipeline-preset';
import { writePresetPlan } from '../src/modules/studio-practice/preset-apply';

function arg(name: string): string | null {
  const i = process.argv.indexOf(name);
  return i >= 0 ? (process.argv[i + 1] ?? null) : null;
}

async function main() {
  const slug = arg('--studio');
  const dryRun = process.argv.includes('--dry-run');
  if (!slug) throw new Error('Usage: npx tsx scripts/apply-hauspire-pipeline.ts --studio <slug> [--dry-run]');
  console.log(`▶ database: ${(process.env.DATABASE_URL ?? '').replace(/^.*@/, '').replace(/[/?].*$/, '') || '(none)'}`);
  const db = new PrismaClient();
  try {
    const studio = await db.studio.findUnique({ where: { slug }, select: { id: true, tradeName: true } });
    if (!studio) throw new Error(`No studio with slug ${slug}.`);
    const stages = await db.studioStage.findMany({
      where: { studioId: studio.id },
      orderBy: { sortOrder: 'asc' },
      select: { id: true, name: true, kind: true, isIntake: true, sortOrder: true, isCallStep: true, _count: { select: { clients: true } } },
    });
    const plan = planPreset(stages as unknown as ExistingStage[]);
    console.log(`${studio.tradeName} (${slug})${dryRun ? '  (DRY RUN: nothing is written)' : ''}`);
    console.log(`  columns now: ${stages.map((s) => `${s.name} [${s.kind}${s.isIntake ? ', intake' : ''}] ${s._count.clients}`).join(' · ')}`);
    console.log(`  ${presetSummary(plan)}`);
    if (plan.renames.length) console.log(`  renames: ${plan.renames.map((r) => `${r.from} → ${r.to}`).join(', ')}`);
    if (plan.creates.length) console.log(`  adds: ${plan.creates.map((c) => `${c.name} [${c.kind}]`).join(', ')}`);
    if (plan.kindChanges.length) console.log(`  kind changes: ${plan.kindChanges.map((k) => `${k.name} ${k.from} → ${k.to}`).join(', ')}`);
    if (dryRun) return;
    await db.$transaction(async (tx) => {
      await writePresetPlan(tx, studio.id, plan);
      await tx.auditLog.create({
        data: {
          actorId: null,
          action: 'studio.pipeline.hauspire',
          entityType: 'Studio',
          entityId: studio.id,
          before: { columns: stages.map((s) => s.name) },
          after: { renames: plan.renames.length, creates: plan.creates.length, kindChanges: plan.kindChanges.length, by: 'scripts/apply-hauspire-pipeline.ts' },
        },
      });
    });
    const after = await db.studioStage.findMany({ where: { studioId: studio.id }, orderBy: { sortOrder: 'asc' }, select: { name: true, kind: true, isIntake: true, isCallStep: true } });
    console.log(`Written. Columns: ${after.map((s) => `${s.name}${s.isIntake ? ' (intake)' : ''}${s.isCallStep ? ' (calling)' : ''} [${s.kind}]`).join(' · ')}`);
  } finally {
    await db.$disconnect();
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
