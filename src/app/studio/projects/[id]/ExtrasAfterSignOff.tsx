import { formatINR } from '@/lib/money';

/**
 * "Extras after sign-off" on the quotation's document (change orders, owner
 * 15 Oct 2026): every change order the client approved, priced from this
 * quotation, as its own section after the signed lines — which it never
 * changes. No hooks, so the print page renders it on the server.
 */
export function ExtrasAfterSignOff({
  extras,
}: {
  extras: { number: number; title: string; status: string; workPaise: number; discountPaise: number; gstPaise: number; totalPaise: number; approvedOn: string | null }[];
}) {
  if (!extras.length) return null;
  const total = extras.reduce((a, e) => a + e.totalPaise, 0);
  return (
    <div className="qd-keep" style={{ marginBottom: '5mm' }} data-testid="extras-after-signoff">
      <p className="qd-bandline">Extras after sign-off</p>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th style={{ textAlign: 'left', padding: '4px 6px' }}>#</th>
            <th style={{ textAlign: 'left', padding: '4px 6px' }}>Extra work</th>
            <th style={{ textAlign: 'left', padding: '4px 6px' }}>Approved</th>
            <th style={{ textAlign: 'right', padding: '4px 6px' }}>Before GST</th>
            <th style={{ textAlign: 'right', padding: '4px 6px' }}>GST</th>
            <th style={{ textAlign: 'right', padding: '4px 6px' }}>Amount</th>
          </tr>
        </thead>
        <tbody>
          {extras.map((e) => (
            <tr key={e.number}>
              <td style={{ padding: '4px 6px' }}>{e.number}</td>
              <td style={{ padding: '4px 6px' }}>{e.title}</td>
              <td style={{ padding: '4px 6px' }}>{e.approvedOn ?? ''}</td>
              <td style={{ padding: '4px 6px', textAlign: 'right' }}>{formatINR(e.workPaise - e.discountPaise)}</td>
              <td style={{ padding: '4px 6px', textAlign: 'right' }}>{formatINR(e.gstPaise)}</td>
              <td style={{ padding: '4px 6px', textAlign: 'right' }}>{formatINR(e.totalPaise)}</td>
            </tr>
          ))}
          <tr>
            <td colSpan={5} style={{ padding: '4px 6px', fontWeight: 700 }}>
              Total extras after sign-off (approved by the client, GST included)
            </td>
            <td style={{ padding: '4px 6px', textAlign: 'right', fontWeight: 700 }}>{formatINR(total)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
