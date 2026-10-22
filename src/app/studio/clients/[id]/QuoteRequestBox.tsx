'use client';

/**
 * The lead page's quotation request (owner, 22 Oct 2026; docs/studio-os/
 * QUOTE-REQUESTS.md): "Quotation being built by Khushi", and the buttons
 * the person looking may press — Request quotation (handed to whoever
 * builds quotations next in turn), or for a head, hand it over or cancel.
 */

import Link from 'next/link';
import { useState } from 'react';
import type { LeadRequestState } from '@/modules/studio-quote/quote-requests';
import { Said, useAct } from '../../SalesUi';
import { requestQuotationAction } from '../../quotations/requests/actions';
import { FinishRequest, ReassignRequest } from '../../quotations/requests/RequestControls';

export function QuoteRequestBox({ clientId, state, meId }: { clientId: string; state: LeadRequestState; meId: string | null }) {
  const act = useAct();
  const [asking, setAsking] = useState(false);
  const [note, setNote] = useState('');
  const r = state.request;
  const active = r !== null && (r.status === 'OPEN' || r.status === 'IN_PROGRESS');
  const mine = active && r.assignedToId !== null && r.assignedToId === meId;

  /* Nothing to say and nothing to press: stay out of the way. */
  if (!r && !state.may.request) return null;

  return (
    <section className="card" aria-label="Quotation request" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div className="hstack" style={{ justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
        <span style={{ fontWeight: active ? 600 : 400 }}>
          {r ? r.line : 'No quotation requested yet.'}
          {active ? <span className="muted sm"> · waiting {r.waiting}</span> : null}
        </span>
        <span className="hstack" style={{ gap: 6 }}>
          {mine ? (
            <Link href="/studio/quotations/requests" className="btn pri sm">
              To build →
            </Link>
          ) : null}
          {state.may.request && !asking ? (
            <button type="button" className="btn sec sm" onClick={() => setAsking(true)}>
              Request quotation
            </button>
          ) : null}
        </span>
      </div>

      {asking ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            act.run(
              () => requestQuotationAction(clientId, note),
              (res) => {
                if (res.ok) {
                  setAsking(false);
                  setNote('');
                }
              },
            );
          }}
          style={{ display: 'flex', flexDirection: 'column', gap: 6 }}
        >
          <label className="muted sm" htmlFor="rq-note">
            Anything the person building it should know (optional)
          </label>
          <input id="rq-note" className="fld" value={note} maxLength={300} onChange={(e) => setNote(e.target.value)} placeholder="Wants a lighter kitchen, budget near 8 lakh" />
          <span className="hstack" style={{ gap: 6 }}>
            <button type="submit" className="btn pri sm" disabled={act.pending}>
              {act.pending ? 'Asking…' : 'Request quotation'}
            </button>
            <button type="button" className="btn sec sm" onClick={() => setAsking(false)} disabled={act.pending}>
              Not now
            </button>
          </span>
          <span className="muted sm">It goes to whoever builds quotations next in turn, and they are told.</span>
        </form>
      ) : null}
      <Said result={act.result} />

      {active && (state.may.reassign || state.may.cancel || (state.may.done && !mine)) ? (
        <div className="hstack" style={{ gap: 8, flexWrap: 'wrap', alignItems: 'flex-start' }}>
          {state.may.reassign || state.may.cancel ? (
            <ReassignRequest
              requestId={r.id}
              clientId={clientId}
              currentId={r.assignedToId}
              builders={state.builders}
              reassign={state.may.reassign}
              allowCancel={state.may.cancel}
            />
          ) : null}
          {state.may.done && state.may.reassign ? <FinishRequest requestId={r.id} clientId={clientId} /> : null}
        </div>
      ) : null}
    </section>
  );
}
