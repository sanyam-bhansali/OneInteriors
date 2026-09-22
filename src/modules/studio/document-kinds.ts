/**
 * What a studio can send as proof, and what happens to it afterwards.
 *
 * Pure — no database, no `server-only` — so the form can import the labels
 * and the tests can assert the vocabulary without a connection. See
 * CONTRIBUTING §9.5.
 *
 * ## Why these are strings rather than a Postgres enum
 *
 * `StudioDocument.kind` and `.state` are plain text columns. The list of
 * things a studio might send grows every time somebody sends something
 * sensible we had not thought of, and every addition to a database enum is a
 * migration that must ship *before* the code that writes the value — which
 * makes the cheap change the slow one. This file is the authority instead,
 * and it is the thing to read before writing either column.
 */

export const DOCUMENT_KINDS = ['GST_CERTIFICATE', 'UDYAM', 'SHOP_LICENCE', 'OTHER'] as const;

export type DocumentKind = (typeof DOCUMENT_KINDS)[number];

export const KIND_LABELS: Record<DocumentKind, string> = {
  GST_CERTIFICATE: 'GST certificate',
  UDYAM: 'Udyam registration',
  SHOP_LICENCE: 'Shop & establishment licence',
  OTHER: 'Other business proof',
};

export function isDocumentKind(value: string): value is DocumentKind {
  return (DOCUMENT_KINDS as readonly string[]).includes(value);
}

/**
 * Where a document is in its life.
 *
 * `RECEIVED` and not `PENDING`. "Pending" describes a queue and implies a
 * position in one, which is a promise about timing we are not making. "We
 * have it" is the whole of what is true the moment it lands, and it is also
 * the thing the studio wants to know.
 */
export const DOCUMENT_STATES = ['RECEIVED', 'ACCEPTED', 'REJECTED'] as const;

export type DocumentState = (typeof DOCUMENT_STATES)[number];

/**
 * What the studio is told, in their words rather than ours.
 *
 * Note that `ACCEPTED` deliberately does not say "verified". Accepting a
 * document means a person opened it and it is the right document; the
 * verification tier is a separate judgement made from several checks, and
 * conflating them would have a studio believe one upload had made them a
 * verified practice.
 */
export const STATE_COPY: Record<DocumentState, { label: string; detail: string }> = {
  RECEIVED: {
    label: 'With us',
    detail: 'Nobody has opened it yet. We will look at it as part of your verification.',
  },
  ACCEPTED: {
    label: 'Accepted',
    detail: 'We have read it and it is the right document. It counts toward your verification.',
  },
  REJECTED: {
    label: 'Needs another',
    detail: 'We could not use this one. The note says why.',
  },
};
