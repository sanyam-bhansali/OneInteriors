/**
 * Download a studio's quotations to this laptop, for the owner to read.
 *
 *     npm run quotes:fetch -- <studio-slug>
 *
 * Part of `/read-quotations` (docs/READ-QUOTATIONS.md). The web app no longer
 * reads quotations through the API (10 Oct 2026); the owner reads them in
 * their own Claude app, and this is the first step: every file the studio has
 * sent, from every archive not refused, lands in `.quote-reading/<slug>/`
 * with a `manifest.json` describing them. Byte-identical copies are listed
 * once and marked, so a quotation sent twice is read once.
 *
 * Credentials come from `.env.local` through prisma/load-env.ts and are never
 * printed. `.quote-reading/` is git-ignored: these are a studio's private
 * prices, and they stay on this laptop.
 */

import '../../prisma/load-env';
import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { PrismaClient } from '@prisma/client';

const BUCKET = 'quotation-archives';

async function main() {
  const slug = process.argv[2]?.trim();
  if (!slug) {
    console.error('Usage: npm run quotes:fetch -- <studio-slug>');
    process.exit(1);
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SECRET_KEY?.trim();
  if (!url || !key) {
    console.error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY must be in .env.local.');
    process.exit(1);
  }

  const prisma = new PrismaClient();
  try {
    const studio = await prisma.studio.findUnique({
      where: { slug },
      select: { id: true, slug: true, tradeName: true },
    });
    if (!studio) {
      console.error(`No studio with slug "${slug}".`);
      process.exit(1);
    }

    const archives = await prisma.quotationArchive.findMany({
      where: { studioId: studio.id, state: { not: 'REJECTED' } },
      orderBy: { uploadedAt: 'asc' },
      select: { id: true, files: { select: { id: true, path: true, filename: true, bytes: true } } },
    });
    const files = archives.flatMap((a) => a.files.map((f) => ({ ...f, archiveId: a.id })));
    if (files.length === 0) {
      console.error(`${studio.tradeName} has not sent any quotations.`);
      process.exit(1);
    }

    const dir = resolve(process.cwd(), '.quote-reading', studio.slug);
    mkdirSync(dir, { recursive: true });

    const byHash = new Map<string, string>();
    const manifest: {
      fileId: string;
      archiveId: string;
      filename: string;
      local: string;
      bytes: number;
      sha256: string;
      duplicateOf: string | null;
    }[] = [];
    let failed = 0;

    for (const [i, f] of files.entries()) {
      const response = await fetch(`${url}/storage/v1/object/${BUCKET}/${encodeURI(f.path)}`, {
        headers: { Authorization: `Bearer ${key}`, apikey: key },
      });
      if (!response.ok) {
        failed += 1;
        console.error(`  could not download ${f.filename} (${response.status})`);
        continue;
      }
      const body = Buffer.from(await response.arrayBuffer());
      const sha256 = createHash('sha256').update(body).digest('hex');
      const duplicateOf = byHash.get(sha256) ?? null;
      const safe = `${String(i + 1).padStart(3, '0')}-${f.filename.replace(/[^\w.\- ]+/g, '_')}`;
      if (!duplicateOf) {
        writeFileSync(join(dir, safe), body);
        byHash.set(sha256, safe);
      }
      manifest.push({
        fileId: f.id,
        archiveId: f.archiveId,
        filename: f.filename,
        local: duplicateOf ? duplicateOf : safe,
        bytes: body.length,
        sha256,
        duplicateOf,
      });
    }

    writeFileSync(
      join(dir, 'manifest.json'),
      JSON.stringify(
        {
          studio,
          fetchedAt: new Date().toISOString(),
          archiveIds: archives.map((a) => a.id),
          files: manifest,
        },
        null,
        2,
      ),
    );

    const unique = manifest.filter((m) => !m.duplicateOf).length;
    console.log(`${studio.tradeName}: ${manifest.length} files, ${unique} unique, ${manifest.length - unique} duplicates${failed ? `, ${failed} failed` : ''}.`);
    console.log(`Saved to ${dir}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
