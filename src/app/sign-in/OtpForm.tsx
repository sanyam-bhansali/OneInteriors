'use client';

/**
 * Name, number, code. One screen, no inbox.
 *
 * ## Why it is two steps and not two pages
 *
 * The whole point of replacing the emailed link was to stop making someone
 * leave the page they were on. Routing to a second URL to type the code would
 * reintroduce a smaller version of the same problem: a back button that loses
 * the number, a refresh that starts over. Both steps live in this component, so
 * the phone and the name stay in memory and "wrong number, go back" costs
 * nothing.
 *
 * ## The details that decide whether people get through
 *
 *  - `inputMode="numeric"` and `autoComplete="one-time-code"` — on Android the
 *    code can be filled from the notification without leaving the page at all.
 *  - The code field accepts a pasted whole message; `cleanCode` on the server
 *    pulls the digits out. Someone who long-presses the WhatsApp message and
 *    hits paste should not be told they are wrong.
 *  - Submits on the sixth digit. Making someone type six digits and then find
 *    a button is a step that exists only because forms usually have one.
 *  - Resend is disabled for thirty seconds, and the counter is visible. A dead
 *    button with no explanation reads as broken.
 */

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui';
import { cleanCode, isOtpShape, isValidName } from '@/modules/auth/otp-code';
import { normalisePhone } from '@/modules/studio/phone';
import { requestOtpAction, verifyOtpAction } from './actions';

const RESEND_SECONDS = 30;

export function OtpForm({ next }: { next: string | null }) {
  const router = useRouter();

  const [stage, setStage] = useState<'details' | 'code'>('details');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [devCode, setDevCode] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);

  const codeRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  // Focus the code field the moment it appears. Without this the customer has
  // to tap it, which on a phone means the keyboard appears a beat late and the
  // notification they are copying from has already been dismissed.
  useEffect(() => {
    if (stage === 'code') codeRef.current?.focus();
  }, [stage]);

  const phoneOk = normalisePhone(phone) !== null;
  const nameOk = isValidName(name);

  async function send() {
    setError(null);
    setBusy(true);
    const result = await requestOtpAction(phone, name);
    setBusy(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }
    setDevCode(result.devCode ?? null);
    setCooldown(RESEND_SECONDS);
    setStage('code');
  }

  async function verify(value: string) {
    setError(null);
    setBusy(true);
    const result = await verifyOtpAction(phone, value, name || null);
    setBusy(false);

    if (!result.ok) {
      setError(result.error);
      setCode('');
      codeRef.current?.focus();
      return;
    }

    // `next` was validated server-side when the page rendered it.
    router.push(next ?? '/quotes');
    router.refresh();
  }

  function onCodeChange(raw: string) {
    const digits = cleanCode(raw);
    setCode(digits);
    // Submit as soon as it is complete. Not on every keystroke — only when the
    // shape is right — so a wrong-length paste does not burn an attempt.
    if (isOtpShape(digits) && !busy) void verify(digits);
  }

  if (stage === 'details') {
    return (
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (phoneOk && nameOk && !busy) void send();
        }}
        className="flex flex-col gap-5"
      >
        <div>
          <label htmlFor="oi-name" className="label m-0 mb-2 block">
            Your name
          </label>
          <input
            id="oi-name"
            name="name"
            autoComplete="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Sanyam Bhansali"
            className="w-full rounded-full border border-[var(--color-rule)] bg-[var(--color-paper-2)] px-5 py-3.5 text-[16px] text-[var(--color-ink)] placeholder:text-[var(--color-ink-3)]"
          />
        </div>

        <div>
          <label htmlFor="oi-phone" className="label m-0 mb-2 block">
            Mobile number
          </label>
          <div className="flex items-center gap-2">
            <span className="rounded-full border border-[var(--color-rule)] bg-[var(--color-paper-3)] px-4 py-3.5 font-[family-name:var(--font-mono)] text-[15px] text-[var(--color-ink-2)]">
              +91
            </span>
            <input
              id="oi-phone"
              name="phone"
              type="tel"
              inputMode="numeric"
              autoComplete="tel-national"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="98765 43210"
              className="tabular w-full rounded-full border border-[var(--color-rule)] bg-[var(--color-paper-2)] px-5 py-3.5 text-[16px] text-[var(--color-ink)] placeholder:text-[var(--color-ink-3)]"
            />
          </div>
          <p className="m-0 mt-2 text-[13.5px] leading-relaxed text-[var(--color-ink-3)]">
            We send a code on WhatsApp. No password, and no one calls this number — your quotes
            live on this site, not in your messages.
          </p>
        </div>

        {error ? (
          <p className="m-0 text-[14px] text-[var(--color-terracotta)]" role="alert">
            {error}
          </p>
        ) : null}

        <Button type="submit" size="lg" disabled={!phoneOk || !nameOk || busy}>
          {busy ? 'Sending…' : 'Send me a code'}
        </Button>
      </form>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <label htmlFor="oi-code" className="label m-0 mb-2 block">
          The six-digit code
        </label>
        <input
          id="oi-code"
          ref={codeRef}
          inputMode="numeric"
          autoComplete="one-time-code"
          value={code}
          onChange={(e) => onCodeChange(e.target.value)}
          placeholder="——————"
          aria-label="Six-digit sign-in code"
          className="tabular w-full rounded-[14px] border border-[var(--color-rule)] bg-[var(--color-paper-2)] px-5 py-4 text-center font-[family-name:var(--font-mono)] text-[28px] tracking-[0.3em] text-[var(--color-ink)] placeholder:tracking-[0.2em] placeholder:text-[var(--color-ink-3)]"
        />
        <p className="m-0 mt-3 text-[14px] leading-relaxed text-[var(--color-ink-2)]">
          Sent on WhatsApp to +91 {phone.replace(/\D/g, '').slice(-10)}.{' '}
          <button
            type="button"
            onClick={() => {
              setStage('details');
              setCode('');
              setError(null);
            }}
            className="text-[var(--color-petrol)] underline underline-offset-4"
          >
            Wrong number?
          </button>
        </p>
      </div>

      {devCode ? (
        <p className="m-0 rounded-[10px] border border-dashed border-[var(--color-rule)] px-4 py-3 font-[family-name:var(--font-mono)] text-[13px] text-[var(--color-ink-2)]">
          Dev — no WhatsApp provider configured. Your code is {devCode}.
        </p>
      ) : null}

      {error ? (
        <p className="m-0 text-[14px] text-[var(--color-terracotta)]" role="alert">
          {error}
        </p>
      ) : null}

      {busy ? (
        <p className="m-0 text-[14px] text-[var(--color-ink-3)]">Checking…</p>
      ) : (
        <button
          type="button"
          disabled={cooldown > 0}
          onClick={() => void send()}
          className="self-start text-[14px] text-[var(--color-petrol)] underline underline-offset-4 disabled:no-underline disabled:opacity-50"
        >
          {cooldown > 0 ? `Resend in ${cooldown}s` : 'Send it again'}
        </button>
      )}
    </div>
  );
}
