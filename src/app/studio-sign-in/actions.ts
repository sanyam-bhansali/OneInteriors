'use server';

import { headers } from 'next/headers';
import { hasDatabase } from '@/lib/env';
import { requestOtp, verifyOtp } from '@/modules/auth/otp';
import { asLang } from '@/modules/i18n/site';
import { localeFor, type StudioWord } from '@/modules/i18n/studio';
import { homeFor } from '@/modules/studio/surfaces';
import { record } from '@/modules/analytics/record';

/**
 * The studio phone sign-in (/studio/sign-in). Same codes, same challenge
 * table and same sessions as the customer's (`auth/otp.ts`), with the
 * `studio` option: only a number on a studio's team gets a code, and
 * signing in never creates an account.
 *
 * Errors come back as word keys, so the page says them in the language the
 * person picked (modules/i18n/studio.ts).
 */

export type StudioCodeResult = { ok: true; devCode?: string } | { ok: false; error: StudioWord };
export type StudioVerifyResult = { ok: true; to: string } | { ok: false; error: StudioWord };

async function clientIp(): Promise<string | null> {
  const h = await headers();
  return h.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null;
}

export async function requestStudioCodeAction(phone: string): Promise<StudioCodeResult> {
  if (!hasDatabase()) return { ok: false, error: 'err.unavailable' };
  try {
    const r = await requestOtp(String(phone).slice(0, 20), '', { ip: await clientIp(), studio: true });
    if (r.ok) return r.devCode ? { ok: true, devCode: r.devCode } : { ok: true };
    return { ok: false, error: r.reason === 'invalid_name' ? 'err.invalid_phone' : `err.${r.reason}` };
  } catch (error) {
    console.error('[studio-sign-in] requestOtp threw:', error);
    return { ok: false, error: 'err.unavailable' };
  }
}

export async function verifyStudioCodeAction(phone: string, code: string, lang: string): Promise<StudioVerifyResult> {
  if (!hasDatabase()) return { ok: false, error: 'err.unavailable' };
  const h = await headers();
  try {
    const r = await verifyOtp(String(phone).slice(0, 20), String(code).slice(0, 40), null, {
      studio: true,
      locale: localeFor(asLang(lang)),
      userAgent: h.get('user-agent'),
      ip: await clientIp(),
    });
    if (!r.ok) return { ok: false, error: `err.${r.reason}` };
    await record('signin.completed');
    return { ok: true, to: homeFor(r.studioRole ?? 'OWNER') };
  } catch (error) {
    console.error('[studio-sign-in] verifyOtp threw:', error);
    return { ok: false, error: 'err.unavailable' };
  }
}
