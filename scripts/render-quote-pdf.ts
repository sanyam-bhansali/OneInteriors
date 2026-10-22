/**
 * Render one quotation to a PDF on this laptop, the way "Export as PDF"
 * prints it, so the pages can be laid side by side with the Hauspire
 * quotation app's PDF of the same quotation (owner, 22 Oct 2026; docs/
 * studio-os/QUOTE-PARITY.md §PDF).
 *
 *     npx tsx scripts/render-quote-pdf.ts --sample --out sample.pdf
 *     npx tsx scripts/render-quote-pdf.ts --from-row row.json --brand cover.png,about.png --out 2301.pdf
 *     npx tsx scripts/render-quote-pdf.ts --quote <quote id> --studio <slug> --out 2301.pdf
 *
 * - `--from-row`: one row of the old app's `quotes` table as JSON (what its
 *   Supabase table editor exports), mapped exactly as the import maps it, and
 *   printed with Hauspire's defaults: its maroon, its six payment stages, its
 *   material specification and terms (`--terms file.txt` to use your own).
 * - `--quote`: a quotation from our database (DATABASE_URL; read only), with
 *   the studio's own colour, schedule, specification and terms.
 * - `--sample`: a built-in FAKE quotation, to try the script.
 * - `--brand a.png,b.png`: full-page brand images to open with (the old
 *   app's cover.png and about.png). Our stored brand pages live in private
 *   storage, so give the files here.
 *
 * It renders the same React component the print page uses
 * (`doc/QuotationDocument.tsx`) to static HTML with the same stylesheet
 * (`doc/quote-doc.css`), then prints it with Playwright's Chromium to A4,
 * which is the browser print the studio does. `--html` keeps the HTML too.
 * Nothing is written to any database.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { extname, resolve } from 'node:path';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { mapQuote, type SourceQuote } from '../src/modules/studio-bring-in/hauspire-map';
import { computeTotals, type QuoteLineInput } from '../src/modules/studio-quote/pricing';
import { HAUSPIRE_COLOURS, type DocHead, type DocLineInput, type DocSpecRow, type DocStudio } from '../src/modules/studio-quote/document';
import { HAUSPIRE_TEMPLATE, readStages, templateOrDefault, type PaymentStage } from '../src/modules/studio-sales/payment-template';
import { roomsOfLines } from '../src/modules/studio-quote/rooms';

function arg(name: string): string | undefined {
  const argv = process.argv.slice(2);
  const i = argv.indexOf(`--${name}`);
  if (i >= 0 && argv[i + 1] && !argv[i + 1]!.startsWith('--')) return argv[i + 1];
  const eq = argv.find((a) => a.startsWith(`--${name}=`));
  return eq ? eq.slice(name.length + 3) : undefined;
}

/** The old app's material specification (`lib/boilerplate.ts` MATERIAL_SPEC). */
export const HAUSPIRE_SPEC: DocSpecRow[] = [
  { item: 'Plywood', brand: 'CENTURY', spec: 'BWP (Boiling Water Proof) Grade' },
  { item: 'HDHMR', brand: 'GREEN PLY', spec: 'BWP (Boiling Water Proof) Grade' },
  { item: 'Laminates', brand: 'MERINO', spec: 'Wood, Gloss, Matt, Texture' },
  { item: 'Special Laminates', brand: 'ADVANCE, VOUGE, MERINO', spec: 'High Gloss, Special Texture' },
  { item: 'Hardware', brand: 'HETTICH', spec: 'Soft Close' },
  { item: 'False Ceiling', brand: 'SAINT GOBAIN', spec: 'Gypsum board and Gyproc Channels' },
  { item: 'Handles', brand: 'LETTO, NIMKRO', spec: 'Premium Aluminium Handles' },
  { item: 'Wiring', brand: 'POLYCAB', spec: 'Standard Thickness' },
  { item: 'Paint', brand: 'Asian Paints', spec: 'Putty, Primer and Paint' },
  { item: 'Adhesive', brand: 'FEVICOL', spec: 'Falco Fix Pro' },
];

/** A FAKE quotation (no real client), shaped like an old-app row. */
const SAMPLE_ROW: SourceQuote = {
  id: '00000000-0000-0000-0000-000000000001',
  quote_no: '2399',
  stage: 'sales',
  client_name: 'Sample Client',
  mobile: '9000000000',
  location: 'Pune',
  bhk: '3 BHK',
  created_at: '2026-10-22T06:00:00Z',
  settings: { modularPct: 0.15, onSpot: 10000, onSpotLabel: 'Festive Discount', feeOn: true, gstOn: false, quoteDate: '2026-10-22' },
  tpv: 0,
  lines: [
    { room: 'Kitchen', product: 'Base Cabinets', wc: 'MO-01', details: 'BWP plywood carcass, laminate shutters', width: 3960, height: 750, rate: 2580, amount: 82480 },
    { room: 'Kitchen', product: 'Base Cabinets- Tandems (Horizantal)', wc: 'NM-01', details: 'Soft-close tandem drawers', width: null, height: null, qty: 3, unitPrice: 10000, amount: 30000 },
    { room: 'Kitchen', product: 'Wall Cabinets', wc: 'MO-01', details: '', width: 3960, height: 600, rate: 2580, amount: 65984 },
    { room: 'Master Bedroom', product: 'Premium Shutter wardrobe', wc: 'MO-01', details: 'Sliding shutters', width: 1500, height: 2100, rate: 2580, amount: 87478 },
    { room: 'Master Bedroom', product: 'Queen size Bed Hydraulic Storage', wc: 'MO-01', details: '', width: null, height: null, qty: 1, unitPrice: 54000, amount: 54000 },
    { room: 'Living, Dining & Foyer', product: 'TV Unit', wc: 'NM-01', details: 'Fluted panel', width: 1500, height: 2100, rate: 1200, amount: 40688 },
    { room: 'Other Services', product: 'Painting - 3BHK (Emulsion)', wc: 'NM-01', details: 'Two coats', width: null, height: null, qty: 1, unitPrice: 55000, amount: 55000 },
    { room: 'Other Services', product: 'False Ceiling (Living)', wc: 'NM-01', details: 'Gypsum', width: null, height: null, sqft: 180, rate: 120, amount: 21600 },
  ],
};

function dataUri(path: string): string {
  const ext = extname(path).toLowerCase();
  const mime = ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : 'image/jpeg';
  return `data:${mime};base64,${readFileSync(path).toString('base64')}`;
}

interface DocInput {
  studio: DocStudio;
  head: DocHead;
  lines: DocLineInput[];
  terms: { feeBps: number; discountBps: number; onSpotPaise: number; onSpotLabel: string | null; gstBps: number; bookingAdvancePaise: number; phases?: { label: string; pct: number }[] | null };
  schedule: PaymentStage[] | null;
  spec: DocSpecRow[];
  termsText: string | null;
}

const HAUSPIRE_STUDIO: DocStudio = { name: 'Hauspire', tradeName: 'Hauspire', addressLine: null, city: 'Pune', pincode: null, phone: null, email: null, website: null, gstin: null, logoUrl: null, accentHex: HAUSPIRE_COLOURS.brand };

function fromRow(row: SourceQuote, termsText: string | null): DocInput {
  const m = mapQuote(row);
  return {
    studio: HAUSPIRE_STUDIO,
    head: { clientName: m.client, clientPhone: m.phone, flatNo: null, config: m.bhk, number: m.number, date: m.terms.quoteDate ? new Date(`${m.terms.quoteDate}T00:00:00`) : new Date(), location: m.location },
    lines: m.lines,
    terms: { ...m.terms, bookingAdvancePaise: 2_500_000 },
    schedule: [...HAUSPIRE_TEMPLATE],
    spec: HAUSPIRE_SPEC,
    termsText,
  };
}

async function fromDb(quoteId: string, slug: string): Promise<DocInput> {
  const { PrismaClient } = await import('@prisma/client');
  const prisma = new PrismaClient();
  try {
    const studio = await prisma.studio.findUnique({ where: { slug }, select: { id: true, tradeName: true, paymentTemplate: true, branding: true } });
    if (!studio) throw new Error(`No studio with slug "${slug}".`);
    const q = await prisma.studioQuote.findFirst({ where: { id: quoteId, studioId: studio.id }, include: { lines: { orderBy: { sortOrder: 'asc' } } } });
    if (!q) throw new Error('No such quotation in that studio.');
    const b = studio.branding;
    return {
      studio: { name: b?.legalName ?? studio.tradeName, tradeName: b?.documentName?.trim() || studio.tradeName, addressLine: b?.addressLine ?? null, city: b?.city ?? null, pincode: b?.pincode ?? null, phone: b?.phone ?? null, email: b?.email ?? null, website: b?.website ?? null, gstin: b?.gstin ?? null, logoUrl: null, accentHex: b?.accentHex ?? null },
      head: { clientName: q.clientName, clientPhone: q.clientPhone, flatNo: q.society, config: q.config, number: q.number, date: q.quoteDate ?? q.createdAt, location: q.locality || b?.city || null },
      lines: q.lines.map((l) => ({ room: l.room, product: l.product, code: l.code, unit: l.unit, details: l.details, widthMm: l.widthMm, heightMm: l.heightMm, qtyMilli: l.qtyMilli, amountPaise: Number(l.amountPaise), note: l.note })),
      terms: { feeBps: q.feeBps, discountBps: q.discountBps, onSpotPaise: Number(q.onSpotPaise), onSpotLabel: q.onSpotLabel, gstBps: q.gstBps, bookingAdvancePaise: Number(q.bookingAdvancePaise) },
      schedule: readStages(q.salesFinalSchedule) ?? templateOrDefault(studio.paymentTemplate),
      spec: (b?.materialSpec as unknown as DocSpecRow[] | null) ?? [],
      termsText: q.terms?.trim() ? q.terms : (b?.terms ?? null),
    };
  } finally {
    await prisma.$disconnect();
  }
}

async function main() {
  const out = resolve(arg('out') ?? 'quotation.pdf');
  const termsFile = arg('terms');
  const termsText = termsFile ? readFileSync(termsFile, 'utf8') : null;
  let input: DocInput;
  if (process.argv.includes('--sample')) input = fromRow(SAMPLE_ROW, termsText);
  else if (arg('from-row')) input = fromRow(JSON.parse(readFileSync(arg('from-row')!, 'utf8').replace(/^﻿/, '')) as SourceQuote, termsText);
  else if (arg('quote') && arg('studio')) input = await fromDb(arg('quote')!, arg('studio')!);
  else {
    console.error('Usage: npx tsx scripts/render-quote-pdf.ts (--sample | --from-row row.json | --quote <id> --studio <slug>) [--brand a.png,b.png] [--terms terms.txt] [--out file.pdf] [--html]');
    process.exit(1);
  }
  if (!input.termsText) input.termsText = readFileSync(resolve('scripts/fixtures/hauspire-terms.txt'), 'utf8');

  const lineInputs: QuoteLineInput[] = input.lines.map((l) => ({ ...l, ratePaise: 0, amountPaise: l.amountPaise }));
  const totals = computeTotals(lineInputs, input.terms);
  const brandPages = (arg('brand') ?? '').split(',').map((s) => s.trim()).filter(Boolean).map((p) => dataUri(resolve(p)));
  /* The component is compiled by tsx with the classic JSX runtime (the
     project's tsconfig says "preserve", for Next), which needs React in scope. */
  (globalThis as { React?: typeof React }).React = React;
  const { QuotationDocument } = await import('../src/app/studio/quotations/doc/QuotationDocument');
  const body = renderToStaticMarkup(
    React.createElement(QuotationDocument, {
      studio: input.studio,
      brandPages,
      head: input.head,
      lines: input.lines,
      roomOrder: roomsOfLines(input.lines),
      totals,
      feeBps: input.terms.feeBps,
      discountBps: input.terms.discountBps,
      gstBps: input.terms.gstBps,
      onSpotLabel: input.terms.onSpotLabel,
      schedule: input.schedule,
      spec: input.spec,
      terms: input.termsText,
      showMark: false,
      markText: '',
    }),
  );
  const css = readFileSync(resolve('src/app/studio/quotations/doc/quote-doc.css'), 'utf8');
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${input.head.clientName} Quotation ${input.head.number}</title><style>html,body{margin:0;background:#fff}${css}</style></head><body>${body}</body></html>`;
  if (process.argv.includes('--html')) writeFileSync(out.replace(/\.pdf$/i, '') + '.html', html);

  const { chromium } = await import('playwright');
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'load' });
    await page.emulateMedia({ media: 'print' });
    await page.pdf({ path: out, format: 'A4', printBackground: true, preferCSSPageSize: true });
  } finally {
    await browser.close();
  }
  console.log(`Wrote ${out} (${input.head.clientName}, ${input.head.number}, total ₹${Math.round(totals.totalPaise / 100).toLocaleString('en-IN')}).`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
