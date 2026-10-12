'use client';

import { useEffect, useState, useTransition } from 'react';
import { setFormActiveAction } from './actions';

/**
 * The studio's own enquiry link, on the page about getting leads in.
 *
 * ## Why it lives here rather than in Settings
 *
 * Import and this are the same job: two ways a lead reaches the board without
 * anybody typing it. A studio arriving to move their spreadsheet across is
 * exactly the studio who should learn they have a link — and Settings is
 * where people go when something is wrong, not when they are setting up.
 *
 * ## The URL is built in the browser, from the browser
 *
 * `window.location.origin` rather than a configured base URL, because this
 * app answers on three hosts — studio., ops. and the apex — and a studio
 * copying a link that points at the wrong one gets a redirect at best. The
 * host they are reading it on is the host that works.
 *
 * It is rendered after mount for that reason, so the server and the client
 * agree on what to paint first.
 */
export function CaptureLink({ slug, active }: { slug: string; active: boolean }) {
  const [copied, setCopied] = useState(false);
  const [on, setOn] = useState(active);
  const [pending, start] = useTransition();

  /* Empty on the server and on first paint, filled in an effect. Reading
     window.location during render would make the server and client markup
     differ, which React treats as a hydration error — and a lazy useState
     initializer is still render, so that is not the escape hatch it looks
     like. */
  const [origin, setOrigin] = useState('');
  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  const url = origin ? `${origin}/f/${slug}` : `/f/${slug}`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* Clipboard is blocked in some browsers and over plain http. The input
         is selectable, so the fallback is already on screen — saying
         "couldn't copy" would be telling somebody off for their settings. */
      setCopied(false);
    }
  }

  function toggle() {
    const next = !on;
    setOn(next);
    start(async () => {
      const result = await setFormActiveAction(next);
      /* Put it back if the save failed, rather than leaving a switch that
         says one thing while the database says another. */
      if (!result.ok) setOn(!next);
    });
  }

  return (
    <section className="card" style={{ maxWidth: '46rem' }}>
      <div className="chead">
        <h2>Your enquiry link</h2>
        <button
          type="button"
          onClick={toggle}
          disabled={pending}
          aria-pressed={on}
          className="btn ghost sm"
        >
          {on ? 'Turn it off' : 'Turn it on'}
        </button>
      </div>

      <p className="muted sm" style={{ margin: 0, maxWidth: '62ch', lineHeight: 1.5 }}>
        Put this in your Instagram bio or on your own site. Anyone who fills it in lands on your
        board, in the pool, with a callback due the same day.
      </p>

      <div className="hstack" style={{ gap: 8 }}>
        <input
          readOnly
          value={url}
          onFocus={(e) => e.currentTarget.select()}
          aria-label="Your enquiry link"
          className="fld mono"
          style={{ flex: 1, minWidth: 0, width: 'auto', opacity: on ? 1 : 0.5 }}
        />
        <button
          type="button"
          onClick={copy}
          className="btn sec sm"
        >
          {copied ? 'Copied' : 'Copy'}
        </button>
        <a
          href={url}
          target="_blank"
          rel="noreferrer"
          className="btn ghost sm"
        >
          Preview
        </a>
      </div>

      {!on ? (
        <p className="muted sm" style={{ margin: 0 }}>
          Switched off — the page tells visitors you have paused it rather than showing an error.
        </p>
      ) : null}
    </section>
  );
}
