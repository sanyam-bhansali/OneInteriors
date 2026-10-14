import { formatINR } from '@/lib/money';
import { MODE_LABEL, type LedgerStage } from '@/modules/project/payment-ledger';
import { studioPayments, type StudioPaymentRow, type StudioPayments } from '@/modules/project/payments-flow';
import { istDay } from '@/modules/project/working-days';
import { CustomerSees } from '../marks';
import { CorrectPayment, DueDate, RecordPayment } from './PaymentsClient';

/**
 * The Payments tab of the project workspace (studio workspace Phase 5,
 * StudioProject.dc.html): what each stage is owed now (signed, plus the
 * decisions landing on the final one), what is paid, what is waiting for
 * the customer's yes, and every entry with its receipt. Computed from the
 * payment rows each time (project/payment-ledger.ts); nothing typed twice.
 * Also the body of the accounts landing (/studio/payments).
 */

const muted = 'text-[12.5px] text-[var(--muted)]';
const mono = 'mono';
const shortDay = (day: string) => new Date(`${day}T12:00:00Z`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: 'Asia/Kolkata' });

function stageStatus(s: LedgerStage, customer: string, dueOn: string | null): { text: string; tone: string } {
  switch (s.state) {
    case 'paid':
      return { text: `Paid${s.paidOn ? ` · ${shortDay(s.paidOn)}` : ''}`, tone: 'var(--good)' };
    case 'waiting':
      return { text: `Recorded · waiting for ${customer} to confirm`, tone: 'var(--warn)' };
    case 'part':
      return { text: `${formatINR(s.paidPaise + s.waitingPaise)} of ${formatINR(s.amountPaise)} recorded`, tone: 'var(--warn)' };
    case 'due':
      return { text: dueOn ? `Due ${shortDay(dueOn)}` : 'Next', tone: 'var(--ink)' };
    default:
      return { text: dueOn ? `Due ${shortDay(dueOn)}` : 'Not due yet', tone: 'var(--muted)' };
  }
}

function rowStatus(r: StudioPaymentRow, customer: string): { text: string; tone: string } {
  switch (r.status) {
    case 'confirmed':
      return { text: `${customer} confirmed`, tone: 'var(--good)' };
    case 'earlier':
      return { text: 'Recorded before confirmations started · counts as paid', tone: 'var(--text2)' };
    case 'waiting':
      return { text: `Waiting for ${customer} to confirm`, tone: 'var(--warn)' };
    case 'disputed':
      return { text: `${customer} says this was not paid · One Interiors is looking into it`, tone: 'var(--bad)' };
    default:
      return { text: 'Corrected by a later entry', tone: 'var(--muted)' };
  }
}

export function PaymentsBody({ data, customer }: { data: StudioPayments; customer: string }) {
  const l = data.ledger;
  const today = istDay(new Date());
  const tiles = [
    { label: 'Total now', value: l.totalPaise, sub: l.changesPaise ? `${l.changesPaise > 0 ? '+' : '−'}${formatINR(Math.abs(l.changesPaise))} from decisions and extra work` : 'as signed' },
    { label: 'Paid', value: l.paidPaise, sub: `confirmed by ${customer}` },
    { label: `Waiting for ${customer}`, value: l.waitingPaise, sub: 'recorded, not confirmed yet' },
    { label: 'Balance', value: l.balancePaise, sub: 'total less paid' },
  ];
  return (
    <div className="flex flex-col gap-5">
      <dl className="m-0 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {tiles.map((t) => (
          <div key={t.label} className="rounded-[10px] bg-[var(--fill)] p-3">
            <dt className="text-[12px] font-semibold text-[var(--text2)]">{t.label}</dt>
            <dd className={`m-0 mt-1 text-[16px] font-semibold ${mono}`}>{formatINR(t.value)}</dd>
            <dd className={`m-0 ${muted}`}>{t.sub}</dd>
          </div>
        ))}
      </dl>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] border-collapse text-left text-[14px]">
          <thead>
            <tr className="text-[12px] text-[var(--muted)]">
              <th className="py-2 pr-3 font-semibold">Stage</th>
              <th className="py-2 pr-3 text-right font-semibold">Amount</th>
              <th className="py-2 font-semibold">Status</th>
            </tr>
          </thead>
          <tbody>
            {l.stages.map((s) => {
              const st = stageStatus(s, customer, data.dueOn[s.index] ?? null);
              return (
                <tr key={s.index} id={`pay-${s.index}`} className="border-t border-[var(--fill2)] align-top">
                  <td className="py-3 pr-3">
                    <span className="font-medium">{s.label}</span>
                    {s.pct !== null ? <span className={`block ${muted}`}>{s.pct}% as signed</span> : null}
                  </td>
                  <td className={`py-3 pr-3 text-right ${mono}`}>
                    {formatINR(s.amountPaise)}
                    {s.changesPaise ? (
                      <span className={`block ${muted}`}>
                        {formatINR(s.signedPaise)} signed {s.changesPaise > 0 ? '+' : '−'} {formatINR(Math.abs(s.changesPaise))} decisions and extras
                      </span>
                    ) : null}
                  </td>
                  <td className="py-3 text-[13.5px] font-medium">
                    <span style={{ color: st.tone }}>{st.text}</span>
                    {data.canSetDue && s.state !== 'paid' && s.state !== 'waiting' ? (
                      <span className="mt-1.5 block">
                        <DueDate projectId={data.projectId} index={s.index} value={data.dueOn[s.index] ?? null} label={s.label} />
                      </span>
                    ) : null}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {data.canRecord ? (
        <RecordPayment
          projectId={data.projectId}
          customer={customer}
          stages={l.stages.map((s) => ({ index: s.index, label: s.label, openPaise: s.openPaise }))}
          suggested={data.suggested?.index ?? null}
          today={today}
        />
      ) : (
        <p className={`m-0 ${muted}`}>Accounts or the studio owner marks payments received.</p>
      )}

      {data.rows.length ? (
        <section aria-label="Entries">
          <h3 className="m-0 mb-1 text-[14px] font-semibold">Entries</h3>
          <p className={`m-0 mb-2 ${muted}`}>Never edited or deleted. A correction is a new entry beside the one it replaces.</p>
          <ul className="m-0 flex list-none flex-col p-0">
            {[...data.rows].reverse().map((r) => {
              const st = rowStatus(r, customer);
              return (
                <li key={r.id} className="grid gap-x-4 gap-y-1 border-t border-[var(--fill2)] py-3 text-[14px] sm:grid-cols-[minmax(0,1fr)_auto]">
                  <span className={r.status === 'replaced' ? 'text-[var(--muted)] line-through' : undefined}>
                    <span className={mono}>{formatINR(r.amountPaise)}</span> · {r.stageLabel}
                    <span className={`block ${muted}`} style={{ textDecoration: 'none' }}>
                      {shortDay(r.receivedOn)}
                      {r.mode ? ` · ${MODE_LABEL[r.mode]}` : ''}
                      {r.receiptUrl ? (
                        <>
                          {' · '}
                          <a href={r.receiptUrl} target="_blank" rel="noreferrer" className="acc-t">
                            receipt in locker
                          </a>
                        </>
                      ) : (
                        ' · no receipt'
                      )}
                      {r.replaces ? ' · a correction' : ''}
                    </span>
                    {r.note ? <span className={`block ${muted}`}>Only your team: {r.note}</span> : null}
                  </span>
                  <span className="flex flex-col items-start gap-1 sm:items-end">
                    <span className="text-[13px] font-medium" style={{ color: st.tone }}>
                      {st.text}
                    </span>
                    {data.canRecord && r.live && r.amountPaise > 0 ? <CorrectPayment projectId={data.projectId} paymentId={r.id} amountPaise={r.amountPaise} /> : null}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

/** The workspace tab: loads its own data through payments-flow.ts (`payment.read`). */
export async function PaymentsTab({ projectId, customer }: { projectId: string; customer: string }) {
  const data = await studioPayments(projectId);
  return (
    <section aria-label="Payments" className="card p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 className="m-0 text-[17px] font-semibold">
          Payments{' '}
          {data ? (
            <span className={`${mono} text-[13px] font-normal text-[var(--muted)]`}>
              {formatINR(data.ledger.paidPaise)} of {formatINR(data.ledger.totalPaise)} paid
            </span>
          ) : null}
        </h2>
        <CustomerSees name={customer} />
      </div>
      <p className={`m-0 mt-1 mb-4 ${muted}`}>
        {customer} pays you directly. A payment counts once you record it and {customer} confirms it in the app.
      </p>
      {data ? (
        <PaymentsBody data={data} customer={customer} />
      ) : (
        <p className={`m-0 ${muted}`}>This project was started before signing in the app, so it has no signed payment plan.</p>
      )}
    </section>
  );
}
