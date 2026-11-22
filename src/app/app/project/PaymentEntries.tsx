import type { MyProject } from '@/components/app/useMyProject';
import { formatINR } from '@/lib/money';
import { shortDate } from '@/modules/app/project-view';

/**
 * The payments the studio marked received, on the website's payments card —
 * the same as the phone app's (mobile/src/components/project/payment-entries.tsx).
 * Nothing to answer: "Remove the client confirms in app for payments — it is
 * marked by our team." (owner, 22 Nov 2026). A payment the client said they
 * did not make, back when they could, still says our team is checking.
 */

type Entry = NonNullable<MyProject['payments']>['entries'][number];

const MODE: Record<string, string> = { UPI: ' · UPI', BANK: ' · bank transfer', CHEQUE: ' · cheque', CASH: ' · cash' };

/** Anything our team is checking first, then the latest three received: the rest are in the locker's receipts. */
export function entriesShown(entries: readonly Entry[]): Entry[] {
  return [...entries.filter((e) => e.status === 'disputed'), ...entries.filter((e) => e.status === 'paid').slice(0, 3)].slice(0, 6);
}

export function PaymentEntries({ payments }: { payments: NonNullable<MyProject['payments']> }) {
  const shown = entriesShown(payments.entries);
  if (shown.length === 0) return null;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 12 }}>
      {shown.map((e) => (
        <div
          key={e.id}
          className="oa-card"
          style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 4, ...(e.status === 'disputed' ? { borderColor: 'var(--accent-ink)' } : {}) }}
        >
          <span style={{ fontWeight: 600 }}>
            {formatINR(e.amountPaise)} for {e.stage}
          </span>
          <span className="oa-meta">
            Received {shortDate(`${e.receivedOn}T12:00:00Z`)}
            {e.mode ? (MODE[e.mode] ?? '') : ''}
          </span>
          {e.status === 'disputed' ? (
            <span className="oa-meta" style={{ color: 'var(--accent-ink)' }}>
              You said you did not pay this. Our team will call you.
            </span>
          ) : (
            <span className="oa-meta" style={{ color: 'var(--ok, var(--accent))' }}>
              ✓ Paid
            </span>
          )}
        </div>
      ))}
    </div>
  );
}
