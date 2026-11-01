'use client';

import { useState, useTransition } from 'react';
import type { StudioRequirementForm } from '@/modules/project/requirement-form';
import { sendRequirementFormAction } from './design-actions';

/**
 * The requirement form on the Design tab (walkthrough, 27 Oct 2026; owner,
 * 1 Nov 2026): send it to the client with the mood board (it ticks the
 * step's "send the requirement form" task), see that it waits, and read the
 * answers once they are in. The answers are the client's commitment
 * reference, so they are read only here too.
 */
export function RequirementCard({ form, customerFirst }: { form: StudioRequirementForm; customerFirst: string }) {
  const [pending, start] = useTransition();
  const [said, setSaid] = useState<{ ok: boolean; text: string } | null>(null);
  const send = () =>
    start(async () => {
      const r = await sendRequirementFormAction(form.projectId);
      setSaid(r.ok ? { ok: true, text: r.message } : { ok: false, text: r.error });
    });
  const line =
    form.state === 'filled'
      ? `${customerFirst} filled it in on ${dayWords(form.filledOn!)}. Their answers are the commitment reference: a change after this is said in writing (Chats, a decision).`
      : form.state === 'sent'
        ? `Sent ${dayWords(form.sentOn!)}. Waiting for ${customerFirst} to fill it in the app.`
        : `Not sent yet. Send it with the mood board: ${customerFirst} answers appliances, finishes, budget and commitments in the app (the Google Form, no longer needed).`;
  return (
    <section aria-label="Requirement form" className="card flex flex-col gap-3 p-5" data-testid="requirement-card">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 className="m-0 text-[16px] font-semibold">Requirement form</h2>
        <span className={`chip ${form.state === 'filled' ? 'good' : form.state === 'sent' ? 'warn' : ''}`}>{form.state === 'filled' ? 'Filled' : form.state === 'sent' ? 'Waiting' : 'Not sent'}</span>
      </div>
      <p className="m-0 text-[12.5px] text-[var(--muted)]">{line}</p>
      {form.canSend ? (
        <div>
          <button type="button" className="btn pri sm" disabled={pending} onClick={send}>
            Send to {customerFirst}
          </button>
        </div>
      ) : null}
      {form.answers.length ? (
        <details>
          <summary className="cursor-pointer text-[13px] acc-t">Read the answers</summary>
          <div className="mt-3 flex flex-col gap-4">
            {form.answers.map((s) => (
              <div key={s.title} className="flex flex-col gap-2">
                <h3 className="m-0 text-[14px] font-semibold">{s.title}</h3>
                <dl className="m-0 grid gap-x-4 gap-y-2 text-[13.5px] sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                  {s.rows.map((r) => (
                    <div key={r.label} className="contents">
                      <dt className="text-[var(--muted)]">{r.label}</dt>
                      <dd className="m-0 whitespace-pre-wrap text-[var(--ink)]">{r.answer}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            ))}
          </div>
        </details>
      ) : null}
      {said ? (
        <p role={said.ok ? 'status' : 'alert'} className={`m-0 text-[12.5px] ${said.ok ? 'text-[var(--good)]' : 'text-[var(--bad)]'}`}>
          {said.text}
        </p>
      ) : null}
    </section>
  );
}

const dayWords = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
