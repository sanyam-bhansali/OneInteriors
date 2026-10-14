'use client';

import { useState } from 'react';
import type { MyProject } from '@/components/app/useMyProject';
import { formatINR } from '@/lib/money';
import { shortDate } from '@/modules/app/project-view';

/**
 * The payments the studio recorded, on the website's payments card — the
 * same as the phone app's (mobile/src/components/project/payment-entries.tsx),
 * through the same routes (POST /api/app/v1/payments/:id/confirm and
 * /dispute, project/payments-flow.ts `confirmPayment` / `disputePayment`).
 * A recorded payment counts as paid once the customer says yes; "I didn't pay
 * this" goes to One Interiors' team, and the studio sees only that we are
 * checking. Only the owner of the brief answers (`canAnswer`); family see.
 */

type Entry = NonNullable<MyProject['payments']>['entries'][number];

const MODE: Record<string, string> = { UPI: ' · UPI', BANK: ' · bank transfer', CHEQUE: ' · cheque', CASH: ' · cash' };

/** What waits on the customer first, then the latest two they confirmed. */
export function entriesShown(entries: readonly Entry[]): Entry[] {
  return [...entries.filter((e) => e.status !== 'confirmed'), ...entries.filter((e) => e.status === 'confirmed').slice(0, 2)].slice(0, 6);
}

export function PaymentEntries({ payments, onChanged }: { payments: NonNullable<MyProject['payments']>; onChanged: () => void }) {
  const shown = entriesShown(payments.entries);
  if (shown.length === 0) return null;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 12 }}>
      {shown.map((e) => (
        <PaymentEntry key={e.id} e={e} onChanged={onChanged} />
      ))}
    </div>
  );
}

function PaymentEntry({ e, onChanged }: { e: Entry; onChanged: () => void }) {
  const [busy, setBusy] = useState<'confirm' | 'dispute' | null>(null);
  const [answer, setAnswer] = useState<'confirmed' | 'disputed' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const status = answer ?? e.status;

  const send = async (kind: 'confirm' | 'dispute') => {
    if (kind === 'dispute' && !window.confirm(`Tell One Interiors you did not pay ${formatINR(e.amountPaise)} for ${e.stage}? Our team will call you.`)) return;
    setBusy(kind);
    setError(null);
    try {
      const res = await fetch(`/api/app/v1/payments/${encodeURIComponent(e.id)}/${kind}`, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: kind === 'dispute' ? JSON.stringify({ note: '' }) : '{}',
      });
      const body = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
      if (!res.ok || !body?.ok) {
        setError(body?.error ?? 'That did not go through. Try again.');
        return;
      }
      setAnswer(kind === 'confirm' ? 'confirmed' : 'disputed');
      onChanged();
    } catch {
      setError('That did not go through. Try again.');
    } finally {
      setBusy(null);
    }
  };

  const asking = e.canAnswer && (status === 'waiting' || status === 'earlier');
  const waiting = status === 'waiting';
  return (
    <div
      className="oa-card"
      style={{
        padding: 14,
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
        ...(waiting ? { background: '#F5E2D8', borderColor: '#F5E2D8' } : {}),
        ...(status === 'disputed' ? { borderColor: 'var(--accent-ink)' } : {}),
      }}
    >
      {waiting ? (
        <span className="oa-meta" style={{ color: 'var(--accent-ink)', textTransform: 'uppercase', letterSpacing: '0.07em', fontSize: 12.5 }}>
          {e.canAnswer ? 'Recorded by the studio — please confirm' : 'Recorded by the studio'}
        </span>
      ) : null}
      <span style={{ fontWeight: 600 }}>
        {formatINR(e.amountPaise)} for {e.stage}
      </span>
      <span className="oa-meta">
        Marked received {shortDate(`${e.receivedOn}T12:00:00Z`)}
        {e.mode ? (MODE[e.mode] ?? '') : ''}
      </span>
      {status === 'confirmed' ? (
        <span className="oa-meta" style={{ color: 'var(--ok, var(--accent))' }}>
          ✓ You confirmed this
        </span>
      ) : status === 'disputed' ? (
        <span className="oa-meta" style={{ color: 'var(--accent-ink)' }}>
          {answer === 'disputed'
            ? 'Sent to One Interiors. Our team will call you; the studio sees only that we are checking.'
            : 'You said you did not pay this. Our team will call you.'}
        </span>
      ) : status === 'earlier' ? (
        <span className="oa-meta">Recorded before confirmations started. Counted as paid.</span>
      ) : (
        <span className="oa-meta">It counts as paid once {e.canAnswer ? 'you confirm' : 'the owner confirms'}.</span>
      )}
      {asking ? (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 6 }}>
          <button type="button" className="oa-cta" disabled={busy !== null} onClick={() => void send('confirm')} aria-label={`Yes, I paid ${formatINR(e.amountPaise)} for ${e.stage}`}>
            {busy === 'confirm' ? '…' : 'Yes, I paid'}
          </button>
          <button type="button" className="oa-inline-link" disabled={busy !== null} onClick={() => void send('dispute')} aria-label={`I didn't pay ${formatINR(e.amountPaise)} for ${e.stage}`}>
            {busy === 'dispute' ? '…' : "I didn't pay this"}
          </button>
        </div>
      ) : null}
      {error ? (
        <span role="alert" className="oa-meta" style={{ color: 'var(--accent-ink)' }}>
          {error}
        </span>
      ) : null}
    </div>
  );
}
