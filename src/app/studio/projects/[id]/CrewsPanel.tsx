'use client';

import Link from 'next/link';
import { useState } from 'react';
import { formatINR } from '@/lib/money';
import type { ProjectCrews } from '@/modules/studio-crews/store';
import { buildWorkOrdersAction } from '../../vendors/actions';
import { Message, WorkOrderCard, useRun } from '../../vendors/crews-ui';
import { h2, muted } from '../../vendors/format';
import { OnlyYourTeam } from '../marks';

/**
 * The project's Crews tab (Studio OS Phase 3 §3): the work orders for the
 * site crews, and the final's lines still to order, grouped by trade, each
 * trade with a crew to pick. Internal only — the client never sees any of
 * this. A PM receives quantities only (the server strips the money).
 */
export function CrewsPanel({ tab }: { tab: ProjectCrews }) {
  const live = tab.orders.filter((o) => !o.archived);
  const archived = tab.orders.filter((o) => o.archived);
  const running = live.filter((o) => o.status !== 'SETTLED');
  const settled = live.filter((o) => o.status === 'SETTLED');
  return (
    <OnlyYourTeam>
      <div className="flex flex-col gap-5">
        {tab.labour ? <Labour tab={tab} /> : null}
        {tab.locks.length ? (
          <p className="m-0 rounded-[10px] bg-[var(--s-surface-2)] px-3 py-2 text-[13px] text-[var(--s-ink-2)]">
            Waiting for the client&apos;s payment: {tab.locks.map((l) => `${l.label} (opens when the ${l.payment} is recorded)`).join(' · ')}.
          </p>
        ) : null}

        <section className="flex flex-col gap-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className={h2}>Work orders</h2>
            {tab.seesMoney ? (
              <Link href="/studio/vendors/pay" className="text-[13px] text-[var(--s-accent)]">
                Pay these →
              </Link>
            ) : null}
          </div>
          {running.length === 0 && settled.length === 0 ? (
            <p className={`m-0 ${muted}`}>
              None yet.{' '}
              {tab.canBuild ? (tab.source ? 'Build them from the final below: pick a crew for each trade.' : 'Once the project has a sales final or a design final, its lines can be ordered here.') : ''}
            </p>
          ) : (
            <ul className="m-0 flex flex-col gap-2 p-0">
              {running.map((o) => (
                <WorkOrderCard key={o.id} order={o} projectId={tab.projectId} canBuild={tab.canBuild} seesMoney={tab.seesMoney} canPay={tab.canPay} allCrews={tab.allCrews} steps={tab.steps} />
              ))}
            </ul>
          )}
          {settled.length ? (
            <details>
              <summary className="cursor-pointer text-[13.5px] text-[var(--s-ink-2)]">
                {settled.length} settled work order{settled.length === 1 ? '' : 's'}
              </summary>
              <ul className="m-0 mt-2 flex flex-col gap-2 p-0">
                {settled.map((o) => (
                  <WorkOrderCard key={o.id} order={o} projectId={tab.projectId} canBuild={tab.canBuild} seesMoney={tab.seesMoney} canPay={tab.canPay} />
                ))}
              </ul>
            </details>
          ) : null}
          {archived.length ? (
            <details>
              <summary className="cursor-pointer text-[13.5px] text-[var(--s-ink-3)]">Archived ({archived.length})</summary>
              <ul className="m-0 mt-2 flex flex-col gap-2 p-0">
                {archived.map((o) => (
                  <WorkOrderCard key={o.id} order={o} projectId={tab.projectId} canBuild={tab.canBuild} seesMoney={tab.seesMoney} canPay={tab.canPay} />
                ))}
              </ul>
            </details>
          ) : null}
        </section>

        {tab.canBuild && tab.source ? <Builder tab={tab} /> : null}
      </div>
    </OnlyYourTeam>
  );
}

function Labour({ tab }: { tab: ProjectCrews }) {
  const l = tab.labour!;
  const fig = (label: string, v: string) => (
    <div className="flex flex-col">
      <span className="s-label">{label}</span>
      <span className="s-num font-[family-name:var(--font-mono)] text-[15px] font-semibold">{v}</span>
    </div>
  );
  return (
    <section className="s-card flex flex-col gap-2 p-4">
      <div className="flex flex-wrap gap-x-7 gap-y-2">
        {fig('Contract', l.contractPaise === null ? '—' : formatINR(l.contractPaise))}
        {fig('Crews expected', formatINR(l.expectedPaise))}
        {fig('Committed', formatINR(l.committedPaise))}
        {fig('Paid', formatINR(l.paidPaise))}
        {fig('Labour margin', l.marginPaise === null ? '—' : `${formatINR(l.marginPaise)} · ${((l.marginBp ?? 0) / 100).toFixed(1)}%`)}
      </div>
      {l.warn ? <p className="m-0 text-[13px] text-[var(--s-bad)]">The labour margin is below your target. Only you see this.</p> : <p className={`m-0 ${muted}`}>Only you see this. Material is not counted.</p>}
    </section>
  );
}

function Builder({ tab }: { tab: ProjectCrews }) {
  const r = useRun();
  const [due, setDue] = useState(tab.dueDefault);
  const [crewFor, setCrewFor] = useState<Record<string, string>>(() =>
    Object.fromEntries(tab.plan.map((t) => [t.trade, t.crews.find((c) => c.hasOrder)?.id ?? t.crews[0]?.id ?? ''])),
  );
  const [ticked, setTicked] = useState<Set<string>>(() => new Set(tab.plan.flatMap((t) => t.lines.map((l) => l.id))));
  const [modes, setModes] = useState<Record<string, 'INSTALL' | 'FULL'>>(() =>
    Object.fromEntries(tab.plan.flatMap((t) => t.lines.filter((l) => l.carpentry).map((l) => [l.id, l.carpentry!]))),
  );
  const total = tab.plan.reduce((s, t) => s + t.lines.length, 0);
  if (total === 0)
    return (
      <section className="s-card p-4">
        <h2 className={h2}>From the {tab.source!.kind === 'DESIGN_FINAL' ? 'design final' : 'sales final'}</h2>
        <p className={`m-0 mt-1 ${muted}`}>Every line of quotation {tab.source!.number} is on a work order.</p>
      </section>
    );
  const toggle = (id: string, on: boolean) => {
    const next = new Set(ticked);
    if (on) next.add(id);
    else next.delete(id);
    setTicked(next);
  };
  return (
    <section className="s-card flex flex-col gap-4 p-4">
      <div>
        <h2 className={h2}>
          Still to order from the {tab.source!.kind === 'DESIGN_FINAL' ? 'design final' : 'sales final'} ({tab.source!.number})
        </h2>
        <p className={`m-0 mt-1 ${muted}`}>
          {total} line{total === 1 ? '' : 's'}, grouped by trade. Pick a crew for each trade: lines with a width and height price themselves from that crew&apos;s card; the rest wait in
          &ldquo;Price these&rdquo;. A crew already on this project gets the lines added to their work order.
        </p>
      </div>
      {tab.plan.map((t) => (
        <div key={t.trade} className="flex flex-col gap-2 border-t border-[var(--s-rule)] pt-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="m-0 text-[14.5px] font-semibold">
              {t.label} <span className={muted}>· {t.lines.length}</span>
            </p>
            <label className="flex items-center gap-2 text-[13px]">
              Crew
              <select className="s-input w-auto" value={crewFor[t.trade] ?? ''} onChange={(e) => setCrewFor({ ...crewFor, [t.trade]: e.target.value })}>
                <option value="">Skip this trade for now</option>
                {t.crews.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                    {c.hasOrder ? ' (on this project)' : ''}
                    {c.kind === 'TEMPORARY' ? ' · temporary' : ''}
                  </option>
                ))}
                {tab.allCrews
                  .filter((c) => !t.crews.some((x) => x.id === c.id))
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} (another trade)
                    </option>
                  ))}
              </select>
            </label>
          </div>
          {t.crews.length === 0 ? <p className={`m-0 ${muted}`}>No crew works in {t.label.toLowerCase()} yet. Add one on the Crews page, or pick another crew.</p> : null}
          <ul className="m-0 flex list-none flex-col gap-1 p-0">
            {t.lines.map((l) => (
              <li key={l.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[13.5px]">
                <label className="flex min-w-0 flex-1 items-center gap-2">
                  <input type="checkbox" checked={ticked.has(l.id)} onChange={(e) => toggle(l.id, e.target.checked)} />
                  <span className="min-w-0">
                    <span className="font-medium">{l.product}</span> <span className={muted}>· {l.room}</span>
                    {l.size ? <span className={muted}> · {l.size}</span> : null}
                    {l.qty ? <span className={muted}> · {l.qty}</span> : <span className="text-[12px] text-[var(--s-warn)]"> · needs a quantity</span>}
                  </span>
                  {l.guessed ? (
                    <span className="s-tag" title="Nothing in the routing named this product; it went to carpentry by its work code. Set it under Settings, Crews and trades.">
                      Trade guessed
                    </span>
                  ) : null}
                </label>
                {l.carpentry ? (
                  <span className="flex gap-1">
                    {(['INSTALL', 'FULL'] as const).map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => setModes({ ...modes, [l.id]: m })}
                        className={`rounded-[6px] border px-1.5 py-0.5 text-[11.5px] ${modes[l.id] === m ? 'border-[var(--s-accent)] bg-[var(--s-accent-wash)] text-[var(--s-accent)]' : 'border-[var(--s-rule)] text-[var(--s-ink-3)]'}`}
                      >
                        {m === 'INSTALL' ? 'Installation only' : 'Full carpentry'}
                      </button>
                    ))}
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ))}
      <div className="flex flex-wrap items-end gap-3 border-t border-[var(--s-rule)] pt-3">
        <label className="flex flex-col gap-1">
          <span className="s-label">Crews paid by</span>
          <input type="date" className="s-input w-auto" value={due} onChange={(e) => setDue(e.target.value)} />
        </label>
        <button
          type="button"
          className="s-btn"
          disabled={r.pending}
          onClick={() =>
            r.run(() =>
              buildWorkOrdersAction(tab.projectId, {
                dueOn: due,
                picks: tab.plan
                  .filter((t) => crewFor[t.trade])
                  .map((t) => ({
                    trade: t.trade,
                    crewId: crewFor[t.trade],
                    lineIds: t.lines.filter((l) => ticked.has(l.id)).map((l) => l.id),
                    carpentry: Object.fromEntries(t.lines.filter((l) => l.carpentry).map((l) => [l.id, modes[l.id] ?? 'INSTALL'])),
                  })),
              }),
            )
          }
        >
          Make work orders
        </button>
      </div>
      <Message m={r.message} />
    </section>
  );
}
