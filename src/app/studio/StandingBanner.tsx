'use client';

import { useActionState } from 'react';
import { dismissAnnouncementAction } from './standing-actions';
import './office-ui.css';

/**
 * Where the studio stands, at the top of their own software.
 *
 * ## Two different things, deliberately not merged
 *
 * A **standing** is a condition: "with us for review" is true every day until
 * it is not, so it is quiet, permanent while it lasts, and cannot be
 * dismissed — dismissing a fact does not change it, and a studio who hid it
 * would have no way to find out where they stood.
 *
 * An **announcement** is a moment: "you are on the roster" happened once, at
 * a time somebody can ask about later. It is loud, it is dismissible, and it
 * goes away for good once read.
 *
 * Collapsing them would make one of the two wrong. A permanent congratulation
 * is a banner nobody sees after the second day; a dismissible standing is a
 * studio who cannot remember whether they ever submitted.
 */
export function StandingBanner({
  standing,
  label,
  detail,
  approval,
}: {
  standing: string;
  label: string;
  detail: string;
  /** The unread approval announcement, if there is one. */
  approval: { id: string } | null;
}) {
  const [, dismiss, pending] = useActionState(dismissAnnouncementAction, null);

  if (approval) {
    return (
      <div className="oi-approved cheer" style={{ alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <span style={{ width: 32, height: 32, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--good-s)', color: 'var(--paper)', flex: 'none' }}>
          <svg viewBox="0 0 16 16" aria-hidden="true" width="16" height="16">
            <path
              d="M3.5 8.5 L6.5 11.5 L12.5 5"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>

        <div style={{ flex: '1 1 260px', minWidth: 0 }}>
          <b style={{ display: 'block', fontSize: 16 }}>You are on the roster.</b>
          <p className="sm" style={{ margin: '2px 0 0', maxWidth: '68ch', color: 'var(--text2)' }}>
            Verified and listed. Customers can find you now, and briefs will start arriving —
            you will get a call from us about the agreement before the first one does.
          </p>
        </div>

        <form action={dismiss} style={{ flex: 'none' }}>
          <input type="hidden" name="id" value={approval.id} />
          <button type="submit" disabled={pending} className="btn sec sm">
            {pending ? '…' : 'Thanks'}
          </button>
        </form>
      </div>
    );
  }

  /* Listed and already acknowledged: nothing to say. The rest of the
     software is the message. */
  if (standing !== 'WITH_US') return null;

  return (
    <div className="hstack" style={{ alignItems: 'baseline', padding: '12px 16px', borderRadius: 14, background: 'var(--info-bg)', color: 'var(--info)' }}>
      <b style={{ fontSize: 14, fontWeight: 600 }}>{label}</b>
      <span className="sm" style={{ flex: '1 1 240px', minWidth: 0 }}>
        {detail}
      </span>
    </div>
  );
}
