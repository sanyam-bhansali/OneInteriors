'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { isTypingTarget } from '@/modules/studio-sales/lead-context';

/** Sent by the lead page's call sheet when a call is logged (AxLead.tsx); LeadNav listens. */
export const CALL_LOGGED_EVENT = 'oi:lead-call-logged';

export interface NavLead {
  name: string;
  href: string;
}

/**
 * "← Previous · Next lead →" on a lead opened from a list (improvement 8,
 * owner 22 Oct 2026). The neighbours come from the server when the page
 * first opens and are kept here: logging a call refreshes the page, and the
 * refreshed answer would be worked out from the lead's new follow-up date,
 * not from where it stood in the list. The page mounts this with
 * `key={leadId}`, so the next lead starts fresh.
 *
 * Once a call is logged here, "Next lead →" grows into the main button, and
 * N opens it (not while typing, not with a sheet open, not with ⌘/Ctrl/Alt).
 */
export function LeadNav({ leadId, prev, next, back, label }: { leadId: string; prev: NavLead | null; next: NavLead | null; back: string; label: string }) {
  const router = useRouter();
  const [kept] = useState(() => ({ prev, next }));
  const [called, setCalled] = useState(false);

  useEffect(() => {
    const onLogged = (e: Event) => {
      const id = (e as CustomEvent<{ leadId?: string }>).detail?.leadId;
      if (!id || id === leadId) setCalled(true);
    };
    window.addEventListener(CALL_LOGGED_EVENT, onLogged);
    return () => window.removeEventListener(CALL_LOGGED_EVENT, onLogged);
  }, [leadId]);

  useEffect(() => {
    const to = kept.next?.href;
    if (!to) return;
    router.prefetch(to);
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'n' && e.key !== 'N') return;
      if (e.metaKey || e.ctrlKey || e.altKey || e.repeat) return;
      if (isTypingTarget(e.target as HTMLElement | null) || isTypingTarget(document.activeElement as HTMLElement | null)) return;
      if (document.querySelector('[aria-modal="true"]')) return;
      e.preventDefault();
      router.push(to);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [kept.next, router]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <nav className="hstack" aria-label={`Leads in ${label}`} style={{ gap: 8, flexWrap: 'wrap' }}>
        <Link href={back} className="btn ghost sm">
          Back to {label}
        </Link>
        <span style={{ flex: 1 }} />
        {kept.prev ? (
          <Link href={kept.prev.href} className="btn sec sm" title={`Previous: ${kept.prev.name}`}>
            ← Previous
          </Link>
        ) : null}
        {kept.next ? (
          <Link href={kept.next.href} className="btn sec sm" title={`Next: ${kept.next.name} (press N)`}>
            Next lead →
          </Link>
        ) : (
          <span className="muted sm">Last lead in {label}</span>
        )}
      </nav>
      {called ? (
        <div role="status" className="hstack" style={{ gap: 12, padding: '12px 16px', borderRadius: 14, background: 'var(--acc-soft)', flexWrap: 'wrap' }}>
          <span style={{ fontWeight: 600 }}>Call logged.</span>
          {kept.next ? (
            <>
              <Link href={kept.next.href} className="btn acc">
                Next lead → {kept.next.name}
              </Link>
              <span className="muted sm">or press N</span>
            </>
          ) : (
            <>
              <span className="muted">That was the last lead in {label}.</span>
              <Link href={back} className="btn sec sm">
                Back to {label}
              </Link>
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}
