'use client';

/**
 * Sign (v79 "Choose & sign", step 4 of 4): the locked total, handover, how
 * they pay, the studio's own terms, a tick, and a 6-digit WhatsApp code to
 * the number on their account.
 *
 * The design names Aadhaar OTP. That needs a licensed e-sign provider, which
 * is not chosen yet, so this signs with the account's own WhatsApp code and
 * says plainly that they pay the studio directly.
 */

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Body, Cta, Foot, Frame, Head } from '@/components/app/ui';
import { formatINR } from '@/lib/money';
import type { FinalQuoteView } from '@/modules/portal/choose';
import { Steps } from '../../ChooseScreen';
import { requestSignCodeAction, signAction } from '../../actions';

const RESEND_S = 30;

export function SignScreen({ q, name, phone }: { q: FinalQuoteView; name: string; phone: string }) {
  const router = useRouter();
  const [agreed, setAgreed] = useState(false);
  const [showTerms, setShowTerms] = useState(false);
  const [sent, setSent] = useState(false);
  const [code, setCode] = useState('');
  const [devCode, setDevCode] = useState<string | null>(null);
  const [wait, setWait] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (wait <= 0) return;
    const t = setTimeout(() => setWait((w) => w - 1), 1000);
    return () => clearTimeout(t);
  }, [wait]);

  const send = async () => {
    setError(null);
    setBusy(true);
    const r = await requestSignCodeAction();
    setBusy(false);
    if (!r.ok) return setError(r.error);
    setSent(true);
    setDevCode(r.devCode ?? null);
    setWait(RESEND_S);
  };

  const sign = async () => {
    setError(null);
    setBusy(true);
    const r = await signAction({ quoteId: q.id, code, agreed });
    setBusy(false);
    if (!r.ok) return setError(r.error);
    setDone(true);
  };

  if (done) {
    return (
      <Frame dark>
        <main className="oa-body" style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 72px)', gap: 18 }}>
          <h1 className="oa-title" style={{ color: '#f1f0ec' }}>
            Signed. Your home starts now{name ? `, ${name}` : ''}.
          </h1>
          <p style={{ margin: 0, fontSize: 15, lineHeight: 1.5, color: '#b5b3ad' }}>
            {q.studioName} has your signed quote and starts the detailed design. Your project, its stages and every site update are
            in the app from today.
          </p>
        </main>
        <Foot>
          <Cta onClick={() => router.push('/app/home')} tone="light">
            Open my project
          </Cta>
        </Foot>
      </Frame>
    );
  }

  return (
    <Frame>
      <Head back={`/app/choose/quote/${q.id}`} meta="Choose & sign" />
      <Body>
        <Steps at={4} />
        <h1 className="oa-title">Sign with {q.studioName}</h1>

        <div className="oa-bill">
          <div className="row">
            <span>Total, locked</span>
            <span className="amt">
              {formatINR(q.totalPaise)} for {q.lineCount} lines
            </span>
          </div>
          <div className="row">
            <span>GST</span>
            <span className="amt">On the studio&rsquo;s invoice</span>
          </div>
          <div className="row">
            <span>Handover</span>
            <span className="amt">About {Math.round(q.handoverDays / 7)} weeks from signing</span>
          </div>
          <div className="row">
            <span>Site updates</span>
            <span className="amt">Here, as the studio posts them</span>
          </div>
        </div>

        <p className="oa-label">How you pay</p>
        <ol className="oa-stages">
          {q.stages.map((s, i) => (
            <li key={`${s.label}-${i}`}>
              <span className="n">{i + 1}</span>
              <span className="what">{s.label}</span>
              <span className="amt">
                {formatINR(s.amountPaise)}
                {s.pct !== null ? <small>{s.pct}%</small> : null}
              </span>
            </li>
          ))}
        </ol>
        <p className="oa-note">You pay the studio directly. Every payment and receipt is kept in your Home locker.</p>

        {q.terms ? (
          <>
            <button type="button" className="oa-share-row" onClick={() => setShowTerms((v) => !v)}>
              <span>
                <b>Read {q.studioName}&rsquo;s terms</b>
                <small>Their own, as written on the quote</small>
              </span>
              <span className="go" aria-hidden>
                {showTerms ? '−' : '+'}
              </span>
            </button>
            {showTerms ? <div className="oa-terms">{q.terms}</div> : null}
          </>
        ) : null}

        <label className="oa-row" style={{ alignItems: 'flex-start', justifyContent: 'flex-start' }}>
          <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} className="mt-1 h-5 w-5 accent-[var(--accent)]" />
          <span className="text-[15px] leading-[1.45]">
            I have read the quote{q.terms ? ' and the terms' : ''} and agree to the price, timeline and payment stages.
          </span>
        </label>

        {sent ? (
          <>
            <label className="oa-label" htmlFor="oa-sign-code">
              6-digit code sent on WhatsApp to {phone}
            </label>
            <input
              id="oa-sign-code"
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
                `Didn’t get it? Ask for a new code in 0:${String(wait).padStart(2, '0')}`
              ) : (
                <button type="button" className="oa-inline-link" onClick={send} disabled={busy}>
                  Send a new code
                </button>
              )}
            </p>
            {devCode ? <p className="oa-sample">Test build · your code is {devCode}</p> : null}
          </>
        ) : null}

        {error ? (
          <p className="oa-note" role="alert" style={{ color: 'var(--accent-ink)' }}>
            {error}
          </p>
        ) : null}
      </Body>
      <Foot>
        {sent ? (
          <Cta onClick={() => void sign()} disabled={!agreed || code.length !== 6 || busy}>
            {busy ? 'Signing…' : `Sign with ${q.studioName}`}
          </Cta>
        ) : (
          <Cta onClick={() => void send()} disabled={!agreed || busy}>
            Send my signing code
          </Cta>
        )}
      </Foot>
    </Frame>
  );
}
