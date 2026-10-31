import { record } from '@/modules/analytics/record';
import { customerPasswordSignIn } from '@/modules/auth/customer-password';
import { CUSTOMER_REFUSAL_WORDS } from '@/modules/auth/customer-password-rules';
import { clientIp, fail, gate, json, readJson, str } from '@/modules/app-api/http';

/**
 * POST /api/app/v1/auth/password — { phone, password } → { token, mustChange }.
 *
 * The clients' sign-in while codes are not live (owner, 1 Nov 2026): mobile
 * number and the one-time password their studio made, or the one they chose
 * (auth/customer-password.ts). The token is a normal session, as from the
 * code sign-in. `mustChange`: a one-time password, so the app asks for their
 * own before anything else (`/auth/password/choose`).
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const STATUS = { invalid_phone: 400, no_match: 401, no_password: 401, locked: 423, rate_limited: 429, unavailable: 503 } as const;

export async function POST(req: Request) {
  const g = gate('project');
  if (!g.ok) return g.response;
  const body = (await readJson(req)) as Record<string, unknown> | null;
  try {
    const r = await customerPasswordSignIn(str(body?.phone, 20), str(body?.password, 200), {
      userAgent: req.headers.get('user-agent'),
      ip: clientIp(req),
      bearer: true,
    });
    if (!r.ok) return fail(STATUS[r.reason], CUSTOMER_REFUSAL_WORDS[r.reason]);
    await record('signin.completed');
    return json({ ok: true, token: r.token, mustChange: r.mustChange });
  } catch (error) {
    console.error('[app-api] password sign-in threw:', error instanceof Error ? error.name : 'unknown');
    return fail(503, CUSTOMER_REFUSAL_WORDS.unavailable);
  }
}
