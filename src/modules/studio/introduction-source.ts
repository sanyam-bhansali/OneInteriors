/**
 * Where an introduction came from (`Introduction.source`). Since 11 Oct 2026
 * a studio can start a project for its OWN client, and that project hangs off
 * an introduction too, so every existing read of a project keeps working
 * (docs/studio-workspace/OWN-CLIENTS.md). Those introductions are not One
 * Interiors': anything that means "our expert introduced them" — ops' queues,
 * introduction counts, the funnel, a customer's "Meet studios", commission —
 * reads `INTRODUCED_BY_US` and so never sees them. Pure.
 */

export type IntroductionSourceName = 'ONE_INTERIORS' | 'STUDIO_OWN_CLIENT';

/** `where` fragment for an introduction One Interiors made. */
export const INTRODUCED_BY_US = { source: 'ONE_INTERIORS' } as const;

/** `where` fragment for a studio's own client. */
export const STUDIO_OWN_CLIENT = { source: 'STUDIO_OWN_CLIENT' } as const;

export const isOwnClient = (source: string | null | undefined): boolean => source === 'STUDIO_OWN_CLIENT';
