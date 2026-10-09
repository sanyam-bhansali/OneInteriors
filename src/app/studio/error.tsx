'use client';

/**
 * When something on a studio screen breaks, this instead of a blank
 * "Application error" page. Everything a studio saved is already on the
 * server, so the honest message is: it is safe, try again.
 *
 * The error goes to the browser console with its digest, which is what ops
 * needs to find it in the server logs.
 */

import { useEffect } from 'react';

export default function StudioError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error('[studio] screen failed', error.digest ?? '', error);
  }, [error]);

  return (
    <div className="mx-auto flex max-w-[34rem] flex-col gap-4 px-6 py-16">
      <h1 className="h2 m-0">That screen stopped working.</h1>
      <p className="m-0 text-[15px] leading-relaxed text-[var(--color-ink-2)]">
        Everything you saved is safe. Try once more; if it happens again, send a screenshot of this page to
        your contact at One Interiors and we will sort it out.
      </p>
      {error.digest ? <p className="m-0 font-[family-name:var(--font-mono)] text-[12.5px] text-[var(--color-ink-3)]">Reference {error.digest}</p> : null}
      <div className="flex flex-wrap gap-3">
        <button type="button" onClick={reset} className="s-btn">
          Try again
        </button>
        <button type="button" onClick={() => window.location.reload()} className="s-btn-ghost">
          Reload the page
        </button>
      </div>
    </div>
  );
}
