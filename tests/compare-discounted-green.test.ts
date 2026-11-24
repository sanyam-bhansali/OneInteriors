import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

/* Owner, 24 Nov 2026: "The discounted price should be in green color" (the Sales Final vs Design Final comparison). */
describe('the comparison PDF', () => {
  it('shows every discounted figure in green, lines and room sub-totals, both sides', () => {
    const page = readFileSync('src/app/studio/quotations/[id]/compare/page.tsx', 'utf8');
    expect(page.match(/<td className="r qd-disc">/g)?.length).toBe(4);
    expect(page).toContain("import '../../doc/quote-doc.css';");
  });

  it('green is the quotation PDF green, and it prints', () => {
    const css = readFileSync('src/app/studio/quotations/doc/quote-doc.css', 'utf8');
    expect(css).toContain('.qd-disc { color: var(--qd-green);');
    expect(css).toContain('print-color-adjust: exact;');
  });
});
