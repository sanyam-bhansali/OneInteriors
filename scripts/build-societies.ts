/**
 * Build a studio's societies from its leads (owner, 11 Nov 2026), after an
 * AxLeads import or refresh. src/modules/studio-practice/society-build.ts
 * decides; this reads and writes.
 *
 *     npx tsx scripts/build-societies.ts --studio <slug>            (dry run: prints, writes nothing)
 *     npx tsx scripts/build-societies.ts --studio <slug> --write    (writes)
 *     … [--min 3]   a society for every name on at least this many leads (default 3)
 *
 * - Typos are merged ("Godrej Medow" → Godrej Meadows), phases and towers
 *   never are, sources ("Digital", "Refferal") are not societies.
 * - An existing society is reused and its spellings added; nothing is
 *   deleted, and no society is renamed.
 * - Owner: whoever has most of its leads; nobody when most are nobody's.
 *   Wings: the leads' "wing" field, or the wing written in the name.
 *   Locality: the most common one on its leads.
 * - Every matching lead is linked to its society, and to its wing when one is
 *   known (a wing set by hand is kept when nothing better is known).
 * - Running it again is safe: it finds what it made and only adds.
 *
 * The database is DATABASE_URL from the environment (scripts/with-env.ps1
 * loads .env.local). The host is printed first, never the credentials.
 * Nothing is sent to anybody.
 */

import { PrismaClient } from '@prisma/client';
import { planSocietyBuild, type BuildLead } from '../src/modules/studio-practice/society-build';
import { societyKey } from '../src/modules/studio-practice/society-rules';

function arg(name: string): string | undefined {
  const argv = process.argv.slice(2);
  const i = argv.indexOf(`--${name}`);
  if (i >= 0 && argv[i + 1] && !argv[i + 1]!.startsWith('--')) return argv[i + 1];
  const eq = argv.find((a) => a.startsWith(`--${name}=`));
  return eq ? eq.slice(name.length + 3) : undefined;
}

const fieldText = (fields: unknown, keys: readonly string[]): string | null => {
  if (!fields || typeof fields !== 'object' || Array.isArray(fields)) return null;
  for (const k of keys) {
    const v = (fields as Record<string, unknown>)[k];
    if (typeof v === 'string' && v.trim()) return v.trim();
    if (typeof v === 'number') return String(v);
  }
  return null;
};

async function main() {
  const slug = arg('studio')?.trim();
  const write = process.argv.includes('--write');
  const min = Math.max(1, Math.floor(Number(arg('min') ?? 3)) || 3);
  if (!slug) {
    console.error('Usage: npx tsx scripts/build-societies.ts --studio <slug> [--write] [--min 3]');
    process.exit(1);
  }
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('DATABASE_URL is not set. Point it at the database to build in (scripts/with-env.ps1 loads .env.local).');
    process.exit(1);
  }
  console.log(`▶ database: ${url.replace(/^postgres(ql)?:\/\/[^@]*@/, '').split(/[/?]/)[0]}`);

  const prisma = new PrismaClient();
  try {
    const studio = await prisma.studio.findUnique({ where: { slug }, select: { id: true, tradeName: true } });
    if (!studio) {
      console.error(`No studio with slug "${slug}".`);
      process.exit(1);
    }
    const studioId = studio.id;
    /* The studio's own fields that hold a wing or an area (AxLeads' "wing" and "area" became fields on the first import). */
    const fields = await prisma.studioField.findMany({ where: { studioId }, select: { key: true, label: true } });
    const wingKeys = fields.filter((f) => /^(wing|tower|wing_tower)$/i.test(f.key) || /^(wing|tower|wing \/ tower)$/i.test(f.label)).map((f) => f.key);
    const areaKeys = fields.filter((f) => /^(area|locality|location)$/i.test(f.key) || /^(area|locality|location)$/i.test(f.label)).map((f) => f.key);

    const rows = await prisma.studioClient.findMany({
      where: { studioId, deletedAt: null, society: { not: null } },
      select: { id: true, society: true, locality: true, fields: true, assignedToId: true, societyId: true, wingId: true },
    });
    const leads: BuildLead[] = rows.map((r) => ({
      id: r.id,
      society: r.society,
      locality: r.locality ?? fieldText(r.fields, areaKeys),
      wing: fieldText(r.fields, wingKeys),
      assignedToId: r.assignedToId,
    }));
    const existing = await prisma.studioSociety.findMany({ where: { studioId }, select: { id: true, name: true, aliases: true } });
    const people = new Map(
      (await prisma.studioMember.findMany({ where: { studioId }, select: { id: true, user: { select: { name: true } } } })).map((m) => [m.id, m.user.name ?? 'someone']),
    );
    const plan = planSocietyBuild(leads, existing, min);

    // ── Report ──
    const made = plan.societies.filter((s) => !s.existing);
    const reused = plan.societies.filter((s) => s.existing);
    console.log(`\n${studio.tradeName} (${slug})${write ? '' : '  (DRY RUN — nothing is written; add --write to build)'}`);
    console.log(`Leads with a society typed   ${leads.length}`);
    console.log(`Societies to make            ${made.length}   (a name on ${min}+ leads)`);
    console.log(`Societies already here       ${reused.length}`);
    console.log(`Leads to link                ${plan.links.size}`);
    console.log(`Left as text, under ${min} leads  ${plan.small.reduce((a, s) => a + s.leads, 0)} leads in ${plan.small.length} names`);
    console.log(`Not a society (a source)     ${plan.notSocieties.reduce((a, s) => a + s.leads, 0)} leads: ${plan.notSocieties.map((s) => `${s.name} (${s.leads})`).join(', ') || '—'}`);
    const merged = plan.societies.filter((s) => s.spellings.length > 1);
    if (merged.length) {
      console.log(`\nTypos and spellings merged (${merged.length}):`);
      for (const s of merged) console.log(`  ${s.name}  ⇐  ${s.spellings.map((x) => `${x.name} (${x.leads})`).join(' + ')}`);
    }
    console.log('\nSocieties (leads · wings · owner · locality):');
    for (const s of plan.societies) {
      console.log(`  ${s.existing ? '=' : '+'} ${s.name} · ${s.leads} · ${s.wings.length ? s.wings.join(', ') : 'no wings'} · ${s.ownerId ? people.get(s.ownerId) ?? 'someone' : 'nobody'} · ${s.locality ?? '—'}`);
    }
    if (!write) {
      console.log('\nDry run: nothing was written. Run again with --write to build.');
      return;
    }

    // ── Write ──
    const started = Date.now();
    const idOf = new Map<string, string>();
    let created = 0;
    for (const s of plan.societies) {
      if (s.existing) {
        const row = existing.find((e) => e.id === s.ref)!;
        const aliases = [...new Set([...row.aliases, ...s.aliases])];
        if (aliases.length !== row.aliases.length) await prisma.studioSociety.updateMany({ where: { id: s.ref, studioId }, data: { aliases } });
        idOf.set(s.ref, s.ref);
        continue;
      }
      const key = societyKey(s.name);
      const clash = await prisma.studioSociety.findUnique({ where: { studioId_key: { studioId, key } }, select: { id: true, aliases: true } });
      if (clash) {
        await prisma.studioSociety.updateMany({ where: { id: clash.id, studioId }, data: { aliases: [...new Set([...clash.aliases, ...s.aliases])] } });
        idOf.set(s.ref, clash.id);
        continue;
      }
      const row = await prisma.studioSociety.create({
        data: { studioId, name: s.name, key, aliases: s.aliases, locality: s.locality, assignedToId: s.ownerId, sourceSheet: 'AxLeads leads', sourceImportedAt: new Date() },
        select: { id: true },
      });
      idOf.set(s.ref, row.id);
      created += 1;
    }
    /* Wings, then the leads, grouped by (society, wing) so each is one update. */
    const wingId = new Map<string, string>();
    let wings = 0;
    for (const s of plan.societies) {
      const sid = idOf.get(s.ref)!;
      for (const w of s.wings) {
        const before = await prisma.studioSocietyWing.findUnique({ where: { societyId_name: { societyId: sid, name: w } }, select: { id: true } });
        const row = before ?? (await prisma.studioSocietyWing.create({ data: { societyId: sid, name: w }, select: { id: true } }));
        if (!before) wings += 1;
        wingId.set(`${sid}|${w}`, row.id);
      }
    }
    const current = new Map(rows.map((r) => [r.id, r]));
    const groups = new Map<string, { societyId: string; wingId: string | null | undefined; ids: string[] }>();
    for (const [leadId, l] of plan.links) {
      const sid = idOf.get(l.ref)!;
      const wid = l.wing ? wingId.get(`${sid}|${l.wing}`) : undefined;
      const now = current.get(leadId)!;
      /* No wing known: keep a wing set by hand in this same society. */
      const keepWing = wid === undefined && now.societyId === sid;
      if (now.societyId === sid && (keepWing || now.wingId === wid)) continue;
      const k = `${sid}|${keepWing ? 'keep' : (wid ?? 'none')}`;
      const g = groups.get(k) ?? { societyId: sid, wingId: keepWing ? undefined : (wid ?? null), ids: [] };
      g.ids.push(leadId);
      groups.set(k, g);
    }
    let linked = 0;
    for (const g of groups.values()) {
      for (let i = 0; i < g.ids.length; i += 1000) {
        const r = await prisma.studioClient.updateMany({
          where: { studioId, id: { in: g.ids.slice(i, i + 1000) } },
          data: { societyId: g.societyId, ...(g.wingId === undefined ? {} : { wingId: g.wingId }) },
        });
        linked += r.count;
      }
    }
    await prisma.auditLog.create({
      data: { actorId: null, action: 'studio.societies.build', entityType: 'Studio', entityId: studioId, after: { by: 'scripts/build-societies.ts', min, created, reused: reused.length, wings, linked } },
    });
    console.log(`\nWritten in ${Math.round((Date.now() - started) / 1000)}s: ${created} societies made, ${reused.length} reused, ${wings} wings, ${linked} leads linked.`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
