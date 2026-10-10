'use client';

import { useState, useTransition } from 'react';
import type { QuoteRow } from '@/modules/studio-quote/quotes';
import { saveClientAction } from '../actions';

const field =
  'rounded-[8px] border border-[var(--s-rule)] bg-[var(--s-surface)] px-2.5 py-2 text-[13.5px] outline-none focus:border-[var(--s-accent)]';

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
    <section className="s-card p-4">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="s-label m-0">For</h2>
        <button type="button" onClick={() => setOpen(!open)} className="text-[12.5px] text-[var(--s-accent)]">
          {open ? 'Close' : 'Edit'}
        </button>
      </div>
      {open ? (
        <div className="mt-3 flex flex-col gap-2.5">
          <input value={f.clientName} onChange={set('clientName')} placeholder="Name" aria-label="Client name" className={field} />
          <div className="flex gap-2">
            <input value={f.clientPhone} onChange={set('clientPhone')} placeholder="Phone" aria-label="Phone" inputMode="tel" className={`${field} min-w-0 flex-1`} />
            <input value={f.config} onChange={set('config')} placeholder="3 BHK" aria-label="Configuration" className={`${field} w-[5.5rem]`} />
          </div>
          <input value={f.clientEmail} onChange={set('clientEmail')} placeholder="Email" aria-label="Email" inputMode="email" className={field} />
          <input value={f.society} onChange={set('society')} placeholder="Society, flat number" aria-label="Society" className={field} />
          <div className="flex gap-2">
            <input value={f.locality} onChange={set('locality')} placeholder="Area" aria-label="Area" className={`${field} min-w-0 flex-1`} />
            <input value={f.carpet} onChange={set('carpet')} placeholder="sq ft" aria-label="Carpet sq ft" inputMode="numeric" className={`${field} s-num w-[5.5rem] text-right`} />
          </div>
          <button
            type="button"
            disabled={pending}
            onClick={save}
            className="rounded-[8px] bg-[var(--s-accent)] px-4 py-2 text-[13.5px] font-medium text-white disabled:opacity-40"
          >
            {pending ? 'Saving…' : 'Save details'}
          </button>
          {error ? <p className="m-0 text-[12.5px] text-[var(--s-bad)]">{error}</p> : null}
        </div>
      ) : (
        <p className="m-0 mt-1 text-[13.5px] leading-snug">
          <span className="font-medium">{quote.clientName}</span>
          <span className="block text-[12.5px] text-[var(--s-ink-3)]">
            {[quote.clientPhone, quote.society, quote.locality, quote.config].filter(Boolean).join(' · ') || 'No details yet'}
          </span>
        </p>
      )}
    </section>
  );
}
