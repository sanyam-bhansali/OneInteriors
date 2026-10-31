'use client';

import { useState, useTransition } from 'react';
import { clientPasswordAction, resendInviteAction } from '../start/actions';

/**
 * The studio's own client's invite to the app (docs/studio-workspace/
 * OWN-CLIENTS.md): what went out, and the link and the words to send
 * yourself — customers never get WhatsApp from us, so the studio's own
 * WhatsApp or SMS to its client is the surest way. Copy buttons, the message
 * in English, Hindi and Marathi, and "send a new link" (the old one stops).
 * Until sign-in codes are live the client signs in with a one-time password
 * the studio makes here and hands over with the link (owner, 1 Nov 2026).
 */

type Lang = 'en' | 'hi' | 'mr';
const LANG_NAMES: Record<Lang, string> = { en: 'English', hi: 'हिन्दी', mr: 'मराठी' };

const quiet = 'btn ghost sm';

export function InviteBanner({
  projectId,
  customer,
  link,
  code,
  sentVia,
  messages,
  joined,
  justStarted,
  canResend,
}: {
  projectId: string;
  customer: string;
  link: string;
  code: string;
  sentVia: ('sms' | 'email')[];
  messages: Record<Lang, string>;
  joined: boolean;
  justStarted: boolean;
  canResend: boolean;
}) {
  const [lang, setLang] = useState<Lang>('en');
  const [copied, setCopied] = useState<'link' | 'message' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [oneTime, setOneTime] = useState<{ password: string; message: string } | null>(null);

  const makePassword = () =>
    start(async () => {
      const r = await clientPasswordAction(projectId);
      if (r.ok) {
        setOneTime({ password: r.password, message: r.message });
        setError(null);
      } else setError(r.error);
    });

  const copy = async (what: 'link' | 'message') => {
    try {
      await navigator.clipboard.writeText(what === 'link' ? link : messages[lang]);
      setCopied(what);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      setError('Copying did not work here. Select the text and copy it.');
    }
  };

  const sent =
    sentVia.length === 0
      ? `Nothing was sent automatically. Share the link with ${customer} yourself.`
      : `Invite sent to ${customer} by ${sentVia.map((v) => (v === 'sms' ? 'SMS' : 'email')).join(' and ')}. You can share the link too.`;

  return (
    <section
      aria-label="Invite to the app"
      className="card"
      style={{ boxShadow: `inset 4px 0 0 ${joined ? 'var(--good)' : 'var(--acc)'}` }}
    >
      <div>
        <p className="m-0 text-[15.5px] font-semibold">
          {joined ? `${customer} has joined the app.` : justStarted ? 'Project started. Now invite your client.' : `${customer} has not opened the app yet.`}
        </p>
        <p className="m-0 mt-0.5 text-[13.5px] text-[var(--text2)]">
          {joined
            ? 'Everything your team records here shows in their app.'
            : `${sent} They sign in with their own mobile number and see this project.`}
        </p>
      </div>

      {!joined ? (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <code className="min-w-0 break-all rounded-[10px] bg-[var(--fill)] mono px-2.5 py-1.5 text-[13px]">{link}</code>
            <button type="button" onClick={() => copy('link')} className={quiet}>
              {copied === 'link' ? 'Copied' : 'Copy link'}
            </button>
            <span className="text-[12.5px] text-[var(--muted)]">
              Code <span className="mono">{code}</span>
            </span>
          </div>

          <div>
            <div role="tablist" aria-label="Message language" className="tabs mb-2">
              {(Object.keys(LANG_NAMES) as Lang[]).map((l) => (
                <button
                  key={l}
                  type="button"
                  role="tab"
                  aria-selected={l === lang}
                  onClick={() => setLang(l)}
                >
                  {LANG_NAMES[l]}
                </button>
              ))}
            </div>
            <p className="m-0 rounded-[12px] bg-[var(--soft)] p-3 text-[13.5px] leading-relaxed">{messages[lang]}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <button type="button" onClick={() => copy('message')} className={quiet}>
                {copied === 'message' ? 'Copied' : 'Copy message'}
              </button>
              {canResend ? (
                <button
                  type="button"
                  disabled={pending}
                  onClick={() =>
                    start(async () => {
                      const r = await resendInviteAction(projectId);
                      setError(r.ok ? null : (r.error ?? 'That did not work.'));
                    })
                  }
                  className={quiet}
                  title="Makes a new link; the old one stops working"
                >
                  {pending ? 'Sending…' : 'Send a new link'}
                </button>
              ) : null}
            </div>
          </div>
        </>
      ) : null}
 <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={makePassword}
          className={quiet}
          title="Signs the client out everywhere; they choose their own password when they next sign in"
        >
          {pending ? 'Making…' : joined ? 'New one-time password' : 'Make a one-time password'}
        </button>
        {oneTime ? (
          <span className="text-[13px]">
            <code className="mono rounded-[10px] bg-[var(--fill)] px-2.5 py-1.5 text-[14px]">{oneTime.password}</code>
          </span>
        ) : null}
      </div>
      {oneTime ? <p className="m-0 text-[13px] text-[var(--text2)]">{oneTime.message} It is shown only now.</p> : null}
      {error ? (
        <p role="alert" className="m-0 text-[13px] text-[var(--bad)]">
          {error}
        </p>
      ) : null}
    </section>
  );
}
