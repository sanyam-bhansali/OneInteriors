/**
 * The client agreement (owner, 21 Nov 2026; docs/studio-os/CLIENT-AGREEMENT.md),
 * pure and tested (tests/client-agreement.test.ts).
 *
 * Kept apart from the quotation's terms: the studio writes its agreement once
 * (Settings → Client agreement, the same light markup as the terms: "## "
 * title, "### " heading, "* " bullet, "**bold**"), with {{placeholders}} for
 * the client's details. At design closure the studio confirms those details,
 * the agreement is filled, printed to a PDF with the studio's side already
 * signed, and sent to the client to e-sign with Aadhaar. Only the client
 * signs (owner, 21 Nov 2026).
 */

export const AGREEMENT_MAX = 60_000;

/**
 * The placeholders a template may use. `relation` and `pan` are optional and
 * carry their own punctuation, so a blank one leaves no "of ____" behind:
 * "{{client_name}}, {{client_relation}}residing at …" reads "Ankita Shah,
 * daughter of Ramesh Shah, residing at …" or "Ankita Shah, residing at …".
 */
export const PLACEHOLDERS = {
  client_name: 'The client’s full name',
  client_relation: 'Optional: “daughter of Ramesh Shah, ” (with the comma), or nothing',
  client_address: 'The client’s residential address',
  client_pan: 'Optional: “, PAN ABCDE1234F”, or nothing',
  site_address: 'The project site’s address',
  agreement_date: 'The date it is made, e.g. 21 November 2026',
  design_quotation: 'The design quotation’s number',
  studio_signatory: 'Who signs for the studio',
  studio_signatory_role: 'Their designation',
} as const;
export type PlaceholderKey = keyof typeof PLACEHOLDERS;

export interface AgreementFields {
  clientName: string;
  relation: string;
  address: string;
  pan: string;
  siteAddress: string;
  date: string;
}

const clean = (v: unknown, max: number) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max) : '');

const PAN = /^[A-Z]{5}[0-9]{4}[A-Z]$/;

/** The details the studio confirms before sending. */
export function checkAgreementFields(raw: Record<string, unknown>): { ok: true; value: AgreementFields } | { ok: false; error: string } {
  const value: AgreementFields = {
    clientName: clean(raw.clientName, 120),
    relation: clean(raw.relation, 160),
    address: clean(raw.address, 400),
    pan: clean(raw.pan, 10).toUpperCase(),
    siteAddress: clean(raw.siteAddress, 400),
    date: clean(raw.date, 40),
  };
  if (value.clientName.length < 3) return { ok: false, error: 'Write the client’s full name, as on their Aadhaar.' };
  if (value.address.length < 10) return { ok: false, error: 'Write the client’s residential address.' };
  if (value.siteAddress.length < 10) return { ok: false, error: 'Write the project site’s address.' };
  if (value.pan && !PAN.test(value.pan)) return { ok: false, error: 'That PAN does not look right: 5 letters, 4 digits, 1 letter.' };
  if (value.date.length < 6) return { ok: false, error: 'Give the date of the agreement.' };
  return { ok: true, value };
}

/** "21 November 2026" for a Date, in IST. */
export function agreementDate(at: Date): string {
  return at.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Kolkata' });
}

const PLACEHOLDER = /\{\{\s*([a-z_]+)\s*\}\}/g;

/** The placeholders a template uses that this app does not know: a typo the owner should see before a client does. */
export function unknownPlaceholders(template: string): string[] {
  const out = new Set<string>();
  for (const m of template.matchAll(PLACEHOLDER)) if (!(m[1]! in PLACEHOLDERS)) out.add(m[1]!);
  return [...out];
}

/** The template filled. Unknown placeholders are left as written (the editor warns about them). */
export function fillAgreement(
  template: string,
  f: AgreementFields,
  extra: { designQuotation: string | null; signatory: string | null; signatoryRole: string | null },
): string {
  const values: Record<PlaceholderKey, string> = {
    client_name: f.clientName,
    client_relation: f.relation ? `${f.relation.replace(/,\s*$/, '')}, ` : '',
    client_address: f.address,
    client_pan: f.pan ? `, PAN ${f.pan}` : '',
    site_address: f.siteAddress,
    agreement_date: f.date,
    design_quotation: extra.designQuotation ?? '',
    studio_signatory: extra.signatory ?? '',
    studio_signatory_role: extra.signatoryRole ?? '',
  };
  return template.replace(PLACEHOLDER, (whole, key: string) => (key in values ? values[key as PlaceholderKey] : whole));
}

/** May the agreement be sent? The template written, the signatory named, no unknown placeholders. */
export function readyToSend(t: { template: string | null; signatory: string | null }): { ok: true } | { ok: false; error: string } {
  if (!t.template?.trim()) return { ok: false, error: 'Write the client agreement first (Settings → Client agreement).' };
  if (!t.signatory?.trim()) return { ok: false, error: 'Name who signs for the studio first (Settings → Client agreement).' };
  const unknown = unknownPlaceholders(t.template);
  if (unknown.length) return { ok: false, error: `The agreement uses ${unknown.map((u) => `{{${u}}}`).join(', ')}, which the app cannot fill. Fix it in Settings → Client agreement.` };
  return { ok: true };
}

export type AgreementState = 'none' | 'sent' | 'signed';

/** The latest agreement on a project, as the screens show it. */
export function agreementState(rows: readonly { status: string }[]): AgreementState {
  const live = rows.find((r) => r.status !== 'CANCELLED');
  return live ? (live.status === 'SIGNED' ? 'signed' : 'sent') : 'none';
}

/** PDF fonts (standard Helvetica) have no rupee sign: printed as "Rs.". Line breaks are kept: they are the layout. */
export const pdfSafe = (s: string): string =>
  s
    .replace(/\r\n?/g, '\n')
    .replace(/\t/g, '  ')
    .replace(/₹\s?/g, 'Rs. ')
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[^\n\x20-\x7E -ÿ–—…•]/g, '');
