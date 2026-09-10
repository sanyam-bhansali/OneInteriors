import { describe, it, expect, afterEach } from 'vitest';
import { showUnverifiedStudios, showOtpOnScreen, rosterIsReal } from '@/lib/env';

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
  otp: process.env.DEV_SHOW_OTP_ON_SCREEN,
  real: process.env.NEXT_PUBLIC_ROSTER_IS_REAL,
};

function setEnv(dev: string | undefined, real: string | undefined): void {
  if (dev === undefined) delete process.env.DEV_SHOW_UNVERIFIED_STUDIOS;
  else process.env.DEV_SHOW_UNVERIFIED_STUDIOS = dev;

  if (real === undefined) delete process.env.NEXT_PUBLIC_ROSTER_IS_REAL;
  else process.env.NEXT_PUBLIC_ROSTER_IS_REAL = real;
}

function setOtpEnv(otp: string | undefined, real: string | undefined): void {
  if (otp === undefined) delete process.env.DEV_SHOW_OTP_ON_SCREEN;
  else process.env.DEV_SHOW_OTP_ON_SCREEN = otp;

  if (real === undefined) delete process.env.NEXT_PUBLIC_ROSTER_IS_REAL;
  else process.env.NEXT_PUBLIC_ROSTER_IS_REAL = real;
}

afterEach(() => {
  setEnv(ORIGINAL.dev, ORIGINAL.real);
  if (ORIGINAL.otp === undefined) delete process.env.DEV_SHOW_OTP_ON_SCREEN;
  else process.env.DEV_SHOW_OTP_ON_SCREEN = ORIGINAL.otp;
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

/**
 * The OTP bypass, which is the more dangerous of the two flags.
 *
 * With it on, a sign-in code is printed on the page and the OTP verifies
 * nothing at all — anyone can claim any phone number. It exists only so the
 * funnel behind the sign-in gate can be tested while a WhatsApp template waits
 * on Meta approval, and it must be impossible for it to survive contact with a
 * real roster.
 */
describe('showOtpOnScreen', () => {
  it('is off whenever the roster is real, however loudly the flag is set', () => {
    setOtpEnv('1', '1');
    expect(rosterIsReal()).toBe(true);
    expect(showOtpOnScreen()).toBe(false);
  });

  it('is on for a placeholder roster when explicitly asked', () => {
    setOtpEnv('1', undefined);
    expect(showOtpOnScreen()).toBe(true);
  });

  it('is off by default — the safe direction', () => {
    setOtpEnv(undefined, undefined);
    expect(showOtpOnScreen()).toBe(false);
  });

  it('treats an empty value as off, not as set', () => {
    setOtpEnv('', undefined);
    expect(showOtpOnScreen()).toBe(false);
  });

  it('accepts only "1"', () => {
    for (const value of ['true', 'yes', 'on', '0', 'TRUE']) {
      setOtpEnv(value, undefined);
      expect(showOtpOnScreen()).toBe(false);
    }
  });

  /**
   * The two flags are independent. Turning the studio gate off must not
   * quietly turn the auth bypass on — they are different amounts of danger and
   * should be decided separately.
   */
  it('is not switched on by the studio gate', () => {
    delete process.env.DEV_SHOW_OTP_ON_SCREEN;
    setEnv('1', undefined);
    expect(showUnverifiedStudios()).toBe(true);
    expect(showOtpOnScreen()).toBe(false);
  });
});
