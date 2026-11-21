import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

/* Owner, 21 Nov 2026: "add autosave option in quotation". */
const builder = readFileSync('src/app/studio/quotations/[id]/QuoteBuilder.tsx', 'utf8');
const quotes = readFileSync('src/modules/studio-quote/quotes.ts', 'utf8');

describe('quotation autosave', () => {
  it('has an Autosave switch, on unless turned off, remembered in the browser', () => {
    expect(builder).toMatch(/useState\(true\)/);
    expect(builder).toMatch(/AUTOSAVE_KEY = 'oi\.quote\.autosave'/);
    expect(builder).toMatch(/onChange=\{\(e\) => chooseAutosave\(e\.target\.checked\)\}/);
    expect(builder).toMatch(/\n\s*Autosave\n/);
  });

  it('saves a few seconds after the last change, one save at a time, never on a locked quotation, and does not retry a failed save until something changes', () => {
    expect(builder).toMatch(/if \(!autosave \|\| !dirty \|\| locked \|\| saving \|\| !termsIn\) return;/);
    expect(builder).toMatch(/if \(inFlight\.current\) return;/);
    expect(builder).toMatch(/autoFailed\.current = onScreenNow/);
    expect(builder).toMatch(/window\.clearTimeout\(timer\)/);
  });

  it('only saves; making the Design Final stays on its own button', () => {
    const effect = builder.slice(builder.indexOf('const autoFailed'), builder.indexOf('function saveAs('));
    expect(effect).not.toMatch(/copyQuoteAction/);
    expect(effect).toMatch(/persist\(\)/);
  });

  it('a new line gets its id back, so a later save updates it instead of adding it again', () => {
    expect(quotes).toMatch(/return \{ ok: true, ids: cleaned\.map/);
    expect(builder).toMatch(/idOf\.set\(l\.key, id\)/);
    expect(builder).toMatch(/sameButKeys\(/);
  });
});
