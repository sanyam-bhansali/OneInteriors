'use client';

import { useState, useTransition } from 'react';
import type { QuoteRow } from '@/modules/studio-quote/quotes';
import { saveClientAction } from '../actions';

/**
 * Who the quotation is for. Read as a line; "Edit" opens the fields, with
 * their own save — correcting a client's name is not part of pricing the job.
 */
export function ClientPanel({ quote }: { quote: QuoteRow }) {
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({
    clientName: quote.clientName,
    clientPhone: quote.clientPhone ?? '',
    clientEmail: quote.clientEmail ?? '',
    society: quote.society ?? '',
    locality: quote.locality ?? '',
    config: quote.config ?? '',
    carpet: quote.carpetSqft ? String(quote.carpetSqft) : '',
  });
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });

  function save() {
    setError(null);
    const carpet = Number(f.carpet);
    start(async () => {
      const r = await saveClientAction(quote.id, {
        clientName: f.clientName,
        clientPhone: f.clientPhone,
        clientEmail: f.clientEmail,
        society: f.society,
        locality: f.locality,
        config: f.config,
        carpetSqft: f.carpet.trim() && Number.isFinite(carpet) ? Math.round(carpet) : null,
      });
      if (r && 'ok' in r && !r.ok) setError(r.error);
      else setOpen(false);
    });
  }

  return (
    <section className="card" aria-label="Who it is for">
      <div className="chead">
        <h2>For</h2>
        <button type="button" onClick={() => setOpen(!open)} className="btn ghost sm">
          {open ? 'Close' : 'Edit'}
        </button>
      </div>
      {open ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <input value={f.clientName} onChange={set('clientName')} placeholder="Name" aria-label="Client name" className="fld" />
          <div className="hstack" style={{ gap: 8, flexWrap: 'nowrap' }}>
            <input value={f.clientPhone} onChange={set('clientPhone')} placeholder="Phone" aria-label="Phone" inputMode="tel" className="fld" style={{ flex: 1, minWidth: 0 }} />
            <input value={f.config} onChange={set('config')} placeholder="3 BHK" aria-label="Configuration" className="fld" style={{ width: '6rem', flex: 'none' }} />
          </div>
          <input value={f.clientEmail} onChange={set('clientEmail')} placeholder="Email" aria-label="Email" inputMode="email" className="fld" />
          <input value={f.society} onChange={set('society')} placeholder="Society, flat number" aria-label="Society" className="fld" />
          <div className="hstack" style={{ gap: 8, flexWrap: 'nowrap' }}>
            <input value={f.locality} onChange={set('locality')} placeholder="Area" aria-label="Area" className="fld" style={{ flex: 1, minWidth: 0 }} />
            <input value={f.carpet} onChange={set('carpet')} placeholder="sq ft" aria-label="Carpet sq ft" inputMode="numeric" className="fld num" style={{ width: '6rem', flex: 'none' }} />
          </div>
          <button
            type="button"
            disabled={pending}
            onClick={save}
            className="btn pri"
          >
            {pending ? 'Saving…' : 'Save details'}
          </button>
          {error ? <p className="qerr">{error}</p> : null}
        </div>
      ) : (
        <p style={{ margin: 0, lineHeight: 1.4 }}>
          <b style={{ fontWeight: 600 }}>{quote.clientName}</b>
          <span className="muted sm" style={{ display: 'block' }}>
            {[quote.clientPhone, quote.society, quote.locality, quote.config].filter(Boolean).join(' · ') || 'No details yet'}
          </span>
        </p>
      )}
    </section>
  );
}
