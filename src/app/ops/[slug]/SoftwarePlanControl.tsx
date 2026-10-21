'use client';

import { useActionState } from 'react';
import { setSoftwarePlanAction } from './actions';
import type { RecordResult } from '@/modules/verification/record';
import { SOFTWARE_PLANS, type SoftwarePlan } from '@/modules/studio/software-plan';

/**
 * The studio software plan (owner, 19 Oct 2026; modules/studio/software-plan.ts).
 *
 * Pro Solo (owner, 21 Oct 2026): Pro for a one-person company, one login.
 * Pro (every studio): Leads, Quotations, the product master, settings, Today
 * and Calendar; the rest shows "coming soon". Max: the full Studio OS —
 * projects from design to warranty, site mode, the payments desk, crews, the
 * team and the client app's approvals. Hauspire only while it is tested.
 * Every change is in the audit trail.
 */
export function SoftwarePlanControl({ studioId, slug, plan }: { studioId: string; slug: string; plan: SoftwarePlan }) {
  const [state, action, pending] = useActionState<RecordResult | null, FormData>(setSoftwarePlanAction, null);
  return (
    <div className="border-t border-[var(--color-rule)] pt-4" data-testid="software-plan">
      <p className="label m-0 mb-1">Studio software plan</p>
      <p className="m-0 mb-3 text-[13px] leading-snug text-[var(--color-ink-2)]">
        On <b>{SOFTWARE_PLANS[plan].name}</b>: {SOFTWARE_PLANS[plan].line}{' '}
        {plan === 'MAX' ? 'Every part of the studio software is open.' : plan === 'SOLO' ? 'One login, no team screen or lead pool; projects, site mode, payments and crews show “coming soon”.' : 'Projects, site mode, payments, crews and the team show “coming soon”.'}
      </p>
      <div className="flex flex-wrap gap-2">
        {(['SOLO', 'PRO', 'MAX'] as const).map((p) => (
          <form key={p} action={action}>
            <input type="hidden" name="studioId" value={studioId} />
            <input type="hidden" name="slug" value={slug} />
            <input type="hidden" name="plan" value={p} />
            <button
              type="submit"
              disabled={pending || plan === p}
              aria-pressed={plan === p}
              data-testid={`plan-${p.toLowerCase()}`}
              className={`rounded-full border px-4 py-1.5 text-[13px] disabled:cursor-default ${
                plan === p
                  ? 'border-[var(--color-petrol)] bg-[var(--color-petrol)] text-[var(--color-paper)]'
                  : 'border-[var(--color-rule)] text-[var(--color-ink)] hover:border-[var(--color-petrol)]'
              }`}
            >
              {pending ? 'Saving…' : plan === p ? `${SOFTWARE_PLANS[p].name} (current)` : `Move to ${SOFTWARE_PLANS[p].name}`}
            </button>
          </form>
        ))}
      </div>
      {state && !state.ok ? (
        <p role="alert" className="m-0 mt-2 text-[13px] leading-snug text-[var(--color-atrisk)]">
          {state.error}
        </p>
      ) : null}
    </div>
  );
}
