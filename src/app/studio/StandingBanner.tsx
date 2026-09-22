'use client';

import { useActionState } from 'react';
import { dismissAnnouncementAction } from './standing-actions';

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
      <div className="oi-approved mx-auto mb-5 flex max-w-[72rem] flex-wrap items-start gap-4 rounded-[14px] border border-[var(--s-good,#4a6a4f)]/30 bg-[var(--s-good-wash,#e5eee1)] px-5 py-4">
        <span className="mt-0.5 grid h-8 w-8 flex-none place-items-center rounded-full bg-[var(--s-good,#4a6a4f)] text-white">
          <svg viewBox="0 0 16 16" aria-hidden="true" className="h-4 w-4">
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

        <div className="min-w-0 flex-1">
          <p className="m-0 text-[16px] font-semibold text-[var(--s-ink,#1c1b19)]">
            You are on the roster.
          </p>
          <p className="m-0 mt-0.5 max-w-[68ch] text-[14px] leading-relaxed text-[var(--s-ink-2,#56524b)]">
            Verified and listed. Customers can find you now, and briefs will start arriving —
            you will get a call from us about the agreement before the first one does.
          </p>
        </div>

        <form action={dismiss} className="flex-none">
          <input type="hidden" name="id" value={approval.id} />
          <button
            type="submit"
            disabled={pending}
            className="rounded-full border border-[var(--s-good,#4a6a4f)]/40 px-4 py-1.5 text-[13px] font-medium text-[var(--s-ink,#1c1b19)] disabled:opacity-50"
          >
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
    <div className="mx-auto mb-5 flex max-w-[72rem] flex-wrap items-baseline gap-x-3 gap-y-1 rounded-[12px] bg-[var(--s-surface-2,#f0ede7)] px-5 py-3">
      <span className="text-[13.5px] font-medium text-[var(--s-ink,#1c1b19)]">{label}</span>
      <span className="min-w-0 flex-1 text-[13px] leading-relaxed text-[var(--s-ink-2,#56524b)]">
        {detail}
      </span>
    </div>
  );
}
