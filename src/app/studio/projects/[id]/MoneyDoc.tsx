/* eslint-disable @next/next/no-img-element -- short signed storage links on a print page; next/image would proxy and cache them. */
import type { DocIssuer } from '@/modules/project/invoice';
import './money-doc.css';

/**
 * The parts the invoice and the statement share (owner, 21 Nov 2026: the
 * approved sample pages): the studio's header, the signature block and the
 * footer. The signature and stamp are drawn only when uploaded (Settings →
 * Invoices); without them the block is the line, the name and designation.
 */

export const longDay = (day: string) => new Date(`${day}T12:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' });

export function DocHeader({ issuer, title, meta }: { issuer: DocIssuer; title: string; meta: { label: string; value: React.ReactNode }[] }) {
  return (
    <header className="mdoc-head">
      <div className="mdoc-co">
        {issuer.logoUrl ? <img className="mdoc-logo" src={issuer.logoUrl} alt={`${issuer.legalName} logo`} /> : null}
        <b>{issuer.legalName}</b>
        {issuer.address ? <span>{issuer.address}</span> : null}
        <span>
          {issuer.gstin ? (
            <>
              GSTIN: <strong>{issuer.gstin}</strong> ·{' '}
            </>
          ) : null}
          State: {issuer.state}
        </span>
        {issuer.contact ? <span>{issuer.contact}</span> : null}
      </div>
      <div className="mdoc-title">
        <h1>{title}</h1>
        <table>
          <tbody>
            {meta.map((m) => (
              <tr key={m.label}>
                <td>{m.label}</td>
                <td>{m.value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </header>
  );
}

/** "Payments are made to … directly", with the bank details when the owner filled them in. */
export function PaymentNote({ issuer }: { issuer: DocIssuer }) {
  const b = issuer.bank;
  if (!b) return <p>Payments are made to {issuer.legalName} directly.</p>;
  const bits = [b.accountName ? `Account name ${b.accountName}` : null, `Account no. ${b.accountNumber}`, b.ifsc ? `IFSC ${b.ifsc}` : null, b.bankName].filter(Boolean);
  return (
    <p>
      Payments are made to {issuer.legalName} directly. Bank details: {bits.join(' · ')}.
    </p>
  );
}

export function SignBlock({ issuer }: { issuer: DocIssuer }) {
  return (
    <div className="mdoc-sign mdoc-keep">
      <div className="mdoc-signbox">
        <div className="for">For {issuer.legalName}</div>
        <div className="art">
          {issuer.stampUrl ? <img className="stamp" src={issuer.stampUrl} alt={`${issuer.legalName} stamp`} /> : null}
          {issuer.signatureUrl ? <img className="sig" src={issuer.signatureUrl} alt={issuer.signatoryName ? `Signature of ${issuer.signatoryName}` : 'Signature'} /> : null}
        </div>
        <div className="line">
          {issuer.signatoryName ? <span className="name">{issuer.signatoryName}</span> : null}
          {issuer.signatoryName ? <br /> : null}
          <span className="role">{issuer.signatoryDesignation ? `${issuer.signatoryDesignation} · Authorised signatory` : 'Authorised signatory'}</span>
        </div>
      </div>
    </div>
  );
}

export function DocFooter({ issuer, right }: { issuer: DocIssuer; right: string }) {
  return (
    <footer className="mdoc-foot">
      <span>
        {issuer.legalName}
        {issuer.gstin ? ` · GSTIN ${issuer.gstin}` : ''}
      </span>
      <span>{right}</span>
    </footer>
  );
}
