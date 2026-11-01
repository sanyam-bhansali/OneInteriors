import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { PHONE_PAGE, isPhone, phoneMayOpen } from '@/modules/studio/phone-rules';
import { mayOpen } from '@/modules/studio/surfaces';
import type { MemberRole } from '@/modules/studio/roles';

/** The studio on a phone is site mode only (owner, 1 Nov 2026). */

const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';
const ANDROID = 'Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36';
const ANDROID_TAB = 'Mozilla/5.0 (Linux; Android 14; SM-X710) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36';
const IPAD = 'Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';
const LAPTOP = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36';

describe('a phone', () => {
  it('is told apart from a laptop and a tablet', () => {
    expect(isPhone(IPHONE, null)).toBe(true);
    expect(isPhone(ANDROID, null)).toBe(true);
    expect(isPhone(ANDROID_TAB, null)).toBe(false);
    expect(isPhone(IPAD, null)).toBe(false);
    expect(isPhone(LAPTOP, null)).toBe(false);
    expect(isPhone(null, null)).toBe(false);
  });

  it('believes the browser when it says', () => {
    expect(isPhone(LAPTOP, '?1')).toBe(true);
    expect(isPhone(ANDROID, '?0')).toBe(false);
  });
});

describe('what a phone may open', () => {
  it('site mode, its meetings, choosing a password and the phone page', () => {
    for (const p of ['/studio/site', '/studio/site/post/p1', '/studio/site/snag', '/studio/site/me', '/studio/calendar/meetings', '/studio/password', PHONE_PAGE]) expect(phoneMayOpen(p)).toBe(true);
  });

  it('nothing of the office', () => {
    for (const p of ['/studio', '/studio/home', '/studio/projects/p1', '/studio/design', '/studio/chats', '/studio/quotations/q1', '/studio/calendar', '/studio/siteX']) expect(phoneMayOpen(p)).toBe(false);
  });

  it('leaves the rest of the site alone: the sign-in, the client app, the API', () => {
    for (const p of ['/studio-sign-in', '/app/home', '/api/app/v1/chats', '/']) expect(phoneMayOpen(p)).toBe(true);
  });

  it('the phone page opens for every role, and the middleware sends phones to it', () => {
    const m = (role: MemberRole['role']): MemberRole => ({ role, status: 'ACTIVE' }) as MemberRole;
    for (const role of ['OWNER', 'PM', 'DESIGNER', 'SALES', 'ACCOUNTS', 'SUPERVISOR'] as const) expect(mayOpen(m(role), PHONE_PAGE)).toBe(true);
    const mw = readFileSync('src/middleware.ts', 'utf8');
    expect(mw).toMatch(/!phoneMayOpen\(served\) && isPhone\(request\.headers\.get\('user-agent'\), request\.headers\.get\('sec-ch-ua-mobile'\)\)/);
  });
});
