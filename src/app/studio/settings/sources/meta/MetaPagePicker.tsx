'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { PagesScreen } from '@/modules/studio-intake/meta-account';
import { connectPageAction } from '../intake-actions';

/** The Pages a Facebook login can manage, each with Connect (owner, 12 Nov 2026). */
export function MetaPagePicker({ pages }: { pages: PagesScreen['pages'] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [said, setSaid] = useState<{ ok: boolean; text: string } | null>(null);

  if (pages.length === 0) {
    return (
      <p className="m-0 text-[13.5px]">
        This Facebook account manages no Pages. Log in with the account that is an admin of your business Page, or ask its admin to add you in Meta Business Suite → Settings → People.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <ul className="m-0 flex list-none flex-col gap-2 p-0">
        {pages.map((p) => (
          <li key={p.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-[9px] bg-[var(--s-surface-2)] px-3 py-2 text-[13.5px]">
            <span className="font-medium">{p.name}</span>
            <span className="text-[12.5px] muted">{p.id}</span>
            {p.connectedHere ? <span className="text-[12.5px] text-[var(--s-good)]">Connected</span> : null}
            {!p.canAdvertise ? <span className="text-[12.5px] muted">You cannot advertise on this Page, so its leads cannot be read.</span> : null}
            <span className="flex-1" />
            <button
              type="button"
              className={p.connectedHere ? 'btn ghost sm' : 'btn pri sm'}
              disabled={busy !== null}
              onClick={async () => {
                setBusy(p.id);
                setSaid(null);
                try {
                  const r = await connectPageAction(p.id);
                  if (!r.ok) setSaid({ ok: false, text: r.error });
                  else {
                    setSaid({ ok: true, text: r.message });
                    router.push('/studio/settings/sources');
                  }
                } catch {
                  setSaid({ ok: false, text: 'That did not go through. Check your connection and try again.' });
                } finally {
                  setBusy(null);
                }
              }}
            >
              {busy === p.id ? 'Connecting…' : p.connectedHere ? 'Connect again' : 'Connect'}
            </button>
          </li>
        ))}
      </ul>
      {said ? (
        <p role="status" className={`m-0 text-[13px] ${said.ok ? '' : 'text-[var(--s-bad)]'}`}>
          {said.text}
        </p>
      ) : null}
    </div>
  );
}
