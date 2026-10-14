'use client';

import { useState, useTransition } from 'react';
import { formatINR } from '@/lib/money';
import { approveProposalAction, rejectProposalAction } from './actions';

export interface ProposalView {
  id: string;
  name: string;
  code: 'MODULAR' | 'ONSITE';
  unit: 'AREA' | 'SQFT' | 'RFT' | 'UNIT';
  ratePaise: number;
  details: string | null;
  room: string | null;
  proposedBy: string | null;
  createdOn: string;
}

const PER: Record<ProposalView['unit'], string> = { AREA: '/sq ft (W × H)', SQFT: '/sq ft', RFT: '/rft', UNIT: '/unit' };

/**
 * Proposed products (Hauspire's Products → proposals): lines a salesperson
 * added from the quotation builder that the product master does not have.
 * Approve adds it to the product master; Reject leaves it only on the
 * quotations it was used on.
 */
export function Proposals({ rows }: { rows: ProposalView[] }) {
  const [said, setSaid] = useState<string | null>(null);
  const [gone, setGone] = useState<string[]>([]);
  const [pending, start] = useTransition();
  const shown = rows.filter((r) => !gone.includes(r.id));
  if (rows.length === 0) return null;

  const act = (id: string, approve: boolean) =>
    start(async () => {
      try {
        const r = approve ? await approveProposalAction(id) : await rejectProposalAction(id);
        setSaid(r.ok ? r.message : r.error);
        if (r.ok) setGone((g) => [...g, id]);
      } catch {
        setSaid('That did not go through. Try again.');
      }
    });

  return (
    <section className="card flush pnote" aria-label="Proposed products">
      <div className="chead">
        <h2>Proposed — waiting for your approval</h2>
        <span className="chip warn">
          <span className="dot" />
          {shown.length} proposed
        </span>
      </div>
      {said ? (
        <p className="muted sm" role="status" style={{ margin: '0 20px 8px' }}>
          {said}
        </p>
      ) : null}
      {shown.length > 0 ? (
        <div className="tscroll">
          <table className="tbl" style={{ minWidth: 720 }}>
            <thead>
              <tr>
                <th scope="col">Product</th>
                <th scope="col">Code</th>
                <th scope="col" style={{ textAlign: 'right' }}>
                  Rate
                </th>
                <th scope="col">Proposed</th>
                <th scope="col">
                  <span className="sr-only">Decide</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {shown.map((r) => (
                <tr key={r.id}>
                  <td>
                    <b style={{ fontWeight: 600 }}>{r.name}</b>
                    {r.details ? <div className="muted sm">{r.details}</div> : null}
                  </td>
                  <td>{r.code === 'MODULAR' ? 'MO-01' : 'NM-01'}</td>
                  <td className="mono" style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                    {formatINR(r.ratePaise)}
                    <span className="muted sm"> {PER[r.unit]}</span>
                  </td>
                  <td className="muted sm">
                    {[r.proposedBy, r.room, r.createdOn].filter(Boolean).join(' · ')}
                  </td>
                  <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                    <button type="button" className="btn pri sm" disabled={pending} onClick={() => act(r.id, true)}>
                      Approve
                    </button>{' '}
                    <button type="button" className="btn sec sm" disabled={pending} onClick={() => act(r.id, false)}>
                      Reject
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  );
}
