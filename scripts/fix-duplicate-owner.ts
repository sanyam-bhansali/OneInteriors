/**
 * One person on a studio's team twice (owner, 23 Oct 2026: the AxLeads
 * import added Yogesh Tripathi again by his mobile number, because his email
 * was already the login of the owner account he had, and that account has no
 * mobile number on it).
 *
 *     npx tsx scripts/fix-duplicate-owner.ts --studio <slug> --phone <+91…> --dry-run
 *     npx tsx scripts/fix-duplicate-owner.ts --studio <slug> --phone <+91…>
 *
 * Keeps the ACTIVE member (the one who has been signing in). The duplicate is
 * the INVITED member whose login carries `--phone` and has never signed in.
 * In one transaction: the duplicate's leads, tasks and quotation requests go
 * to the kept member; its membership and its never-used login are removed;
 * and when the kept login has no mobile number, it takes this one, so the
 * person signs in with either their email or their mobile. Refuses when the
 * duplicate has signed in, when the kept login already has a different
 * mobile, or when the two are not on the same studio. Audited
 * (`studio.member.merge_duplicate`).
 *
 * The database is DATABASE_URL from the environment; the host is printed
 * first, never the credentials.
 */
import { PrismaClient } from '@prisma/client';

function arg(name: string): string | null {
  const i = process.argv.indexOf(name);
  return i >= 0 ? (process.argv[i + 1] ?? null) : null;
}

async function main() {
  const slug = arg('--studio');
  const phone = arg('--phone');
  const dryRun = process.argv.includes('--dry-run');
  if (!slug || !phone || !/^\+91\d{10}$/.test(phone)) throw new Error('Usage: npx tsx scripts/fix-duplicate-owner.ts --studio <slug> --phone +91XXXXXXXXXX [--dry-run]');
  console.log(`▶ database: ${(process.env.DATABASE_URL ?? '').replace(/^.*@/, '').replace(/[/?].*$/, '') || '(none)'}`);
  const db = new PrismaClient();
  try {
    const studio = await db.studio.findUnique({ where: { slug }, select: { id: true, tradeName: true } });
    if (!studio) throw new Error(`No studio with slug ${slug}.`);
    const dup = await db.studioMember.findFirst({
      where: { studioId: studio.id, user: { phone } },
      select: { id: true, role: true, status: true, userId: true, user: { select: { name: true, email: true, _count: { select: { sessions: true } } } } },
    });
    if (!dup) throw new Error(`Nobody on ${studio.tradeName}'s team has the mobile ${phone}.`);
    if (dup.status !== 'INVITED' || dup.user._count.sessions > 0) throw new Error('That member has signed in; this script only removes a never-used duplicate.');
    const name = dup.user.name?.trim() ?? '';
    const keep = await db.studioMember.findFirst({
      where: { studioId: studio.id, id: { not: dup.id }, status: 'ACTIVE', role: dup.role, user: { name: { equals: name, mode: 'insensitive' } } },
      select: { id: true, userId: true, user: { select: { name: true, email: true, phone: true } } },
    });
    if (!keep) throw new Error(`No active ${dup.role.toLowerCase()} called "${name}" to keep on ${studio.tradeName}.`);
    if (keep.user.phone && keep.user.phone !== phone) throw new Error(`The kept login already has another mobile (…${keep.user.phone.slice(-4)}); not changing it.`);

    const [leads, pools, tasks, requests] = await Promise.all([
      db.studioClient.count({ where: { studioId: studio.id, assignedToId: dup.id } }),
      db.studioClient.count({ where: { studioId: studio.id, poolTeamId: dup.id } }),
      db.studioTask.count({ where: { studioId: studio.id, assignedToId: dup.id } }).catch(() => 0),
      db.studioQuoteRequest.count({ where: { studioId: studio.id, assignedToId: dup.id } }).catch(() => 0),
    ]);
    console.log(`${studio.tradeName} (${slug})${dryRun ? '  (DRY RUN: nothing is written)' : ''}`);
    console.log(`  keep       ${keep.user.name} · ${keep.user.email ?? 'no email'} · mobile ${keep.user.phone ? `…${keep.user.phone.slice(-4)}` : 'none'}`);
    console.log(`  remove     ${dup.user.name} · invited, never signed in · mobile …${phone.slice(-4)}`);
    console.log(`  move       ${leads} leads, ${pools} team-pool leads, ${tasks} tasks, ${requests} quotation requests`);
    console.log(`  mobile     ${keep.user.phone ? 'kept login already has it' : `…${phone.slice(-4)} moves to the kept login (sign in by email or mobile)`}`);
    if (dryRun) return;

    await db.$transaction(async (tx) => {
      await tx.studioClient.updateMany({ where: { studioId: studio.id, assignedToId: dup.id }, data: { assignedToId: keep.id } });
      await tx.studioClient.updateMany({ where: { studioId: studio.id, poolTeamId: dup.id }, data: { poolTeamId: keep.id } });
      await tx.studioTask.updateMany({ where: { studioId: studio.id, assignedToId: dup.id }, data: { assignedToId: keep.id } }).catch(() => undefined);
      await tx.studioQuoteRequest.updateMany({ where: { studioId: studio.id, assignedToId: dup.id }, data: { assignedToId: keep.id } }).catch(() => undefined);
      await tx.studioMember.updateMany({ where: { studioId: studio.id, reportsToId: dup.id }, data: { reportsToId: keep.id } });
      await tx.studioMember.delete({ where: { id: dup.id } });
      await tx.user.delete({ where: { id: dup.userId } });
      if (!keep.user.phone) await tx.user.update({ where: { id: keep.userId }, data: { phone } });
      await tx.auditLog.create({
        data: {
          actorId: null,
          action: 'studio.member.merge_duplicate',
          entityType: 'StudioMember',
          entityId: keep.id,
          before: { removedMember: dup.id, removedUser: dup.userId },
          after: { leads, pools, tasks, requests, phoneMoved: !keep.user.phone, by: 'scripts/fix-duplicate-owner.ts' },
        },
      });
    });
    console.log('Written. One account for this person now.');
  } finally {
    await db.$disconnect();
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
