'use client';

import { useActionState } from 'react';
import { setSoftwarePlanAction } from './actions';
import type { RecordResult } from '@/modules/verification/record';
import { SOFTWARE_PLANS, type SoftwarePlan } from '@/modules/studio/software-plan';

/**
 * The studio CRM plan (owner, 24 Nov 2026; modules/studio/software-plan.ts).
 *
 * Free: one person, leads and quotations, with limits (a studio still on the
 * old Pro Solo shows as Free with its limits waived). Pro: a sales team. Max:
 * the full Studio OS — projects from design to warranty, site mode, the
 * payments desk, crews, the team and the client app. Every change is in the
 * audit trail; no change deletes anything.
 */
export function SoftwarePlanControl({ studioId, slug, plan, legacySolo = false }: { studioId: string; slug: string; plan: SoftwarePlan; legacySolo?: boolean }) {
  const [state, action, pending] = useActionState<RecordResult | null, FormData>(setSoftwarePlanAction, null);
  return (
    <div className="border-t border-[var(--color-rule)] pt-4" data-testid="software-plan">
      <p className="label m-0 mb-1">Studio CRM plan</p>
      <p className="m-0 mb-3 text-[13px] leading-snug text-[var(--color-ink-2)]">
        On <b>{SOFTWARE_PLANS[plan].name}</b>: {SOFTWARE_PLANS[plan].line}{' '}
        {plan === 'MAX'
          ? 'Every part of the studio software is open.'
          : plan === 'FREE'
            ? `One login, no team screen or lead pool; projects, site mode, payments and crews show “coming soon”.${legacySolo ? ' Was Pro Solo, so the Free limits do not apply yet.' : ' Free limits apply: open leads, new quotations printed a month, file storage.'}`
            : 'Projects, site mode, payments, crews and the team show “coming soon”.'}
      </p>
      <div className="flex flex-wrap gap-2">
        {(['FREE', 'PRO', 'MAX'] as const).map((p) => (
          <form key={p} action={action}>
            <input type="hidden" name="studioId" value={studioId} />
            <input type="hidden" name="slug" value={slug} />
            <input type="hidden" name="plan" value={p} />
            <button
              type="submit"
              disabled={pending || (plan === p && !legacySolo)}
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
