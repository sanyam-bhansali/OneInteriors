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
  // Indian mobile numbers begin 6-9. A leading 0 is an STD landline prefix.
  if (digits.length === 10 && /^[6-9]/.test(digits)) return `+91${digits}`;
  if (digits.length === 12 && digits.startsWith('91') && /^[6-9]/.test(digits.slice(2))) {
    return `+${digits}`;
  }
  if (digits.length === 13 && digits.startsWith('091') && /^[6-9]/.test(digits.slice(3))) {
    return `+${digits.slice(1)}`;
  }
  return null;
}
