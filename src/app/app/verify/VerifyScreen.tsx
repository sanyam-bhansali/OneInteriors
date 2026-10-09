'use client';

/**
 * Phone and consent (v79 design, 9 Oct 2026): the number is asked for once,
 * when the quotes are ready, and checked with a 6-digit WhatsApp code. The
 * code is the sign-in code, so verifying also saves everything to their
 * number — "come back any time" is true, not a promise.
 *
 * Consent is written first, by the same server action the website's brief
 * uses; then the code signs them in and the brief moves onto their account.
 * A build with no database (local, or SAMPLE_DATA_ONLY) saves nothing and
 * says so.
 */

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Body, Cta, Foot, Frame, Head } from '@/components/app/ui';
import { useJourney } from '@/components/app/useJourney';
import { normalisePhone } from '@/modules/studio/phone';
import { submitContactAction } from '@/app/quiz/actions';
import { requestOtpAction, verifyOtpAction } from '@/app/sign-in/actions';
import { useAppData } from '@/components/app/useAppData';
import type { AppData } from '../data';
import { useT } from '@/components/app/i18n';

const RESEND_S = 30;

export function VerifyScreen({ data }: { data: AppData }) {
  const { sample } = data;
  const router = useRouter();
  const { brief, matches } = useJourney(data);
  const n = matches.length;
  const [phone, setPhone] = useState('');
  const t = useT();
  const [code, setCode] = useState('');
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [wait, setWait] = useState(0);
  const [devCode, setDevCode] = useState<string | null>(null);
  const [agreed, setAgreed] = useState(false);
  const [whatsapp, setWhatsapp] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (wait <= 0) return;
    const t = setTimeout(() => setWait((w) => w - 1), 1000);
    return () => clearTimeout(t);
  }, [wait]);

  const normal = normalisePhone(phone);
  const name = brief?.contactName?.trim() || 'there';
  const changed = sentTo !== null && sentTo !== normal;

  const send = async () => {
    if (!normal) return;
    setError(null);
    setCode('');
    if (sample) {
      setSentTo(normal);
      setWait(RESEND_S);
      return;
    }
    setBusy(true);
    const r = await requestOtpAction(phone, name);
    setBusy(false);
    if (!r.ok) return setError(r.error);
    setSentTo(normal);
    setDevCode(r.devCode ?? null);
    setWait(RESEND_S);
  };

  const verify = async () => {
    if (!brief || !sentTo) return;
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
    const v = await verifyOtpAction(phone, code, name);
    setBusy(false);
    if (!v.ok) return setError(v.error);
    router.push('/app/quote');
  };

  const ready = Boolean(sentTo) && !changed && code.length === 6 && agreed && !busy;

  return (
    <Frame>
      <Head back="/app/matches" meta={t('verify.meta')} />
      <Body>
        <h1 className="oa-title">{t('verify.h1', { n: n || '' })}</h1>
        <p className="oa-sub">{t('verify.sub')}</p>

        <label className="oa-label" htmlFor="oa-phone">
          {t('verify.mobile')}
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

        {sentTo && !changed ? (
          <>
            <label className="oa-label" htmlFor="oa-code">
              {t('verify.code')}
            </label>
            <input
              id="oa-code"
              className="oa-input mono oa-code"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              placeholder="······"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            />
            <p className="oa-note">
              {wait > 0 ? (
                t('verify.wait', { s: String(wait).padStart(2, '0') })
              ) : (
                <button type="button" className="oa-inline-link" onClick={send} disabled={busy}>
                  {t('verify.resend')}
                </button>
              )}
            </p>
            {devCode ? <p className="oa-sample">Test build · your code is {devCode}</p> : null}
          </>
        ) : (
          <button type="button" className="oa-cta outline" onClick={send} disabled={!normal || busy}>
            {changed ? t('verify.sendThis') : t('verify.send')}
          </button>
        )}

        {sample ? <p className="oa-sample">Test build · no code is sent, nothing is saved</p> : null}

        <div className="oa-list mt-2">
          <label className="oa-row" style={{ alignItems: 'flex-start', justifyContent: 'flex-start' }}>
            <input
              type="checkbox"
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
              className="mt-1 h-5 w-5 accent-[var(--accent)]"
            />
            <span className="text-[15px] leading-[1.45]">
              {t('verify.consent')}{' '}
              <a href="/privacy" className="underline" style={{ color: 'var(--accent-ink)' }}>
                {t('verify.privacy')}
              </a>
              .
            </span>
          </label>
          <label className="oa-row" style={{ alignItems: 'flex-start', justifyContent: 'flex-start' }}>
            <input
              type="checkbox"
              checked={whatsapp}
              onChange={(e) => setWhatsapp(e.target.checked)}
              className="mt-1 h-5 w-5 accent-[var(--accent)]"
            />
            <span className="text-[15px] leading-[1.45] text-[var(--ink-2)]">{t('verify.tips')}</span>
          </label>
        </div>

        {error ? (
          <p className="oa-note" role="alert" style={{ color: 'var(--accent-ink)' }}>
            {error}
          </p>
        ) : null}
      </Body>
      <Foot>
        {sentTo && !agreed ? <p className="oa-foot-note">{t('verify.tick')}</p> : null}
        <Cta onClick={verify} disabled={!ready}>
          {t('verify.cta')}
        </Cta>
      </Foot>
    </Frame>
  );
}

/** The screen once the studio data is here — usually already, since the quiz fetches it early. */
export function Verify() {
  const data = useAppData();
  return data ? <VerifyScreen data={data} /> : <Frame>{null}</Frame>;
}
