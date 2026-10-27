/**
 * Move people who were added to the wrong studio (owner, 27 Oct 2026:
 * Hauspire's six designers went to `hauspire` instead of
 * `hauspire-luxury-design-studio`, the studio Yogesh signs in to).
 *
 *     npx tsx scripts/move-studio-members.ts --from <slug> --to <slug> --file people.json --dry-run
 *     npx tsx scripts/move-studio-members.ts --from <slug> --to <slug> --file people.json
 *
 * `people.json` is the same list add-studio-members.ts took; only the mobiles
 * are read. First prints every studio whose slug or name says "hauspire"
 * (slug, name, status, GSTIN's last four, members), so it is plain which is
 * which. Then moves, one transaction each, a member of `--from` with that
 * mobile, only while they are INVITED and have never been seen, own no leads,
 * tasks, events, files, quotation work or projects, and report to nobody:
 * a fresh row, nothing of the old studio goes with it. The membership keeps
 * its role and stays INVITED; the inviter becomes `--to`'s owner; sales role,
 * reports-to and design head are cleared. Refuses when `--to` is REMOVED.
 * Audited (`studio.member.moved`). No message is sent.
 *
 * The database is DATABASE_URL from the environment; the host is printed
 * first, never the credentials or the numbers.
 */
import { readFileSync } from 'node:fs';
import { PrismaClient } from '@prisma/client';

function arg(name: string): string | null {
  const i = process.argv.indexOf(name);
  return i >= 0 ? (process.argv[i + 1] ?? null) : null;
}
const mask = (p: string) => `…${p.slice(-4)}`;

async function main() {
  const fromSlug = arg('--from');
  const toSlug = arg('--to');
  const file = arg('--file');
  const dryRun = process.argv.includes('--dry-run');
  if (!fromSlug || !toSlug || !file || fromSlug === toSlug) throw new Error('Usage: npx tsx scripts/move-studio-members.ts --from <slug> --to <slug> --file people.json [--dry-run]');
  const raw = JSON.parse(readFileSync(file, 'utf8')) as { phone?: unknown }[];
  if (!Array.isArray(raw)) throw new Error('The file is not a list of people.');
  const phones = raw.map((p, i) => {
    const digits = String(p.phone ?? '').replace(/\D/g, '');
    const phone = digits.length === 10 ? `+91${digits}` : digits.length === 12 && digits.startsWith('91') ? `+${digits}` : '';
    if (!/^\+91[6-9]\d{9}$/.test(phone)) throw new Error(`Row ${i + 1}: not an Indian mobile number.`);
    return phone;
  });

  console.log(`▶ database: ${(process.env.DATABASE_URL ?? '').replace(/^.*@/, '').replace(/[/?].*$/, '') || '(none)'}`);
  const db = new PrismaClient();
  try {
    const all = await db.studio.findMany({
      where: { OR: [{ slug: { contains: 'hauspire', mode: 'insensitive' } }, { tradeName: { contains: 'hauspire', mode: 'insensitive' } }] },
      select: { slug: true, tradeName: true, legalName: true, status: true, gstin: true, _count: { select: { members: true } } },
      orderBy: { slug: 'asc' },
    });
    console.log('Studios named Hauspire:');
    for (const s of all) console.log(`  ${s.slug.padEnd(34)} ${s.tradeName} · ${s.legalName ?? '—'} · ${s.status} · GSTIN ${s.gstin ? mask(s.gstin) : 'none'} · ${s._count.members} members`);

    const from = await db.studio.findUnique({ where: { slug: fromSlug }, select: { id: true, tradeName: true } });
    const to = await db.studio.findUnique({ where: { slug: toSlug }, select: { id: true, tradeName: true, status: true } });
    if (!from) throw new Error(`No studio with slug ${fromSlug}.`);
    if (!to) throw new Error(`No studio with slug ${toSlug}.`);
    if (to.status === 'REMOVED') throw new Error(`${to.tradeName} is REMOVED; not moving anyone to it.`);
    const owner = await db.studioMember.findFirst({ where: { studioId: to.id, role: 'OWNER', status: 'ACTIVE' }, select: { id: true } });

    const members = await db.studioMember.findMany({
      where: { studioId: from.id, user: { phone: { in: phones } } },
      select: {
        id: true, role: true, status: true, lastSeenAt: true, reportsToId: true,
        user: { select: { name: true, phone: true } },
        _count: { select: { clients: true, clientEvents: true, clientFiles: true, quoteRevisions: true, designing: true, tasksAssigned: true, tasksCreated: true, quoteRequestsAsked: true, quoteRequestsToBuild: true, projects: true, reports: true, invitees: true } },
      },
    });

    console.log(`\nFrom ${from.tradeName} (${fromSlug}) to ${to.tradeName} (${toSlug})${dryRun ? '  (DRY RUN: nothing is written)' : ''}`);
    const ok: typeof members = [];
    for (const phone of phones) {
      const m = members.find((x) => x.user.phone === phone);
      if (!m) { console.log(`  skip   ${mask(phone)}  not a member of ${fromSlug}`); continue; }
      const used = Object.entries(m._count).filter(([, n]) => n > 0).map(([k, n]) => `${k} ${n}`);
      const why = m.status !== 'INVITED' ? `is ${m.status}` : m.lastSeenAt ? 'has signed in' : m.reportsToId ? 'reports to someone there' : used.length ? `has ${used.join(', ')}` : null;
      const name = (m.user.name ?? '—').padEnd(24);
      if (why) { console.log(`  skip   ${name} ${m.role.padEnd(10)} ${mask(phone)}  ${why}`); continue; }
      console.log(`  > MOVE ${name} ${m.role.padEnd(10)} ${mask(phone)}`);
      ok.push(m);
    }
    if (dryRun || ok.length === 0) return;

    let moved = 0;
    for (const m of ok) {
      try {
        await db.$transaction(async (tx) => {
          await tx.studioMember.update({
            where: { id: m.id, studioId: from.id, status: 'INVITED', lastSeenAt: null },
            data: { studioId: to.id, invitedById: owner?.id ?? null, salesRoleId: null, reportsToId: null, designHead: false },
          });
          await tx.auditLog.create({
            data: { actorId: null, action: 'studio.member.moved', entityType: 'StudioMember', entityId: m.id, before: { studioId: from.id }, after: { studioId: to.id, role: m.role, by: 'scripts/move-studio-members.ts' } },
          });
        }, { timeout: 60_000, maxWait: 20_000 });
        moved += 1;
      } catch (error) {
        console.log(`  refused ${m.user.name ?? mask(m.user.phone ?? '')}: ${String((error as Error).message ?? error).slice(0, 200)}`);
      }
    }
    console.log(`Written: ${moved} of ${ok.length} moved to ${to.tradeName}, still INVITED. No message was sent.`);
  } finally {
    await db.$disconnect();
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
