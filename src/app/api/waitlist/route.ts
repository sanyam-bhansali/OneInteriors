import { timingSafeEqual } from 'node:crypto';
import { ingestWaitlistSignup } from '@/modules/waitlist/ingest';
import { waitlistIngestToken } from '@/lib/env';
import { POLICY_VERSION } from '@/modules/consent/policy';

/**
 * POST /api/waitlist
 *
 * The pre-launch page at oneinteriors.in is a separate deployment and posts
 * signups here. It holds a bearer token, not a database credential — the
 * whole point of the arrangement is that the landing page can add a name to
 * one table and do nothing else. If the token leaks, that is the blast
 * radius.
 *
 * Not a server action because the caller is a different origin and a
 * different codebase; server actions are for this app's own forms.
 */

export const runtime = 'nodejs';       // timingSafeEqual, and Prisma
export const dynamic = 'force-dynamic';

type AuthResult = 'ok' | 'refused' | 'not-configured';

function authorised(req: Request): AuthResult {
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

export async function POST(req: Request) {
  const auth = authorised(req);
  if (auth === 'not-configured') {
    return Response.json(
      { error: 'Waitlist ingest is not configured on this deployment.',
        fix: 'Set WAITLIST_INGEST_TOKEN in this Vercel project and REDEPLOY — env vars are read at boot.' },
      { status: 503 },
    );
  }
  if (auth !== 'ok') {
    return Response.json({ error: 'Not for you.' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'Expected JSON' }, { status: 400 });
  }
  if (!body || typeof body !== 'object') {
    return Response.json({ error: 'Expected an object' }, { status: 400 });
  }

  try {
    const result = await ingestWaitlistSignup(body, POLICY_VERSION);
    if (!result.ok) {
      return Response.json({ error: 'Invalid submission', fields: result.fields }, { status: 400 });
    }
    return Response.json({ ok: true, created: result.created });
  } catch (err) {
    /**
     * The visitor on the other side has already watched their room furnish
     * itself. Log the lead in full so it is recoverable by hand, and tell the
     * caller it failed so it can decide what to say — the one thing that must
     * not happen is a signup disappearing silently.
     */
    console.error('[waitlist] ingest failed:', JSON.stringify(redact(body)), err);
    return Response.json({ error: 'Could not store the signup' }, { status: 500 });
  }
}

/** Logs are a dashboard other people can open. Keep the contact partial. */
function redact(body: unknown): unknown {
  if (!body || typeof body !== 'object') return body;
  const b = body as Record<string, unknown>;
  const c = typeof b.contact === 'string' ? b.contact : '';
  return { ...b, contact: c ? `${c.slice(0, 3)}…${c.slice(-2)}` : '' };
}
