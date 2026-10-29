'use client';

/**
 * Client sign-off on the project (owner, 15 Oct 2026; project/signoffs.ts):
 * the sales final (BOQ), the agreement (27 Oct 2026: hidden from the client
 * until asked) and the design final, each with "Ask {client} to sign" (optional, the studio decides when), the requests and "Signed by …
 * on …". A newer revision needs a new sign-off; the old signature stays on
 * its revision. The signed copy opens the page the client signed on, and is
 * filed in the locker by itself.
 */

import { useState, useTransition } from 'react';
import { formatINR } from '@/lib/money';
import type { StudioSignoffs } from '@/modules/project/signoffs';
import { requestSignoffAction, withdrawSignoffAction } from './extras-actions';

const STATE: Record<string, { text: string; tone: string }> = {
  waiting: { text: 'Waiting for the signature', tone: 'warn' },
  signed: { text: 'Signed', tone: 'good' },
  superseded: { text: 'Newer version sent: ask again', tone: '' },
};

export function SignoffCard({ data, customer }: { data: StudioSignoffs; customer: string }) {
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<{ ok: true; message?: string } | { ok: false; error: string }>, confirmText?: string) => {
    if (confirmText && !window.confirm(confirmText)) return;
    setMsg(null);
    start(async () => {
      const r = await fn();
      setMsg(r.ok ? { ok: true, text: r.message ?? 'Done.' } : { ok: false, text: r.error });
    });
  };
  return (
    <section className="card flex flex-col gap-3 p-4" aria-label="Client sign-off" data-testid="signoff-card">
      <div className="flex flex-col gap-1">
        <b>Client sign-off</b>
        <span className="muted sm">
          Optional. {customer} reads it in the app, ticks I agree and types their name. The agreement can also be signed on paper at the office: upload it as &quot;Signed agreement (paper)&quot;.
        </span>
      </div>
      {data.targets.map((t) => (
        <div key={t.kind} className="flex flex-col gap-1.5" data-testid={`signoff-${t.kind}`}>
          <span className="sm">
            <b>{t.label}</b>
            {t.quote ? ` · ${t.quote.number}${t.revision ? ` R${t.revision}` : ''}` : ''}
            {t.totalPaise !== null ? <span className="mono"> · {formatINR(t.totalPaise)}</span> : null}
          </span>
          {t.requests.map((r) => (
            <span key={r.id} className="flex flex-wrap items-center gap-2 sm">
              <span className={`chip ${STATE[r.state]?.tone ?? ''}`}>R{r.revision}</span>
              {r.line ? (
                <a href={`/app/signoff/${r.id}`} target="_blank" rel="noreferrer" className="good-t" data-testid="signed-by">
                  {r.line}
                </a>
              ) : (
                <span>
                  {STATE[r.state]?.text ?? r.state} · asked {r.requestedOn}
                </span>
              )}
              {r.state === 'waiting' && data.canRequest ? (
                <button type="button" className="btn ghost sm" disabled={pending} onClick={() => run(() => withdrawSignoffAction(data.projectId, r.id), 'Withdraw this request?')}>
                  Withdraw
                </button>
              ) : null}
            </span>
          ))}
          {t.canAsk ? (
            <div>
              <button
                type="button"
                className="btn sec sm"
                disabled={pending}
                onClick={() => run(() => requestSignoffAction(data.projectId, t.kind), `Ask ${customer} to sign ${t.label.toLowerCase()} ${t.quote?.number ?? ''} R${t.revision}?`)}
                data-testid={`signoff-ask-${t.kind}`}
              >
                Ask {customer} to sign
              </button>
            </div>
          ) : data.canRequest && t.why && t.requests.length === 0 ? (
            <span className="muted sm">{t.why}</span>
          ) : null}
        </div>
      ))}
      {msg ? (
        <p className={`m-0 sm ${msg.ok ? 'good-t' : 'bad-t'}`} role={msg.ok ? 'status' : 'alert'}>
          {msg.text}
        </p>
      ) : null}
    </section>
  );
}
