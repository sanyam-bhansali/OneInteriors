'use client';

import Link from 'next/link';
import { useState, useTransition } from 'react';
import type { SwitchRow as Row } from '@/modules/studio-design/switch-steps';
import { switchProjectAction, standardStepsAction } from './actions';

/**
 * One project: where it is now (a step of the new list), then "Move it".
 * Everything before the step picked is ticked as done before the switch.
 */
export function SwitchRow({ row, steps }: { row: Row; steps: { label: string; group: string }[] }) {
  const [at, setAt] = useState('');
  const [pending, start] = useTransition();
  const [said, setSaid] = useState<{ ok: boolean; text: string } | null>(null);
  return (
    <tr className="border-t border-[var(--s-rule-soft)] align-top">
      <td className="px-3 py-2">
        <Link href={`/studio/projects/${row.projectId}?tab=design`} className="font-medium">
          {row.client}
        </Link>
        <div className="muted sm">{row.home}</div>
      </td>
      <td className="px-2 py-2 sm">{row.designer ?? <span className="muted">No designer</span>}</td>
      <td className="px-2 py-2 sm">
        {row.oldTotal ? (
          <>
            {row.oldDone} of {row.oldTotal} old steps done
            {row.oldAt ? <div className="muted">At: {row.oldAt}</div> : null}
          </>
        ) : (
          <span className="muted">No steps</span>
        )}
      </td>
      <td className="px-2 py-2">
        {row.switched ? (
          <span className="chip good">On the new steps</span>
        ) : (
          <div className="flex flex-col gap-1.5">
            <div className="flex flex-wrap items-center gap-1.5">
              <select aria-label={`Where ${row.client}'s project is now`} value={at} onChange={(e) => setAt(e.target.value)} className="fld max-w-[300px]">
                <option value="">Where is it now?</option>
                {steps.map((s, i) => (
                  <option key={i} value={i}>
                    {i + 1}. {s.label}
                    {s.group === 'Pre-execution' ? ' (pre-execution)' : ''}
                  </option>
                ))}
                <option value={steps.length}>Every step done</option>
              </select>
              <button
                type="button"
                className="btn pri sm"
                disabled={pending || at === ''}
                onClick={() =>
                  start(async () => {
                    const r = await switchProjectAction(row.projectId, Number(at));
                    setSaid(r.ok ? { ok: true, text: r.message } : { ok: false, text: r.error });
                  })
                }
              >
                Move it
              </button>
            </div>
            {at !== '' && Number(at) > 0 ? <span className="muted sm">Steps 1 to {Math.min(Number(at), steps.length)} are ticked as done before the switch.</span> : null}
          </div>
        )}
        {said ? (
          <p role={said.ok ? 'status' : 'alert'} className={`m-0 mt-1 sm ${said.ok ? 'good-t' : 'bad-t'}`}>
            {said.text}
          </p>
        ) : null}
      </td>
    </tr>
  );
}

/** For a studio that saved the old steps: back to the standard (new) ones before moving any project. */
export function UseStandardSteps() {
  const [pending, start] = useTransition();
  const [said, setSaid] = useState<string | null>(null);
  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <button
        type="button"
        className="btn pri sm"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const r = await standardStepsAction();
            setSaid(r.ok ? r.message : r.error);
          })
        }
      >
        Use the new standard steps
      </button>
      {said ? <span className="sm">{said}</span> : null}
    </span>
  );
}
