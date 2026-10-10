import { verifyOtp } from '@/modules/auth/otp';
import { SIGN_IN_UNAVAILABLE, verifyOtpMessage } from '@/modules/auth/otp-messages';
import { record } from '@/modules/analytics/record';
import { clientIp, fail, gate, json, readJson, str } from '@/modules/app-api/http';

/**
 * POST /api/app/v1/auth/otp/verify — { phone, code, name } → { token }.
 *
 * The token is a normal session (modules/auth/session.ts) returned in the
 * body instead of a cookie. The app keeps it in the device keychain and sends
 * it as `Authorization: Bearer`. It lasts 30 days and dies with sign-out.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const g = gate();
  if (!g.ok) return g.response;

  const body = (await readJson(req)) as Record<string, unknown> | null;
  try {
    const result = await verifyOtp(str(body?.phone, 20), str(body?.code, 12), str(body?.name, 80) || null, {
      userAgent: req.headers.get('user-agent'),
      ip: clientIp(req),
      bearer: true,
    });
    if (!result.ok) return fail(400, verifyOtpMessage(result.reason));
    await record('signin.completed');
    return json({ ok: true, token: result.token });
  } catch (error) {
    console.error('[app-api] verifyOtp threw:', error);
    return fail(503, SIGN_IN_UNAVAILABLE);
  }
}
