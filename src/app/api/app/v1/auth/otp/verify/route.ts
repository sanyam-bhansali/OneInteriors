import { verifyOtp } from '@/modules/auth/otp';
import { SIGN_IN_UNAVAILABLE, verifyOtpMessage } from '@/modules/auth/otp-messages';
import { record } from '@/modules/analytics/record';
import { briefFromJson } from '@/modules/brief/from-json';
import { checkContact } from '@/modules/brief/contact';
import { saveContact } from '@/modules/brief/repository';
import { recordConsent } from '@/modules/consent/record';
import { CONTACT_CONSENT_SOURCE, contactConsent } from '@/modules/consent/policy';
import { clientIp, fail, gate, json, readJson, str } from '@/modules/app-api/http';

/**
 * POST /api/app/v1/auth/otp/verify — { phone, code, name, brief?, consent? } → { token }.
 *
 * The token is a normal session (modules/auth/session.ts) returned in the
 * body instead of a cookie. The app keeps it in the device keychain and sends
 * it as `Authorization: Bearer`. It lasts 30 days and dies with sign-out.
 *
 * On the first visit the app also sends the brief and
 * `consent: { share, offers }`. `share` must be true when a brief is sent:
 * it is checked before the code is spent, the same check the website's
 * contact step runs (`checkContact`). Once the code is right, the consent
 * rows go in first and only then the brief with the name and number, onto
 * the account just verified — as `submitContactAction` does, so there is
 * never a number in our database without its agreement beside it (DPDP).
 * A returning customer sends neither.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const g = gate('project');
  if (!g.ok) return g.response;

  const body = (await readJson(req)) as Record<string, unknown> | null;
  const brief = body?.brief === undefined || body.brief === null ? null : briefFromJson(body.brief);
  if (body?.brief && !brief) return fail(400, 'That brief could not be read.');
  const consent = (body?.consent ?? null) as { share?: unknown; offers?: unknown } | null;
  const name = str(body?.name, 80) || (brief?.contactName ?? '');

  const contact = brief
    ? checkContact({ name, phone: str(body?.phone, 20), email: '', agreed: consent?.share === true, whatsappUpdates: consent?.offers === true })
    : null;
  if (contact && !contact.ok) {
    return fail(400, contact.errors.agreed ?? contact.errors.name ?? contact.errors.phone ?? 'Check your details and try again.');
  }

  try {
    const result = await verifyOtp(str(body?.phone, 20), str(body?.code, 12), name || null, {
      userAgent: req.headers.get('user-agent'),
      ip: clientIp(req),
      bearer: true,
    });
    if (!result.ok) return fail(400, verifyOtpMessage(result.reason));
    if (brief && contact?.ok) {
      const owner = { userId: result.userId };
      await recordConsent(contactConsent(contact.value.whatsappUpdates), CONTACT_CONSENT_SOURCE, owner);
      await saveContact(brief, contact.value, owner);
      await record('quiz.contact.saved');
    }
    await record('signin.completed');
    return json({ ok: true, token: result.token });
  } catch (error) {
    console.error('[app-api] verifyOtp threw:', error);
    return fail(503, SIGN_IN_UNAVAILABLE);
  }
}
