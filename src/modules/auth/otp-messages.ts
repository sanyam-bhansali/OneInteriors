/**
 * What a customer reads when a WhatsApp code fails, for the website and the
 * phone app alike. One copy, so the two cannot drift into saying different
 * things about the same refusal.
 */

export const SIGN_IN_UNAVAILABLE =
  'Sign-in is temporarily unavailable. This is our problem, not yours — try again shortly.';

/**
 * The studio sign-in's own refusals. A customer never meets them (only
 * `requestOtp(..., { studio: true })` gives them); the studio page says them
 * in three languages from its own words (app/studio-sign-in/words.ts).
 */
const STUDIO_REFUSAL = {
  not_member: 'This number is not on a studio team. Ask your studio owner to add you from Settings, Team.',
  suspended: 'Your access to this studio is paused. Ask your studio owner.',
} as const;

export function requestOtpMessage(
  reason: 'invalid_phone' | 'invalid_name' | 'rate_limited' | 'cooldown' | 'not_member' | 'suspended',
): string {
  if (reason === 'not_member' || reason === 'suspended') return STUDIO_REFUSAL[reason];
  return reason === 'invalid_phone'
    ? 'That does not look like an Indian mobile number.'
    : reason === 'invalid_name'
      ? 'Please tell us your name.'
      : reason === 'cooldown'
        ? 'Give it a few seconds before asking for another code.'
        : 'Too many codes requested. Try again in fifteen minutes.';
}

export function verifyOtpMessage(
  reason: 'invalid_phone' | 'invalid_code' | 'expired' | 'too_many' | 'not_member' | 'suspended',
): string {
  if (reason === 'not_member' || reason === 'suspended') return STUDIO_REFUSAL[reason];
  return reason === 'expired'
    ? 'That code has expired. Ask for a new one.'
    : reason === 'too_many'
      ? 'Too many wrong attempts. Ask for a new code.'
      : reason === 'invalid_phone'
        ? 'That does not look like an Indian mobile number.'
        : 'That code is not right. Check the message and try again.';
}
