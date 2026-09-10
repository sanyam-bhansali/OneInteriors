import { describe, it, expect, afterEach } from 'vitest';
import { showUnverifiedStudios, rosterIsReal } from '@/lib/env';

/**
 * The verification gate's development bypass.
 *
 * These tests exist for one assertion — that a real roster cannot be shown
 * unverified — and that assertion is worth a test file of its own because it is
 * the only thing standing between "development convenience" and "we presented
 * businesses we had not checked as though we had".
 *
 * Everything else here is documentation of the switch's behaviour.
 */

const ORIGINAL = {
  dev: process.env.DEV_SHOW_UNVERIFIED_STUDIOS,
  real: process.env.NEXT_PUBLIC_ROSTER_IS_REAL,
};

function setEnv(dev: string | undefined, real: string | undefined): void {
  if (dev === undefined) delete process.env.DEV_SHOW_UNVERIFIED_STUDIOS;
  else process.env.DEV_SHOW_UNVERIFIED_STUDIOS = dev;

  if (real === undefined) delete process.env.NEXT_PUBLIC_ROSTER_IS_REAL;
  else process.env.NEXT_PUBLIC_ROSTER_IS_REAL = real;
}

afterEach(() => {
  setEnv(ORIGINAL.dev, ORIGINAL.real);
});

describe('showUnverifiedStudios', () => {
  /**
   * THE test. A real roster disables the bypass unconditionally, so the
   * dangerous state is not reachable by forgetting to unset a variable — only
   * by declaring the roster real and fake at the same time.
   */
  it('is off whenever the roster is real, however loudly the flag is set', () => {
    setEnv('1', '1');
    expect(rosterIsReal()).toBe(true);
    expect(showUnverifiedStudios()).toBe(false);
  });

  it('is on for a placeholder roster when explicitly asked', () => {
    setEnv('1', undefined);
    expect(showUnverifiedStudios()).toBe(true);
  });

  it('is off by default — the safe direction', () => {
    setEnv(undefined, undefined);
    expect(showUnverifiedStudios()).toBe(false);
  });

  // The empty string is what an unset variable arrives as on Vercel, and
  // treating it as truthy has broken a deploy here before. See CONTRIBUTING §8.
  it('treats an empty value as off, not as set', () => {
    setEnv('', undefined);
    expect(showUnverifiedStudios()).toBe(false);
  });

  it('accepts only "1", not "true" or "yes"', () => {
    for (const value of ['true', 'yes', 'on', '0', 'TRUE']) {
      setEnv(value, undefined);
      expect(showUnverifiedStudios()).toBe(false);
    }
  });

  it('tolerates surrounding whitespace, which pasted env values often carry', () => {
    setEnv(' 1 ', undefined);
    expect(showUnverifiedStudios()).toBe(true);
  });
});
