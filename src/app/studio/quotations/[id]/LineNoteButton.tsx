'use client';

import { useEffect, useRef, useState } from 'react';
import { LINE_NOTE_LABEL, LINE_NOTE_MAX, cleanNote } from '@/modules/studio-quote/line-note';

/**
 * A note on one quotation line (owner's team, 15 Oct 2026): "jahan pe bhi
 * notes ki zarurat hai, wahan pe just they can mark notes ... in a dialogue
 * box ... it should be printed with that particular comment".
 *
 * Under the line's details: "+ Note" when it has none; the note itself as a
 * badge when it has one, which opens the same dialog to change or remove it.
 * The note is client-facing (it prints on the quotation PDF and the Final
 * PDF), and is saved with the line on the builder's Save. On a booked or
 * read-only quotation the note shows and cannot be opened.
 */
export function LineNoteButton({
  note,
  product,
  readOnly,
  onChange,
}: {
  note: string | null | undefined;
  product: string;
  readOnly: boolean;
  onChange: (note: string | null) => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const text = note?.trim() ?? '';

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  function start() {
    setDraft(text);
    setOpen(true);
  }

  function save(value: string | null) {
    onChange(cleanNote(value));
    setOpen(false);
  }

  if (readOnly) {
    return text ? (
      <span className="hlinenote ro" title={LINE_NOTE_LABEL}>
        <b>Note:</b> {text}
      </span>
    ) : null;
  }

  return (
    <>
      {text ? (
        <button type="button" className="hlinenote" onClick={start} title="Change the note for the client" aria-label={`Note on ${product}: ${text}. Change it`}>
          <b>Note:</b> {text}
        </button>
      ) : (
        <button type="button" className="hmini ghost hnoteadd" onClick={start} title={LINE_NOTE_LABEL} aria-label={`Add a note for the client on ${product}`}>
          + Note
        </button>
      )}
      <dialog
        ref={ref}
        className="hnotedlg"
        aria-label={`Note on ${product}`}
        onClose={() => setOpen(false)}
        onClick={(e) => {
          /* A click on the backdrop closes without saving. */
          if (e.target === e.currentTarget) setOpen(false);
        }}
      >
        <div>
          <p className="hnotedlg-t">{product}</p>
          <label className="hnotedlg-l">
            {LINE_NOTE_LABEL}
            <textarea
              className="fld"
              rows={4}
              maxLength={LINE_NOTE_MAX}
              value={draft}
              autoFocus
              placeholder="e.g. Handles as per the sample shown on site."
              onChange={(e) => setDraft(e.target.value)}
            />
          </label>
          <p className="muted hnotedlg-h">Saved with the quotation when you save. The client sees it under this line on the PDF.</p>
          <div className="hnotedlg-b">
            {text ? (
              <button type="button" className="btn sec sm" onClick={() => save(null)}>
                Remove note
              </button>
            ) : null}
            <span style={{ flex: 1 }} />
            <button type="button" className="btn sec sm" onClick={() => setOpen(false)}>
              Cancel
            </button>
            <button type="button" className="btn pri sm" onClick={() => save(draft)}>
              Done
            </button>
          </div>
        </div>
      </dialog>
    </>
  );
}
