/**
 * Project documents (docs/CUSTOMER-PLATFORM-PLAN.md, step 2): the kinds a
 * studio or ops can upload, and how each reads in the customer's Locker.
 * Pure, and tested.
 */

export const DOC_KINDS = {
  AGREEMENT: 'Agreement',
  QUOTATION: 'Signed quotation',
  DRAWINGS: 'Design drawings',
  RECEIPT: 'Payment receipt',
  WARRANTY: 'Warranty or manual',
  OTHER: 'Other',
} as const;

export type DocKind = keyof typeof DOC_KINDS;

export function isDocKind(v: unknown): v is DocKind {
  return typeof v === 'string' && v in DOC_KINDS;
}

export type DocCheck = { ok: true; value: { kind: DocKind; title: string } } | { ok: false; error: string };

/** A kind from the list, and a title — the kind's own name when none is given. */
export function checkDoc(input: { kind: unknown; title: unknown }): DocCheck {
  if (!isDocKind(input.kind)) return { ok: false, error: 'Pick what kind of document it is.' };
  const title = typeof input.title === 'string' ? input.title.trim().replace(/\s+/g, ' ').slice(0, 100) : '';
  return { ok: true, value: { kind: input.kind, title: title || DOC_KINDS[input.kind] } };
}

/** "PDF · 1.2 MB · 3 Aug", the line under a document's name. */
export function docMeta(d: { contentType: string; bytes: number; createdAt: Date }): string {
  const type = d.contentType === 'application/pdf' ? 'PDF' : 'Photo';
  const size = d.bytes >= 1024 * 1024 ? `${(d.bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(d.bytes / 1024))} KB`;
  const day = d.createdAt.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: 'Asia/Kolkata' });
  return `${type} · ${size} · ${day}`;
}
