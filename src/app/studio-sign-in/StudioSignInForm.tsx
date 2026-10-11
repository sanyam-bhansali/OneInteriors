'use client';

/**
 * Number, then six code boxes, on one screen (design: StudioSignIn). A site
 * supervisor uses this on a phone, often outdoors, so: big targets, the
 * numeric keypad, the code accepted pasted whole or filled from the
 * notification, and it submits on the sixth digit.
 *
 * After sign-in it navigates with a full page load, not the router: the
 * studio layout decides who sees which screen, and a client-side navigation
 * would keep the signed-out frame around it.
 */

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { cleanCode } from '@/modules/auth/otp-code';
import { normalisePhone } from '@/modules/studio/phone';
import { tx, type Lang } from '@/modules/i18n/site';
import { STUDIO_WORDS, type StudioWord } from '@/modules/i18n/studio';
import { LangSwitch } from '../studio/LangSwitch';
import { requestStudioCodeAction, verifyStudioCodeAction } from './actions';

const RESEND_SECONDS = 30;
const DIGITS = 6;

const field = 'rounded-[12px] bg-[var(--s-surface-2)] text-[var(--s-ink)] font-[family-name:var(--font-mono)]';

export function StudioSignInForm({ initialLang }: { initialLang: Lang }) {
  const [lang, setLang] = useState<Lang>(initialLang);
  const t = (key: StudioWord, vars?: Record<string, string | number>) => tx(lang, STUDIO_WORDS[key], vars);

  const [stage, setStage] = useState<'phone' | 'code'>('phone');
  const [phone, setPhone] = useState('');
  const [digits, setDigits] = useState<string[]>(Array(DIGITS).fill(''));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<StudioWord | null>(null);
  const [devCode, setDevCode] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);
  const boxes = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(id);
  }, [cooldown]);

  useEffect(() => {
    if (stage === 'code') boxes.current[0]?.focus();
  }, [stage]);

  async function askForCode() {
    setError(null);
    if (!normalisePhone(phone)) {
      setError('err.invalid_phone');
      return;
    }
    setBusy(true);
    const r = await requestStudioCodeAction(phone);
    setBusy(false);
    if (!r.ok) {
      setError(r.error);
      return;
    }
    setDevCode(r.devCode ?? null);
    setDigits(Array(DIGITS).fill(''));
    setCooldown(RESEND_SECONDS);
    setStage('code');
  }

  async function submit(code: string) {
    setBusy(true);
    setError(null);
    const r = await verifyStudioCodeAction(phone, code, lang);
    if (!r.ok) {
      setBusy(false);
      setError(r.error);
      setDigits(Array(DIGITS).fill(''));
      boxes.current[0]?.focus();
      return;
    }
    window.location.assign(r.to);
  }

  function fill(from: number, raw: string) {
    const incoming = cleanCode(raw).slice(0, DIGITS - from).split('');
    if (incoming.length === 0) {
      setDigits((d) => d.map((x, i) => (i === from ? '' : x)));
      return;
    }
    const next = [...digits];
    incoming.forEach((ch, k) => (next[from + k] = ch));
    setDigits(next);
    const focusAt = Math.min(from + incoming.length, DIGITS - 1);
    boxes.current[focusAt]?.focus();
    const code = next.join('');
    if (code.length === DIGITS && !busy) void submit(code);
  }

  const shownPhone = normalisePhone(phone)?.replace(/^\+91(\d{5})(\d{5})$/, '$1 $2') ?? phone;

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[460px] flex-col px-5">
      <header className="flex items-center justify-between gap-3 pt-6">
        <div className="flex items-center gap-2">
          <span className="text-[17px] font-semibold tracking-tight">One Interiors</span>
          <span className="rounded-full bg-[var(--s-accent)] px-2.5 py-0.5 text-[13px] font-medium text-white">Studio</span>
        </div>
        <LangSwitch value={lang} onPick={setLang} />
      </header>

      <main className="flex flex-1 flex-col gap-7 pb-5 pt-12">
        <div className="flex flex-col gap-2.5">
          <h1 className="m-0 text-[34px] font-medium leading-[1.05] tracking-[-0.03em]">{t('signin.h1')}</h1>
          <p className="m-0 text-[16px] leading-relaxed text-[var(--s-ink-2)]">{t('signin.sub')}</p>
        </div>

        <form
          className="flex flex-col gap-5 rounded-[20px] bg-[var(--s-surface)] p-5 shadow-[var(--s-lift)]"
          onSubmit={(e) => {
            e.preventDefault();
            if (stage === 'phone') void askForCode();
            else if (digits.join('').length === DIGITS) void submit(digits.join(''));
          }}
        >
          <div className="flex flex-col gap-2">
            <label htmlFor="studio-phone" className="text-[14px] font-medium text-[var(--s-ink-2)]">
              {t('signin.phone')}
            </label>
            <div className={`flex min-h-14 items-center gap-2.5 px-4 ${field}`}>
              <span className="text-[17px] text-[var(--s-ink-2)]">+91</span>
              <input
                id="studio-phone"
                type="tel"
                inputMode="numeric"
                autoComplete="tel-national"
                value={phone}
                disabled={stage === 'code'}
                onChange={(e) => setPhone(e.target.value)}
                className="min-w-0 flex-1 border-0 bg-transparent text-[19px] outline-none disabled:opacity-70"
              />
            </div>
          </div>

          {stage === 'code' ? (
            <div className="flex flex-col gap-2">
              <span id="code-label" className="text-[14px] font-medium text-[var(--s-ink-2)]">
                {t('signin.code')}
              </span>
              <div role="group" aria-labelledby="code-label" className="grid grid-cols-6 gap-2">
                {digits.map((d, i) => (
                  <input
                    key={i}
                    ref={(el) => {
                      boxes.current[i] = el;
                    }}
                    aria-label={`Digit ${i + 1}`}
                    value={d}
                    inputMode="numeric"
                    autoComplete={i === 0 ? 'one-time-code' : 'off'}
                    disabled={busy}
                    onChange={(e) => {
                      /* Typing over a filled box: keep the new digit, not both. */
                      const v = e.target.value;
                      fill(i, d && v.length === 2 ? v.replace(d, '') : v);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Backspace' && !digits[i] && i > 0) boxes.current[i - 1]?.focus();
                    }}
                    onPaste={(e) => {
                      e.preventDefault();
                      fill(i, e.clipboardData.getData('text'));
                    }}
                    className={`min-h-[52px] w-full min-w-0 border-0 text-center text-[22px] outline-none focus:shadow-[inset_0_0_0_2px_var(--s-accent)] ${field}`}
                  />
                ))}
              </div>
              <p className="m-0 text-[14px] text-[var(--s-ink-2)]">
                {t('signin.sent', { phone: shownPhone })}{' '}
                {cooldown > 0 ? (
                  t('signin.resendIn', { s: String(cooldown).padStart(2, '0') })
                ) : (
                  <button type="button" onClick={() => void askForCode()} disabled={busy} className="font-medium text-[var(--s-accent)] underline">
                    {t('signin.resend')}
                  </button>
                )}
              </p>
              {devCode ? (
                <p className="m-0 rounded-[10px] bg-[var(--s-warn-wash)] px-3 py-2 text-[13.5px] text-[var(--s-warn)]">
                  {t('signin.devCode', { code: devCode })}
                </p>
              ) : null}
              <button
                type="button"
                onClick={() => {
                  setStage('phone');
                  setError(null);
                  setDevCode(null);
                }}
                className="self-start text-[13.5px] text-[var(--s-ink-2)] underline"
              >
                {t('signin.otherNumber')}
              </button>
            </div>
          ) : null}

          {error ? (
            <p role="alert" className="m-0 rounded-[10px] bg-[var(--s-bad-wash)] px-3 py-2 text-[14px] text-[var(--s-bad)]">
              {t(error)}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={busy || (stage === 'code' && digits.join('').length < DIGITS)}
            className="flex min-h-14 items-center justify-center gap-2.5 rounded-full bg-[var(--s-accent)] text-[16px] font-medium text-white hover:bg-[var(--s-accent-deep)] disabled:opacity-50"
          >
            {stage === 'phone' ? t('signin.getCode') : t('signin.cta')}
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
              <path d="M3.5 9h11M10 4.5 14.5 9 10 13.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </form>

        <p className="m-0 text-[14px] leading-relaxed text-[var(--s-ink-2)]">{t('signin.note')}</p>
      </main>

      <footer className="flex flex-col items-center gap-3 pb-9 pt-3 text-center text-[14px] text-[var(--s-ink-2)]">
        <Link href="/sign-in?next=/studio" className="text-[var(--s-ink-2)] underline-offset-2 hover:underline">
          {t('signin.owner')}
        </Link>
        <Link href="/apply" className="text-[var(--s-ink-2)] underline-offset-2 hover:underline">
          {t('signin.newStudio')}
        </Link>
      </footer>
    </div>
  );
}
