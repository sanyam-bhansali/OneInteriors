'use client';

/** The project page's row for the client agreement: hidden until the studio sends it (docs/studio-os/CLIENT-AGREEMENT.md). */

import Link from 'next/link';
import { useEffect, useState } from 'react';

export function AgreementRow({ projectId }: { projectId: string }) {
  const [state, setState] = useState<'none' | 'sent' | 'signed'>('none');
  const [owner, setOwner] = useState(false);
  useEffect(() => {
    let live = true;
    fetch(`/api/app/v1/agreement?projectId=${encodeURIComponent(projectId)}`, { credentials: 'same-origin' })
      .then((r) => (r.ok ? r.json() : null))
      .then((b: { state?: 'none' | 'sent' | 'signed'; owner?: boolean } | null) => {
        if (live && b?.state) {
          setState(b.state);
          setOwner(b.owner === true);
        }
      })
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [projectId]);
  if (state === 'none') return null;
  return (
    <div className="oa-list" style={{ marginTop: 12 }}>
      <Link href="/app/agreement" className="oa-row" style={{ textDecoration: 'none' }}>
        <span>
          <span className="oa-row-title">Your agreement</span>
          <span className="oa-row-sub" style={state === 'sent' && owner ? { color: 'var(--accent-ink)' } : undefined}>
            {state === 'signed' ? 'Signed · in your Locker' : owner ? 'Ready to sign with Aadhaar' : 'Sent · waiting for the owner’s signature'}
          </span>
        </span>
        <span aria-hidden>→</span>
      </Link>
    </div>
  );
}
