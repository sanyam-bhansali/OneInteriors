import { formatINR } from '@/lib/money';
import type { StageInvoice } from '@/modules/project/invoice';
import { amountInWords } from '@/modules/project/invoice-rules';
import { DocFooter, DocHeader, PaymentNote, SignBlock, longDay } from '../../MoneyDoc';

/** The invoice sheet (owner, 21 Nov 2026: the approved sample-invoice.html). */

const money = (p: number) => formatINR(p, { paise: true, symbol: false });

export function InvoiceDoc({ inv }: { inv: StageInvoice }) {
  const f = inv.figures;
  const g = f.gst;
  const pct = inv.project.gstPct;
  return (
    <div className="mdoc">
      <article className="mdoc-page" data-testid="invoice">
        <DocHeader
          issuer={inv.issuer}
          title={f.title}
          meta={[
            { label: 'Invoice no.', value: <b>{inv.number}</b> },
            { label: 'Invoice date', value: longDay(inv.issuedOn) },
            ...(inv.quotation ? [{ label: 'Quotation', value: inv.quotation }] : []),
            { label: 'Place of supply', value: inv.issuer.state },
          ]}
        />

        <div className="mdoc-parties">
          <div className="mdoc-box">
            <h3>Bill to</h3>
            <b>{inv.client.name}</b>
            <br />
            {inv.client.site}
            {inv.client.phone ? (
              <>
                <br />
                {inv.client.phone}
              </>
            ) : null}
            <br />
            Client GSTIN: —
          </div>
          <div className="mdoc-box">
            <h3>Project</h3>
            <b>{inv.client.site}</b>
            <br />
            Payment stage {inv.stage.position} of {inv.stage.of}: <b>{f.stageLabel}</b>
            <br />
            {inv.project.designFinal ? 'Design Final total' : 'Quotation total'}: {formatINR(inv.project.valuePaise)}
            {pct !== null ? ` · GST on ${pct}% of the project value` : ''}
          </div>
        </div>

        <table className="mdoc-items">
          <thead>
            <tr>
              <th style={{ width: 38 }}>#</th>
              <th>Description</th>
              <th style={{ width: 80 }}>SAC</th>
              <th className="r" style={{ width: 130 }}>
                Amount (₹)
              </th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>1</td>
              <td>
                <b>{f.stageLabel}</b>
                {inv.stage.deliverable ? (
                  <>
                    <br />
                    <span className="m">{inv.stage.deliverable}</span>
                  </>
                ) : null}
              </td>
              <td>{inv.issuer.sac}</td>
              <td className="r">{money(f.basePaise)}</td>
            </tr>
            {f.changesPaise !== 0 ? (
              <tr>
                <td>2</td>
                <td>
                  <b>Decisions and extra work added to this stage</b>
                </td>
                <td>{inv.issuer.sac}</td>
                <td className="r">
                  {f.changesPaise < 0 ? '−' : ''}
                  {money(Math.abs(f.changesPaise))}
                </td>
              </tr>
            ) : null}
            {g ? (
              <>
                <tr className="mdoc-sub">
                  <td />
                  <td>Taxable value: this stage&rsquo;s share of the {pct ?? ''}% of the project GST applies to</td>
                  <td />
                  <td className="r">{money(g.taxablePaise)}</td>
                </tr>
                <tr className="mdoc-sub">
                  <td />
                  <td>CGST @ 9%</td>
                  <td />
                  <td className="r">{money(g.cgstPaise)}</td>
                </tr>
                <tr className="mdoc-sub">
                  <td />
                  <td>SGST @ 9%</td>
                  <td />
                  <td className="r">{money(g.sgstPaise)}</td>
                </tr>
              </>
            ) : null}
            <tr className="mdoc-grand">
              <td />
              <td>Total for this stage</td>
              <td />
              <td className="r">₹{money(f.totalPaise)}</td>
            </tr>
          </tbody>
        </table>
        <p className="mdoc-words">
          Amount in words: <b>{amountInWords(f.totalPaise)}</b>
        </p>

        <div className="mdoc-status mdoc-keep">
          <div>
            <span>This stage</span>
            <b>{formatINR(f.totalPaise)}</b>
          </div>
          <div>
            <span>Received</span>
            <b className={f.paidPaise > 0 ? 'paid' : undefined}>
              {formatINR(f.paidPaise)}
              {f.paidPaise > 0 && inv.received.day ? ` · ${longDay(inv.received.day)}` : ''}
              {f.paidPaise > 0 && inv.received.mode ? ` · ${inv.received.mode}` : ''}
            </b>
          </div>
          <div>
            <span>Balance on this stage</span>
            <b>{formatINR(f.balancePaise)}</b>
          </div>
        </div>

        <div className="mdoc-notes">
          <p>
            Project total: {formatINR(inv.project.totalPaise)}
            {inv.project.gstPaise > 0 && pct !== null ? ` (${formatINR(inv.project.totalPaise - inv.project.gstPaise)} + GST ${formatINR(inv.project.gstPaise)} on ${pct}% of it)` : ''} · Paid to date:{' '}
            {formatINR(inv.project.paidPaise)} · Still to come: {formatINR(inv.project.remainingPaise)}.
          </p>
          <PaymentNote issuer={inv.issuer} />
          <p>This is a computer-generated invoice from the project&rsquo;s Payments tab.</p>
        </div>

        <SignBlock issuer={inv.issuer} />
        <DocFooter issuer={inv.issuer} right={`Invoice ${inv.number}`} />
      </article>
    </div>
  );
}
