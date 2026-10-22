/**
 * Hauspire's product master from its quotation app, into a studio's product
 * master (owner, 22 Oct 2026: "import the products"; docs/studio-os/QUOTE-PARITY.md).
 *
 *     npx tsx scripts/import-hauspire-products.ts --studio <slug> --file products.json --dry-run
 *     npx tsx scripts/import-hauspire-products.ts --studio <slug> --file products.json
 *
 * `products.json` is the old app's `product_master` rows (id, product, wc,
 * type, rate, unit, rooms, details, sort, fq_config), read from it read-only.
 * Each row matches our product by name (case and spacing ignored) and is
 * updated to the old app's figures, or is made when we have none. Ours that
 * the old app does not have are listed and left as they are. A copy of the
 * whole product master is kept first (studio_product_backups, restorable with
 * scripts/quotations/restore.ts), in the same transaction. One AuditLog row.
 *
 * Mapping, the old app's own meaning:
 *   wc      MO-01 → MODULAR, NM-01 → ONSITE
 *   type    Area → AREA (rate per sqft of W×H), SqFt → SQFT, RFT → RFT, Unit → UNIT
 *   price   `rate` for Area / SqFt / RFT; `unit` (the unit price) for Unit
 *   rooms   "Kitchen,Living" → ["Kitchen", "Living"]
 *   fq_config  fq → in the standard build; w / h / qty → default size; useRun,
 *           perBath, perBed, balcony, bhk, sqft, rft → the first-quote rules
 *   sort    → sortOrder
 *
 * The database is DATABASE_URL from the environment; the host is printed
 * first, never the credentials.
 */
import { readFileSync } from 'node:fs';
import { Prisma, PrismaClient } from '@prisma/client';
import { readRules, standardSelectionFor } from '../src/modules/studio-quote/configure';

type OldProduct = {
  id: string;
  product: string;
  wc: string | null;
  type: string | null;
  rate: number | null;
  unit: number | null;
  rooms: string | null;
  details: string | null;
  sort: number | null;
  fq_config: Record<string, unknown> | null;
};

const UNITS: Record<string, 'AREA' | 'SQFT' | 'RFT' | 'UNIT'> = { area: 'AREA', sqft: 'SQFT', rft: 'RFT', unit: 'UNIT' };
/* Luster and Lustre are one product (the old app spells it both ways). */
const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ').replace(/\blustre\b/g, 'luster');
const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : null);
const rupees = (paise: bigint | number) => `₹${(Number(paise) / 100).toLocaleString('en-IN')}`;

/**
 * The old app's rooms, except "Other": our first quote places whole-home and
 * bathroom work by those names (configure.ts), so "Other" takes ours when we
 * know the product's kind, and stays "Other" when we do not.
 */
function roomsOf(o: OldProduct, unit: 'AREA' | 'SQFT' | 'RFT' | 'UNIT'): string[] {
  const rooms = (o.rooms ?? '').split(',').map((r) => r.trim()).filter(Boolean);
  if (!rooms.includes('Other')) return rooms;
  const ours = standardSelectionFor(o.product, unit)?.rooms ?? [];
  return [...new Set(rooms.flatMap((r) => (r === 'Other' && ours.length ? ours : [r])))];
}

export function mapProduct(o: OldProduct) {
  const unit = UNITS[norm(o.type ?? '')];
  if (!unit) return { ok: false as const, why: `unknown type "${o.type}"` };
  const price = unit === 'UNIT' ? num(o.unit) : num(o.rate);
  if (price === null) return { ok: false as const, why: `no ${unit === 'UNIT' ? 'unit price' : 'rate'}` };
  const fq = o.fq_config ?? {};
  const intOrNull = (v: unknown) => (typeof v === 'number' && Number.isInteger(v) && v > 0 ? v : null);
  return {
    ok: true as const,
    row: {
      name: o.product.trim(),
      code: o.wc === 'NM-01' ? ('ONSITE' as const) : ('MODULAR' as const),
      unit,
      ratePaise: BigInt(Math.round(price * 100)),
      details: o.details?.trim() || null,
      rooms: roomsOf(o, unit),
      inStandardBuild: fq.fq === true,
      defaultWidthMm: intOrNull(fq.w),
      defaultHeightMm: intOrNull(fq.h),
      defaultQty: intOrNull(fq.qty),
      rules: readRules(fq),
      sortOrder: typeof o.sort === 'number' ? o.sort : 100,
    },
  };
}

function arg(name: string): string | null {
  const i = process.argv.indexOf(name);
  return i >= 0 ? (process.argv[i + 1] ?? null) : null;
}

async function main() {
  const slug = arg('--studio');
  const file = arg('--file');
  const dryRun = process.argv.includes('--dry-run');
  if (!slug || !file) throw new Error('Usage: npx tsx scripts/import-hauspire-products.ts --studio <slug> --file products.json [--dry-run]');
  console.log(`▶ database: ${(process.env.DATABASE_URL ?? '').replace(/^.*@/, '').replace(/[/?].*$/, '') || '(none)'}`);
  const all = JSON.parse(readFileSync(file, 'utf8')) as OldProduct[];
  /* A name twice in the old app: the one its first quote uses (fq), else the later one. */
  const rank = (o: OldProduct) => (o.fq_config?.fq === true ? 1_000_000 : 0) + (o.sort ?? 0);
  const best = new Map<string, OldProduct>();
  for (const o of all) {
    const k = norm(o.product);
    const had = best.get(k);
    if (!had || rank(o) > rank(had)) best.set(k, o);
  }
  const old = [...best.values()];
  const doubled = all.length - old.length;
  const db = new PrismaClient();
  try {
    const studio = await db.studio.findUnique({ where: { slug }, select: { id: true, tradeName: true } });
    if (!studio) throw new Error(`No studio with slug ${slug}.`);
    const ours = await db.studioProduct.findMany({ where: { studioId: studio.id } });
    const byName = new Map(ours.map((p) => [norm(p.name), p]));
    const seen = new Set<string>();
    const creates: ReturnType<typeof mapProduct> extends infer R ? (R extends { ok: true; row: infer Row } ? Row : never)[] : never = [];
    const updates: { id: string; name: string; row: (typeof creates)[number]; changes: string[] }[] = [];
    const skipped: string[] = [];
    for (const o of old) {
      const m = mapProduct(o);
      if (!m.ok) {
        skipped.push(`${o.product}: ${m.why}`);
        continue;
      }
      const key = norm(m.row.name);
      seen.add(key);
      const mine = byName.get(key);
      if (!mine) {
        creates.push(m.row);
        continue;
      }
      const changes: string[] = [];
      if (mine.ratePaise !== m.row.ratePaise) changes.push(`rate ${rupees(mine.ratePaise)} → ${rupees(m.row.ratePaise)}`);
      if (mine.code !== m.row.code) changes.push(`code ${mine.code} → ${m.row.code}`);
      if (mine.unit !== m.row.unit) changes.push(`unit ${mine.unit} → ${m.row.unit}`);
      if ((mine.details ?? '') !== (m.row.details ?? '')) changes.push('details');
      if (mine.inStandardBuild !== m.row.inStandardBuild) changes.push(m.row.inStandardBuild ? 'now in the standard build' : 'out of the standard build');
      if (mine.defaultWidthMm !== m.row.defaultWidthMm || mine.defaultHeightMm !== m.row.defaultHeightMm || mine.defaultQty !== m.row.defaultQty) changes.push('default size');
      if (JSON.stringify(mine.rules ?? null) !== JSON.stringify(m.row.rules ?? null)) changes.push('first-quote rules');
      if (!mine.isActive) changes.push('switched back on');
      /* Our room names stay: our first quote places products by them. */
      if (changes.length) updates.push({ id: mine.id, name: mine.name, row: { ...m.row, name: mine.name, rooms: mine.rooms }, changes });
    }
    const onlyOurs = ours.filter((p) => !seen.has(norm(p.name)) && p.isActive);

    console.log(`Hauspire quotation app → ${studio.tradeName} (${slug})${dryRun ? '  (DRY RUN: nothing is written)' : ''}`);
    console.log(`  products in the old app      ${all.length}${doubled ? ` (${doubled} name twice: the one its first quote uses is taken)` : ''}`);
    console.log(`  new here                     ${creates.length}`);
    console.log(`  updated to the old figures   ${updates.length}`);
    console.log(`  already the same             ${old.length - creates.length - updates.length - skipped.length}`);
    console.log(`  skipped                      ${skipped.length}`);
    console.log(`  ours, not in the old app     ${onlyOurs.length} (left as they are)`);
    if (creates.length) console.log(`\nNew:\n${creates.map((r) => `  + ${r.name} · ${r.code} · ${r.unit} · ${rupees(r.ratePaise)}`).join('\n')}`);
    if (updates.length) console.log(`\nUpdated:\n${updates.map((u) => `  ~ ${u.name}: ${u.changes.join('; ')}`).join('\n')}`);
    if (skipped.length) console.log(`\nSkipped:\n${skipped.map((s) => `  ✗ ${s}`).join('\n')}`);
    if (onlyOurs.length) console.log(`\nOurs, not in the old app:\n${onlyOurs.map((p) => `  · ${p.name} · ${rupees(p.ratePaise)}`).join('\n')}`);
    if (dryRun) return;

    await db.$transaction(
      async (tx) => {
        if (ours.length) {
          await tx.studioProductBackup.create({
            data: { studioId: studio.id, reason: 'before importing the Hauspire quotation app’s product master', rows: ours.map((p) => ({ ...p, ratePaise: String(p.ratePaise) })) as unknown as Prisma.InputJsonValue },
          });
        }
        const data = (r: (typeof creates)[number]) => ({ ...r, rules: r.rules ?? Prisma.DbNull, isActive: true });
        for (const r of creates) await tx.studioProduct.create({ data: { studioId: studio.id, ...data(r) } });
        for (const u of updates) await tx.studioProduct.update({ where: { id: u.id }, data: data(u.row) });
        await tx.auditLog.create({
          data: { actorId: null, action: 'studio.products.hauspire', entityType: 'Studio', entityId: studio.id, after: { created: creates.length, updated: updates.length, skipped: skipped.length, by: 'scripts/import-hauspire-products.ts' } },
        });
      },
      { timeout: 120_000 },
    );
    console.log(`\nWritten: ${creates.length} made, ${updates.length} updated. A backup of the product master was kept first.`);
  } finally {
    await db.$disconnect();
  }
}

if (require.main === module) {
  main().catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  });
}
