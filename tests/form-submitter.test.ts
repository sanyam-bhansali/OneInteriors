import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

/**
 * A disabled control is excluded from FormData. So a submit button that
 * carries the form's intent in its own `name`/`value` AND disables itself
 * while pending can lose that value in the race between the pending re-render
 * and the submit event.
 *
 * That is not theoretical. On /ops/applications every decision — approve,
 * reject, mark as reviewing — answered **"Unknown action."** in production,
 * because `intent` arrived empty. The markup read perfectly: the button had
 * `name="intent" value="approve"` right there. Nothing about it looks wrong,
 * which is why this is asserted rather than remembered.
 *
 * The fix is a hidden field written through a ref in onClick — synchronous, so
 * it is in the DOM before the submit event is dispatched. React state is not a
 * fix: the update is batched and can miss the same window.
 */

const ROOT = join(__dirname, '..');

function tsx(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = join(dir, e.name);
    if (e.isDirectory()) return tsx(p);
    return e.name.endsWith('.tsx') ? [p] : [];
  });
}

describe('no submit button carries its value and disables itself', () => {
  it('across every client component', () => {
    const offenders: string[] = [];

    for (const file of tsx(join(ROOT, 'src'))) {
      const src = readFileSync(file, 'utf8');
      if (!src.includes("'use client'")) continue;

      /* Each <button ...> opening tag, looked at whole — the attributes can be
         in any order and are usually across several lines. */
      for (const m of src.matchAll(/<button\b[^>]*>/gs)) {
        const tag = m[0];
        if (!/type\s*=\s*["{]?\s*['"]?submit/.test(tag)) continue;
        if (!/\bname\s*=/.test(tag)) continue;
        if (!/disabled\s*=\s*\{[^}]*pending/.test(tag)) continue;

        const line = src.slice(0, m.index).split('\n').length;
        offenders.push(`${file.replace(ROOT, '')}:${line}`);
      }
    }

    expect(
      offenders,
      'these submit buttons disable themselves while carrying the form value, ' +
        'so FormData can lose it; move the value to a hidden input set via a ref in onClick',
    ).toEqual([]);
  });
});

describe('the decision form sends an intent that survives the pending render', () => {
  const src = readFileSync(
    join(ROOT, 'src/app/ops/applications/DecisionForm.tsx'),
    'utf8',
  );

  it('carries the intent in a hidden field, not on the buttons', () => {
    expect(src).toMatch(/<input[^>]*type="hidden"[^>]*name="intent"/s);
  });

  it('writes it through a ref, not through state', () => {
    // State is batched. The ref write is synchronous and lands before submit.
    expect(src).toMatch(/intentRef\.current\.value\s*=/);
  });

  it('still offers all three decisions', () => {
    for (const intent of ['approve', 'reject', 'reviewing']) {
      expect(src, intent).toContain(`send('${intent}')`);
    }
  });
});
