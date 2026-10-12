'use client';

import { useState } from 'react';
import type { CrewSettings } from '@/modules/studio-crews/settings';
import { CREW_UNIT_LABEL, CREW_UNITS, HAUSPIRE_PRODUCTS, type CrewUnitName } from '@/modules/studio-crews/trades';
import { saveCrewSettingsAction } from '../../vendors/actions';
import { Message, useRun } from '../../vendors/crews-ui';
import { muted } from '../../vendors/format';

/**
 * Settings → Crews and trades (Studio OS Phase 3): one form, saved at once.
 * Trades (renamed or switched off, never removed while in use), the
 * studio's own routing rows (which win over Hauspire's table), the rate
 * templates copied onto a new crew, the numbers, and the execution steps
 * that wait for a client payment.
 */
export function TradesForm({ initial, inUse, paymentLabels }: { initial: CrewSettings; inUse: string[]; paymentLabels: string[] }) {
  const r = useRun();
  const [trades, setTrades] = useState(initial.trades.map((t) => ({ key: t.key as string | undefined, label: t.label, active: t.active })));
  const [routes, setRoutes] = useState(initial.routes);
  const [useHauspire, setUseHauspire] = useState(initial.useHauspire);
  const [templates, setTemplates] = useState<Record<string, { item: string; unit: CrewUnitName; rateRupees: string }[]>>(() =>
    Object.fromEntries(initial.trades.map((t) => [t.key, (initial.templates[t.key] ?? []).map((i) => ({ item: i.item, unit: i.unit, rateRupees: i.ratePaise === null ? '' : String(i.ratePaise / 100) }))])),
  );
  const [dueDays, setDueDays] = useState(String(initial.dueDays));
  const [target, setTarget] = useState(String(initial.labourTargetPct));
  const [advance, setAdvance] = useState(String(initial.advanceLimitPaise / 100));
  const [install, setInstall] = useState(String(initial.installRatePaise / 100));
  const [gates, setGates] = useState(initial.execGates);
  const [tplOpen, setTplOpen] = useState<string | null>(null);
  const keyed = trades.filter((t) => t.key) as { key: string; label: string; active: boolean }[];
  const section = 's-card flex flex-col gap-3 p-5';

  return (
    <form
      className="flex flex-col gap-5"
      onSubmit={(e) => {
        e.preventDefault();
        r.run(() =>
          saveCrewSettingsAction({
            trades,
            routes,
            useHauspire,
            dueDays: Number(dueDays),
            labourTargetPct: Number(target),
            advanceLimitRupees: advance,
            installRateRupees: install,
            execGates: gates,
            templates,
          }),
        );
      }}
    >
      <section className={section}>
        <h2 className="m-0 text-[16px] font-semibold">Trades</h2>
        <p className={`m-0 ${muted}`}>Rename a trade freely: crews and work orders follow. A trade in use can be switched off, not removed.</p>
        <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
          {trades.map((t, i) => (
            <li key={t.key ?? `new-${i}`} className="flex flex-wrap items-center gap-2">
              <input
                className="s-input w-[240px]"
                aria-label="Trade name"
                value={t.label}
                onChange={(e) => setTrades(trades.map((x, k) => (k === i ? { ...x, label: e.target.value } : x)))}
              />
              <label className="flex items-center gap-1.5 text-[13px]">
                <input type="checkbox" checked={t.active} onChange={(e) => setTrades(trades.map((x, k) => (k === i ? { ...x, active: e.target.checked } : x)))} />
                Shown
              </label>
              {!t.key || !inUse.includes(t.key) ? (
                <button type="button" className="text-[12.5px] text-[var(--s-ink-3)] hover:text-[var(--s-bad)]" onClick={() => setTrades(trades.filter((_, k) => k !== i))}>
                  Remove
                </button>
              ) : (
                <span className={muted}>in use</span>
              )}
            </li>
          ))}
        </ul>
        <div>
          <button type="button" className="s-btn-ghost" onClick={() => setTrades([...trades, { key: undefined, label: '', active: true }])}>
            Add a trade
          </button>
        </div>
      </section>

      <section className={section}>
        <h2 className="m-0 text-[16px] font-semibold">Routing quotation lines to trades</h2>
        <p className={`m-0 ${muted}`}>
          Your rows come first: an exact product name, or a word the name contains. Then Hauspire&apos;s table ({Object.keys(HAUSPIRE_PRODUCTS).length} product names and its keyword rules). A
          line nothing matches goes to carpentry, marked &ldquo;trade guessed&rdquo;.
        </p>
        <label className="flex items-center gap-2 text-[13.5px]">
          <input type="checkbox" checked={useHauspire} onChange={(e) => setUseHauspire(e.target.checked)} />
          Use Hauspire&apos;s routing under my rows
        </label>
        <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
          {routes.map((x, i) => (
            <li key={i} className="flex flex-wrap items-center gap-2">
              <select className="s-input w-auto" aria-label="Match" value={x.match} onChange={(e) => setRoutes(routes.map((y, k) => (k === i ? { ...y, match: e.target.value as 'exact' | 'keyword' } : y)))}>
                <option value="exact">Product is</option>
                <option value="keyword">Name contains</option>
              </select>
              <input className="s-input w-[240px]" aria-label="Product or word" value={x.text} onChange={(e) => setRoutes(routes.map((y, k) => (k === i ? { ...y, text: e.target.value } : y)))} />
              <span className={muted}>goes to</span>
              <select className="s-input w-auto" aria-label="Trade" value={x.trade} onChange={(e) => setRoutes(routes.map((y, k) => (k === i ? { ...y, trade: e.target.value } : y)))}>
                {keyed.map((t) => (
                  <option key={t.key} value={t.key}>
                    {t.label}
                  </option>
                ))}
              </select>
              <button type="button" className="text-[12.5px] text-[var(--s-ink-3)] hover:text-[var(--s-bad)]" onClick={() => setRoutes(routes.filter((_, k) => k !== i))}>
                Remove
              </button>
            </li>
          ))}
        </ul>
        <div>
          <button type="button" className="s-btn-ghost" onClick={() => setRoutes([...routes, { match: 'exact', text: '', trade: keyed[0]?.key ?? 'carpentry' }])}>
            Add a routing row
          </button>
        </div>
      </section>

      <section className={section}>
        <h2 className="m-0 text-[16px] font-semibold">Rate templates</h2>
        <p className={`m-0 ${muted}`}>Copied onto a new crew&apos;s card for their trades, once. Changing a template never changes a crew&apos;s card. Only ₹150 per sq ft installation is Hauspire&apos;s real rate; fill in yours.</p>
        <div className="flex flex-wrap gap-1.5">
          {keyed.map((t) => (
            <button key={t.key} type="button" className={tplOpen === t.key ? 's-btn' : 's-btn-ghost'} onClick={() => setTplOpen(tplOpen === t.key ? null : t.key)}>
              {t.label} · {(templates[t.key] ?? []).length}
            </button>
          ))}
        </div>
        {tplOpen ? (
          <div className="flex flex-col gap-1.5 rounded-[10px] bg-[var(--s-surface-2)] p-3">
            {(templates[tplOpen] ?? []).map((x, i) => {
              const set = (v: Partial<typeof x>) => setTemplates({ ...templates, [tplOpen]: (templates[tplOpen] ?? []).map((y, k) => (k === i ? { ...y, ...v } : y)) });
              return (
                <div key={i} className="flex flex-wrap items-center gap-2">
                  <input className="s-input w-[230px]" aria-label="Item" value={x.item} onChange={(e) => set({ item: e.target.value })} />
                  <select className="s-input w-auto" aria-label="Unit" value={x.unit} onChange={(e) => set({ unit: e.target.value as CrewUnitName })}>
                    {CREW_UNITS.map((u) => (
                      <option key={u} value={u}>
                        per {CREW_UNIT_LABEL[u]}
                      </option>
                    ))}
                  </select>
                  <input className="s-input w-[110px]" inputMode="decimal" aria-label="Rate in rupees" placeholder="₹ (blank)" value={x.rateRupees} onChange={(e) => set({ rateRupees: e.target.value })} />
                  <button type="button" className="text-[12.5px] text-[var(--s-ink-3)] hover:text-[var(--s-bad)]" onClick={() => setTemplates({ ...templates, [tplOpen]: (templates[tplOpen] ?? []).filter((_, k) => k !== i) })}>
                    Remove
                  </button>
                </div>
              );
            })}
            <div>
              <button type="button" className="s-btn-ghost" onClick={() => setTemplates({ ...templates, [tplOpen]: [...(templates[tplOpen] ?? []), { item: '', unit: 'SQFT', rateRupees: '' }] })}>
                Add an item
              </button>
            </div>
          </div>
        ) : null}
      </section>

      <section className={section}>
        <h2 className="m-0 text-[16px] font-semibold">Numbers</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1">
            <span className="s-label">Pay crews within (days)</span>
            <input className="s-input w-[120px]" inputMode="numeric" value={dueDays} onChange={(e) => setDueDays(e.target.value)} />
            <span className={muted}>A new work order&apos;s &ldquo;pay by&rdquo; date. Hauspire: 45.</span>
          </label>
          <label className="flex flex-col gap-1">
            <span className="s-label">Labour margin target (%)</span>
            <input className="s-input w-[120px]" inputMode="numeric" value={target} onChange={(e) => setTarget(e.target.value)} />
            <span className={muted}>You are warned when a project&apos;s contract less its crews falls below this share. Only you see it.</span>
          </label>
          <label className="flex flex-col gap-1">
            <span className="s-label">Installation-only rate (₹ per sq ft)</span>
            <input className="s-input w-[120px]" inputMode="decimal" value={install} onChange={(e) => setInstall(e.target.value)} />
            <span className={muted}>For a carpentry line marked installation only, when the crew&apos;s card has no rate. Hauspire: ₹150.</span>
          </label>
          <label className="flex flex-col gap-1">
            <span className="s-label">Advance limit (₹)</span>
            <input className="s-input w-[140px]" inputMode="decimal" value={advance} onChange={(e) => setAdvance(e.target.value)} />
            <span className={muted}>How far an advance may run ahead of a work order&apos;s bill. 0 means no advances.</span>
          </label>
        </div>
      </section>

      <section className={section}>
        <h2 className="m-0 text-[16px] font-semibold">Steps that wait for the client&apos;s payment</h2>
        <p className={`m-0 ${muted}`}>
          A step whose name contains the words on the left cannot be ticked until accounts records the payment stage whose name contains the words on the right. Your stages:{' '}
          {paymentLabels.join(', ') || 'none set'}.
        </p>
        <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
          {gates.map((g, i) => (
            <li key={i} className="flex flex-wrap items-center gap-2">
              <input className="s-input w-[240px]" aria-label="Step words" value={g.step} onChange={(e) => setGates(gates.map((x, k) => (k === i ? { ...x, step: e.target.value } : x)))} />
              <span className={muted}>waits for</span>
              <input className="s-input w-[220px]" aria-label="Payment words" list="payment-stage-labels" value={g.payment} onChange={(e) => setGates(gates.map((x, k) => (k === i ? { ...x, payment: e.target.value } : x)))} />
              <button type="button" className="text-[12.5px] text-[var(--s-ink-3)] hover:text-[var(--s-bad)]" onClick={() => setGates(gates.filter((_, k) => k !== i))}>
                Remove
              </button>
            </li>
          ))}
        </ul>
        <datalist id="payment-stage-labels">
          {paymentLabels.map((l) => (
            <option key={l} value={l} />
          ))}
        </datalist>
        <div>
          <button type="button" className="s-btn-ghost" onClick={() => setGates([...gates, { step: '', payment: '' }])}>
            Add a lock
          </button>
        </div>
      </section>

      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" className="s-btn" disabled={r.pending}>
          Save
        </button>
        <Message m={r.message} />
      </div>
    </form>
  );
}
