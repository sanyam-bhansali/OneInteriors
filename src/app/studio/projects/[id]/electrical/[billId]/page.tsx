import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { formatINR } from '@/lib/money';
import { projectStatement } from '@/modules/project/statement';
import { electricalForProject } from '@/modules/project/electrical-bill';
import { qtyWords } from '@/modules/project/electrical-rules';
import { nameWord } from '@/modules/studio-design/documents';
import { PrintStatement } from '../../statement/PrintStatement';
import { DocFooter, DocHeader, PaymentNote, SignBlock, longDay } from '../../MoneyDoc';

export const metadata: Metadata = { title: 'Electrical bill', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

const STATUS: Record<string, string> = {
  DRAFT: 'Draft',
  SENT_TO_CLIENT: 'Sent for approval',
  APPROVED: 'Approved',
  PAID: 'Approved',
  DECLINED: 'Declined',
  CANCELLED: 'Cancelled',
  RELEASED: 'Released',
};

/**
 * One electrical bill as a PDF (owner, 22 Nov 2026: "it should generate a PDF electrical bill"): the studio's
 * header, the client, every line with its note, quantity, rate and amount, then work, the discount, GST and the
 * total, and the signature — in the same document style as the statement and the invoices (MoneyDoc).
 */
export default async function ElectricalBillPage({ params }: { params: Promise<{ id: string; billId: string }> }) {
  const { id, billId } = await params;
  const [view, data] = await Promise.all([projectStatement(id), electricalForProject(id)]);
  const bill = data?.bills.find((b) => b.id === billId);
  if (!view || !bill) notFound();
  const day = longDay(view.on);
  const filename = `Electrical bill ${bill.number}_${nameWord(view.client, 'Client')}_${nameWord(view.studio, 'Studio')}_${view.on}`;

  return (
    <main className="mdoc-wrap px-4 py-6" style={{ background: '#ebe9ee' }}>
      <PrintStatement filename={filename} backHref={`/studio/projects/${id}?tab=electrical`} />
      <div className="mdoc">
        <article className="mdoc-page" data-testid="electrical-bill">
          <DocHeader
            issuer={view.issuer}
            title="ELECTRICAL BILL"
            meta={[
              { label: 'Bill', value: <b>No. {bill.number}</b> },
              { label: 'Date', value: day },
              { label: 'Status', value: STATUS[bill.status] ?? bill.status },
            ]}
          />

          <div className="mdoc-parties">
            <div className="mdoc-box">
              <h3>Client</h3>
              <b>{view.client}</b>
              <br />
              {view.home}
            </div>
            <div className="mdoc-box">
              <h3>Amount</h3>
              Total: <b>{formatINR(bill.totalPaise)}</b>
              <br />
              {bill.lines.length} {bill.lines.length === 1 ? 'item' : 'items'}
            </div>
          </div>

          <table className="mdoc-items">
            <thead>
              <tr>
                <th style={{ width: 40 }}>S.No</th>
                <th>Item</th>
                <th style={{ width: 100 }}>Quantity</th>
                <th className="r" style={{ width: 90 }}>
                  Rate
                </th>
                <th className="r" style={{ width: 110 }}>
                  Amount
                </th>
              </tr>
            </thead>
            <tbody>
              {bill.lines.map((l, i) => (
                <tr key={i}>
                  <td>{i + 1}</td>
                  <td>
                    <b>{l.product}</b>
                    {l.details ? <div className="m">{l.details}</div> : null}
                    {l.note ? <div style={{ fontStyle: 'italic' }}>{l.note}</div> : null}
                  </td>
                  <td>{qtyWords(l.qtyMilli, l.unitLabel)}</td>
                  <td className="r">{formatINR(l.ratePaise)}</td>
                  <td className="r">{formatINR(l.amountPaise)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <table className="mdoc-totals mdoc-keep">
            <tbody>
              <tr>
                <td>Work</td>
                <td className="r">{formatINR(bill.workPaise)}</td>
              </tr>
              {bill.discountPaise ? (
                <tr>
                  <td>Discount ({bill.discountBps / 100}%)</td>
                  <td className="r">− {formatINR(bill.discountPaise)}</td>
                </tr>
              ) : null}
              {bill.gstPaise ? (
                <tr>
                  <td>GST ({bill.gstBps / 100}%)</td>
                  <td className="r">{formatINR(bill.gstPaise)}</td>
                </tr>
              ) : null}
              <tr className="rem">
                <td>Total</td>
                <td className="r">
                  <b>{formatINR(bill.totalPaise)}</b>
                </td>
              </tr>
            </tbody>
          </table>

          <div className="mdoc-notes">
            <p>Once approved, this amount is added to the project value and spread over the payment stages not yet paid.</p>
            <PaymentNote issuer={view.issuer} />
          </div>

          <SignBlock issuer={view.issuer} />
          <DocFooter issuer={view.issuer} right={`Electrical bill ${bill.number} · ${day}`} />
        </article>
      </div>
    </main>
  );
}
