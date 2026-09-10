'use client';

/**
 * "Send this to whoever decides with you."
 *
 * ## The behaviour that matters
 *
 * The link is minted on click, not on page load. Two reasons, and the second
 * is the real one:
 *
 *  1. Most people will never share, so most briefs should never carry a live
 *     bearer token.
 *  2. Creating it silently would mean a shareable URL to somebody's budget
 *     exists before they have decided they want one. Consent to share is the
 *     click.
 *
 * The copy avoids "share" as a verb on its own, which reads as social-media
 * broadcasting. This is a private hand-off to one or two specific people, and
 * saying so is what makes it feel safe enough to do.
 */

import { useState } from 'react';
import { Button } from '@/components/ui';
import { createShareLinkAction } from './actions';

type State =
  | { phase: 'idle' }
  | { phase: 'working' }
  | { phase: 'ready'; url: string; copied: boolean }
  | { phase: 'error'; message: string };

export function ShareButton() {
  const [state, setState] = useState<State>({ phase: 'idle' });

  async function create() {
    setState({ phase: 'working' });
    const result = await createShareLinkAction();
    if (!result.ok) {
      setState({ phase: 'error', message: result.error });
      return;
    }
    setState({ phase: 'ready', url: result.url, copied: false });

    // Best effort. Clipboard access is refused in plenty of ordinary
    // situations — an insecure origin, a browser that wants a fresher user
    // gesture — and the URL is on screen and selectable either way, so a
    // failure here must not read as the link having failed.
    try {
      await navigator.clipboard.writeText(result.url);
      setState({ phase: 'ready', url: result.url, copied: true });
    } catch {
      /* the input below is the fallback, and it is always there */
    }
  }

  if (state.phase === 'ready') {
    return (
      <div className="w-full rounded-[12px] border border-[var(--color-rule)] bg-[var(--color-paper-2)] p-5">
        <p className="m-0 mb-2 font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.12em] text-[var(--color-ink-3)]">
          {state.copied ? 'Copied — paste it to them' : 'Your link'}
        </p>
        <input
          readOnly
          value={state.url}
          onFocus={(e) => e.currentTarget.select()}
          aria-label="Shareable link to your comparison"
          className="w-full rounded-[8px] border border-[var(--color-rule)] bg-[var(--color-paper)] px-3 py-2.5 font-[family-name:var(--font-mono)] text-[13px] text-[var(--color-ink-2)]"
        />
        <p className="m-0 mt-3 max-w-[52ch] text-[13px] leading-[1.55] text-[var(--color-ink-3)]">
          Anyone with this link can read your quotes and what we assumed. They cannot change
          anything, ask for an introduction, or see your contact details — and we do not have
          theirs.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-4">
      <Button
        onClick={() => void create()}
        variant="secondary"
        size="lg"
        disabled={state.phase === 'working'}
      >
        {state.phase === 'working' ? 'Making a link…' : 'Send this to whoever decides with you'}
      </Button>
      {state.phase === 'error' ? (
        <span className="text-[14px] text-[var(--color-terracotta)]">{state.message}</span>
      ) : (
        <span className="max-w-[38ch] text-[14px] leading-relaxed text-[var(--color-ink-3)]">
          A read-only copy of this page. No account needed to open it.
        </span>
      )}
    </div>
  );
}
