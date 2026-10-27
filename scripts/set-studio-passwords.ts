/**
 * One-time passwords for a role at a studio, from a template (owner, 27 Oct
 * 2026: "make login and password for every designer in a template
 * NameDesign12#").
 *
 *     npx tsx scripts/set-studio-passwords.ts --studio <slug> --role DESIGNER --template "{First}Design12#" --dry-run
 *     npx tsx scripts/set-studio-passwords.ts --studio <slug> --role DESIGNER --template "{First}Design12#"
 *
 * `{First}` is the person's first name as on the team ("Renuka"). Each
 * password is ONE-TIME (`passwordTemporary`): they sign in with their mobile
 * number and it, and the studio makes them choose their own before anything
 * else (auth/studio-password.ts), because a pattern anyone can guess must
 * not stay anyone's password. Their sessions end. Skipped: someone who has
 * already chosen their own password (unless `--include-own`), the owner, and
 * anyone suspended. Audited (`studio.member.password_set`, never the
 * password). Prints names and the last four digits of mobiles, never a
 * password.
 *
 * The database is DATABASE_URL from the environment; the host is printed
 * first, never the credentials.
 */
import { PrismaClient, type StudioRole } from '@prisma/client';
import { hashPassword } from '../src/modules/auth/password';

function arg(name: string): string | null {
  const i = process.argv.indexOf(name);
  return i >= 0 ? (process.argv[i + 1] ?? null) : null;
}
const ROLES: readonly StudioRole[] = ['PM', 'SUPERVISOR', 'ACCOUNTS', 'SALES', 'DESIGNER'];
const mask = (p: string | null) => (p ? `…${p.slice(-4)}` : '(no mobile)');

/** "{First}Design12#" with Renuka Gupta → "RenukaDesign12#". Letters only from the first name, first letter capital. */
export function fromTemplate(template: string, name: string): string | null {
  const first = (name.trim().split(/\s+/)[0] ?? '').replace(/[^A-Za-z]/g, '');
  if (first.length < 2) return null;
  return template.replaceAll('{First}', first[0]!.toUpperCase() + first.slice(1).toLowerCase());
}

async function main() {
  const slug = arg('--studio');
  const role = (arg('--role') ?? '').toUpperCase() as StudioRole;
  const template = arg('--template');
  const dryRun = process.argv.includes('--dry-run');
  const includeOwn = process.argv.includes('--include-own');
  if (!slug || !template || !ROLES.includes(role)) throw new Error('Usage: npx tsx scripts/set-studio-passwords.ts --studio <slug> --role DESIGNER --template "{First}Design12#" [--dry-run] [--include-own]');
  if (!template.includes('{First}')) throw new Error('The template needs {First}, or everyone gets the same password.');

  console.log(`▶ database: ${(process.env.DATABASE_URL ?? '').replace(/^.*@/, '').replace(/[/?].*$/, '') || '(none)'}`);
  const db = new PrismaClient();
  try {
    const studio = await db.studio.findUnique({ where: { slug }, select: { id: true, tradeName: true, status: true } });
    if (!studio) throw new Error(`No studio with slug ${slug}.`);
    if (studio.status === 'REMOVED') throw new Error(`${studio.tradeName} is REMOVED.`);
    const owner = await db.studioMember.findFirst({ where: { studioId: studio.id, role: 'OWNER', status: 'ACTIVE' }, select: { userId: true } });
    const people = await db.studioMember.findMany({
      where: { studioId: studio.id, role },
      orderBy: { createdAt: 'asc' },
      select: { id: true, status: true, userId: true, user: { select: { name: true, phone: true, passwordHash: true, passwordTemporary: true } } },
    });
    console.log(`${studio.tradeName} (${slug}) · ${role} · ${people.length} people${dryRun ? '  (DRY RUN: nothing is written)' : ''}`);
    let written = 0;
    for (const p of people) {
      const name = p.user.name?.trim() || '';
      const pw = fromTemplate(template, name);
      const own = p.user.passwordHash !== null && !p.user.passwordTemporary;
      const why = p.status === 'SUSPENDED' ? 'suspended' : !pw ? 'no first name to make it from' : own && !includeOwn ? 'has chosen their own password' : null;
      if (why) {
        console.log(`  skip  ${(name || '—').padEnd(24)} ${mask(p.user.phone)}  ${why}`);
        continue;
      }
      console.log(`  > SET ${name.padEnd(24)} ${mask(p.user.phone)}  one-time, from the template`);
      if (dryRun) continue;
      await db.$transaction([
        db.user.update({ where: { id: p.userId }, data: { passwordHash: await hashPassword(pw!), passwordSetAt: new Date(), passwordTemporary: true, failedSignIns: 0, lockedOutAt: null } }),
        db.session.updateMany({ where: { userId: p.userId, revokedAt: null }, data: { revokedAt: new Date() } }),
        db.auditLog.create({ data: { actorId: owner?.userId ?? null, action: 'studio.member.password_set', entityType: 'StudioMember', entityId: p.id, after: { temporary: true, from: 'scripts/set-studio-passwords.ts' } } }),
      ]);
      written += 1;
    }
    if (!dryRun) console.log(`Written: ${written}. Each signs in at studio.oneinteriors.in with their mobile number and their one-time password, then chooses their own.`);
  } finally {
    await db.$disconnect();
  }
}

if (process.argv[1]?.includes('set-studio-passwords')) {
  main().catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  });
}
