import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { formatINR } from '@/lib/money';
import { statementOf } from '@/modules/studio-crews/store';
import { qtyWords } from '@/modules/studio-crews/money';
import { CREW_UNIT_SHORT } from '@/modules/studio-crews/trades';
import { PrintButton } from './PrintButton';
import '../../../../office-ui.css';
import '../../../vendors.css';

export const metadata: Metadata = { title: 'Statement of account', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

const day = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });

/**
 * A crew's statement of account for one work order (Studio OS Phase 3 §4,
 * Hauspire §3.11): lines by room, billed, extras, paid, balance; printed or
 * saved as PDF from the browser. A statement, not an invoice: the studio is
 * the payer and the crew raises its own bill. It opens only for the owner and
 * accounts signed in to the studio — crews have no login; the studio prints
 * it to PDF and sends that from its own WhatsApp.
 */
export default async function StatementPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const s = await statementOf(id.slice(0, 64));
  if (!s) notFound();
  const o = s.order;
  const m = o.money!;
  const rooms = [...new Set(o.lines.map((l) => l.room))];
  const pending = o.needPrice + o.needQty;
  const th = '';
  const td = '';
  return (
    <main className="content ox-page">
      {/* Print only the statement, not the studio's frame around it. */}
      <style>{`@media print { body * { visibility: hidden !important; } .crew-statement, .crew-statement * { visibility: visible !important; } .crew-statement { position: absolute; left: 0; top: 0; width: 100%; box-shadow: none !important; border: 0 !important; } .no-print { display: none !important; } }`}</style>
      <div className="no-print hstack">
        <Link href={`/studio/vendors/orders/${o.id}`} className="btn ghost">
          ← Back to the work order
        </Link>
        <PrintButton />
        <span className="muted sm">Use &ldquo;Save as PDF&rdquo; to send it from your WhatsApp.</span>
      </div>
      <article className="crew-statement">
        <header className="st-h" style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
          <div>
            <p style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>{s.studio.name}</p>
            {s.studio.address ? (
              <p className="muted" style={{ margin: 0, fontSize: 12 }}>
                {s.studio.address}
              </p>
            ) : null}
            <p style={{ margin: '4px 0 0', fontSize: 13, fontWeight: 500 }}>Statement of account</p>
          </div>
          <div className="muted" style={{ textAlign: 'right', fontSize: 12 }}>
            <p className="m-0">Reference {s.reference}</p>
            <p className="m-0">Generated {day(s.generatedOn)}</p>
            {o.dueOn ? <p className="m-0">Pay by {day(o.dueOn)}</p> : null}
          </div>
        </header>
        <section className="st-h vd-grid2" style={{ paddingTop: 16, gap: 16 }}>
          <div>
            <p className="st-cap">Crew</p>
            <p className="m-0 font-semibold">{s.crew.name}</p>
            <p className="m-0">{o.trades.map((t) => t.label).join(', ')}</p>
            {s.crew.phone ? <p className="m-0">{s.crew.phone}</p> : null}
            {s.crew.address ? <p className="m-0">{s.crew.address}</p> : null}
            {s.crew.pan ? <p className="m-0">PAN {s.crew.pan}</p> : null}
            {s.crew.kind === 'PERMANENT' ? <p className="m-0">Aadhaar {s.crew.aadhaar}</p> : null}
          </div>
          <div>
            <p className="st-cap">Site</p>
            <p className="m-0 font-semibold">{o.projectName}</p>
            <p className="m-0">Work order WO-{o.number}</p>
          </div>
        </section>
        <table style={{ width: '100%', marginTop: 16, borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th className={th}>Work</th>
              <th className={th} style={{ textAlign: 'right' }}>
                Rate
              </th>
              <th className={th} style={{ textAlign: 'right' }}>
                Qty
              </th>
              <th className={th} style={{ textAlign: 'right' }}>
                Amount
              </th>
            </tr>
          </thead>
          <tbody>
            {rooms.map((room) => (
              <RoomBlock key={room} room={room} lines={o.lines.filter((l) => l.room === room)} td={td} />
            ))}
          </tbody>
        </table>
        {pending ? (
          <p className="warn-t" style={{ margin: '12px 0 0', fontSize: 12 }}>
            {pending} line{pending === 1 ? ' is' : 's are'} still to be priced. This statement is provisional until they are.
          </p>
        ) : null}
        <table className="st-tot" style={{ marginLeft: 'auto', marginTop: 16, borderCollapse: 'collapse' }}>
          <tbody>
            <tr>
              <td>Total billed</td>
              <td className="mono" style={{ textAlign: 'right' }}>
                {formatINR(m.billPaise)}
              </td>
            </tr>
            {m.extrasPaise > 0 ? (
              <tr>
                <td className="muted">of which extra work</td>
                <td className="mono muted" style={{ textAlign: 'right' }}>
                  {formatINR(m.extrasPaise)}
                </td>
              </tr>
            ) : null}
            <tr>
              <td>Paid to date</td>
              <td className="mono" style={{ textAlign: 'right' }}>
                − {formatINR(m.paidPaise)}
              </td>
            </tr>
            <tr className="st-last">
              <td>{m.balancePaise < 0 ? 'Advance to recover' : 'Balance due'}</td>
              <td className="mono" style={{ textAlign: 'right' }}>
                {formatINR(Math.abs(m.balancePaise))}
              </td>
            </tr>
          </tbody>
        </table>
        {o.payments && o.payments.length ? (
          <>
            <p className="st-cap" style={{ marginTop: 24 }}>
              Payments
            </p>
            <table style={{ width: '100%', marginTop: 4, borderCollapse: 'collapse' }}>
              <tbody>
                {o.payments.map((p) => (
                  <tr key={p.id}>
                    <td className={td}>{day(p.paidOn)}</td>
                    <td className={td}>
                      {p.kind === 'ADVANCE' ? 'Advance' : p.kind === 'CORRECTION' ? 'Correction' : (p.note ?? 'Payment')}
                      {p.reference ? ` · ${p.reference}` : ''}
                    </td>
                    <td className={td}>{p.mode}</td>
                    <td className={`${td} mono`} style={{ textAlign: 'right' }}>
                      {formatINR(p.amountPaise)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        ) : null}
        <p className="muted" style={{ margin: '24px 0 0', fontSize: 11.5 }}>
          A statement of account, not an invoice: {s.studio.name} pays for the work above. Please raise any disagreement before accepting the next payment.
        </p>
      </article>
    </main>
  );
}

function RoomBlock({ room, lines, td }: { room: string; lines: NonNullable<Awaited<ReturnType<typeof statementOf>>>['order']['lines']; td: string }) {
  return (
    <>
      <tr>
        <td colSpan={4} style={{ paddingTop: 12, fontSize: 12, fontWeight: 600, borderBottom: 0 }}>
          {room}
        </td>
      </tr>
      {lines.map((l) => {
        const q = l.measuredQtyMilli ?? l.qtyMilli;
        return (
          <tr key={l.id}>
            <td className={td}>
              {l.product}
              {l.isExtra ? ' (extra)' : ''}
              <span className="muted" style={{ display: 'block', fontSize: 11.5 }}>
                {l.item}
              </span>
            </td>
            <td className={`${td} mono`} style={{ textAlign: 'right' }}>
              {l.agreedPaise !== null ? 'agreed' : l.ratePaise !== null ? `${formatINR(l.ratePaise)}/${CREW_UNIT_SHORT[l.unit]}` : '—'}
            </td>
            <td className={`${td} mono`} style={{ textAlign: 'right' }}>
              {l.agreedPaise !== null ? '' : q === null ? '—' : qtyWords(q)}
            </td>
            <td className={`${td} mono`} style={{ textAlign: 'right' }}>
              {l.pending ? 'to price' : formatINR(l.amountPaise ?? 0)}
            </td>
          </tr>
        );
      })}
    </>
  );
}
