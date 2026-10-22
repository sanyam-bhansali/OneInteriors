'use client';

import { useMemo, useState, useTransition } from 'react';
import { parseTerms } from '@/modules/studio-quote/document';
import { DocFrame, TermsBody } from '../doc/QuotationDocument';
import '../doc/quote-doc.css';
import { saveTermsAction } from './actions';

const PLACEHOLDER = `## Terms & Conditions

### 1. Validity & Pricing
- This quotation is valid for 30 days from the date of issue.
- …

### 2. Payment Terms
- …`;

/**
 * Hauspire's /terms: the text on the left, the page as the PDF prints it on
 * the right, one Save. The same field Settings kept (`StudioBranding.terms`),
 * so there is one copy; every new quotation copies it.
 */
export function TermsEditor({ initial, studioName, accentHex, maxLength }: { initial: string; studioName: string; accentHex: string | null; maxLength: number }) {
  const [text, setText] = useState(initial);
  const [saved, setSaved] = useState(initial);
  const [said, setSaid] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const blocks = useMemo(() => parseTerms(text), [text]);
  const dirty = text !== saved;

  function save() {
    start(async () => {
      const r = await saveTermsAction(text);
      if ('ok' in r && r.ok) {
        setSaved(text);
        setSaid({ ok: true, text: 'Saved. Every new quotation starts with these terms.' });
      } else {
        setSaid({ ok: false, text: 'error' in r ? r.error : 'That did not save.' });
      }
    });
  }

  return (
    <>
      <div className="hstack qterms-bar">
        <button type="button" className="btn pri sm" onClick={save} disabled={pending || !dirty}>
          {pending ? 'Saving…' : 'Save'}
        </button>
        <button type="button" className="btn ghost sm" onClick={() => setText(saved)} disabled={pending || !dirty}>
          Undo changes
        </button>
        {said ? (
          <span role={said.ok ? 'status' : 'alert'} className={`sm ${said.ok ? 'good-t' : 'bad-t'}`}>
            {said.text}
          </span>
        ) : dirty ? (
          <span className="sm muted">Not saved yet.</span>
        ) : null}
      </div>

      <div className="qterms-grid">
        <section className="card qterms-edit" aria-label="Edit the terms">
          <span className="eyebrow">Edit</span>
          <textarea
            className="fld mono qterms-text"
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              setSaid(null);
            }}
            maxLength={maxLength}
            spellCheck
            placeholder={PLACEHOLDER}
            aria-label="Terms and conditions"
          />
          <p className="sm muted" style={{ margin: 0, lineHeight: 1.5 }}>
            <b>## Heading</b> and <b>### Section</b> print as headings, a line starting with <b>-</b> or <b>*</b> as a bullet, and <b>**words**</b> in
            bold. A short line ending with a colon is a heading too.
          </p>
        </section>

        <section className="card flush qterms-preview" aria-label="How the PDF prints them">
          <div className="chead">
            <h2>Preview</h2>
            <span className="muted sm">As the quotation PDF prints them</span>
          </div>
          <DocFrame accentHex={accentHex} embedded>
            <div className="qd-sheet qd-terms-preview">
              <div className="qd-runhead">
                <span className="qd-runname">{studioName.toUpperCase()}</span>
                <span className="qd-runlabel">Terms &amp; Conditions</span>
              </div>
              {blocks.length > 0 ? <TermsBody blocks={blocks} /> : <p className="qd-empty">No terms yet: the PDF leaves the page out.</p>}
            </div>
          </DocFrame>
        </section>
      </div>
    </>
  );
}
