import 'server-only';

import { hasDatabase } from '@/lib/env';
import { customerLive } from '@/lib/host';
import { getCurrentUser, type AuthUser } from '@/modules/auth/session';

/**
 * The plumbing every `/api/app/v1` route shares.
 *
 * `/api` is on the always-allowed list in lib/host.ts, so middleware lets
 * these through on every host. The customer gate therefore has to be here:
 * while `CUSTOMER_LIVE` is unset the app API answers 404, exactly as the
 * website's customer pages redirect to the waitlist. A test pins it.
 */

export type Gate = { ok: true } | { ok: false; response: Response };

export function json(body: unknown, status = 200): Response {
  return Response.json(body, {
    status,
    // Personal data, every response. Nothing on the way may keep a copy.
    headers: { 'cache-control': 'no-store' },
  });
}

export function fail(status: number, error: string): Response {
  return json({ ok: false, error }, status);
}

export function gate(): Gate {
  if (!customerLive()) return { ok: false, response: fail(404, 'Not found.') };
  if (!hasDatabase()) {
    return {
      ok: false,
      response: fail(503, 'One Interiors is temporarily unavailable. This is our problem, not yours.'),
    };
  }
  return { ok: true };
}

/** The signed-in customer, or a 401 the app answers by showing sign-in. */
export async function signedIn(): Promise<{ ok: true; user: AuthUser } | { ok: false; response: Response }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, response: fail(401, 'Please sign in again.') };
  return { ok: true, user };
}

/** 64 KB is ten times the largest brief; anything bigger is not from the app. */
const MAX_BODY = 64 * 1024;

export async function readJson(req: Request): Promise<unknown> {
  const text = await req.text().catch(() => '');
  if (!text || text.length > MAX_BODY) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export function clientIp(req: Request): string | null {
  return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null;
}

export function str(value: unknown, max = 200): string {
  return typeof value === 'string' ? value.slice(0, max) : '';
}
