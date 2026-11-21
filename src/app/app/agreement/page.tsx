'use client';

/**
 * Your agreement (owner, 21 Nov 2026; docs/studio-os/CLIENT-AGREEMENT.md):
 * sent by the studio at design closure, read here, and signed with Aadhaar
 * eSign (an OTP on the phone linked to your Aadhaar). Only the person whose
 * home it is signs; family can read it. Once signed, the signed copy is also
 * in the Locker. Same API as the Expo app (/api/app/v1/agreement).
 */

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Frame, Tabs } from '@/components/app/ui';
import { useMyProject } from '@/components/app/useMyProject';

interface View {
  state: 'none' | 'sent' | 'signed';
  studio: string;
  owner: boolean;
  pdfUrl: string | null;
  signedUrl: string | null;
  signUrl: string | null;
  signedAt: string | null;
}

export default function AgreementPage() {
  const mine = useMyProject();
  const projectId = mine.state === 'real' ? mine.project.id : null;
  const [view, setView] = useState<View | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [back, setBack] = useState<string | null>(null);

  useEffect(() => {
    setBack(new URLSearchParams(window.location.search).get('esign'));
  }, []);

  useEffect(() => {
    if (!projectId) return;
    fetch(`/api/app/v1/agreement?projectId=${encodeURIComponent(projectId)}`, { credentials: 'same-origin' })
      .then(async (r) => {
        const b = (await r.json().catch(() => null)) as (View & { error?: string }) | null;
        if (r.ok && b) setView(b);
        else setError(b?.error ?? 'That did not load. Try again.');
      })
      .catch(() => setError('No connection. Try again.'));
  }, [projectId]);

  if (mine.state === 'loading') return <Frame>{null}</Frame>;

  return (
    <Frame>
      <header className="oa-page-head">
        <span className="oa-meta">At design closure</span>
        <h1>Your agreement</h1>
      </header>
      <main className="oa-body">
        {back === 'signed' ? (
          <p className="oa-toast" role="status">
            Signed. Your copy is below and in your Locker.
          </p>
        ) : back === 'pending' ? (
          <p className="oa-note" role="status">
            We are waiting for the eSign to finish. Check again in a minute.
          </p>
        ) : back === 'failed' || back === 'check' ? (
          <p className="oa-note" role="status" style={{ color: 'var(--accent-ink)' }}>
            The signature did not go through. Try signing again.
          </p>
        ) : null}
        {mine.state !== 'real' ? (
          <p className="oa-note">Your studio sends the agreement when your design is closed.</p>
        ) : error ? (
          <p className="oa-note">{error}</p>
        ) : !view ? null : view.state === 'none' ? (
          <p className="oa-note">{view.studio} sends your agreement when your design is closed. You will get a notice.</p>
        ) : view.state === 'signed' ? (
          <div className="oa-card">
            <p style={{ margin: 0, fontSize: 15.5, lineHeight: 1.5 }}>
              You signed your agreement with {view.studio}
              {view.signedAt ? ` on ${new Date(view.signedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}` : ''}.
            </p>
            {view.signedUrl ? (
              <a className="oa-cta" style={{ marginTop: 12 }} href={view.signedUrl} target="_blank" rel="noopener">
                Open the signed agreement
              </a>
            ) : null}
            <Link href="/app/locker" className="oa-meta" style={{ display: 'inline-block', marginTop: 10 }}>
              It is also in your Locker
            </Link>
          </div>
        ) : (
          <div className="oa-card">
            <p style={{ margin: 0, fontSize: 15.5, lineHeight: 1.5 }}>
              {view.studio} has sent your agreement. Read it in full first. {view.owner ? 'You sign it with Aadhaar eSign: an OTP comes to the phone linked to your Aadhaar.' : 'The person whose home it is signs it.'}
            </p>
            {view.pdfUrl ? (
              <a className="oa-cta light" style={{ marginTop: 12, boxShadow: 'inset 0 0 0 1px var(--line)' }} href={view.pdfUrl} target="_blank" rel="noopener">
                Read the agreement
              </a>
            ) : null}
            {view.signUrl ? (
              <a className="oa-cta" style={{ marginTop: 10 }} href={view.signUrl}>
                Sign with Aadhaar
              </a>
            ) : view.owner ? (
              <p className="oa-note" style={{ marginTop: 10 }}>
                Signing opens here soon. {view.studio} will let you know.
              </p>
            ) : null}
          </div>
        )}
      </main>
      <Tabs />
    </Frame>
  );
}
