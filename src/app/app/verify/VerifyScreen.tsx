'use client';

/**
 * Phone and consent (the owner's v1 screens). The number is asked for here,
 * once, when the quotes are ready — verified by a WhatsApp code, which also
 * signs them in so everything is saved. Contact and consent are written by
 * the same server action the website's brief uses, consent first.
 *
 * A build with no database (local, or SAMPLE_DATA_ONLY) sends no code and
 * saves nothing, and says so.
 */

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Body, Cta, Foot, Frame, Head } from '@/components/app/ui';
import { useJourney } from '@/components/app/useJourney';
import { normalisePhone } from '@/modules/studio/phone';
import { requestOtpAction, verifyOtpAction } from '@/app/sign-in/actions';
import { submitContactAction } from '@/app/quiz/actions';
import type { AppData } from '../data';

const RESEND = 30;

const COUNT = ['No', 'One', 'Two', 'Three'];

export function VerifyScreen({ data }: { data: AppData }) {
  const { sample } = data;
  const router = useRouter();
  const { brief, matches } = useJourney(data);
  const n = matches.length;
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [sent, setSent] = useState(false);
  const [devCode, setDevCode] = useState<string | null>(null);
  const [agreed, setAgreed] = useState(false);
  const [whatsapp, setWhatsapp] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [wait, setWait] = useState(0);

  useEffect(() => {
    if (wait <= 0) return;
    const t = setTimeout(() => setWait((w) => w - 1), 1000);
    return () => clearTimeout(t);
  }, [wait]);

  const valid = normalisePhone(phone) !== null;
  const name = brief?.contactName?.trim() || 'there';

  const sendCode = async () => {
    setError(null);
    setBusy(true);
    const res = await requestOtpAction(phone, name);
    setBusy(false);
    if (!res.ok) return setError(res.error);
    setSent(true);
    setDevCode(res.devCode ?? null);
    setWait(RESEND);
  };

  const verify = async () => {
    if (!brief) return;
    setError(null);
    if (sample) {
      router.push('/app/quote');
      return;
    }
    setBusy(true);
    const contact = await submitContactAction(brief, { name, phone, email: '', agreed, whatsappUpdates: whatsapp });
    if (!contact.ok) {
      setBusy(false);
      return setError(Object.values(contact.errors)[0] ?? 'Check your details and try again.');
    }
    const res = await verifyOtpAction(phone, code, name);
    setBusy(false);
    if (!res.ok) return setError(res.error);
    router.push('/app/quote');
  };

  const ready = valid && agreed && (sample || code.replace(/\D/g, '').length >= 4);

  return (
    <Frame>
      <Head back="/app/matches" meta="Quotes ready" />
      <Body>
        <h1 className="oa-title">{n === 1 ? 'Your quote is' : `Your ${n || ''} quotes are`} ready. Where should we send them?</h1>
        <p className="oa-sub">Your number also saves everything, so you can come back any time.</p>

        <label className="oa-label" htmlFor="oa-phone">
          Mobile number
        </label>
        <div className="flex items-end gap-3">
          <span className="oa-input mono" style={{ width: 'auto', color: 'var(--ink-2)' }} aria-hidden>
            +91
          </span>
          <input
            id="oa-phone"
            className="oa-input mono"
            inputMode="tel"
            autoComplete="tel-national"
            placeholder="98220 41736"
            maxLength={14}
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
        </div>

        {sample ? (
          <p className="oa-sample">Test build · no code is sent and nothing is saved</p>
        ) : sent ? (
          <>
            <label className="oa-label" htmlFor="oa-code">
              Code sent on WhatsApp
            </label>
            <input
              id="oa-code"
              className="oa-input mono"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={8}
              value={code}
              onChange={(e) => setCode(e.target.value)}
              style={{ letterSpacing: '0.4em', fontSize: 28 }}
            />
            {devCode ? <p className="oa-note">Test build: your code is {devCode}.</p> : null}
            <button
              type="button"
              className="oa-link"
              style={{ textAlign: 'left', padding: 0, fontSize: 14, color: 'var(--ink-2)', fontWeight: 400 }}
              disabled={wait > 0 || busy}
              onClick={sendCode}
            >
              {wait > 0 ? `Didn’t get it? Ask for a new code in 0:${String(wait).padStart(2, '0')}` : 'Send a new code'}
            </button>
          </>
        ) : (
          <button type="button" className="oa-cta black" disabled={!valid || busy} onClick={sendCode}>
            Send code on WhatsApp
          </button>
        )}

        <div className="oa-list mt-2">
          <label className="oa-row" style={{ alignItems: 'flex-start', justifyContent: 'flex-start' }}>
            <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} className="mt-1 h-5 w-5 accent-[var(--accent)]" />
            <span className="text-[15px] leading-[1.45]">
              Share my home details and answers with {n === 1 ? 'this studio' : `these ${COUNT[n]?.toLowerCase() ?? n} studios`} so they can quote. I agree to the{' '}
              <a href="/privacy" className="underline" style={{ color: 'var(--accent-ink)' }}>
                privacy policy
              </a>
              .
            </span>
          </label>
          <label className="oa-row" style={{ alignItems: 'flex-start', justifyContent: 'flex-start' }}>
            <input type="checkbox" checked={whatsapp} onChange={(e) => setWhatsapp(e.target.checked)} className="mt-1 h-5 w-5 accent-[var(--accent)]" />
            <span className="text-[15px] leading-[1.45] text-[var(--ink-2)]">Send me tips and offers on WhatsApp too (optional)</span>
          </label>
        </div>

        {error ? (
          <p className="oa-note" role="alert" style={{ color: 'var(--accent-ink)' }}>
            {error}
          </p>
        ) : null}
      </Body>
      <Foot>
        <Cta onClick={verify} disabled={!ready || busy}>
          {sample ? 'See my quotes' : 'Verify and see my quotes'}
        </Cta>
      </Foot>
    </Frame>
  );
}
