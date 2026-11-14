/**
 * The title before the client's name on a quotation (owner, 14 Nov 2026:
 * "give a prefix drop down mr mrs miss"). Pure, used by the browser and the
 * server (tests/studio-client-title.test.ts).
 *
 * The title goes on the QUOTATION's client name ("Mrs Kothari"), not on the
 * lead: the lead keeps the plain name, so search and the board are unchanged.
 */

export const CLIENT_TITLES = ['Mr', 'Mrs', 'Miss'] as const;
export type ClientTitle = (typeof CLIENT_TITLES)[number];

const LEADING = /^(mr|mrs|miss|ms|dr)\.?\s+/i;

export function asClientTitle(raw: unknown): ClientTitle | null {
  return typeof raw === 'string' ? (CLIENT_TITLES.find((t) => t.toLowerCase() === raw.trim().replace(/\.$/, '').toLowerCase()) ?? null) : null;
}

/** The title a name starts with ("Mrs Asha Patil" → "Mrs"), or '' (the Full builder's dropdown reads it back). */
export function titleOf(name: string): ClientTitle | '' {
  const m = /^(mr|mrs|miss)\.?\s+/i.exec(name.trim());
  return m ? (asClientTitle(m[1]) ?? '') : '';
}

/** The name with any title taken off the front. */
export function withoutTitle(name: string): string {
  return name.trim().replace(/\s+/g, ' ').replace(LEADING, '');
}

/** "Mrs" + "Asha Patil" → "Mrs Asha Patil". A title already typed in the name is replaced, never doubled. No title: the name as typed. */
export function withTitle(title: unknown, name: string): string {
  const t = asClientTitle(title);
  const plain = name.trim().replace(/\s+/g, ' ');
  if (!t) return plain;
  return `${t} ${plain.replace(LEADING, '')}`.trim();
}
