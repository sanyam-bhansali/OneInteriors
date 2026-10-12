'use client';

import { useState, useTransition } from 'react';
import { RESPONSIBLE_LABEL, RESPONSIBLES, type DesignTemplateStep } from '@/modules/studio-design/template';
import { milestoneWarning } from '@/modules/project/step-rules';
import { resetDesignStepsAction, saveDesignStepsAction } from './actions';

/**
 * The studio's design steps, as rows: name, who, days after the previous
 * step, the payment that opens it, whether it needs its file, its weight,
 * and its star: a starred step is a milestone the client sees
 * (docs/studio-os/CUSTOMER-MILESTONES.md). Move up or down, add, remove; one Save.
 */

type Row = { label: string; responsible: string; days: string; gate: string; needsDocument: boolean; weight: string; milestone: boolean };

const toRow = (s: DesignTemplateStep): Row => ({
  label: s.label,
  responsible: s.responsible,
  days: String(s.days),
  gate: s.gate ?? '',
  needsDocument: s.needsDocument,
  weight: String(s.weight),
  milestone: s.milestone,
});

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
  const total = rows.reduce((a, r) => a + (Number(r.days) || 0), 0);
  const stars = rows.filter((r) => r.milestone).length;
  const warn = milestoneWarning(stars);
  const save = () =>
    start(async () => {
      setMessage(null);
      const r = await saveDesignStepsAction(rows.map((x) => ({ label: x.label, responsible: x.responsible, days: Number(x.days), gate: x.gate, needsDocument: x.needsDocument, weight: Number(x.weight), milestone: x.milestone })));
      setMessage(r.ok ? { ok: true, text: r.message } : { ok: false, text: r.error });
    });
  return (
    <div className="flex flex-col gap-3">
      <div className="s-card overflow-x-auto p-0">
        <table className="w-full min-w-[760px] border-collapse text-[13.5px]">
          <thead>
            <tr className="text-left text-[12px] text-[var(--s-ink-3)]">
              <th className="px-2 py-2 font-medium" title="Starred steps are what the client sees">
                ★ Client sees
              </th>
              <th className="px-3 py-2 font-medium">Step</th>
              <th className="px-2 py-2 font-medium">Who</th>
              <th className="px-2 py-2 font-medium">Days after</th>
              <th className="px-2 py-2 font-medium">Opens when paid</th>
              <th className="px-2 py-2 font-medium">Needs file</th>
              <th className="px-2 py-2 font-medium">Weight</th>
              <th className="px-2 py-2" />
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className="border-t border-[var(--s-rule-soft)]">
                <td className="px-2 py-1.5 text-center">
                  <input
                    aria-label={`Step ${i + 1}: the client sees it (starred)`}
                    type="checkbox"
                    checked={r.milestone}
                    onChange={(e) => set(i, { milestone: e.target.checked })}
                    className="h-4 w-4 accent-[var(--s-accent)]"
                  />
                </td>
                <td className="px-3 py-1.5">
                  <input aria-label={`Step ${i + 1} name`} value={r.label} onChange={(e) => set(i, { label: e.target.value })} maxLength={120} className="s-input w-full" />
                </td>
                <td className="px-2 py-1.5">
                  <select aria-label={`Step ${i + 1} who`} value={r.responsible} onChange={(e) => set(i, { responsible: e.target.value })} className="s-input">
                    {RESPONSIBLES.map((x) => (
                      <option key={x} value={x}>
                        {RESPONSIBLE_LABEL[x]}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-2 py-1.5">
                  <input aria-label={`Step ${i + 1} days`} type="number" min={0} max={30} value={r.days} onChange={(e) => set(i, { days: e.target.value })} className="s-input w-[70px]" />
                </td>
                <td className="px-2 py-1.5">
                  <input aria-label={`Step ${i + 1} payment`} value={r.gate} onChange={(e) => set(i, { gate: e.target.value })} maxLength={40} placeholder="e.g. design advance" className="s-input w-[160px]" />
                </td>
                <td className="px-2 py-1.5 text-center">
                  <input aria-label={`Step ${i + 1} needs its file`} type="checkbox" checked={r.needsDocument} onChange={(e) => set(i, { needsDocument: e.target.checked })} />
                </td>
                <td className="px-2 py-1.5">
                  <input aria-label={`Step ${i + 1} weight`} type="number" min={1} max={10} value={r.weight} onChange={(e) => set(i, { weight: e.target.value })} className="s-input w-[60px]" />
                </td>
                <td className="whitespace-nowrap px-2 py-1.5">
                  <button type="button" className="s-btn-ghost min-h-[32px] px-2 text-[13px]" onClick={() => move(i, -1)} aria-label={`Move step ${i + 1} up`}>
                    ↑
                  </button>
                  <button type="button" className="s-btn-ghost min-h-[32px] px-2 text-[13px]" onClick={() => move(i, 1)} aria-label={`Move step ${i + 1} down`}>
                    ↓
                  </button>
                  <button type="button" className="s-btn-ghost min-h-[32px] px-2 text-[13px]" onClick={() => setRows((rs) => rs.filter((_, j) => j !== i))} aria-label={`Remove step ${i + 1}`}>
                    Remove
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="m-0 text-[12.5px] text-[var(--s-ink-3)]">
        {rows.length} steps · {total} days for a 2 BHK · ★ {stars} shown to the client{warn ? ` (${warn})` : ''}. Starred steps are what the client sees; the rest are for your team. The payment is matched by name to each project&apos;s payment stages (&ldquo;design advance&rdquo; matches
        &ldquo;Design advance 5%&rdquo;).
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className="s-btn-ghost min-h-[40px]" onClick={() => setRows((rs) => [...rs, { label: '', responsible: 'DESIGNER', days: '1', gate: '', needsDocument: false, weight: '1', milestone: false }])}>
          + Add a step
        </button>
        <button type="button" className="s-btn min-h-[40px]" disabled={pending} onClick={save}>
          Save the design steps
        </button>
        {custom ? (
          <button
            type="button"
            className="s-btn-ghost min-h-[40px]"
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
        <p role={message.ok ? 'status' : 'alert'} className={`m-0 text-[13px] ${message.ok ? 'text-[var(--s-good)]' : 'text-[var(--s-bad)]'}`}>
          {message.text}
        </p>
      ) : null}
    </div>
  );
}
