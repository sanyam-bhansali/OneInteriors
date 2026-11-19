'use client';

import { useState } from 'react';
import type { LeadPlan } from '@/modules/studio-quote/from-plan';

/**
 * The lead's floor plan in view while the quotation is made (owner, 19 Nov
 * 2026: "floor plan should be visible to Khushi and Swarupa when they are
 * making quotation"). The plan itself, image or PDF, from a short signed
 * link, with the note the salesperson typed when they uploaded it.
 */
export function PlanViewer({ plans, leadName, empty }: { plans: LeadPlan[]; leadName: string; empty?: string }) {
  const [at, setAt] = useState(0);
  const plan = plans[Math.min(at, plans.length - 1)];
  if (!plan) return <p className="muted hempty">{empty ?? `No floor plan on ${leadName}’s lead yet.`}</p>;
  const pdf = plan.contentType === 'application/pdf';
  return (
    <div className="hplan" data-testid="plan-viewer">
      <div className="hstack" style={{ gap: 8, flexWrap: 'wrap', justifyContent: 'space-between' }}>
        {plans.length > 1 ? (
          <select className="fld hfld" style={{ width: 'auto', maxWidth: '100%' }} value={at} onChange={(e) => setAt(Number(e.target.value))} aria-label="Which floor plan">
            {plans.map((p, i) => (
              <option key={p.id} value={i}>
                {p.name} · {when(p.createdAt)}
              </option>
            ))}
          </select>
        ) : (
          <b className="sm" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>
            {plan.name}
          </b>
        )}
        <span className="muted sm">
          {plan.uploadedByName ? `${plan.uploadedByName} · ` : ''}
          {when(plan.createdAt)}
          {plan.url ? (
            <>
              {' · '}
              <a href={plan.url} target="_blank" rel="noreferrer" className="acc-t">
                Open full size
              </a>
            </>
          ) : null}
        </span>
      </div>
      {plan.note ? (
        <p className="qnote hplannote" data-testid="plan-note">
          <b>Note with the plan:</b> {plan.note}
        </p>
      ) : null}
      {!plan.url ? (
        <p className="muted hempty">This plan cannot be shown here: it was not stored (local copy), or the link could not be made. Try reloading.</p>
      ) : pdf ? (
        <iframe src={plan.url} title={`Floor plan: ${plan.name}`} className="hplanframe" />
      ) : (
        // eslint-disable-next-line @next/next/no-img-element -- a short signed link to a private file; next/image would cache it
        <img src={plan.url} alt={`Floor plan: ${plan.name}`} className="hplanimg" />
      )}
    </div>
  );
}

function when(d: Date | string): string {
  return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: 'Asia/Kolkata' });
}
