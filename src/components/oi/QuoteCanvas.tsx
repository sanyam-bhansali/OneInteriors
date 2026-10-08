'use client';

/**
 * The Home Canvas, v0 — the quote, made editable (docs/HOME-CANVAS.md).
 *
 * Take a line out, put it back, set the kitchen platform you measured: this
 * studio's total and every other matched studio's total move at once. Nothing
 * is saved until they say so; then the brief changes and every quote on the
 * site follows it.
 *
 * What it shows is what the quote already shows — line amounts and totals.
 * Never a studio's rate (owner, 30 Sep): a line's amount is its rate times a
 * quantity the customer can see, which is what the document has always
 * printed.
 */

import { useMemo, useState } from 'react';
import { formatINRCompact } from '@/lib/money';
import { checklistFor } from '@/modules/quotation/scope';
import type { HomeShape } from '@/modules/quotation/price-all';
import type { FloorPlan } from '@/modules/quotation/project-store';
import {
  RUN_MAX_MM,
  RUN_MIN_MM,
  draftChanged,
  toggleItem,
  withRun,
  type CanvasDraft,
  type PricedStudio,
} from '@/modules/quotation/canvas';

const money = (p: number) => formatINRCompact(p);

function signed(p: number): string {
  if (p === 0) return 'same';
  return `${p > 0 ? '+' : '−'}${formatINRCompact(Math.abs(p))}`;
}

export function QuoteCanvas({
  shape,
  plan,
  draft,
  onDraft,
  priced,
  currentSlug,
  savedTotalPaise,
  onPick,
  onSave,
}: {
  shape: HomeShape;
  /** The kitchen the page priced on, before anything typed here. */
  plan: FloorPlan;
  draft: CanvasDraft;
  onDraft: (next: CanvasDraft) => void;
  /** Every matched studio, priced on the draft, cheapest first. */
  priced: PricedStudio[];
  currentSlug: string;
  /** This studio's total before the canvas changed anything. */
  savedTotalPaise: number;
  /** Open another studio's quote, keeping the draft. */
  onPick: (slug: string) => void;
  /** Write the draft to the brief. */
  onSave: () => void;
}) {
  const [open, setOpen] = useState<string | null>(null);
  const current = priced.find((p) => p.slug === currentSlug) ?? null;
  const groups = useMemo(() => checklistFor(shape.bhk, shape.scope), [shape]);
  const off = new Set(draft.excludedItems);
  const amountOf = useMemo(
    () => new Map((current?.quote.lines ?? []).map((l) => [l.code, l.amountPaise])),
    [current],
  );
  const roomTotal = useMemo(
    () => new Map((current?.quote.rooms ?? []).map((r) => [r.room, r.subtotalPaise])),
    [current],
  );
  const hasKitchenRun = groups.some((g) => g.items.some((i) => i.fromKitchenRun && !off.has(i.code)));
  const runMm = draft.kitchenRunMm ?? plan.kitchenRunMm ?? 3900;
  const changed = draftChanged(shape, draft);
  const top = priced.reduce((m, p) => Math.max(m, p.quote.totalPaise), 1);

  if (!current) return null;
  const delta = current.quote.totalPaise - savedTotalPaise;

  return (
    <section
      aria-labelledby="canvas-h"
      className="mb-8 rounded-[28px] bg-[var(--card)] p-[clamp(18px,3.4vw,36px)] print:hidden"
    >
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div className="max-w-[44ch]">
          <p className="oi-eyebrow m-0 mb-2">Shape this quote</p>
          <h2 id="canvas-h" className="oi-display m-0 text-[clamp(1.6rem,1.1rem+1.8vw,2.4rem)]">
            Change it, and every studio re-prices.
          </h2>
          <p className="m-0 mt-2 text-[15px] leading-[1.55] text-[var(--ink2)]">
            Take things out, put them back, set your kitchen size. Nothing is saved until you say so.
          </p>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
        {/* ── The rooms ── */}
        <div className="flex min-w-0 flex-col gap-2.5">
          {groups.map((g) => {
            const inRoom = g.items.filter((i) => !off.has(i.code)).length;
            const isOpen = open === g.room;
            const subtotal = roomTotal.get(g.room);
            return (
              <div key={g.room} className="rounded-[20px] bg-[var(--bg)]">
                <button
                  type="button"
                  aria-expanded={isOpen}
                  onClick={() => setOpen(isOpen ? null : g.room)}
                  className="flex w-full cursor-pointer items-center justify-between gap-3 rounded-[20px] border-0 bg-transparent px-4 py-3.5 text-left"
                >
                  <span className="min-w-0">
                    <span className="block text-[15.5px] font-medium text-[var(--ink)]">{g.label}</span>
                    <span className="block text-[12.5px] text-[var(--ink2)]">
                      {inRoom === 0 ? 'Nothing in the quote' : `${inRoom} of ${g.items.length} in the quote`}
                    </span>
                  </span>
                  <span className="flex shrink-0 items-center gap-3">
                    <span className="tabular-nums text-[15px] text-[var(--ink)]">
                      {subtotal ? money(subtotal) : '—'}
                    </span>
                    <span aria-hidden className="text-[var(--ink2)]">
                      {isOpen ? '−' : '+'}
                    </span>
                  </span>
                </button>
                {isOpen ? (
                  <ul className="m-0 flex list-none flex-col gap-1 px-2 pb-3">
                    {g.items.map((item) => {
                      const on = !off.has(item.code);
                      const amount = amountOf.get(item.code);
                      return (
                        <li key={item.code}>
                          <button
                            type="button"
                            role="switch"
                            aria-checked={on}
                            onClick={() => onDraft(toggleItem(shape, draft, item.code))}
                            className="flex w-full cursor-pointer items-center justify-between gap-3 rounded-[14px] border-0 bg-transparent px-2.5 py-2 text-left hover:bg-[var(--card)]"
                          >
                            <span className="flex min-w-0 items-center gap-3">
                              <span
                                aria-hidden
                                className={`relative h-[22px] w-[38px] shrink-0 rounded-full transition-colors ${on ? 'bg-[var(--ink)]' : 'bg-[var(--line)]'}`}
                              >
                                <span
                                  className={`absolute top-[3px] h-4 w-4 rounded-full bg-white transition-[left] ${on ? 'left-[19px]' : 'left-[3px]'}`}
                                />
                              </span>
                              <span
                                className={`text-[14.5px] ${on ? 'text-[var(--ink)]' : 'text-[var(--ink2)] line-through decoration-[var(--line)]'}`}
                              >
                                {item.label}
                              </span>
                            </span>
                            <span className="shrink-0 tabular-nums text-[13.5px] text-[var(--ink2)]">
                              {on && amount !== undefined ? money(amount) : on ? 'not priced' : 'out'}
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                ) : null}
              </div>
            );
          })}

          {hasKitchenRun ? (
            <div className="rounded-[20px] bg-[var(--bg)] px-4 py-4">
              <label htmlFor="canvas-run" className="flex items-baseline justify-between gap-3">
                <span className="text-[15.5px] font-medium text-[var(--ink)]">Kitchen platform length</span>
                <span className="tabular-nums text-[15px] text-[var(--ink)]">{(runMm / 1000).toFixed(2)} m</span>
              </label>
              <input
                id="canvas-run"
                type="range"
                min={RUN_MIN_MM}
                max={RUN_MAX_MM}
                step={50}
                value={runMm}
                onChange={(e) => onDraft(withRun(draft, Number(e.target.value)))}
                className="mt-3 w-full accent-[var(--ink)]"
              />
              <p className="m-0 mt-2 text-[12.5px] leading-[1.5] text-[var(--ink2)]">
                {draft.kitchenRunMm !== null || plan.source !== 'standard'
                  ? 'Priced on your real length, so every studio’s range is narrower.'
                  : 'Measured your platform? Set the real length — the biggest guess on the quote goes away.'}
              </p>
            </div>
          ) : null}
        </div>

        {/* ── Every studio, live ── */}
        <div className="min-w-0 lg:sticky lg:top-6 lg:self-start">
          <div className="rounded-[22px] bg-[var(--ink)] p-5 text-white" aria-live="polite">
            <p className="m-0 text-[13px] text-white/60">{current.name} · this quote</p>
            <p className="m-0 mt-1 text-[clamp(2rem,1.4rem+2vw,2.8rem)] font-medium leading-none tracking-[-0.03em] tabular-nums">
              {money(current.quote.totalPaise)}
            </p>
            <p className="m-0 mt-2 text-[13px] text-white/70">
              {money(current.quote.lowPaise)}–{money(current.quote.highPaise)} · ±
              {Math.round(current.quote.variancePct * 100)}% · incl. GST
            </p>
            {changed ? (
              <p className="m-0 mt-3 inline-block rounded-full bg-white/10 px-3 py-1 text-[13px]">
                {signed(delta)} from the quote you had
              </p>
            ) : null}
          </div>

          <p className="oi-label m-0 mb-2 mt-5">Every match, live</p>
          <ol className="m-0 flex list-none flex-col gap-1.5 p-0">
            {priced.map((p, i) => {
              const isCurrent = p.slug === currentSlug;
              const vs = p.quote.totalPaise - current.quote.totalPaise;
              return (
                <li key={p.slug}>
                  <button
                    type="button"
                    disabled={isCurrent}
                    onClick={() => onPick(p.slug)}
                    className={`w-full rounded-[16px] border px-3.5 py-2.5 text-left ${isCurrent ? 'cursor-default border-[var(--ink)] bg-[var(--bg)]' : 'cursor-pointer border-transparent bg-[var(--bg)] hover:border-[var(--line)]'}`}
                  >
                    <span className="flex items-baseline justify-between gap-3">
                      <span className="min-w-0 truncate text-[14.5px] text-[var(--ink)]">
                        <span className="mr-2 text-[12px] text-[var(--ink2)]">{i + 1}</span>
                        {p.name}
                      </span>
                      <span className="shrink-0 tabular-nums text-[14.5px] text-[var(--ink)]">
                        {money(p.quote.totalPaise)}
                      </span>
                    </span>
                    <span className="mt-1.5 flex items-center gap-3">
                      <span className="h-[3px] flex-1 overflow-hidden rounded-full bg-[var(--line)]">
                        <span
                          className="block h-full rounded-full bg-[var(--ink)] transition-[width] duration-300"
                          style={{ width: `${Math.round((p.quote.totalPaise / top) * 100)}%` }}
                        />
                      </span>
                      <span className="w-[4.5rem] shrink-0 text-right text-[12px] text-[var(--ink2)]">
                        {isCurrent ? 'this one' : signed(vs)}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>

          {changed ? (
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={onSave}
                className="oi-cta inline-flex min-h-11 cursor-pointer items-center rounded-full border-0 px-5 text-[14.5px]"
              >
                Save to my brief
              </button>
              <button
                type="button"
                onClick={() => onDraft({ excludedItems: [...shape.scope.excludedItems], kitchenRunMm: null })}
                className="min-h-11 cursor-pointer rounded-full border border-[var(--line)] bg-transparent px-5 text-[14px] text-[var(--ink)]"
              >
                Undo changes
              </button>
            </div>
          ) : (
            <p className="m-0 mt-4 text-[13px] leading-[1.5] text-[var(--ink2)]">
              Tap a room to take things out or put them back.
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
