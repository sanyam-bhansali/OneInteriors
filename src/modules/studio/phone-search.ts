/**
 * The digits a search box looks for in a phone column (sales walkthrough,
 * 19 Nov 2026). Leads and quotations store a ten-digit mobile
 * ("9876543210"), but people type it as they read it off WhatsApp:
 * "+91 98765 43210", "098765 43210", "+91 98765". Searching the raw digits
 * ("919876543210") found nothing. Pure, so the lead list, the Ctrl K search
 * and the quotations list all peel the same way.
 *
 * Returns null when the query does not carry at least `min` digits.
 */
export function phoneSearchDigits(query: string, min = 4): string | null {
  const raw = String(query ?? '').trim();
  let d = raw.replace(/\D/g, '');
  /* A country code typed with its plus: "+91 98765" is "98765". */
  if (/^\+\s*91/.test(raw)) d = d.slice(2);
  /* A full number with a trunk zero or the code without its plus: the last ten. */
  else if (d.length > 10) d = d.slice(-10);
  return d.length >= min ? d : null;
}
