import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { designFinalAmounts, docStages } from '@/modules/studio-quote/document';
import { templateOrDefault } from '@/modules/studio-sales/payment-template';

/* Owner, 21 Nov 2026: the Design Final quotation's payment stages follow the same rule as the project's after the Design Final. */
describe("a design quotation's payment stages", () => {
  const schedule = templateOrDefault(null);
  const sales = 87_866_060;
  const df = 114_496_185;

  it("match Hauspire's quotation sheet: booking and design advance as on the sales final, closure takes the catch-up", () => {
    const amounts = designFinalAmounts(schedule, df, sales);
    if (!amounts) throw new Error('no split');
    const sheet = [2_500_000, 4_268_303, 12_531_125, 44_798_474, 44_798_474, 5_599_809];
    amounts.forEach((a, i) => expect(Math.abs(a - sheet[i]!)).toBeLessThanOrEqual(1));
    expect(amounts.reduce((a, b) => a + b, 0)).toBe(df);
  });

  it('the printed stages carry those amounts and add up to the total', () => {
    const printed = docStages(schedule, { totalPaise: df, stages: [] }, sales);
    expect(printed.map((s) => s.amountPaise)).toEqual(designFinalAmounts(schedule, df, sales));
    expect(printed[2]!.label).toMatch(/\(10%\)/);
  });

  it('a sales quotation (no sales total) still splits plainly by percent', () => {
    const plain = docStages(schedule, { totalPaise: df, stages: [] });
    expect(plain[1]!.amountPaise).not.toBe(designFinalAmounts(schedule, df, sales)![1]);
    expect(designFinalAmounts(schedule, df, null)).toBeNull();
  });

  it('the PDF, the builder and the Design Final sign-off all pass the sales total', () => {
    expect(readFileSync('src/modules/studio-quote/document-data.ts', 'utf8')).toMatch(/salesFinalTotalInStudio\(design/);
    expect(readFileSync('src/modules/project/signoffs.ts', 'utf8')).toMatch(/salesFinalTotalInStudio\(salesFinalId/);
    expect(readFileSync('src/app/studio/quotations/[id]/QuoteBuilder.tsx', 'utf8')).toMatch(/stages=\{designStages\}/);
  });
});
