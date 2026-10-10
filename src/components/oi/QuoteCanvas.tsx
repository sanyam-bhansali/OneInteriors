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
 *
 * In the landing's manner (owner, 10 Oct 2026): a soft card, white room
 * tiles, the live total as the landing's black live-price block, pills for
 * save and undo.
 */

import { useMemo, useState } from 'react';
import { PillButton, Split } from '@/components/home/parts';
import { formatINRCompact } from '@/lib/money';
import { checklistFor } from '@/modules/quotation/scope';
import { useLang, useSiteT } from '@/components/app/i18n';
import { OI_DICT, roomName } from '@/modules/i18n/site/oi';
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
  const t = useSiteT(OI_DICT);
  const lang = useLang();
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
      className="mb-[clamp(32px,5vw,56px)] rounded-[var(--r-l)] bg-[var(--soft)] p-[clamp(20px,3.4vw,40px)] print:hidden"
    >
      <div className="mb-8 max-w-[46ch]">
        <p className="eyebrow">{t('canvas.eyebrow')}</p>
        <Split id="canvas-h" className="h-m" text={t('canvas.h2')} auto />
        <p className="m-0 mt-4 text-[15.5px] leading-[1.6] text-[var(--ink-2)]">
          {t('canvas.body')}
        </p>
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
        {/* ── The rooms ── */}
        <div className="flex min-w-0 flex-col gap-2.5">
          {groups.map((g) => {
            const inRoom = g.items.filter((i) => !off.has(i.code)).length;
            const isOpen = open === g.room;
            const subtotal = roomTotal.get(g.room);
            return (
              <div key={g.room} className="rounded-[var(--r-m)] bg-[var(--paper)]">
                <button
                  type="button"
                  aria-expanded={isOpen}
                  onClick={() => setOpen(isOpen ? null : g.room)}
                  className="flex min-h-14 w-full cursor-pointer items-center justify-between gap-3 rounded-[var(--r-m)] border-0 bg-transparent px-4 py-3.5 text-left"
                >
                  <span className="min-w-0">
                    <span className="block text-[16px] font-medium tracking-[-0.01em] text-[var(--ink)]">{roomName(lang, g.room, g.label)}</span>
                    <span className="block text-[13px] text-[var(--ink-2)]">
                      {inRoom === 0 ? t('canvas.nothing') : t('canvas.inQuote', { n: inRoom, of: g.items.length })}
                    </span>
                  </span>
                  <span className="flex shrink-0 items-center gap-3">
                    <span className="text-[16px] font-medium tabular-nums tracking-[-0.01em] text-[var(--ink)]">
                      {subtotal ? money(subtotal) : '—'}
                    </span>
                    <span
                      aria-hidden
                      className="grid h-8 w-8 place-items-center rounded-full bg-[var(--soft)] text-[var(--ink)] transition-transform duration-300"
                      style={{ transform: isOpen ? 'rotate(45deg)' : undefined }}
                    >
                      <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
                        <path d="M7 1v12M1 7h12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                      </svg>
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
                            className="flex min-h-11 w-full cursor-pointer items-center justify-between gap-3 rounded-[14px] border-0 bg-transparent px-2.5 py-2 text-left hover:bg-[var(--soft)]"
                          >
                            <span className="flex min-w-0 items-center gap-3">
                              <span
                                aria-hidden
                                className={`relative h-[22px] w-[38px] shrink-0 rounded-full transition-colors ${on ? 'bg-[var(--ink)]' : 'bg-[var(--soft-2)]'}`}
                              >
                                <span
                                  className={`absolute top-[3px] h-4 w-4 rounded-full bg-white transition-[left] ${on ? 'left-[19px]' : 'left-[3px]'}`}
                                />
                              </span>
                              <span
                                className={`text-[15px] ${on ? 'text-[var(--ink)]' : 'text-[var(--ink-2)] line-through decoration-[var(--ink-3)]'}`}
                              >
                                {item.label}
                              </span>
                            </span>
                            <span className="shrink-0 tabular-nums text-[14px] text-[var(--ink-2)]">
                              {on && amount !== undefined ? money(amount) : on ? t('canvas.notPriced') : t('canvas.out')}
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
            <div className="rounded-[var(--r-m)] bg-[var(--paper)] px-4 py-4">
              <label htmlFor="canvas-run" className="flex items-baseline justify-between gap-3">
                <span className="text-[16px] font-medium tracking-[-0.01em] text-[var(--ink)]">{t('canvas.run')}</span>
                <span className="text-[16px] font-medium tabular-nums text-[var(--ink)]">{(runMm / 1000).toFixed(2)} m</span>
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
              <p className="m-0 mt-2 text-[13px] leading-[1.5] text-[var(--ink-2)]">
                {draft.kitchenRunMm !== null || plan.source !== 'standard'
                  ? t('canvas.runReal')
                  : t('canvas.runGuess')}
              </p>
            </div>
          ) : null}
        </div>

        {/* ── Every studio, live ── */}
        <div className="min-w-0 lg:sticky lg:top-6 lg:self-start">
          {/* The landing's live-price block: black, the figure large. */}
          <div className="rounded-[var(--r-l)] bg-[var(--ink)] p-[clamp(20px,3vw,32px)] text-white" aria-live="polite">
            <p className="m-0 text-[13.5px] text-white/60">{t('canvas.thisQuote', { name: current.name })}</p>
            <p className="m-0 mt-3 whitespace-nowrap text-[clamp(1.9rem,1rem+2.4vw,3.1rem)] font-medium leading-none tracking-[-0.04em] tabular-nums">
              {money(current.quote.totalPaise)}
            </p>
            <p className="m-0 mt-3 text-[13px] tabular-nums text-white/70">
              {money(current.quote.lowPaise)}–{money(current.quote.highPaise)} · ±
              {Math.round(current.quote.variancePct * 100)}% {t('canvas.inclGst')}
            </p>
            {changed ? (
              <p className="m-0 mt-3 inline-block rounded-full bg-white/10 px-3 py-1 text-[13px]">
                {t('canvas.fromHad', { delta: signed(delta) })}
              </p>
            ) : null}
          </div>

          <p className="m-0 mb-3 mt-6 text-[12px] font-medium uppercase tracking-[0.08em] text-[var(--ink-2)]">{t('canvas.live')}</p>
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
                    className={`w-full rounded-[var(--r-m)] border-0 bg-[var(--paper)] px-4 py-3 text-left transition-shadow duration-300 ${isCurrent ? 'cursor-default shadow-[inset_0_0_0_1.5px_var(--ink)]' : 'cursor-pointer hover:shadow-[inset_0_0_0_1px_var(--ink-3)]'}`}
                  >
                    <span className="flex items-baseline justify-between gap-3">
                      <span className="min-w-0 truncate text-[15px] font-medium text-[var(--ink)]">
                        <span className="mr-2 text-[12.5px] font-normal tabular-nums text-[var(--ink-2)]">{i + 1}</span>
                        {p.name}
                      </span>
                      <span className="shrink-0 text-[15px] font-medium tabular-nums text-[var(--ink)]">
                        {money(p.quote.totalPaise)}
                      </span>
                    </span>
                    <span className="mt-2 flex items-center gap-3">
                      <span className="h-1 flex-1 overflow-hidden rounded-full bg-[var(--soft-2)]">
                        <span
                          className="block h-full rounded-full bg-[var(--ink)] transition-[width] duration-300"
                          style={{ width: `${Math.round((p.quote.totalPaise / top) * 100)}%` }}
                        />
                      </span>
                      <span className="w-[4.5rem] shrink-0 text-right text-[12.5px] tabular-nums text-[var(--ink-2)]">
                        {isCurrent ? t('canvas.thisOne') : signed(vs)}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>

          {changed ? (
            <div className="mt-5 flex flex-wrap items-center gap-2.5">
              <PillButton onClick={onSave}>{t('canvas.save')}</PillButton>
              <PillButton
                tone="line"
                onClick={() => onDraft({ excludedItems: [...shape.scope.excludedItems], kitchenRunMm: null })}
              >
                {t('canvas.undo')}
              </PillButton>
            </div>
          ) : (
            <p className="m-0 mt-4 text-[13.5px] leading-[1.5] text-[var(--ink-2)]">
              {t('canvas.tap')}
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
