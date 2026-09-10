/**
 * OTP code generation and shape, pure so it can be tested.
 *
 * `otp.ts` carries `server-only` because it touches Postgres and the session
 * cookie; this half must not, or none of it is reachable from Vitest. See
 * CONTRIBUTING §9.5.
 */

/**
 * Six digits.
 *
 * Not four: four digits is 10,000 possibilities, and with the five attempts we
 * allow per challenge plus a few resends, a determined guesser gets a
 * meaningful chance at a specific number. Six is a million, which with the same
 * limits is not worth anyone's time.
 *
 * Not eight or more, and not alphanumeric: this gets read off a WhatsApp
 * notification and typed on a phone keypad, often by someone in their fifties
 * furnishing a new flat. Every extra character is real drop-off, and the
 * defence here is the attempt limit rather than the length.
 */
export const OTP_LENGTH = 6;

const SHAPE = /^\d{6}$/;

/**
 * Generate a code from a caller-supplied source of randomness.
 *
 * Takes the random bytes rather than calling `crypto` itself so the module
 * stays pure and the tests can pin exact outputs. `otp.ts` passes
 * `randomBytes` from node:crypto — never `Math.random`, which is seeded and
 * predictable and has no business anywhere near an authentication code.
 */
export function codeFromBytes(bytes: Uint8Array): string {
  if (bytes.length < 4) {
    throw new Error('Need at least 4 bytes of entropy for an OTP.');
  }

  // Assemble a 32-bit unsigned integer, then take it modulo 10^6.
  //
  // The modulo introduces a bias: 2^32 is not a multiple of 1,000,000, so the
  // low codes are very slightly more likely. The excess is about 0.0002% —
  // roughly one part in 4,000 of a code's probability — which is far below
  // anything an attacker limited to five guesses could exploit. Rejection
  // sampling would remove it and is not worth the extra failure mode here.
  const n =
    ((bytes[0] << 24) >>> 0) + (bytes[1] << 16) + (bytes[2] << 8) + bytes[3];

  return String(n % 1_000_000).padStart(OTP_LENGTH, '0');
}

/**
 * Is this string shaped like a code?
 *
 * Runs before any database work, so a field full of letters or a 400-character
 * paste never becomes a query. Digits only — no whitespace tolerance here,
 * because `cleanCode` below is what handles the messy input.
 */
export function isOtpShape(value: string | null | undefined): boolean {
  if (!value) return false;
  return SHAPE.test(value);
}

/**
 * Tidy what someone actually typed or pasted.
 *
 * People paste the code with the surrounding message, type it with a space in
 * the middle, or let a keyboard insert a non-breaking space. Rejecting those
 * as "wrong code" is infuriating and produces support calls about a system
 * that is working correctly.
 *
 * Anything that is not a digit is dropped, then the FIRST six digits are
 * taken — pasting "Your code is 481920, valid for 10 minutes" yields 481920
 * rather than a mangled run of every digit in the sentence.
 */
export function cleanCode(raw: string): string {
  const digits = (raw ?? '').replace(/\D/g, '');
  return digits.slice(0, OTP_LENGTH);
}

/**
 * The name we ask for alongside the number.
 *
 * Kept deliberately permissive. Indian names carry initials, full stops and
 * multiple spaces, and a validator that insists on two words or rejects
 * punctuation will reject real people — which at this point in the funnel
 * means losing someone who has already answered nine questions. We are asking
 * so an expert can open a call with the right name, not to verify identity.
 */
export function cleanName(raw: string): string {
  return (raw ?? '').replace(/\s+/g, ' ').trim().slice(0, 80);
}

export function isValidName(raw: string): boolean {
  const name = cleanName(raw);
  // Two characters, and at least one letter — enough to reject "." and "12"
  // without adjudicating what a name may contain.
  return name.length >= 2 && /\p{L}/u.test(name);
}
