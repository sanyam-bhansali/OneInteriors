'use client';

import { useState, useTransition } from 'react';
import { HAUSPIRE_PIPELINE, planPreset, presetSummary, type ExistingStage } from '@/modules/studio-practice/pipeline-preset';
import { applyHauspireAction } from './actions';

/**
 * "Use the Hauspire pipeline" — one click to Hauspire's columns (owner,
 * 12 Oct 2026). Says exactly what it will add and rename before it does
 * anything; never deletes a column.
 */
export function HauspirePreset({ stages }: { stages: ExistingStage[] }) {
  const [asking, setAsking] = useState(false);
  const [pending, start] = useTransition();
  const [said, setSaid] = useState<{ ok: boolean; text: string } | null>(null);
  const plan = planPreset(stages);
  return (
    <div className="s-card mb-5 p-5">
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="m-0 text-[14.5px] font-semibold">Use the Hauspire pipeline</p>
          <p className="m-0 mt-1 text-[13px] leading-relaxed text-[var(--s-ink-2)]">{HAUSPIRE_PIPELINE.map((s) => s.name).join(' → ')}</p>
        </div>
        {!asking ? (
          <button type="button" onClick={() => setAsking(true)} className="s-btn-ghost">
            Use it
          </button>
        ) : null}
      </div>
      {asking ? (
        <div className="mt-3 flex flex-wrap items-center gap-2 text-[13.5px]">
          <span className="text-[var(--s-ink-2)]">{presetSummary(plan)}</span>
          <button
            type="button"
            disabled={pending}
            onClick={() =>
              start(async () => {
                const r = await applyHauspireAction();
                setSaid('error' in r ? { ok: false, text: r.error } : { ok: true, text: 'Done. Your pipeline now follows Hauspire’s.' });
                setAsking(false);
              })
            }
            className="s-btn"
          >
            {pending ? 'Applying…' : 'Yes, apply it'}
          </button>
          <button type="button" onClick={() => setAsking(false)} className="text-[13px] underline">
            Cancel
          </button>
        </div>
      ) : null}
      {said ? (
        <p role={said.ok ? 'status' : 'alert'} className={`m-0 mt-2 text-[13px] ${said.ok ? 'text-[var(--s-good)]' : 'text-[var(--s-bad)]'}`}>
          {said.text}
        </p>
      ) : null}
    </div>
  );
}
