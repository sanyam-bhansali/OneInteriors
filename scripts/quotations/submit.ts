/**
 * File a product master read from a studio's quotations, for ops to approve.
 *
 *     npm run quotes:submit -- <studio-slug> <path/to/product-master.json>
 *
 * The last step of `/read-quotations` (docs/READ-QUOTATIONS.md). Writes the
 * rows as PENDING drafts (one run; it supersedes any older pending run) and
 * marks the studio's archives READ. Nothing reaches the studio's product
 * master until ops approves on /ops/<slug>.
 *
 * The JSON shape is in docs/READ-QUOTATIONS.md. Every row is checked here, and
 * the whole file is refused if any row is wrong — a half-filed master is worse
 * than none.
 */

import '../../prisma/load-env';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Prisma, PrismaClient } from '@prisma/client';

const ROOMS = ['Kitchen', 'Bedroom', 'Living', 'Study', 'Bathroom', 'Whole home'] as const;
const UNITS = ['AREA', 'SQFT', 'RFT', 'UNIT'] as const;
const RULE_KEYS = ['perBath', 'perBed', 'useRun', 'balcony', 'bhk', 'sqft', 'rft'] as const;

interface InRow {
  name: string;
  code: string;
  unit: string;
  rate: number;
  details?: string;
  rooms?: string[];
  defaultWidthMm?: number | null;
  defaultHeightMm?: number | null;
  defaultQty?: number | null;
  standard?: boolean;
  rules?: Record<string, unknown>;
  fromQuotations?: number;
  evidence?: Record<string, unknown>;
}

function codeOf(raw: string): 'MODULAR' | 'ONSITE' | null {
  const c = raw.trim().toUpperCase();
  if (c === 'MODULAR' || c.startsWith('MO')) return 'MODULAR';
  if (c === 'ONSITE' || c === 'ON-SITE' || c.startsWith('NM')) return 'ONSITE';
  return null;
}

function check(rows: InRow[]): string[] {
  const errors: string[] = [];
  const names = new Set<string>();
  rows.forEach((r, i) => {
    const at = `row ${i + 1} (${r?.name ?? '?'})`;
    if (!r || typeof r.name !== 'string' || r.name.trim().length < 2) errors.push(`${at}: name missing`);
    else if (names.has(r.name.trim().toLowerCase())) errors.push(`${at}: duplicate name`);
    else names.add(r.name.trim().toLowerCase());
    if (!codeOf(String(r?.code ?? ''))) errors.push(`${at}: code must be MO-01/MODULAR or NM-01/ONSITE`);
    if (!UNITS.includes(String(r?.unit ?? '').toUpperCase() as (typeof UNITS)[number])) errors.push(`${at}: unit must be ${UNITS.join('/')}`);
    if (typeof r?.rate !== 'number' || !Number.isFinite(r.rate) || r.rate <= 0 || r.rate >= 1e8) errors.push(`${at}: rate must be rupees above 0`);
    for (const room of r?.rooms ?? []) {
      if (!ROOMS.includes(room as (typeof ROOMS)[number])) errors.push(`${at}: room "${room}" is not one of ${ROOMS.join(', ')}`);
    }
    for (const k of Object.keys(r?.rules ?? {})) {
      if (!RULE_KEYS.includes(k as (typeof RULE_KEYS)[number])) errors.push(`${at}: unknown rule "${k}"`);
    }
  });
  return errors;
}

async function main() {
  const [slug, file] = [process.argv[2]?.trim(), process.argv[3]?.trim()];
  if (!slug || !file) {
    console.error('Usage: npm run quotes:submit -- <studio-slug> <product-master.json>');
    process.exit(1);
  }

  const input = JSON.parse(readFileSync(resolve(process.cwd(), file), 'utf8')) as {
    products: InRow[];
    quotationCount?: number;
    notes?: string[];
    unmapped?: string[];
  };
  const rows = Array.isArray(input.products) ? input.products : [];
  if (rows.length === 0) {
    console.error('No products in the file.');
    process.exit(1);
  }
  const errors = check(rows);
  if (errors.length > 0) {
    console.error(`Refused — ${errors.length} problem(s):\n  ${errors.join('\n  ')}`);
    process.exit(1);
  }

  const prisma = new PrismaClient();
  try {
    const studio = await prisma.studio.findUnique({ where: { slug }, select: { id: true, tradeName: true } });
    if (!studio) {
      console.error(`No studio with slug "${slug}".`);
      process.exit(1);
    }
    const archives = await prisma.quotationArchive.findMany({
      where: { studioId: studio.id, state: { not: 'REJECTED' } },
      orderBy: { uploadedAt: 'desc' },
      select: { id: true },
    });
    const archiveId = archives[0]?.id ?? null;
    const runId = `run-${new Date().toISOString()}`;

    await prisma.$transaction(
      async (tx) => {
        await tx.studioProductDraft.updateMany({
          where: { studioId: studio.id, state: 'PENDING' },
          data: { state: 'SUPERSEDED' },
        });
        await tx.studioProductDraft.createMany({
          data: rows.map((r, i) => ({
            studioId: studio.id,
            archiveId,
            runId,
            name: r.name.trim(),
            code: codeOf(r.code)!,
            unit: r.unit.toUpperCase() as (typeof UNITS)[number],
            details: r.details?.trim() || null,
            ratePaise: BigInt(Math.round(r.rate * 100)),
            rooms: r.rooms ?? [],
            defaultWidthMm: r.defaultWidthMm ?? null,
            defaultHeightMm: r.defaultHeightMm ?? null,
            defaultQty: r.defaultQty ?? null,
            inStandardBuild: r.standard === true,
            rules: r.rules ? (r.rules as Prisma.InputJsonValue) : Prisma.JsonNull,
            sortOrder: (i + 1) * 10,
            fromQuotations: Math.max(0, Math.round(r.fromQuotations ?? 0)),
            evidence: r.evidence ? (r.evidence as Prisma.InputJsonValue) : Prisma.JsonNull,
          })),
        });
        await tx.quotationArchive.updateMany({
          where: { id: { in: archives.map((a) => a.id) } },
          data: {
            analysisState: 'READ',
            analysisError: null,
            analysedAt: new Date(),
            ...(input.quotationCount ? { quotationCount: Math.round(input.quotationCount) } : {}),
            report: { readLocally: true, runId, notes: input.notes ?? [], unmapped: input.unmapped ?? [] },
          },
        });
      },
      { timeout: 30_000 },
    );

    console.log(`${studio.tradeName}: ${rows.length} products filed for approval (${runId}).`);
    console.log(`Approve them on /ops/${slug}.`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
