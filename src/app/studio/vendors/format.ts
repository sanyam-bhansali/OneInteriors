import { formatINR } from '@/lib/money';

/**
 * Shared words and classes for the crew screens. A plain module (no
 * 'use client'), so server pages and client components can both call these:
 * a function exported from a client module cannot be called on the server.
 */

export const muted = 'text-[12.5px] text-[var(--s-ink-3)]';
export const h2 = 'm-0 text-[16px] font-semibold';

export const rupees = (paise: number | null | undefined) => (paise === null || paise === undefined ? '—' : formatINR(paise));

export const dayWords = (iso: string | null) =>
  iso ? new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }) : '—';
