import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/** The phone app keeps an identical copy of the Realtime listener (1 Nov 2026), as it does the words. */
describe('the Realtime listener', () => {
  it('is the same on the website and the phone', () => {
    const strip = (s: string) => s.replace(/^\/\*\*[\s\S]*?\*\/\n/, '');
    const web = readFileSync('src/components/chat/live-socket.ts', 'utf8');
    const phone = readFileSync('mobile/src/lib/live-socket.ts', 'utf8');
    expect(strip(phone)).toBe(strip(web));
  });
});
