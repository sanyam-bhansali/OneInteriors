'use client';

import { useState, useTransition } from 'react';
import {
  APPROVAL_KINDS,
  DESIGN_GROUP,
  PRE_EXECUTION_GROUP,
  RESPONSIBLE_LABEL,
  RESPONSIBLES,
  type DesignTemplateStep,
} from '@/modules/studio-design/template';
import { resetDesignStepsAction, saveDesignStepsAction } from './actions';

/**
 * The studio's design steps, as rows (docs/studio-os/DESIGN-PROCESS-PLAN.md
 * §1): design or pre-execution, name, who, days after the previous step,
 * effort in hours, the payment that opens it, whether it needs its file, the
 * client's in-app approval that ticks it, the step's to-dos, and its star.
 * Move up or down, add a step below any step, remove; one Save.
 */

type Row = {
  group: string;
  label: string;
  responsible: string;
  days: string;
  hours: string;
  gate: string;
  needsDocument: boolean;
  approval: string;
  tasks: string;
  milestone: boolean;
};

const hoursOf = (min: number): string => String(Math.round((min / 60) * 100) / 100);

const toRow = (s: DesignTemplateStep): Row => ({
  group: s.group,
  label: s.label,
  responsible: s.responsible,
  days: String(s.days),
  hours: hoursOf(s.effortMin),
  gate: s.gate ?? '',
  needsDocument: s.needsDocument,
  approval: s.approval ?? '',
  tasks: s.tasks.join('; '),
  milestone: s.milestone,
});

const blank = (group: string): Row => ({ group, label: '', responsible: 'DESIGNER', days: '1', hours: '1', gate: '', needsDocument: false, approval: '', tasks: '', milestone: false });

const minutes = (hours: string): number => Math.round((Number(hours) || 0) * 60);

export function DesignStepsForm({ initial, custom }: { initial: DesignTemplateStep[]; custom: boolean }) {
  const [rows, setRows] = useState<Row[]>(initial.map(toRow));
  const [pending, start] = useTransition();
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const set = (i: number, patch: Partial<Row>) => setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const move = (i: number, by: number) =>
    setRows((rs) => {
      const j = i + by;
      if (j < 0 || j >= rs.length) return rs;
      const out = [...rs];
      [out[i], out[j]] = [out[j]!, out[i]!];
      return out;
    });
  const addBelow = (i: number) => setRows((rs) => [...rs.slice(0, i + 1), blank(rs[i]?.group ?? DESIGN_GROUP), ...rs.slice(i + 1)]);
  const totals = (group: string) => {
    const g = rows.filter((r) => r.group === group);
    return { steps: g.length, days: g.reduce((a, r) => a + (Number(r.days) || 0), 0), hours: Math.round(g.reduce((a, r) => a + minutes(r.hours), 0) / 6) / 10 };
  };
  const design = totals(DESIGN_GROUP);
  const pre = totals(PRE_EXECUTION_GROUP);
  const save = () =>
    start(async () => {
      setMessage(null);
      const r = await saveDesignStepsAction(
        rows.map((x) => ({
          group: x.group,
          label: x.label,
          responsible: x.responsible,
          days: Number(x.days),
          effortMin: minutes(x.hours),
          gate: x.gate,
          needsDocument: x.needsDocument,
          approval: x.approval || null,
          tasks: x.tasks
            .split(';')
            .map((t) => t.trim())
            .filter(Boolean),
          milestone: x.milestone,
        })),
      );
      setMessage(r.ok ? { ok: true, text: r.message } : { ok: false, text: r.error });
    });
  return (
    <div className="flex flex-col gap-3">
      <div className="card overflow-x-auto p-0">
        <table className="w-full min-w-[1080px] border-collapse text-[13.5px]">
          <thead>
            <tr className="text-left text-[12px] muted">
              <th className="px-2 py-2 font-medium" title="A milestone: one of the big moments">
                ★
              </th>
              <th className="px-2 py-2 font-medium">Part</th>
              <th className="px-3 py-2 font-medium">Step</th>
              <th className="px-2 py-2 font-medium">Who</th>
              <th className="px-2 py-2 font-medium" title="Days after the step before it, for a 2 BHK. 0 = the same day.">
                Days after
              </th>
              <th className="px-2 py-2 font-medium" title="Hours of work for a 2 BHK. A step's share of design progress is its hours over the total.">
                Effort (h)
              </th>
              <th className="px-2 py-2 font-medium">Opens when paid</th>
              <th className="px-2 py-2 font-medium">Needs file</th>
              <th className="px-2 py-2 font-medium" title="On a client's step: the approval in the app that ticks it">
                Ticked by
              </th>
              <th className="px-2 py-2 font-medium" title="Small to-dos inside the step, separated by ;">
                Tasks
              </th>
              <th className="px-2 py-2" />
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className={`border-t border-[var(--s-rule-soft)] ${r.group === PRE_EXECUTION_GROUP ? 'bg-[var(--s-paper-2)]' : ''}`}>
                <td className="px-2 py-1.5 text-center">
                  <input aria-label={`Step ${i + 1}: a milestone`} type="checkbox" checked={r.milestone} onChange={(e) => set(i, { milestone: e.target.checked })} className="h-4 w-4" />
                </td>
                <td className="px-2 py-1.5">
                  <select aria-label={`Step ${i + 1} part`} value={r.group} onChange={(e) => set(i, { group: e.target.value })} className="fld">
                    <option value={DESIGN_GROUP}>Design</option>
                    <option value={PRE_EXECUTION_GROUP}>Pre-execution</option>
                  </select>
                </td>
                <td className="px-3 py-1.5">
                  <input aria-label={`Step ${i + 1} name`} value={r.label} onChange={(e) => set(i, { label: e.target.value })} maxLength={120} className="fld w-full min-w-[200px]" />
                </td>
                <td className="px-2 py-1.5">
                  <select aria-label={`Step ${i + 1} who`} value={r.responsible} onChange={(e) => set(i, { responsible: e.target.value, ...(e.target.value === 'CLIENT' ? {} : { approval: '' }) })} className="fld">
                    {RESPONSIBLES.map((x) => (
                      <option key={x} value={x}>
                        {RESPONSIBLE_LABEL[x]}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-2 py-1.5">
                  <input aria-label={`Step ${i + 1} days`} type="number" min={0} max={30} value={r.days} onChange={(e) => set(i, { days: e.target.value })} className="fld w-[64px] fit" />
                </td>
                <td className="px-2 py-1.5">
                  <input aria-label={`Step ${i + 1} effort in hours`} type="number" min={0} max={40} step={0.25} value={r.hours} onChange={(e) => set(i, { hours: e.target.value })} className="fld w-[70px] fit" />
                </td>
                <td className="px-2 py-1.5">
                  <input aria-label={`Step ${i + 1} payment`} value={r.gate} onChange={(e) => set(i, { gate: e.target.value })} maxLength={40} placeholder="e.g. design advance" className="fld w-[140px] fit" />
                </td>
                <td className="px-2 py-1.5 text-center">
                  <input aria-label={`Step ${i + 1} needs its file`} type="checkbox" checked={r.needsDocument} onChange={(e) => set(i, { needsDocument: e.target.checked })} />
                </td>
                <td className="px-2 py-1.5">
                  {r.responsible === 'CLIENT' ? (
                    <select aria-label={`Step ${i + 1} ticked by`} value={r.approval} onChange={(e) => set(i, { approval: e.target.value })} className="fld w-[150px] fit">
                      <option value="">Ticked by hand</option>
                      {Object.entries(APPROVAL_KINDS).map(([k, v]) => (
                        <option key={k} value={k}>
                          {v.replace('The client ', '')}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <span className="muted">—</span>
                  )}
                </td>
                <td className="px-2 py-1.5">
                  <input aria-label={`Step ${i + 1} tasks`} value={r.tasks} onChange={(e) => set(i, { tasks: e.target.value })} placeholder="Task; another task" className="fld w-[180px] fit" />
                </td>
                <td className="whitespace-nowrap px-2 py-1.5">
                  <button type="button" className="btn ghost sm min-h-[32px] px-2 text-[13px]" onClick={() => move(i, -1)} aria-label={`Move step ${i + 1} up`}>
                    ↑
                  </button>
                  <button type="button" className="btn ghost sm min-h-[32px] px-2 text-[13px]" onClick={() => move(i, 1)} aria-label={`Move step ${i + 1} down`}>
                    ↓
                  </button>
                  <button type="button" className="btn ghost sm min-h-[32px] px-2 text-[13px]" onClick={() => addBelow(i)} aria-label={`Add a step below step ${i + 1}`}>
                    + below
                  </button>
                  <button type="button" className="btn ghost sm min-h-[32px] px-2 text-[13px]" onClick={() => setRows((rs) => rs.filter((_, j) => j !== i))} aria-label={`Remove step ${i + 1}`}>
                    Remove
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="m-0 text-[12.5px] muted">
        Design: {design.steps} steps · {design.days} days · {design.hours} hours. Pre-execution: {pre.steps} steps · {pre.days} days · {pre.hours} hours. For a 2 BHK; a 3 BHK is 20% more. A
        client&apos;s step that is late is the client&apos;s delay. The payment is matched by name to each project&apos;s payment stages (&ldquo;design advance&rdquo; matches &ldquo;Design advance
        5%&rdquo;), and every step after it waits for it too.
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className="btn ghost sm min-h-[40px]" onClick={() => setRows((rs) => [...rs, blank(rs[rs.length - 1]?.group ?? DESIGN_GROUP)])}>
          + Add a step at the end
        </button>
        <button type="button" className="btn pri sm min-h-[40px]" disabled={pending} onClick={save}>
          Save the design steps
        </button>
        {custom ? (
          <button
            type="button"
            className="btn ghost sm min-h-[40px]"
            disabled={pending}
            onClick={() =>
              start(async () => {
                const r = await resetDesignStepsAction();
                setMessage(r.ok ? { ok: true, text: r.message } : { ok: false, text: r.error });
              })
            }
          >
            Back to the standard steps
          </button>
        ) : null}
      </div>
      {message ? (
        <p role={message.ok ? 'status' : 'alert'} className={`m-0 text-[13px] ${message.ok ? 'good-t' : 'bad-t'}`}>
          {message.text}
        </p>
      ) : null}
    </div>
  );
}
