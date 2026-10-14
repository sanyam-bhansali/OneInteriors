'use client';

import { useActionState } from 'react';
import { setFullSoftwareAction } from './actions';
import type { RecordResult } from '@/modules/verification/record';

/**
 * "Full studio software" (owner, 14 Oct 2026; modules/studio/pilot.ts).
 *
 * Off (the default): the studio has Leads, Quotations, the product master,
 * its settings, Today and Calendar; everything else shows "coming soon".
 * On: the whole Studio OS — projects, design, site mode, the payments desk,
 * crews and the team. Pilot studios only. Every switch is in the audit trail.
 */
export function FullSoftwareControl({ studioId, slug, on }: { studioId: string; slug: string; on: boolean }) {
  const [state, action, pending] = useActionState<RecordResult | null, FormData>(setFullSoftwareAction, null);
  return (
    <div className="border-t border-[var(--color-rule)] pt-4">
      <p className="label m-0 mb-1">Full studio software</p>
      <p className="m-0 mb-3 text-[13px] leading-snug text-[var(--color-ink-2)]">
        {on
          ? 'On: projects, design, site mode, the payments desk, crews and the team are open to this studio.'
          : 'Off: leads, quotations, the product master, settings, Today and Calendar only. The rest shows “coming soon”.'}
      </p>
      <form action={action}>
        <input type="hidden" name="studioId" value={studioId} />
        <input type="hidden" name="slug" value={slug} />
        <input type="hidden" name="on" value={on ? '0' : '1'} />
        <button
          type="submit"
          disabled={pending}
          aria-pressed={on}
          data-testid="full-software-toggle"
          className="rounded-full border border-[var(--color-rule)] px-4 py-1.5 text-[13px] text-[var(--color-ink)] hover:border-[var(--color-petrol)] disabled:opacity-40"
        >
          {pending ? 'Saving…' : on ? 'Switch it off' : 'Switch it on (pilot studio)'}
        </button>
      </form>
      {state && !state.ok ? (
        <p role="alert" className="m-0 mt-2 text-[13px] leading-snug text-[var(--color-atrisk)]">
          {state.error}
        </p>
      ) : null}
    </div>
  );
}
