/**
 * Add people to a studio's team from a list (owner, 24 Oct 2026: Hauspire's
 * six designers, from a sheet of names and mobiles).
 *
 *     npx tsx scripts/add-studio-members.ts --studio <slug> --file people.json --dry-run
 *     npx tsx scripts/add-studio-members.ts --studio <slug> --file people.json
 *
 * `people.json`: [{ "name": "…", "phone": "+91XXXXXXXXXX", "role": "DESIGNER" }].
 * Each is added as the AxLeads import adds people (studio-import-axleads/
 * import.ts): a login with their mobile and the STUDIO role, and a member
 * INVITED until they first sign in. No invite is sent, no WhatsApp, no SMS:
 * they sign in with their mobile and get the code then. One transaction and
 * one AuditLog row (`studio.member.import`) each, so a clash refuses that
 * person only.
 *
 * Left alone, and listed: someone already on this team (by mobile), and
 * someone whose mobile is another studio's member (one person, one studio).
 * A login that exists with that mobile and no studio is reused, keeping its
 * name. OWNER is refused here: an owner is made in Settings → Team. Pro Solo
 * studios take nobody (one login).
 *
 * The database is DATABASE_URL from the environment; the host is printed
 * first, never the credentials or the numbers.
 */
import { readFileSync } from 'node:fs';
import { PrismaClient, type StudioRole } from '@prisma/client';
import { planOf, seatLimit } from '../src/modules/studio/software-plan';

const ROLES: readonly StudioRole[] = ['PM', 'SUPERVISOR', 'ACCOUNTS', 'SALES', 'DESIGNER'];
const mask = (p: string) => `…${p.slice(-4)}`;

function arg(name: string): string | null {
  const i = process.argv.indexOf(name);
  return i >= 0 ? (process.argv[i + 1] ?? null) : null;
}

async function main() {
  const slug = arg('--studio');
  const file = arg('--file');
  const dryRun = process.argv.includes('--dry-run');
  if (!slug || !file) throw new Error('Usage: npx tsx scripts/add-studio-members.ts --studio <slug> --file people.json [--dry-run]');
  const raw = JSON.parse(readFileSync(file, 'utf8')) as { name?: unknown; phone?: unknown; role?: unknown }[];
  if (!Array.isArray(raw)) throw new Error('The file is not a list of people.');
  const people = raw.map((p, i) => {
    const name = String(p.name ?? '').trim().replace(/\s+/g, ' ');
    const digits = String(p.phone ?? '').replace(/\D/g, '');
    const phone = digits.length === 10 ? `+91${digits}` : digits.length === 12 && digits.startsWith('91') ? `+${digits}` : '';
    const role = String(p.role ?? '').trim().toUpperCase() as StudioRole;
    if (name.length < 2) throw new Error(`Row ${i + 1}: no name.`);
    if (!/^\+91[6-9]\d{9}$/.test(phone)) throw new Error(`Row ${i + 1} (${name}): not an Indian mobile number.`);
    if (!ROLES.includes(role)) throw new Error(`Row ${i + 1} (${name}): role must be one of ${ROLES.join(', ')}.`);
    return { name, phone, role };
  });
  if (new Set(people.map((p) => p.phone)).size !== people.length) throw new Error('The same mobile is in the list twice.');

  console.log(`▶ database: ${(process.env.DATABASE_URL ?? '').replace(/^.*@/, '').replace(/[/?].*$/, '') || '(none)'}`);
  const db = new PrismaClient();
  try {
    const studio = await db.studio.findUnique({ where: { slug }, select: { id: true, tradeName: true, status: true, softwarePlan: true, fullSoftware: true } });
    if (!studio) throw new Error(`No studio with slug ${slug}.`);
    /* 27 Oct 2026: Hauspire's designers went to `hauspire`, a removed duplicate of the company. */
    if (studio.status === 'REMOVED') throw new Error(`${studio.tradeName} (${slug}) is REMOVED; nobody is added to a removed studio. Check the slug.`);
    if (seatLimit(planOf(studio)) !== null) throw new Error(`${studio.tradeName} is on Pro Solo: one login, no team.`);
    const owner = await db.studioMember.findFirst({ where: { studioId: studio.id, role: 'OWNER', status: 'ACTIVE' }, select: { id: true } });

    const users = await db.user.findMany({
      where: { phone: { in: people.map((p) => p.phone) } },
      select: { id: true, phone: true, name: true, role: true, studioMember: { select: { studioId: true, role: true } } },
    });
    const plan = people.map((p) => {
      const u = users.find((x) => x.phone === p.phone);
      if (u?.studioMember?.studioId === studio.id) return { ...p, kind: 'here' as const, note: `already on the team as ${u.studioMember.role}` };
      if (u?.studioMember) return { ...p, kind: 'elsewhere' as const, note: 'on another studio’s team' };
      if (u && u.role !== 'STUDIO') return { ...p, kind: 'elsewhere' as const, note: `that mobile is a ${u.role.toLowerCase()} login` };
      return { ...p, kind: 'add' as const, reuseUserId: u?.id ?? null, note: u ? `their existing login (${u.name ?? 'no name'})` : 'new login' };
    });

    console.log(`${studio.tradeName} (${slug})${dryRun ? '  (DRY RUN: nothing is written)' : ''}`);
    for (const p of plan) console.log(`  ${p.kind === 'add' ? '+ ADD' : '  skip'}  ${p.name.padEnd(24)} ${p.role.padEnd(10)} ${mask(p.phone)}  ${p.note}`);
    const toAdd = plan.filter((p) => p.kind === 'add');
    if (dryRun || toAdd.length === 0) return;

    let added = 0;
    for (const p of toAdd) {
      try {
        await db.$transaction(async (tx) => {
          const userId = p.reuseUserId ?? (await tx.user.create({ data: { phone: p.phone, name: p.name, role: 'STUDIO' }, select: { id: true } })).id;
          const member = await tx.studioMember.create({
            data: { studioId: studio.id, userId, role: p.role, status: 'INVITED', isOwner: false, invitedById: owner?.id ?? null },
            select: { id: true },
          });
          await tx.auditLog.create({
            data: { actorId: null, action: 'studio.member.import', entityType: 'StudioMember', entityId: member.id, after: { role: p.role, from: 'scripts/add-studio-members.ts', inviteSent: false } },
          });
        }, { timeout: 60_000, maxWait: 20_000 });
        added += 1;
      } catch (error) {
        console.log(`  refused ${p.name}: ${(error as { code?: string }).code === 'P2002' ? 'that mobile was just added elsewhere' : String((error as Error).message ?? error).slice(0, 200)}`);
      }
    }
    console.log(`Written: ${added} of ${toAdd.length} added, INVITED. They sign in at the studio sign-in with their mobile; no message was sent.`);
  } finally {
    await db.$disconnect();
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
