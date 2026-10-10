import { requestOtp } from '@/modules/auth/otp';
import { requestOtpMessage, SIGN_IN_UNAVAILABLE } from '@/modules/auth/otp-messages';
import { clientIp, fail, gate, json, readJson, str } from '@/modules/app-api/http';

/** POST /api/app/v1/auth/otp/request — { phone, name } → a WhatsApp code. */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const g = gate();
  if (!g.ok) return g.response;

  const body = (await readJson(req)) as Record<string, unknown> | null;
  try {
    const result = await requestOtp(str(body?.phone, 20), str(body?.name, 80), { ip: clientIp(req) });
    if (!result.ok) return fail(400, requestOtpMessage(result.reason));
    // `devCode` exists only off production or with the pre-launch escape hatch
    // on — the same rule as the website's sign-in (modules/auth/otp.ts).
    return json({ ok: true, devCode: result.devCode });
  } catch (error) {
    console.error('[app-api] requestOtp threw:', error);
    return fail(503, SIGN_IN_UNAVAILABLE);
  }
}
