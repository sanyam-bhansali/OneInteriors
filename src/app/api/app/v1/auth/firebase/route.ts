import { firebaseSignInMessage, signInWithFirebasePhone } from '@/modules/auth/firebase-phone';
import { SIGN_IN_UNAVAILABLE } from '@/modules/auth/otp-messages';
import { record } from '@/modules/analytics/record';
import { briefFromJson } from '@/modules/brief/from-json';
import { checkContact } from '@/modules/brief/contact';
import { saveContact } from '@/modules/brief/repository';
import { recordConsent } from '@/modules/consent/record';
import { CONTACT_CONSENT_SOURCE, contactConsent } from '@/modules/consent/policy';
import { clientIp, fail, gate, json, readJson, str } from '@/modules/app-api/http';

/**
 * POST /api/app/v1/auth/firebase — { idToken, name?, brief?, consent? } → { token }.
 *
 * The phone app's sign-in once Firebase sends the SMS (owner, 4 Nov 2026).
 * The app proves the number with Firebase and sends us the ID token; we check
 * it and return one of our own sessions, the same as /auth/otp/verify. The
 * brief and consent rules are that route's, word for word: consent is checked
 * before anything is written, and saved before the brief.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const g = gate('project');
  if (!g.ok) return g.response;

  const body = (await readJson(req)) as Record<string, unknown> | null;
  const idToken = str(body?.idToken, 4096);
  if (!idToken) return fail(400, 'Ask for a new code and try again.');
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
    const result = await signInWithFirebasePhone(idToken, name || null, {
      userAgent: req.headers.get('user-agent'),
      ip: clientIp(req),
      bearer: true,
    });
    if (!result.ok) return fail(400, firebaseSignInMessage(result.reason));

    if (brief && contact?.ok) {
      const owner = { userId: result.userId };
      await recordConsent(contactConsent(contact.value.whatsappUpdates), CONTACT_CONSENT_SOURCE, owner);
      await saveContact(brief, contact.value, owner);
      await record('quiz.contact.saved');
    }
    await record('signin.completed');
    return json({ ok: true, token: result.token });
  } catch (error) {
    console.error('[app-api] firebase sign-in threw:', error);
    return fail(503, SIGN_IN_UNAVAILABLE);
  }
}
