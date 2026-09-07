'use client';

/**
 * Brief persistence — sessionStorage for v0.1.
 *
 * Deliberately session-scoped, not localStorage: an abandoned brief should not
 * silently resurrect a week later with stale budget and possession dates.
 *
 * From sprint 4 this moves server-side, keyed to the WhatsApp-verified phone,
 * so the brief survives a device change. The interface below is what the
 * server-backed version must also satisfy — keep it narrow.
 */

import { EMPTY_BRIEF, type Brief } from './types';

const KEY = 'oi.brief.v1';

export function loadBrief(): Brief {
  if (typeof window === 'undefined') return EMPTY_BRIEF;
  try {
    const raw = window.sessionStorage.getItem(KEY);
    if (!raw) return EMPTY_BRIEF;
    // Merge over EMPTY_BRIEF so a stored brief from an older shape can't
    // produce undefined fields the matching engine would choke on.
    return { ...EMPTY_BRIEF, ...(JSON.parse(raw) as Partial<Brief>) };
  } catch {
    return EMPTY_BRIEF;
  }
}

export function saveBrief(brief: Brief): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(KEY, JSON.stringify(brief));
  } catch {
    // Private mode, or storage disabled. The quiz still works in memory —
    // it just won't survive a reload. Never let this throw into the UI.
  }
}

export function clearBrief(): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.removeItem(KEY);
  } catch {
    /* no-op */
  }
}
