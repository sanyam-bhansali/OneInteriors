import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

/* Owner, 22 Nov 2026: every quotation in My quotations has "Use as template" — a new quotation
   copied from it, then type the name and pick the lead (the New quotation form, already picked). */
const read = (p: string) => readFileSync(p, 'utf8');

describe('Use as template', () => {
  it('every row in the list links to New quotation with the quotation picked', () => {
    const page = read('src/app/studio/quotations/page.tsx');
    expect(page).toContain('href={templateHref(q.id)}');
    expect(page).toContain('/studio/quotations?new=1&from=');
    // Read as the picker reads it: only a quotation this person may copy.
    expect(page).toContain('previousQuoteToCopy(fromId)');
    expect(page).toMatch(/initialFrom=\{/);
  });

  it('the form starts in copy mode with that quotation, and still asks for the name and the lead', () => {
    const form = read('src/app/studio/quotations/NewQuote.tsx');
    expect(form).toContain('useState(!!preset)');
    expect(form).toContain('useState<PickedQuote | null>(preset ?? null)');
    expect(form).toContain('name="clientId"');
    expect(form).toContain('name="fromQuoteId"');
  });

  it('a client shows their newest quotation; the older ones are behind a toggle', () => {
    const page = read('src/app/studio/quotations/page.tsx');
    expect(page).toContain('{rows[0]}');
    expect(page).toContain('<OlderQuotes count={rows.length - 1}');
    expect(read('src/app/studio/quotations/OlderQuotes.tsx')).toContain('{open ? children : null}');
  });

  it('the product dropdown is not cut: fixed to the screen, at least 420px, names wrap', () => {
    const cmb = read('src/app/studio/quotations/[id]/Combobox.tsx');
    expect(cmb).toContain("position: 'fixed'");
    expect(cmb).toContain('const LIST_MIN = 420;');
    expect(cmb).not.toContain("textOverflow: 'ellipsis'");
    expect(read('src/app/studio/quotations/quotes.css')).toContain('.oi-studio .hpage.qpage { max-width: none; width: 100%; }');
  });

  it('the button inside a quotation goes the same way (no name-only copy without a lead)', () => {
    const bar = read('src/app/studio/quotations/[id]/StatusBar.tsx');
    expect(bar).toContain('/studio/quotations?new=1&from=');
    expect(bar).not.toContain("copyQuoteAction(quoteId, 'template'");
  });
});
