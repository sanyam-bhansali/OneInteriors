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
  if (d.contentType === DECISION_CONTENT_TYPE) {
    return `Your choice · ${d.createdAt.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: 'Asia/Kolkata' })}`;
  }
  if (d.contentType === FILED_CONTENT_TYPE) {
    return `Filed at signing · ${d.createdAt.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: 'Asia/Kolkata' })}`;
  }
  const type = d.contentType === 'application/pdf' ? 'PDF' : 'Photo';
  const size = d.bytes >= 1024 * 1024 ? `${(d.bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(d.bytes / 1024))} KB`;
  const day = d.createdAt.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: 'Asia/Kolkata' });
  return `${type} · ${size} · ${day}`;
}

// ── Documents filed at signing ─────────────────────────────────

/**
 * What signing files in the Locker (studio workspace Phase 1): the agreement
 * and the final quote. Neither is a stored file. The website's Sign step
 * agrees to the signed quote — its lines, total, timeline and payment
 * stages — and the studio's own terms, and all of that is the signed
 * quotation itself (`StudioQuote`, ACCEPTED, with its `terms`), which the
 * customer can already open at /app/choose/quote/<id>. So both documents are
 * records pointing at that page, the agreement opening it at the terms:
 * nothing is copied, so nothing can disagree with what was signed.
 *
 * Their `storageKey` says so (`signed-quote:<quoteId>#agreement`), and
 * `generatedDocLink` turns it into the page link wherever a stored file
 * would get a signed storage link (storage/project-docs.ts `signedDocUrls`).
 */
export const SIGNED_QUOTE_PREFIX = 'signed-quote:';

/** The content type of a filed document: a page, not a file. */
export const FILED_CONTENT_TYPE = 'text/html';

export type FiledKind = 'AGREEMENT' | 'QUOTATION';

export function signedQuoteDocKey(quoteId: string, kind: FiledKind): string {
  return `${SIGNED_QUOTE_PREFIX}${quoteId}#${kind.toLowerCase()}`;
}

/** The documents signing files, ready for `homeDocument.create` minus the project and who filed it. */
export function signedQuoteDocs(quoteId: string, quoteNumber: string): { kind: FiledKind; title: string; storageKey: string; originalName: string }[] {
  return [
    { kind: 'AGREEMENT', title: 'Agreement', storageKey: signedQuoteDocKey(quoteId, 'AGREEMENT'), originalName: `Agreement for quotation ${quoteNumber}` },
    { kind: 'QUOTATION', title: `Signed quotation ${quoteNumber}`.slice(0, 100), storageKey: signedQuoteDocKey(quoteId, 'QUOTATION'), originalName: `Quotation ${quoteNumber}` },
  ];
}

/**
 * The page a filed (not uploaded) document opens, below `origin`; null for a
 * stored file, which gets a signed storage link instead.
 */
export function generatedDocLink(storageKey: string, origin: string): string | null {
  /* A signed copy of a quotation (project/signoff-rules.ts): the page that shows the revision and the signature. */
  if (storageKey.startsWith('signoff:')) {
    const id = storageKey.slice('signoff:'.length);
    return /^[A-Za-z0-9_-]{1,64}$/.test(id) ? `${origin.replace(/\/$/, '')}/app/signoff/${id}` : null;
  }
  if (storageKey.startsWith(DECISION_PREFIX)) {
    const decisionId = storageKey.slice(DECISION_PREFIX.length);
    return /^[A-Za-z0-9_-]{1,64}$/.test(decisionId) ? `${origin.replace(/\/$/, '')}/app/decision?id=${decisionId}` : null;
  }
  if (!storageKey.startsWith(SIGNED_QUOTE_PREFIX)) return null;
  const [id, kind] = storageKey.slice(SIGNED_QUOTE_PREFIX.length).split('#');
  if (!id || !/^[A-Za-z0-9_-]{1,64}$/.test(id)) return null;
  return `${origin.replace(/\/$/, '')}/app/choose/quote/${id}${kind === 'agreement' ? '#agreed' : ''}`;
}

// ── Decision outcomes (studio workspace Phase 5) ───────────────

/**
 * A decision's outcome, filed in the locker when the customer picks
 * (project/decision-flow.ts): a record pointing at the decision
 * (`decision:<id>`), opened as the decision page, like the signed quote
 * above. A re-pick files a new version superseding it.
 */
export const DECISION_PREFIX = 'decision:';

/** The content type of a filed decision outcome. */
export const DECISION_CONTENT_TYPE = 'application/x-decision';
