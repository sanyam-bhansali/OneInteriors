/**
 * How hard the public website lookup may be pushed.
 *
 * ## What this file is now
 *
 * Only the numbers. The sliding-window logic moved to
 * `modules/rate-limit/window.ts` and the storage to
 * `modules/rate-limit/store.ts`, which is shared across instances.
 *
 * ## What it used to be, and why that was not enough
 *
 * An in-memory `Map`, per instance. On Vercel that meant it reset on every
 * cold start and was enforced separately in each concurrently running lambda,
 * so a caller spreading requests across instances got a multiple of the quota.
 * The old docblock said exactly that and asked for a shared store before real
 * traffic. This is that store.
 *
 * ## Why a limiter exists here at all
 *
 * `scrapeStudioSite` makes an outbound HTTP request from our server to a URL
 * a stranger typed. Until the apply form existed its only caller was gated on
 * `requireRole('OPS')`, and that gate was the protection.
 *
 * The SSRF hardening in `scrape.ts` is genuinely good — private ranges
 * blocked including the octal, hex, short-form and trailing-dot tricks,
 * redirects followed by hand with every hop revalidated, body capped while
 * reading — so it cannot be pointed at our own network. What it CAN be turned
 * into without a limiter is an open relay: anybody driving our server to fetch
 * any public URL, as fast as they like, at our cost and from our IP.
 */

import type { Limit } from '@/modules/rate-limit/window';

/**
 * Five in ten minutes. Low on purpose: this is a courtesy shortcut on a form,
 * not a feature anybody needs to use repeatedly. Somebody who trips it can
 * type the answer instead, which is what the refusal says.
 */
export const LOOKUP_LIMIT: Limit = {
  max: 5,
  windowMs: 10 * 60 * 1000,
};
