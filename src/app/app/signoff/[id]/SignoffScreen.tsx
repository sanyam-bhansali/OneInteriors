'use client';

/**
 * The signing half of /app/signoff/:id (owner, 15 Oct 2026): what is being
 * signed, the quotation itself (rendered on the server, passed in), then the
 * tick, the typed full name and Sign. Optional for the studio to ask, never
 * forced; one tap to sign, no code to wait for. In English, Hindi or Marathi.
 */

import { useRouter } from 'next/navigation';
import { useState, type ReactNode } from 'react';
import { Body, Cta, Foot, Frame, Head } from '@/components/app/ui';
import { useLang } from '@/components/app/i18n';
import { lw } from '@/modules/app/lifecycle-words';
import { shortDate } from '@/modules/app/project-view';
import type { SignoffKind, SignoffState } from '@/modules/project/signoff-rules';

export function SignoffScreen({
  id,
  kind,
  quoteNumber,
  revision,
  state,
  canSign,
  viewer,
  hash,
  changedSince,
  signed,
  children,
}: {
  id: string;
  kind: SignoffKind;
  quoteNumber: string;
  revision: number;
  state: SignoffState;
  canSign: boolean;
  viewer: 'owner' | 'family' | 'studio';
  hash: string;
  changedSince: boolean;
  signed: { name: string; on: string; line: string; ip: string | null; userAgent: string | null } | null;
  children: ReactNode;
}) {
  const lang = useLang();
  const router = useRouter();
  const [agreed, setAgreed] = useState(false);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const title = lw(lang, `life.sign.kind.${kind}`, { number: `${quoteNumber} R${revision}` });

  async function sign() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/app/v1/signoffs/${encodeURIComponent(id)}`, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ agreed, name, hash }),
      });
      const body = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
      if (res.ok && body?.ok) {
        setDone(lw(lang, 'life.sign.done'));
        router.refresh();
      } else setError(body?.error ?? lw(lang, 'life.extra.failed'));
    } catch {
      setError(lw(lang, 'life.extra.failed'));
    } finally {
      setBusy(false);
    }
  }

  const open = canSign && !done;
  return (
    <Frame>
      <Head back={viewer === 'studio' ? null : '/app/project'} meta={lw(lang, 'life.sign.title')} />
      <Body>
        <h1 className="oa-title">{title}</h1>
        {signed ? (
          <p className="oa-note" data-testid="signed-line" style={{ fontWeight: 600 }}>
            ✓ {lw(lang, 'life.sign.signed', { name: signed.name, date: shortDate(`${signed.on}T12:00:00Z`) })}
          </p>
        ) : null}
        {signed && viewer === 'studio' && (signed.ip || signed.userAgent) ? (
          <p className="oa-note" style={{ fontSize: 12 }}>
            {[signed.ip ? `IP ${signed.ip}` : null, signed.userAgent].filter(Boolean).join(' · ')} · SHA-256 {hash.slice(0, 16)}…
          </p>
        ) : null}
        {state === 'superseded' ? <p className="oa-note">{lw(lang, 'life.sign.superseded')}</p> : null}
        {changedSince && state !== 'superseded' ? (
          <p className="oa-note" role="alert" style={{ color: 'var(--accent-ink)' }}>
            {state === 'signed'
              ? 'The terms printed with this quotation have changed since it was signed. What was signed is kept by its fingerprint (SHA-256).'
              : 'This quotation changed after the studio asked. Ask them to send it again.'}
          </p>
        ) : null}
        {state === 'waiting' && viewer === 'family' ? <p className="oa-note">{lw(lang, 'life.sign.ownerOnly')}</p> : null}

        <div style={{ overflow: 'auto', maxHeight: kind === 'AGREEMENT' ? '40vh' : '70vh', borderRadius: 12, border: '1px solid var(--line)' }} data-testid="signoff-document">
          {children}
        </div>
        {kind === 'AGREEMENT' && open ? <p className="oa-note">{lw(lang, 'life.sign.paper')}</p> : null}

        {open ? (
          <>
            <label className="oa-row" style={{ alignItems: 'flex-start', justifyContent: 'flex-start' }}>
              <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} className="mt-1 h-5 w-5 accent-[var(--accent)]" data-testid="signoff-agree" />
              <span className="text-[15px] leading-[1.45]">{lw(lang, kind === 'AGREEMENT' ? 'life.sign.agree.AGREEMENT' : 'life.sign.agree')}</span>
            </label>
            <label className="oa-label" htmlFor="oa-signoff-name">
              {lw(lang, 'life.sign.name')}
            </label>
            <input
              id="oa-signoff-name"
              className="oa-input"
              autoComplete="name"
              maxLength={80}
              value={name}
              onChange={(e) => setName(e.target.value)}
              style={{ fontStyle: 'italic', fontSize: 20 }}
              data-testid="signoff-name"
            />
          </>
        ) : null}
        {done ? (
          <p className="oa-note" role="status" style={{ fontWeight: 600 }}>
            {done}
          </p>
        ) : null}
        {error ? (
          <p className="oa-note" role="alert" style={{ color: 'var(--accent-ink)' }}>
            {error}
          </p>
        ) : null}
      </Body>
      {open ? (
        <Foot>
          <Cta onClick={() => void sign()} disabled={!agreed || name.trim().length < 3 || busy}>
            {busy ? '…' : lw(lang, 'life.sign.submit')}
          </Cta>
        </Foot>
      ) : null}
    </Frame>
  );
}
