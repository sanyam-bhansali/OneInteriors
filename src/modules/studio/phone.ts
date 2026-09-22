/**
 * Indian mobile normalisation. Pure — no server-only imports — so it can be
 * tested directly and reused on the client for inline validation.
 *
 * People type their number six different ways; we store one shape (E.164) so
 * that "have we already got this studio?" is a string comparison rather than a
 * judgement call.
 */
export function normalisePhone(raw: string): string | null {
  const digits = (raw ?? '').replace(/\D/g, '');

  // Indian mobile numbers begin 6-9.
  if (digits.length === 10 && /^[6-9]/.test(digits)) return `+91${digits}`;

  /**
   * Eleven digits with a leading zero: `09876543210`.
   *
   * This was rejected, and it is one of the two commonest ways an Indian
   * writes a mobile — the habit is left over from STD dialling and it is on
   * a great many business cards. A studio typing their own number correctly
   * got "A 10-digit Indian mobile number, please", which reads as an
   * accusation, and the applications we lost to it never reached anybody to
   * be counted.
   *
   * Dropping ONE zero and re-testing is deliberately narrow: `020 2567 8900`
   * is also eleven digits with a leading zero, and it is a Pune landline. It
   * strips to `2025678900`, fails the 6-9 rule, and is still refused — which
   * is right, because nothing can send an SMS to it.
   *
   * `capture-fields.ts` has a second `normalisePhone` which has always
   * accepted this form. Two implementations of one rule, disagreeing about
   * which real numbers exist, is the actual defect here; this closes the gap
   * on the side that was losing applications. They should be one function.
   */
  if (digits.length === 11 && digits.startsWith('0') && /^[6-9]/.test(digits.slice(1))) {
    return `+91${digits.slice(1)}`;
  }

  if (digits.length === 12 && digits.startsWith('91') && /^[6-9]/.test(digits.slice(2))) {
    return `+${digits}`;
  }
  if (digits.length === 13 && digits.startsWith('091') && /^[6-9]/.test(digits.slice(3))) {
    return `+${digits.slice(1)}`;
  }
  return null;
}
