'use client';

import { useState, useTransition } from 'react';
import { studioStageDoneAction } from './actions';

/**
 * The project's stages, ticked off by the studio as the site gets there. The
 * customer's tracker reads the same ticks.
 */
export function StageTicks({
  projectId,
  stages,
}: {
  projectId: string;
  stages: { key: string; label: string; state: string }[];
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex flex-wrap gap-x-4 gap-y-2">
        {stages.map((s) => (
          <label key={s.key} className="flex cursor-pointer items-center gap-2 text-[13.5px]">
            <input
              type="checkbox"
              defaultChecked={s.state === 'done'}
              disabled={pending}
              onChange={(e) => {
                const done = e.target.checked;
                start(async () => {
                  const r = await studioStageDoneAction(projectId, s.key, done);
                  setError(r.ok ? null : (r.error ?? 'That did not save.'));
                });
              }}
              className="h-[15px] w-[15px] accent-[var(--acc)]"
            />
            {s.label}
          </label>
        ))}
      </div>
      {error ? <p className="m-0 text-[12.5px] text-[var(--bad)]">{error}</p> : null}
    </div>
  );
}
