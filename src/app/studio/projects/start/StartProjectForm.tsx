'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { formatINR } from '@/lib/money';
import { startOwnProjectAction } from './actions';

/**
 * The short form: which quotation, when work starts, and the client's
 * mobile number. Nothing is retyped — picking a quotation fills the client's
 * name, number and email from the client record (or the quotation), and the
 * date is today. The handover days are the studio's own whole-home figure,
 * under "Change the handover".
 */

type Quote = {
  id: string;
  number: string;
  status: 'ISSUED' | 'ACCEPTED';
  client: string;
  customer: { name: string; phone: string; email: string };
  home: string | null;
  totalPaise: number;
  date: string;
  defaultDays: number;
};

const field = 's-input w-full';
const label = 'mb-1 block text-[13.5px] font-semibold text-[var(--s-ink-2)]';
const hint = 'm-0 mt-1 text-[12.5px] text-[var(--s-ink-3)]';

const day = (iso: string) => new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' });

export function StartProjectForm({ quotes, initialQuoteId, today }: { quotes: Quote[]; initialQuoteId: string; today: string }) {
  const router = useRouter();
  const first = quotes.find((q) => q.id === initialQuoteId) ?? quotes[0]!;
  const [quoteId, setQuoteId] = useState(first.id);
  const [startOn, setStartOn] = useState(today);
  const [days, setDays] = useState(String(first.defaultDays));
  const [showDays, setShowDays] = useState(false);
  const [name, setName] = useState(first.customer.name);
  const [phone, setPhone] = useState(first.customer.phone);
  const [email, setEmail] = useState(first.customer.email);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const chosen = quotes.find((q) => q.id === quoteId) ?? first;

  const pick = (q: Quote) => {
    setQuoteId(q.id);
    setName(q.customer.name);
    setPhone(q.customer.phone);
    setEmail(q.customer.email);
    setDays(String(q.defaultDays));
    setError(null);
  };

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    start(async () => {
      const r = await startOwnProjectAction(form);
      if (r.ok) router.push(`/studio/projects/${r.projectId}?started=1`);
      else setError(r.error);
    });
  };

  return (
    <form onSubmit={submit} className="grid max-w-[980px] items-start gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
      <fieldset className="m-0 min-w-0 border-0 p-0">
        <legend className="mb-2 text-[16px] font-semibold">1. The quotation your client accepted</legend>
        <ul className="m-0 flex list-none flex-col gap-2 p-0">
          {quotes.map((q) => (
            <li key={q.id}>
              <label
                className={`s-card flex cursor-pointer items-start gap-3 p-3.5 ${q.id === quoteId ? '!border-[var(--s-accent)]' : ''}`}
                style={q.id === quoteId ? { boxShadow: 'inset 3px 0 0 var(--s-accent), var(--s-lift)' } : undefined}
              >
                <input type="radio" name="quoteId" value={q.id} checked={q.id === quoteId} onChange={() => pick(q)} className="mt-1" />
                <span className="flex min-w-0 flex-1 flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                  <span className="min-w-0">
                    <span className="block text-[15px] font-semibold">{q.client}</span>
                    <span className="block text-[13px] text-[var(--s-ink-3)]">
                      <span className="s-num">{q.number}</span>
                      {q.home ? ` · ${q.home}` : ''} · {day(q.date)} · {q.status === 'ACCEPTED' ? 'Won' : 'Sent'}
                    </span>
                  </span>
                  <span className="s-num font-[family-name:var(--font-mono)] text-[14.5px]">{formatINR(q.totalPaise)}</span>
                </span>
              </label>
            </li>
          ))}
        </ul>
        {chosen.status === 'ISSUED' ? <p className={hint}>Starting the project marks this quotation as won.</p> : null}
      </fieldset>

      <div className="s-card flex flex-col gap-4 p-5">
        <h2 className="m-0 text-[16px] font-semibold">2. Start date and your client</h2>
        <div>
          <label htmlFor="startOn" className={label}>
            Work starts on
          </label>
          <input id="startOn" name="startOn" type="date" required value={startOn} onChange={(e) => setStartOn(e.target.value)} className={field} />
          {showDays ? (
            <div className="mt-3">
              <label htmlFor="totalDays" className={label}>
                Handover after (days)
              </label>
              <input id="totalDays" name="totalDays" type="number" min={7} max={730} required value={days} onChange={(e) => setDays(e.target.value)} className={field} />
            </div>
          ) : (
            <p className={hint}>
              Handover in {days} days.{' '}
              <button type="button" onClick={() => setShowDays(true)} className="text-[12.5px] text-[var(--s-accent)] underline">
                Change the handover
              </button>
              <input type="hidden" name="totalDays" value={days} />
            </p>
          )}
        </div>
        <div>
          <label htmlFor="name" className={label}>
            Client&rsquo;s name
          </label>
          <input id="name" name="name" required minLength={2} maxLength={80} value={name} onChange={(e) => setName(e.target.value)} className={field} autoComplete="off" />
        </div>
        <div>
          <label htmlFor="phone" className={label}>
            Client&rsquo;s mobile
          </label>
          <input
            id="phone"
            name="phone"
            type="tel"
            inputMode="tel"
            required
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className={field}
            placeholder="98xxx xxxxx"
            autoComplete="off"
          />
          <p className={hint}>They sign in to the app with this number.</p>
        </div>
        <div>
          <label htmlFor="email" className={label}>
            Email <span className="font-normal text-[var(--s-ink-3)]">(optional)</span>
          </label>
          <input id="email" name="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={field} autoComplete="off" />
        </div>
        {error ? (
          <p role="alert" className="m-0 text-[13.5px] text-[var(--s-bad)]">
            {error}
          </p>
        ) : null}
        <button
          type="submit"
          disabled={pending}
          className="rounded-[8px] bg-[var(--s-accent)] px-4 py-2.5 text-[15px] font-medium text-white hover:bg-[var(--s-accent-deep)] disabled:opacity-40"
        >
          {pending ? 'Starting…' : 'Start project'}
        </button>
        <p className={hint}>
          {name.trim().split(/\s+/)[0] || 'Your client'} gets a link to follow the project in the One Interiors app. You can share it yourself too.
        </p>
      </div>
    </form>
  );
}
