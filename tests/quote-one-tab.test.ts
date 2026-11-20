import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { PLAN_NOTE_GUARD, clipLine, planNote } from '@/modules/studio-sales/lead-rules';
import { computeTotals } from '@/modules/studio-quote/pricing';

/**
 * Owner, 19 Nov 2026: one builder tab (Build opens the full builder), the
 * floor plan in view while quoting, "No discount on modular", and a note
 * with a floor plan.
 */

const read = (p: string) => readFileSync(p, 'utf8');

describe('the note with a floor plan', () => {
  it('has no word limit (owner, 20 Nov 2026), keeps its lines, and is tidied', () => {
    expect(planNote('  no loft in   kids room  ')).toBe('no loft in kids room');
    expect(planNote('No loft in kids room\r\n\r\n\r\n  Bar unit   in living  \nBudget near 8 lakh')).toBe('No loft in kids room\n\nBar unit in living\nBudget near 8 lakh');
    expect(planNote('   ')).toBeNull();
    expect(planNote(undefined)).toBeNull();
    expect(planNote(42)).toBeNull();
    // Well past the old 300 characters, kept whole.
    expect(planNote('word '.repeat(600).trim())).toHaveLength(2999);
    // Only a pasted document is stopped.
    expect(planNote('x'.repeat(PLAN_NOTE_GUARD + 50))).toHaveLength(PLAN_NOTE_GUARD);
  });
  it('the boxes have no character limit, and a long note shows with its lines', () => {
    for (const f of ['src/app/studio/clients/[id]/SalesPanels.tsx', 'src/app/studio/quotations/first/FirstQuote.tsx', 'src/app/studio/quotations/[id]/QuotePlanUpload.tsx']) {
      expect(read(f), f).not.toMatch(/maxLength=\{300\}/);
    }
    expect(read('src/modules/studio-quote/quote-request-store.ts')).toMatch(/const note = planNote\(input\.note\);/);
    expect(clipLine('a '.repeat(300))).toHaveLength(200);
  });
  it('is kept on the file and handed to the quotation request', () => {
    const src = read('src/modules/studio-sales/leads.ts');
    expect(src).toMatch(/const note = kind === 'FLOOR_PLAN' \? planNote\(input\.note\) : null;/);
    expect(src).toMatch(/openQuoteRequest\(\{ studioId, clientId, reason: 'FLOOR_PLAN', by, fileId, note \}\)/);
    expect(read('prisma/migrations/20261119120000_lead_file_note/migration.sql')).toMatch(/ADD COLUMN "note" TEXT/);
  });
  it('can be typed on the lead page, the quotation builder and the builder’s Floor plan tab', () => {
    expect(read('src/app/studio/clients/[id]/SalesPanels.tsx')).toMatch(/attachFileAction\(\{ clientId, path, name: file\.name, contentType: type, bytes: file\.size, kind: asKind, note \}\)/);
    expect(read('src/app/studio/quotations/first/FirstQuote.tsx')).toMatch(/kind: 'FLOOR_PLAN', quoteRequest: false, note: planNote/);
    expect(read('src/app/studio/quotations/[id]/QuotePlanUpload.tsx')).toMatch(/kind: 'FLOOR_PLAN', quoteRequest: false, note \}/);
  });
});

describe('one builder tab', () => {
  it('Build saves the draft and opens the builder; there is no separate Revise step', () => {
    const src = read('src/app/studio/quotations/first/FirstQuote.tsx');
    expect(src).not.toMatch(/Revise in Full Builder/);
    expect(src).toMatch(/<form action=\{save\}>/);
    expect(read('src/app/studio/quotations/actions.ts')).toMatch(/redirect\(`\/studio\/quotations\/\$\{r\.id\}`\)/);
  });
  it('the old Full builder link lands on the quotation builder', () => {
    expect(read('src/app/studio/quotations/builder/page.tsx')).toMatch(/redirect\('\/studio\/quotations\/first'\)/);
  });
  it('the floor plan is in view on both screens', () => {
    expect(read('src/app/studio/quotations/first/FirstQuote.tsx')).toMatch(/<PlanViewer/);
    expect(read('src/app/studio/quotations/[id]/QuoteBuilder.tsx')).toMatch(/tab === 'plan' \?/);
    expect(read('src/app/studio/quotations/[id]/QuotePlanUpload.tsx')).toMatch(/<PlanViewer/);
    expect(read('src/modules/studio-quote/from-plan.ts')).toMatch(/const links = await signedLeadFileLinks\(rows\.map\(\(r\) => r\.storagePath\)\);/);
  });
});

describe('No discount on modular', () => {
  it('0% leaves modular at full price', () => {
    const lines = [{ code: 'MODULAR' as const, amountPaise: 100_000_00 }, { code: 'ONSITE' as const, amountPaise: 50_000_00 }];
    const terms = { feeBps: 0, onSpotPaise: 0, bookingAdvancePaise: 0, gstBps: 0, phases: null };
    expect(computeTotals(lines as never, { ...terms, discountBps: 1000 }).discountPaise).toBe(10_000_00);
    expect(computeTotals(lines as never, { ...terms, discountBps: 0 }).discountPaise).toBe(0);
  });
  it('is a tick in the builder and on the quotation builder, and the PDF leaves the 0% row out', () => {
    expect(read('src/app/studio/quotations/[id]/QuoteBuilder.tsx')).toMatch(/No discount on modular/);
    expect(read('src/app/studio/quotations/first/FirstQuote.tsx')).toMatch(/noModularDiscount: noModular/);
    expect(read('src/modules/studio-quote/from-plan.ts')).toMatch(/discountBps: input\.noModularDiscount === true \? 0 : row\.discountBps/);
    expect(read('src/app/studio/quotations/doc/QuotationDocument.tsx')).toMatch(/\{discountBps > 0 \? <Row k=\{`Discount on Modular/);
  });
});
