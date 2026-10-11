import 'server-only';

/**
 * The plumbing the site-mode route handlers share (`/api/studio/site/*`).
 * Route handlers rather than server actions: the phone's offline queue may
 * send a post hours later, after a new deployment, and a server action's id
 * does not survive a deployment; and uploads must not pass through a server
 * action's 4 MB body limit.
 *
 * The session cookie is SameSite=Lax, so another site's page cannot post
 * with it; `sameOrigin` refuses a request a browser marks cross-site anyway.
 */

import { hasDatabase } from '@/lib/env';

export function reply(body: unknown, status = 200): Response {
  return Response.json(body, { status, headers: { 'cache-control': 'no-store' } });
}

const STATUS: Record<string, number> = { sign_in: 401, not_yours: 404, not_your_role: 403, gone: 404, busy: 409 };

/** An error code as a response; 400 for anything the phone sent wrong. */
export const refuse = (error: string) => reply({ ok: false, error }, STATUS[error] ?? 400);

/** Same-origin requests only (browsers send `Sec-Fetch-Site`; one without it is not a browser page). */
export function sameOrigin(req: Request): boolean {
  const site = req.headers.get('sec-fetch-site');
  return site === null || site === 'same-origin' || site === 'none';
}

const MAX_BODY = 256 * 1024;

export async function readBody(req: Request): Promise<unknown> {
  const text = await req.text().catch(() => '');
  if (!text || text.length > MAX_BODY) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

/** The checks every site route starts with. */
export async function opening(req: Request): Promise<{ ok: true; body: unknown } | { ok: false; response: Response }> {
  if (!sameOrigin(req)) return { ok: false, response: refuse('not_yours') };
  if (!hasDatabase()) return { ok: false, response: reply({ ok: false, error: 'offline_server' }, 503) };
  const body = await readBody(req);
  if (body === null) return { ok: false, response: refuse('invalid') };
  return { ok: true, body };
}
