/**
 * The products Hauspire's team proposed in its quotation app and nobody had
 * approved yet, into a studio's Proposals queue on /studio/products (owner,
 * 23 Oct 2026: "the products that were not approved there should also show
 * here as unapproved or needs to be approved").
 *
 *     npx tsx scripts/import-hauspire-proposals.ts --studio <slug> --file proposals.json --dry-run
 *     npx tsx scripts/import-hauspire-proposals.ts --studio <slug> --file proposals.json
 *
 * `proposals.json` is the old app's `product_proposals` rows (id, product,
 * wc, type, rate, unit, details, rooms, created_at), read from it read-only.
 * The old app keeps a row there only while it waits: approving or rejecting
 * deletes it. So every row is still waiting, and each lands as PENDING, with
 * its old date, for the owner or a project manager to approve or reject.
 *
 * Left out, and listed: a row whose name is already a product here (it was
 * approved meanwhile), already a proposal here in any state (so a second run
 * adds nothing), or a repeat of an earlier row in the file (names matched as
 * the builder matches them, proposal-rules.ts `sameProductName`; the latest
 * row wins, as the latest price). A row with no price comes in at ₹0 and is
 * listed, so the approver sets the rate.
 *
 * Mapping as scripts/import-hauspire-products.ts: wc MO-01 → MODULAR, else
 * ONSITE; type Area/SqFt/RFT/Unit; price `rate`, or `unit` for Unit.
 *
 * The database is DATABASE_URL from the environment; the host is printed
 * first, never the credentials. One AuditLog row.
 */
import { readFileSync } from 'node:fs';
import { PrismaClient } from '@prisma/client';
import { sameProductName } from '../src/modules/studio-quote/proposal-rules';

type OldProposal = {
  id: string;
  product: string;
  wc: string | null;
  type: string | null;
  rate: number | null;
  unit: number | null;
  details: string | null;
  rooms: string | null;
  created_at: string;
};

const UNITS: Record<string, 'AREA' | 'SQFT' | 'RFT' | 'UNIT'> = { area: 'AREA', sqft: 'SQFT', rft: 'RFT', unit: 'UNIT' };
const rupees = (paise: number) => `₹${(paise / 100).toLocaleString('en-IN')}`;

function arg(name: string): string | null {
  const i = process.argv.indexOf(name);
  return i >= 0 ? (process.argv[i + 1] ?? null) : null;
}

async function main() {
  const slug = arg('--studio');
  const file = arg('--file');
  const dryRun = process.argv.includes('--dry-run');
  if (!slug || !file) throw new Error('Usage: npx tsx scripts/import-hauspire-proposals.ts --studio <slug> --file proposals.json [--dry-run]');
  const rows = JSON.parse(readFileSync(file, 'utf8')) as OldProposal[];
  if (!Array.isArray(rows)) throw new Error('The file is not a list of proposals.');
  console.log(`▶ database: ${(process.env.DATABASE_URL ?? '').replace(/^.*@/, '').replace(/[/?].*$/, '') || '(none)'}`);
  const db = new PrismaClient();
  try {
    const studio = await db.studio.findUnique({ where: { slug }, select: { id: true, tradeName: true } });
    if (!studio) throw new Error(`No studio with slug ${slug}.`);
    const [products, existing] = await Promise.all([
      db.studioProduct.findMany({ where: { studioId: studio.id }, select: { name: true } }),
      db.studioProductProposal.findMany({ where: { studioId: studio.id }, select: { name: true, state: true } }),
    ]);

    /* The latest row of each name, oldest first. */
    const sorted = [...rows].filter((r) => r && typeof r.product === 'string' && r.product.trim()).sort((a, b) => a.created_at.localeCompare(b.created_at));
    const latest: OldProposal[] = [];
    const repeats: string[] = [];
    for (const r of sorted) {
      const i = latest.findIndex((x) => sameProductName(x.product, r.product));
      if (i >= 0) {
        repeats.push(latest[i].product.trim());
        latest.splice(i, 1);
      }
      latest.push(r);
    }

    const inMaster: string[] = [];
    const alreadyHere: string[] = [];
    const noPrice: string[] = [];
    const toAdd: { name: string; code: 'MODULAR' | 'ONSITE'; unit: 'AREA' | 'SQFT' | 'RFT' | 'UNIT'; ratePaise: number; details: string | null; room: string | null; createdAt: Date }[] = [];
    for (const r of latest) {
      const name = r.product.trim().replace(/\s+/g, ' ').slice(0, 120);
      if (products.some((p) => sameProductName(p.name, name))) { inMaster.push(name); continue; }
      const here = existing.find((p) => sameProductName(p.name, name));
      if (here) { alreadyHere.push(`${name} (${here.state.toLowerCase()})`); continue; }
      const unit = UNITS[(r.type ?? '').trim().toLowerCase()] ?? 'UNIT';
      const price = unit === 'UNIT' ? r.unit : r.rate;
      const ratePaise = typeof price === 'number' && Number.isFinite(price) && price > 0 ? Math.round(price * 100) : 0;
      if (ratePaise === 0) noPrice.push(name);
      const details = (r.details ?? '').trim();
      const room = (r.rooms ?? '').split(',').map((s) => s.trim()).filter(Boolean)[0] ?? null;
      const createdAt = new Date(r.created_at);
      toAdd.push({
        name,
        code: (r.wc ?? '').trim().toUpperCase() === 'MO-01' ? 'MODULAR' : 'ONSITE',
        unit,
        ratePaise,
        details: details ? details.slice(0, 1000) : null,
        room,
        createdAt: Number.isNaN(createdAt.getTime()) ? new Date() : createdAt,
      });
    }

    console.log(`Hauspire quotation app → ${studio.tradeName} (${slug})${dryRun ? '  (DRY RUN: nothing is written)' : ''}`);
    console.log(`  waiting in the old app        ${rows.length}`);
    console.log(`  to approve here (new)         ${toAdd.length}`);
    console.log(`  already a product here        ${inMaster.length}${inMaster.length ? `: ${inMaster.join(', ')}` : ''}`);
    console.log(`  already a proposal here       ${alreadyHere.length}${alreadyHere.length ? `: ${alreadyHere.join(', ')}` : ''}`);
    console.log(`  repeats (latest kept)         ${repeats.length}${repeats.length ? `: ${repeats.join(', ')}` : ''}`);
    console.log(`  no price (comes in at ₹0)     ${noPrice.length}${noPrice.length ? `: ${noPrice.join(', ')}` : ''}`);
    console.log('');
    for (const p of toAdd) console.log(`  + ${p.name} · ${p.code} · ${p.unit} · ${rupees(p.ratePaise)} · ${p.room ?? '—'}`);
    if (dryRun || toAdd.length === 0) return;

    await db.$transaction(async (tx) => {
      await tx.studioProductProposal.createMany({
        data: toAdd.map((p) => ({ studioId: studio.id, ...p, ratePaise: BigInt(p.ratePaise), proposedBy: 'Hauspire quotation app', state: 'PENDING' })),
      });
      await tx.auditLog.create({
        data: {
          actorId: null,
          action: 'studio.proposals.import_hauspire',
          entityType: 'Studio',
          entityId: studio.id,
          after: { added: toAdd.length, inMaster: inMaster.length, alreadyHere: alreadyHere.length, repeats: repeats.length, noPrice: noPrice.length, by: 'scripts/import-hauspire-proposals.ts' },
        },
      });
    }, { timeout: 60_000, maxWait: 20_000 });
    console.log(`\nWritten: ${toAdd.length} proposals waiting for approval on Products.`);
  } finally {
    await db.$disconnect();
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
