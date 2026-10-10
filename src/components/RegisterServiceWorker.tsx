'use client';

import { useEffect } from 'react';

/**
 * Registers `public/sw.js`, which makes the site installable as an app.
 * Production builds only: in development the worker would sit between the
 * browser and hot reload and serve confusing results.
 */
export function RegisterServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') return;
    if (!('serviceWorker' in navigator)) return;
    navigator.serviceWorker.register('/sw.js').catch(() => {
      /* Not installable on this browser; the site works the same. */
    });
  }, []);
  return null;
}
