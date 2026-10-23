/**
 * Hauspire's studio, ready for its team (owner, 23 Oct 2026: "complete
 * everything needed for us to start using it").
 *
 *     npx tsx --conditions=react-server scripts/setup-hauspire-team.ts --studio <slug> --brand cover.png,about.png --dry-run
 *     npx tsx --conditions=react-server scripts/setup-hauspire-team.ts --studio <slug> --brand cover.png,about.png
 *
 * Sets three things, each only when it is not already so:
 *  1. Who builds quotations (Settings → Team → Quotations): Khushi, then
 *     Swarupa, taking turns (docs/studio-os/QUOTE-REQUESTS.md). The turn
 *     starts from the top.
 *  2. New leads go to (Settings → Lead sources): Swarupa's team pool, so she
 *     hands them out to her team as she did on AxLeads.
 *  4. Its rates, filled and confirmed (studio-quote/rates-gate.ts): the
 *     product master was just filled from Hauspire's own quotation app
 *     (scripts/import-hauspire-products.ts), the rates its team quotes from
 *     daily, so the builder opens without the read-and-check step. Only with
 *     `--rates-confirmed`, and only when the product master is not empty.
 *  3. The brand pages (Settings → Branding): the old quotation app's cover
 *     and about pages, stored exactly as an upload in Settings stores them
 *     (storage/studio-logo.ts storeBrandPage). Skipped when the studio
 *     already has brand pages.
 *
 * The people are found by their mobile numbers (the AxLeads import added
 * them). DATABASE_URL, NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
 * and SUPABASE_SECRET_KEY come from the environment; nothing is printed but
 * the database host. `--conditions=react-server` because the storage module
 * is server-only. One AuditLog row (`studio.setup.hauspire`).
 */
import { readFileSync } from 'node:fs';
import { basename } from 'node:path';
import { PrismaClient } from '@prisma/client';
import { storeBrandPage } from '../src/modules/storage/studio-logo';

const KHUSHI = '+918329222519';
const SWARUPA = '+917030142557';

function arg(name: string): string | null {
  const i = process.argv.indexOf(name);
  return i >= 0 ? (process.argv[i + 1] ?? null) : null;
}

async function main() {
  const slug = arg('--studio');
  const dryRun = process.argv.includes('--dry-run');
  const brand = (arg('--brand') ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  if (!slug) throw new Error('Usage: npx tsx --conditions=react-server scripts/setup-hauspire-team.ts --studio <slug> [--brand a.png,b.png] [--dry-run]');
  console.log(`▶ database: ${(process.env.DATABASE_URL ?? '').replace(/^.*@/, '').replace(/[/?].*$/, '') || '(none)'}`);
  const db = new PrismaClient();
  try {
    const studio = await db.studio.findUnique({
      where: { slug },
      select: { id: true, tradeName: true, quoteBuilderIds: true, leadRouteMode: true, leadRouteMemberId: true, ratesFilledAt: true, ratesConfirmedAt: true, branding: { select: { brandPages: true } } },
    });
    if (!studio) throw new Error(`No studio with slug ${slug}.`);
    const member = async (phone: string) =>
      db.studioMember.findFirst({ where: { studioId: studio.id, user: { phone } }, select: { id: true, user: { select: { name: true } } } });
    const khushi = await member(KHUSHI);
    const swarupa = await member(SWARUPA);
    if (!khushi || !swarupa) throw new Error('Khushi or Swarupa is not on this studio’s team yet (run the AxLeads import first).');

    const builders = [khushi.id, swarupa.id];
    const buildersChange = studio.quoteBuilderIds.join(',') !== builders.join(',');
    const routeChange = studio.leadRouteMode !== 'TEAM' || studio.leadRouteMemberId !== swarupa.id;
    const hasPages = (studio.branding?.brandPages ?? []).length > 0;
    const pagesToAdd = hasPages ? [] : brand;
    const products = await db.studioProduct.count({ where: { studioId: studio.id, isActive: true } });
    const ratesChange = process.argv.includes('--rates-confirmed') && !studio.ratesConfirmedAt;
    if (ratesChange && products === 0) throw new Error('The product master is empty: import the products first.');

    console.log(`${studio.tradeName} (${slug})${dryRun ? '  (DRY RUN: nothing is written)' : ''}`);
    console.log(`  who builds quotations   ${buildersChange ? `→ ${khushi.user.name}, ${swarupa.user.name} (in turns)` : 'already Khushi, Swarupa'}`);
    console.log(`  new leads go to         ${routeChange ? `${studio.leadRouteMode} → ${swarupa.user.name}’s team pool` : 'already Swarupa’s team pool'}`);
    console.log(`  brand pages             ${hasPages ? `already ${studio.branding!.brandPages.length}, left as they are` : pagesToAdd.length ? `→ ${pagesToAdd.map((p) => basename(p)).join(', ')}` : 'none given'}`);
    console.log(`  rates                   ${studio.ratesConfirmedAt ? 'already confirmed' : ratesChange ? `→ filled and confirmed (${products} products)` : 'not confirmed (add --rates-confirmed)'}`);
    if (!studio.branding && pagesToAdd.length) throw new Error('This studio has no branding row yet: run scripts/setup-hauspire-document.ts first.');
    if (dryRun) return;

    const stored: string[] = [];
    for (const p of pagesToAdd) {
      const file = new File([readFileSync(p)], basename(p), { type: p.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg' });
      const r = await storeBrandPage(studio.id, file);
      if (!r.ok) throw new Error(`Brand page ${basename(p)}: ${r.error}`);
      stored.push(r.path);
    }
    await db.$transaction(async (tx) => {
      if (buildersChange) await tx.studio.update({ where: { id: studio.id }, data: { quoteBuilderIds: builders, quoteTurnLastId: null } });
      if (routeChange) await tx.studio.update({ where: { id: studio.id }, data: { leadRouteMode: 'TEAM', leadRouteMemberId: swarupa.id } });
      if (ratesChange) {
        const now = new Date();
        await tx.studio.update({ where: { id: studio.id }, data: { ratesFilledAt: studio.ratesFilledAt ?? now, ratesConfirmedAt: now } });
      }
      if (stored.length) await tx.studioBranding.update({ where: { studioId: studio.id }, data: { brandPages: { push: stored } } });
      await tx.auditLog.create({
        data: {
          actorId: null,
          action: 'studio.setup.hauspire',
          entityType: 'Studio',
          entityId: studio.id,
          after: { quoteBuilders: buildersChange ? builders.length : 'unchanged', route: routeChange ? 'TEAM' : 'unchanged', brandPages: stored.length, rates: ratesChange ? 'confirmed' : 'unchanged', by: 'scripts/setup-hauspire-team.ts' },
        },
      });
    });
    console.log(`Written: ${[buildersChange && 'who builds quotations', routeChange && 'new leads go to', stored.length && `${stored.length} brand pages`, ratesChange && 'rates confirmed'].filter(Boolean).join(', ') || 'nothing needed'}.`);
  } finally {
    await db.$disconnect();
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
