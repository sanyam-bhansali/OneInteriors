import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { formatINR } from '@/lib/money';
import { crewDetail } from '@/modules/studio-crews/store';
import { KYC_DOCS } from '@/modules/studio-crews/kyc';
import { tradeLabel } from '@/modules/studio-crews/trades';
import { ArchiveCrew, CrewForm, KycScan, RateCard } from '../CrewForms';
import { WorkOrderCard } from '../crews-ui';
import { dayWords } from '../format';
import { LineIcon } from '../../ui/icons';
import '../../office-ui.css';
import '../vendors.css';

export const metadata: Metadata = { title: 'Crew', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

/**
 * One crew (Studio OS Phase 3): who they are and how to pay them, their KYC
 * scans (private; owner and accounts), their rate card, their work orders on
 * every live project, and every payment — the crew's statement on screen.
 * The look is the owner's handoff (Vendors): the crew's card with call and
 * WhatsApp, the money strip, then the work orders and the ledger.
 */
export default async function CrewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const c = await crewDetail(id.slice(0, 64));
  if (!c) notFound();
  const tradeWords = c.trades.map((t) => tradeLabel(c.settings.trades, t)).join(', ');
  const wa = c.phone ? c.phone.replace(/\D/g, '').replace(/^(\d{10})$/, '91$1') : null;
  return (
    <main className="content ox-page">
      <div className="phead">
        <div>
          <Link href="/studio/vendors" className="vd-back">
            ← Crews
          </Link>
          <h1 style={{ marginTop: 4 }}>{c.name}</h1>
          <p className="muted">
            {[tradeWords, c.kind === 'PERMANENT' ? 'Permanent' : 'Temporary', c.workingSince ? `working with you since ${c.workingSince}` : null].filter(Boolean).join(' · ')}
          </p>
        </div>
        <ArchiveCrew id={c.id} archived={c.archived} />
      </div>

      <section className="card" aria-labelledby="h-crew">
        <div className="chead">
          <div>
            <h2 id="h-crew">{c.name}</h2>
            <span className="muted sm">
              {tradeWords || 'No trade yet'}
              {c.phone ? (
                <>
                  {' · '}
                  <span className="mono">{c.phone}</span>
                </>
              ) : null}
            </span>
          </div>
          {c.phone ? (
            <div className="hstack">
              <a href={`tel:${c.phone}`} className="btn ghost sm">
                <LineIcon name="phone" size={16} />
                Call
              </a>
              {wa ? (
                <a href={`https://wa.me/${wa}`} target="_blank" rel="noopener noreferrer" className="btn ghost sm">
                  <LineIcon name="chat" size={16} />
                  WhatsApp
                </a>
              ) : null}
            </div>
          ) : null}
        </div>
        <div className="money">
          <div>
            <span className="muted sm">Billed</span>
            <b className="mono">{formatINR(c.totals.billPaise)}</b>
            <span className="muted sm">
              {c.orders.length} work order{c.orders.length === 1 ? '' : 's'}
            </span>
          </div>
          <div>
            <span className="muted sm">Paid</span>
            <b className="mono">{formatINR(c.totals.paidPaise)}</b>
            <span className="muted sm">
              {c.payments.length} entr{c.payments.length === 1 ? 'y' : 'ies'}
            </span>
          </div>
          <div className="vd-due">
            <span className="sm">Running balance</span>
            <b className="mono">{formatINR(c.totals.balancePaise)}</b>
            <span className="sm">{c.totals.open ? `across ${c.totals.open} open work order${c.totals.open === 1 ? '' : 's'}` : 'everything settled'}</span>
          </div>
        </div>
      </section>

      <section className="vd-two">
        <div className="card">
          <div className="chead">
            <div>
              <h2>Details</h2>
              <span className="muted sm">
                {c.kyc.label}
                {c.panNumber ? ` · PAN ${c.panNumber}${c.panHolder ? ` (${c.panHolder})` : ''}` : ''}
                {c.hasAadhaar ? ` · Aadhaar ${c.aadhaar}` : ''}
                {c.kycCheckedAt ? ` · checked ${dayWords(c.kycCheckedAt)}` : ''}
              </span>
            </div>
          </div>
          <CrewForm
            trades={c.settings.trades}
            initial={{
              id: c.id,
              name: c.name,
              kind: c.kind,
              trades: c.trades,
              phone: c.phone ?? '',
              altPhone: c.altPhone ?? '',
              address: c.address ?? '',
              workingSince: c.workingSince ?? '',
              notes: c.notes ?? '',
              panNumber: c.panNumber,
              aadhaarMasked: c.hasAadhaar ? c.aadhaar : null,
              upiId: c.upiId ?? '',
              bankAccountName: c.bankAccountName ?? '',
              bankAccountNumber: c.bankAccountNumber ?? '',
              bankIfsc: c.bankIfsc ?? '',
            }}
          />
        </div>
        <div className="card">
          <div className="chead">
            <h2>Scans</h2>
            <span className="team">
              <LineIcon name="lock" size={14} />
              Owner and accounts only
            </span>
          </div>
          <span className="muted sm">Private: only the owner and accounts can open them. JPG, PNG, WebP or PDF, up to 3.8 MB.</span>
          <div className="vd-scans">
            {KYC_DOCS.map((d) => {
              const doc = c.docs.find((x) => x.doc === d)!;
              return <KycScan key={d} crewId={c.id} doc={d} onFile={doc.onFile} link={doc.link} />;
            })}
          </div>
        </div>
      </section>

      <section className="card" aria-labelledby="h-rates">
        <div className="chead">
          <div>
            <h2 id="h-rates">Rate card</h2>
            <span className="muted sm">Lines with width × height are priced as sq ft × these rates when a work order is raised. A blank rate means &ldquo;agree it per job&rdquo;.</span>
          </div>
          <span className="team">
            <LineIcon name="lock" size={14} />
            Only your team sees crew rates
          </span>
        </div>
        <RateCard crewId={c.id} rates={c.rates} trades={c.settings.trades} crewTrades={c.trades} />
      </section>

      <section style={{ display: 'flex', flexDirection: 'column', gap: 12 }} aria-labelledby="h-orders">
        <div className="chead">
          <h2 id="h-orders" style={{ margin: 0, fontSize: 17, fontWeight: 600 }}>
            Work orders
          </h2>
        </div>
        {c.orders.length === 0 ? (
          <div className="empty">
            <b>None yet</b>
            <span className="muted sm">Work orders are raised on a project&apos;s Crews tab.</span>
          </div>
        ) : (
          <ul className="vd-orders">
            {c.orders.map((o) => (
              <WorkOrderCard key={o.id} order={o} projectId={o.projectId} canBuild={false} seesMoney canPay advanceLimitPaise={c.settings.advanceLimitPaise} showProject />
            ))}
          </ul>
        )}
      </section>

      <section className="card flush" aria-labelledby="h-ledger">
        <div className="chead">
          <h2 id="h-ledger">Payment ledger</h2>
          <span className="muted sm">Every rupee paid to {c.name}, newest first</span>
        </div>
        {c.payments.length === 0 ? (
          <p className="muted sm" style={{ margin: 0, padding: '0 18px 18px' }}>
            Nothing paid yet.
          </p>
        ) : (
          <div className="tscroll">
            <table className="tbl" style={{ minWidth: 560 }}>
              <thead>
                <tr>
                  <th scope="col">Date</th>
                  <th scope="col">Project</th>
                  <th scope="col">What</th>
                  <th scope="col" style={{ textAlign: 'right' }}>
                    Amount
                  </th>
                </tr>
              </thead>
              <tbody>
                {c.payments.map((p) => (
                  <tr key={p.id}>
                    <td className="mono">{dayWords(p.paidOn)}</td>
                    <td>{p.projectName}</td>
                    <td className="muted">
                      {p.kind === 'ADVANCE' ? 'Advance' : p.kind === 'CORRECTION' ? 'Correction' : (p.note ?? 'Payment')} · {p.mode}
                    </td>
                    <td className="mono" style={{ textAlign: 'right' }}>
                      {formatINR(p.amountPaise)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
