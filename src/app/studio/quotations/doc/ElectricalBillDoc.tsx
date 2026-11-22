import type { ElectricalBillView } from '@/modules/project/electrical-bill';
import { qtyWords } from '@/modules/project/electrical-rules';

const inr = (paise: number) => `₹${Math.round(paise / 100).toLocaleString('en-IN')}`;

/**
 * The approved electrical bills in the quotation's PDF (owner, 22 Nov 2026:
 * "the final project value PDF … should include quotation as well as
 * electrical bill quotation into one PDF"): each bill's lines, then the
 * quotation, the electrical and the total project value.
 */
export function ElectricalBillDoc({ bills, quotationPaise }: { bills: readonly ElectricalBillView[]; quotationPaise: number }) {
  if (bills.length === 0) return null;
  const electrical = bills.reduce((a, b) => a + b.totalPaise, 0);
  return (
    <div className="qd-keep" style={{ marginBottom: '5mm' }}>
      <div className="qd-roomhdr">Electrical bill</div>
      {bills.map((b) => (
        <table key={b.id} className="qd-tbl" style={{ marginBottom: '3mm' }}>
          <thead>
            <tr>
              <th>S.No</th>
              <th>Item</th>
              <th>Details</th>
              <th>Quantity</th>
              <th>Rate</th>
              <th>Amount</th>
            </tr>
          </thead>
          <tbody>
            {b.lines.map((l, i) => (
              <tr key={i}>
                <td>{i + 1}</td>
                <td>{l.product}</td>
                <td>
                  {l.details}
                  {l.note ? <div style={{ fontStyle: 'italic' }}>{l.note}</div> : null}
                </td>
                <td>{qtyWords(l.qtyMilli, l.unitLabel)}</td>
                <td>{inr(l.ratePaise)}</td>
                <td>{inr(l.amountPaise)}</td>
              </tr>
            ))}
            <tr>
              <td colSpan={5} style={{ textAlign: 'right' }}>
                Work
              </td>
              <td>{inr(b.workPaise)}</td>
            </tr>
            {b.gstPaise ? (
              <tr>
                <td colSpan={5} style={{ textAlign: 'right' }}>
                  GST ({b.gstBps / 100}%)
                </td>
                <td>{inr(b.gstPaise)}</td>
              </tr>
            ) : null}
            <tr>
              <td colSpan={5} style={{ textAlign: 'right', fontWeight: 600 }}>
                Electrical bill {b.number}
              </td>
              <td style={{ fontWeight: 600 }}>{inr(b.totalPaise)}</td>
            </tr>
          </tbody>
        </table>
      ))}
      <table className="qd-tbl">
        <tbody>
          <tr>
            <td>Quotation</td>
            <td style={{ textAlign: 'right' }}>{inr(quotationPaise)}</td>
          </tr>
          <tr>
            <td>Electrical</td>
            <td style={{ textAlign: 'right' }}>{inr(electrical)}</td>
          </tr>
          <tr>
            <td style={{ fontWeight: 700 }}>Total project value</td>
            <td style={{ textAlign: 'right', fontWeight: 700 }}>{inr(quotationPaise + electrical)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
