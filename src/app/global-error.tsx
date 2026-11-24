'use client';

/**
 * The last net (owner, 24 Nov 2026: "protecting the software from crashing").
 * `app/studio/error.tsx` catches a studio screen that breaks, but not the
 * layouts around it: an error in the root or the studio layout itself fell
 * through to Next's blank "Application error". This replaces the whole
 * document, so it carries its own <html> and plain styles (no app CSS loads).
 * Everything saved is on the server; the honest message is "try again".
 */

import { useEffect } from 'react';

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error('[app] page failed', error.digest ?? '', error);
  }, [error]);

  return (
    <html lang="en">
      <body style={{ margin: 0, minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f6f4ef', color: '#1d1b16', fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif', padding: 16 }}>
        <main style={{ maxWidth: 480, width: '100%', background: '#fff', borderRadius: 16, padding: 24, boxShadow: '0 1px 3px rgba(0,0,0,.08)' }}>
          <h1 style={{ margin: '0 0 8px', fontSize: 22, fontWeight: 600 }}>Something went wrong loading this page.</h1>
          <p style={{ margin: '0 0 16px', lineHeight: 1.5, color: '#55524a' }}>
            Everything you saved is safe. Try again; if it keeps happening, send a screenshot of this page to One Interiors.
          </p>
          {error.digest ? <p style={{ margin: '0 0 16px', fontFamily: 'ui-monospace, monospace', fontSize: 12.5, color: '#8a867b' }}>Reference {error.digest}</p> : null}
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button type="button" onClick={reset} style={{ padding: '10px 16px', borderRadius: 10, border: 0, background: '#1d1b16', color: '#fff', fontSize: 15, cursor: 'pointer' }}>
              Try again
            </button>
            <button type="button" onClick={() => window.location.reload()} style={{ padding: '10px 16px', borderRadius: 10, border: '1px solid #d8d4c9', background: 'transparent', color: '#1d1b16', fontSize: 15, cursor: 'pointer' }}>
              Reload the page
            </button>
          </div>
        </main>
      </body>
    </html>
  );
}
