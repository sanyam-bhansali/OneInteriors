import 'server-only';

import { timingSafeEqual } from 'node:crypto';
import { waitlistIngestToken } from '@/lib/env';

/**
 * The bearer check every /api/waitlist route shares. The pre-launch page is
 * a separate deployment holding a token scoped to the waitlist, never a
 * database credential; its server calls these routes, the visitor's browser
 * never does.
 */
export type AuthResult = 'ok' | 'refused' | 'not-configured';

export function authorised(req: Request): AuthResult {
  const expected = waitlistIngestToken();
  // No token configured means the route is closed, not open. A missing
  // environment variable must never be the thing that makes an endpoint
  // public.
  //
  // It is reported separately from a refusal, though, because the two have
  // completely different fixes and were indistinguishable from the caller's
  // side: "I set the variable" and "I set it and redeployed" both produced
  // the same 401, and the only way to tell them apart was to open the
  // function log. Saying "this route has no token" reveals nothing useful to
  // anyone — it is shut either way — and saves the person who just set it up
  // from hunting the wrong problem.
  if (!expected) return 'not-configured';

  const header = req.headers.get('authorization') ?? '';
  // Trimmed on both sides. The value gets pasted into two different Vercel
  // dashboards by hand, and a trailing newline off a terminal is invisible in
  // both of them — it would fail here on length and report as "Not for you.",
  // which reads as a wrong secret rather than a stray character.
  const supplied = (header.startsWith('Bearer ') ? header.slice(7) : '').trim();
  if (!supplied) return 'refused';

  // Compare in constant time. A plain !== leaks the correct prefix through
  // response timing, which is enough to recover a token given patience.
  const a = Buffer.from(supplied);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return 'refused';   // length is not secret
  return timingSafeEqual(a, b) ? 'ok' : 'refused';
}


export function notConfigured(): Response {
  return Response.json(
    {
      error: 'Waitlist ingest is not configured on this deployment.',
      fix: 'Set WAITLIST_INGEST_TOKEN in this Vercel project and REDEPLOY — env vars are read at boot.',
    },
    { status: 503 },
  );
}

/** The JSON body as an object, or null. */
export async function jsonBody(req: Request): Promise<Record<string, unknown> | null> {
  try {
    const b = await req.json();
    return b && typeof b === 'object' ? (b as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}
