/**
 * What a customer reads when a WhatsApp code fails, for the website and the
 * phone app alike. One copy, so the two cannot drift into saying different
 * things about the same refusal.
 */

export const SIGN_IN_UNAVAILABLE =
  'Sign-in is temporarily unavailable. This is our problem, not yours — try again shortly.';

export function requestOtpMessage(
  reason: 'invalid_phone' | 'invalid_name' | 'rate_limited' | 'cooldown',
): string {
  return reason === 'invalid_phone'
    ? 'That does not look like an Indian mobile number.'
    : reason === 'invalid_name'
      ? 'Please tell us your name.'
      : reason === 'cooldown'
        ? 'Give it a few seconds before asking for another code.'
        : 'Too many codes requested. Try again in fifteen minutes.';
}

export function verifyOtpMessage(
  reason: 'invalid_phone' | 'invalid_code' | 'expired' | 'too_many',
): string {
  return reason === 'expired'
    ? 'That code has expired. Ask for a new one.'
    : reason === 'too_many'
      ? 'Too many wrong attempts. Ask for a new code.'
      : reason === 'invalid_phone'
        ? 'That does not look like an Indian mobile number.'
        : 'That code is not right. Check the message and try again.';
}
