'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { formatINR } from '@/lib/money';
import type { ConvertScreen } from '@/modules/studio-sales/convert';
import { HANDOVER_MAX, HANDOVER_MIN } from '@/modules/studio-sales/convert-rules';
import { Modal } from './ax-ui';
import { convertLeadAction, convertScreenAction } from './convert-actions';

/**
 * Convert (owner, 13 Nov 2026): pick the lead's sales-final quotation and
 * write the handover to design. The project starts on Convert; the design
 * head is told to assign a designer; accounts records the booking advance
 * later. Opened when a lead is dropped on, or picked into, a won column, and
 * from the lead's Converted button.
 */
export function ConvertDialog({
  clientId,
  name,
  stageId = null,
  onClose,
  onDone,
}: {
  clientId: string;
  name: string;
  /** The won column it was dropped on, if any. */
  stageId?: string | null;
  onClose: () => void;
  onDone: (r: { projectId: string; stage: string | null }) => void;
}) {
  const [screen, setScreen] = useState<ConvertScreen | null | 'loading'>('loading');
  const [quoteId, setQuoteId] = useState('');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    convertScreenAction(clientId)
      .then((s) => {
        if (!live) return;
        setScreen(s);
        if (s) {
          setNotes(s.notes);
          const first = s.quotes.find((q) => !q.blocked);
          if (first) setQuoteId(first.quoteId);
        }
      })
      .catch(() => live && setScreen(null));
    return () => {
      live = false;
    };
  }, [clientId]);

  const length = notes.trim().length;
  const ready = screen !== 'loading' && screen !== null && !screen.blocked && quoteId !== '' && length >= HANDOVER_MIN && length <= HANDOVER_MAX;

  async function go() {
    setBusy(true);
    setError(null);
    try {
      const r = await convertLeadAction(clientId, quoteId, notes, stageId);
      if (!r.ok) setError(r.error);
      else onDone({ projectId: r.projectId, stage: r.stage });
    } catch {
      setError('That did not go through. Check your connection and try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal onClose={busy ? () => undefined : onClose} width="min(560px, 94vw)" labelledBy="convert-title">
      <div className="sb" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div>
          <h2 id="convert-title" style={{ margin: 0, fontSize: 17, fontWeight: 600 }}>
            Convert {name}
          </h2>
          <p className="cl-sub" style={{ margin: '4px 0 0' }}>
            Pick the sales-final quotation and write the handover to design. The project starts now, the design head is asked to assign a designer, and accounts records the booking advance.
          </p>
        </div>

        {screen === 'loading' ? <p className="muted">Loading…</p> : null}
        {screen === null ? <p className="cl-err">You cannot convert this lead. Only its salesperson, a project manager or the owner can.</p> : null}

        {screen && screen !== 'loading' ? (
          <>
            {screen.blocked ? <p className="cl-err">{screen.blocked}</p> : null}

            {screen.quotes.length > 0 ? (
              <fieldset style={{ border: 0, padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
                <legend style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>Sales-final quotation</legend>
                {screen.quotes.map((q) => (
                  <label key={q.quoteId} className="hstack" style={{ gap: 8, alignItems: 'baseline', opacity: q.blocked ? 0.6 : 1 }}>
                    <input type="radio" name="convert-quote" value={q.quoteId} checked={quoteId === q.quoteId} disabled={Boolean(q.blocked)} onChange={() => setQuoteId(q.quoteId)} />
                    <span>
                      <b>{q.number}</b> · {q.revision} · {formatINR(q.totalPaise)}
                      {q.blocked ? <span className="muted"> · {q.blocked}</span> : null}{' '}
                      <Link href={`/studio/quotations/${q.quoteId}`} className="underline sm">
                        Open
                      </Link>
                    </span>
                  </label>
                ))}
                {/* Owner, 13 Nov 2026: "if none fits, they revise and mark final". */}
                <p className="muted" style={{ fontSize: 12.5, margin: '2px 0 0' }}>
                  None of these is the one? Open the quotation, revise and send it, mark the new revision as sales final, then convert.
                </p>
              </fieldset>
            ) : null}

            <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span style={{ fontSize: 13, fontWeight: 600 }}>Handover to design</span>
              <span className="muted" style={{ fontSize: 12.5 }}>
                In detail: rooms in scope, style and colours, must-haves, budget comfort, possession and timeline, the family and the site, and anything promised to the client.
              </span>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={9}
                maxLength={HANDOVER_MAX + 200}
                className="fld"
                style={{ resize: 'vertical', minHeight: 160 }}
                aria-describedby="convert-count"
              />
              <span id="convert-count" className="muted" style={{ fontSize: 12, color: length > 0 && length < HANDOVER_MIN ? 'var(--bad)' : undefined }}>
                {length < HANDOVER_MIN ? `${length} / at least ${HANDOVER_MIN} characters` : `${length} characters`}
              </span>
            </label>

            {screen.quotes.length === 0 ? (
              <p className="muted" style={{ fontSize: 12.5, margin: 0 }}>
                <Link href={`/studio/clients/${clientId}`} className="underline">
                  Open the lead
                </Link>{' '}
                to mark a sales final on one of its quotations.
              </p>
            ) : null}
          </>
        ) : null}

        {error ? <p className="cl-err">{error}</p> : null}

        <div className="hstack" style={{ justifyContent: 'flex-end', gap: 8 }}>
          <button type="button" onClick={onClose} disabled={busy} className="btn sec sm">
            Cancel
          </button>
          <button type="button" onClick={go} disabled={!ready || busy} className="btn pri sm">
            {busy ? 'Starting the project…' : 'Convert and start project'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
