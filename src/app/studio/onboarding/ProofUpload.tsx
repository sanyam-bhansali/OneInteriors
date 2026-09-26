'use client';

import { useActionState, useRef, useState } from 'react';
import { uploadProofAction, withdrawProofAction, type ProofState } from './actions';
import { Section } from './Section';
import {
  DOCUMENT_KINDS,
  KIND_LABELS,
  STATE_COPY,
  type DocumentKind,
} from '@/modules/studio/document-kinds';
import type { StudioDocumentView } from '@/modules/studio/documents';
import { FileText, UploadCloud } from 'lucide-react';
import { INLINE_ICON, PANEL_ICON } from './icon-sizes';

const INITIAL: ProofState = { status: 'idle' };

/**
 * Send us the certificate.
 *
 * ## It is optional, and says so
 *
 * The step completes without it. That is deliberate and it is the difference
 * between a verification step and a KYC wall: a studio filling this in at
 * nine at night may not have the PDF to hand, and blocking them turns a
 * five-minute errand into a lost evening and sometimes a lost studio. The
 * document is evidence we want, not a gate — we can ask by email, and a
 * GSTIN alone is already checkable against the public register for free.
 *
 * ## Why the drop zone is also a real file input
 *
 * The visible box is a `<label>` wrapped around a hidden `<input type=file>`.
 * Dropping is layered on top with drag events; clicking, tabbing to it and
 * pressing Enter all work because the input underneath is a real one. A
 * div-with-a-click-handler looks the same and is unreachable by keyboard,
 * which on a step about proving legitimacy would be an unkind place to put
 * the only inaccessible control in the product.
 *
 * ## Submitting on drop, rather than after a second button press
 *
 * There is nothing to decide between choosing the file and sending it — the
 * kind is already picked, and a "now press Upload" step is one more place to
 * stop. `requestSubmit`, not `submit`: the latter bypasses the form's own
 * submit handling, which is how a React action ends up never running.
 */
export function ProofUpload({
  documents,
  enabled,
}: {
  documents: StudioDocumentView[];
  enabled: boolean;
}) {
  const [state, action, pending] = useActionState(uploadProofAction, INITIAL);
  const form = useRef<HTMLFormElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const [kind, setKind] = useState<DocumentKind>('GST_CERTIFICATE');

  function send() {
    if (!enabled) return;
    form.current?.requestSubmit();
  }

  return (
    <Section
      n={5}
      title="Business verification"
      optional
      hint="Your GST certificate, Udyam registration, or any document showing the business is registered. A clear photograph is fine."
    >
      {documents.length > 0 ? (
        <ul className="m-0 mb-4 flex list-none flex-col gap-2 p-0">
          {documents.map((doc) => (
            <DocumentRow key={doc.id} doc={doc} />
          ))}
        </ul>
      ) : null}

      {enabled ? (
        <form ref={form} action={action}>
          <div className="mb-3">
            <label htmlFor="kind" className="label m-0 mb-1.5 block">
              What is it?
            </label>
            <select
              id="kind"
              name="kind"
              value={kind}
              onChange={(e) => setKind(e.target.value as DocumentKind)}
              className="oi-input w-full rounded-[11px] border border-[var(--color-rule)] px-4 py-2.5 text-[14.5px] sm:w-auto"
            >
              {DOCUMENT_KINDS.map((k) => (
                <option key={k} value={k}>
                  {KIND_LABELS[k]}
                </option>
              ))}
            </select>
          </div>

          <label
            onDragOver={(e) => {
              e.preventDefault();
              setOver(true);
            }}
            onDragLeave={() => setOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setOver(false);
              const file = e.dataTransfer.files?.[0];
              if (!file || !input.current) return;
              /* A DataTransfer is the only way to put a dropped file into a
                 file input. Assigning `files` directly is read-only in every
                 browser, and without this the drop would appear to work and
                 then post an empty form. */
              const box = new DataTransfer();
              box.items.add(file);
              input.current.files = box.files;
              send();
            }}
            className={`oi-drop flex cursor-pointer flex-col items-center justify-center rounded-[14px] border-2 border-dashed px-6 py-8 text-center ${
              over
                ? 'border-[var(--color-petrol)] bg-[var(--color-petrol-soft)]'
                : 'border-[var(--color-rule)] bg-[var(--color-paper-2)]'
            } ${pending ? 'pointer-events-none opacity-60' : ''}`}
          >
            <input
              ref={input}
              type="file"
              name="proof"
              accept=".pdf,.jpg,.jpeg,.png,.heic,.webp"
              onChange={send}
              className="sr-only"
              disabled={pending}
            />
            <UploadCloud {...PANEL_ICON} />
            <span className="mt-2.5 text-[15px] font-medium text-[var(--color-ink)]">
              {pending ? 'Sending…' : 'Drag a file here'}
            </span>
            <span className="mt-0.5 text-[13.5px] text-[var(--color-ink-2)]">
              {pending ? 'One moment.' : 'or click to choose one'}
            </span>
          </label>

          <div className="mt-2.5 flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
            <p className="m-0 text-[12.5px] text-[var(--color-ink-3)]">PDF, JPG or PNG. Up to 10 MB.</p>
            <p className="m-0 text-[12.5px] text-[var(--color-ink-3)]">
              Read by the person verifying you, and nobody else.
            </p>
          </div>

          {state.status === 'error' ? (
            /* Amber, not red. Nothing has gone wrong with their business —
               they chose a file we cannot read, and the message says which
               file and what to send instead. */
            <p
              role="alert"
              className="m-0 mt-3 rounded-[10px] border border-[var(--color-brass)]/35 bg-[var(--color-brass-soft)] px-4 py-2.5 text-[13.5px] leading-relaxed text-[var(--color-ink)]"
            >
              {state.message}
            </p>
          ) : null}
        </form>
      ) : (
        /* A missing environment variable removes the feature and says so,
           rather than rendering a control that silently cannot work. */
        <p className="m-0 rounded-[11px] bg-[var(--color-paper-2)] px-4 py-3 text-[13.5px] leading-relaxed text-[var(--color-ink-2)]">
          Sending files is not switched on here yet. Email your certificate to{' '}
          <a
            href="mailto:studios@oneinteriors.in"
            className="text-[var(--color-petrol)] underline underline-offset-4"
          >
            studios@oneinteriors.in
          </a>{' '}
          and we will attach it to your file. It does not hold this step up.
        </p>
      )}
    </Section>
  );
}

function DocumentRow({ doc }: { doc: StudioDocumentView }) {
  const [state, action, pending] = useActionState(withdrawProofAction, INITIAL);
  const copy = STATE_COPY[doc.state];

  return (
    <li className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-[11px] border border-[var(--color-rule)] bg-[var(--color-paper-2)] px-4 py-3">
      <FileText {...INLINE_ICON} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[14.5px] text-[var(--color-ink)]">
          {doc.filename}
        </span>
        <span className="block text-[12.5px] text-[var(--color-ink-3)]">
          {KIND_LABELS[doc.kind]} · {kb(doc.bytes)}
        </span>
      </span>

      <span
        className={`rounded-full px-3 py-1 text-[12.5px] font-medium ${
          doc.state === 'ACCEPTED'
            ? 'bg-[var(--color-ontrack-soft)] text-[var(--color-ontrack)]'
            : doc.state === 'REJECTED'
              ? 'bg-[var(--color-brass-soft)] text-[var(--color-brass)]'
              : 'bg-[var(--color-paper-3)] text-[var(--color-ink-2)]'
        }`}
        title={copy.detail}
      >
        {copy.label}
      </span>

      <form action={action}>
        <input type="hidden" name="id" value={doc.id} />
        <button
          type="submit"
          disabled={pending}
          className="text-[13px] text-[var(--color-ink-3)] underline underline-offset-4 hover:text-[var(--color-ink)] disabled:opacity-50"
        >
          {pending ? 'Removing…' : 'Remove'}
        </button>
      </form>

      {/* The note is the whole reason a rejection is useful, so it is shown
          rather than hidden behind the badge's tooltip. */}
      {doc.note ? (
        <p className="m-0 w-full text-[13px] leading-relaxed text-[var(--color-ink-2)]">
          {doc.note}
        </p>
      ) : null}
      {state.status === 'error' ? (
        <p role="alert" className="m-0 w-full text-[13px] text-[var(--color-atrisk)]">
          {state.message}
        </p>
      ) : null}
    </li>
  );
}

/** Rounded to whole units — a file size is a rough sense, not a measurement. */
function kb(bytes: number): string {
  return bytes >= 1024 * 1024
    ? `${(bytes / 1024 / 1024).toFixed(1)} MB`
    : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

