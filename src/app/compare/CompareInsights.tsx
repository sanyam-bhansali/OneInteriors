'use client';

/**
 * The compare sections plan §8 adds: fit first, then price by room, price per
 * material, and a written summary whose every figure is checked.
 */

import { useState, useTransition } from 'react';
import { formatINRCompact } from '@/lib/money';
import { Sheet } from '@/components/oi';
import { FACTOR_LABELS, type MatchResult } from '@/modules/matching/score';
import type { Studio } from '@/modules/studio/types';
import {
  materialRows,
  roomSpreads,
  sameSpecGroups,
  type Entry,
} from '@/modules/quotation/compare-insights';
import { askQuoteAction, explainComparisonAction } from './actions';
import type { ComparisonExplanation, QuoteAnswer } from '@/modules/quotation/compare-summary';
import type { Brief } from '@/modules/brief/types';
import type { FloorPlan } from '@/modules/quotation/project-store';
import { LANGUAGES, LANGUAGE_LABELS, type Language } from '@/modules/brief/types';
import { Listen } from '@/components/oi/Listen';

const money = (p: number) => formatINRCompact(p);

/** Fit, first: the decision is a designer, not a price list. */
export function FitBlock({
  entries,
  studios,
  matches,
}: {
  entries: Entry[];
  studios: Studio[];
  matches: Map<string, MatchResult>;
}) {
  const rows: { label: string; cell: (s: Studio, m: MatchResult | undefined) => string }[] = [
    { label: 'Fit', cell: (_, m) => (m ? `${m.score}% · ${m.factorsScored} of ${m.factorsTotal} measured` : 'Not in your matches now') },
    { label: FACTOR_LABELS.similarWork, cell: (_, m) => m?.evidence?.similarWork ?? '—' },
    { label: FACTOR_LABELS.timeline, cell: (_, m) => m?.timeline?.line ?? 'Not known yet' },
    { label: FACTOR_LABELS.workingStyle, cell: (_, m) => m?.evidence?.workingStyle ?? 'Not known yet' },
    { label: FACTOR_LABELS.household, cell: (_, m) => m?.evidence?.household ?? '—' },
    { label: 'Checks cleared', cell: (s) => `${s.checks.filter((c) => c.result === 'PASS').length} of ${s.checks.length}` },
    {
      label: 'Delivered with us',
      cell: (s) =>
        s.completedProjects === 0
          ? 'No projects with us yet'
          : `${s.completedProjects} projects${s.avgVarianceDays !== null ? `, ${s.avgVarianceDays <= 0 ? 'on time' : `+${s.avgVarianceDays} days`} on average` : ''}`,
    },
  ];
  const cols = entries.map((e) => ({ entry: e, studio: studios.find((s) => s.slug === e.slug) }));
  if (cols.some((c) => !c.studio)) return null;

  return (
    <Sheet className="mb-10 overflow-x-auto p-6">
      <p className="oi-eyebrow m-0 mb-4">Who fits, side by side</p>
      <table className="w-full min-w-[36rem] border-collapse text-[13.5px]">
        <thead>
          <tr>
            <th className="w-[9rem]" />
            {cols.map((c) => (
              <th key={c.entry.slug} className="pb-3 text-left font-semibold text-[var(--ink)]">
                {c.entry.name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.label} className="border-t border-[var(--line)] align-top">
              <th className="oi-label py-2.5 pr-3 text-left font-normal">{r.label}</th>
              {cols.map((c) => (
                <td key={c.entry.slug} className="py-2.5 pr-4 leading-snug text-[var(--ink2)]">
                  {r.cell(c.studio!, matches.get(c.studio!.id))}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </Sheet>
  );
}

/** "Kitchen: ₹2.1 L – ₹2.9 L across your four studios." */
export function RoomPrices({ entries }: { entries: Entry[] }) {
  const rooms = roomSpreads(entries);
  if (rooms.length === 0) return null;
  return (
    <Sheet className="mb-10 p-6">
      <p className="oi-eyebrow m-0 mb-4">Price by room</p>
      <ul className="m-0 flex list-none flex-col gap-3 p-0">
        {rooms.map((r) => (
          <li key={r.room} className="border-b border-[var(--line)] pb-3 last:border-b-0 last:pb-0">
            <p className="m-0 flex flex-wrap items-baseline justify-between gap-3">
              <span className="text-[14.5px] font-medium">{r.label}</span>
              <span className="oi-num text-[13.5px]">
                {r.spreadPaise === 0 ? money(r.lowPaise) : `${money(r.lowPaise)} – ${money(r.highPaise)}`}
              </span>
            </p>
            <p className="m-0 mt-1 text-[13px] text-[var(--ink2)]">
              {r.cells.map((c) => `${c.name} ${c.subtotalPaise === null ? 'not priced' : money(c.subtotalPaise)}`).join(' · ')}
            </p>
          </li>
        ))}
      </ul>
    </Sheet>
  );
}

/** Each studio's price and material for the same item at the same size — never a per-sq-ft rate. */
export function MaterialPrices({ entries }: { entries: Entry[] }) {
  const rows = materialRows(entries);
  if (rows.length === 0) return null;
  return (
    <Sheet className="mb-10 p-6">
      <p className="oi-eyebrow m-0 mb-1">By material</p>
      <p className="m-0 mb-4 text-[13px] text-[var(--ink2)]">
        The same item at the same size — what each studio charges for it, and what it is made of.
      </p>
      <ul className="m-0 flex list-none flex-col gap-4 p-0">
        {rows.map((row) => {
          const shared = sameSpecGroups(row).filter((g) => g.studios.length > 1);
          return (
            <li key={row.code} className="border-b border-[var(--line)] pb-4 last:border-b-0 last:pb-0">
              <p className="m-0 mb-1.5 text-[14.5px] font-medium">
                {row.label}
              </p>
              <ul className="m-0 flex list-none flex-col gap-1 p-0">
                {row.cells.map((c) => (
                  <li key={c.slug} className="text-[13px] leading-snug text-[var(--ink2)]">
                    <span className="text-[var(--ink)]">{c.name}</span>{' '}
                    {c.amountPaise === null ? 'not quoted' : <span className="oi-num">{money(c.amountPaise)}</span>}
                    {c.spec ? ` — ${c.spec}` : ''}
                  </li>
                ))}
              </ul>
              {shared.map((g) => (
                <p key={g.spec} className="m-0 mt-2 text-[13px] leading-snug text-[var(--ink)]">
                  Same material at {g.studios.length} studios: {g.studios.map((s) => `${money(s.amountPaise)} at ${s.name}`).join(', ')}.
                </p>
              ))}
            </li>
          );
        })}
      </ul>
    </Sheet>
  );
}

/** "Explain the differences" — on demand, written by AI or by the rules, and labelled which. */
export function ExplainDifferences({
  slugs,
  brief,
  plan,
}: {
  slugs: string[];
  brief: Brief | null;
  plan: FloorPlan | null;
}) {
  // A standard kitchen is not a measurement; the server prices its own standard one.
  const measured = plan && plan.source !== 'standard' && plan.kitchenRunMm ? plan : null;
  const [result, setResult] = useState<ComparisonExplanation | null>(null);
  const [language, setLanguage] = useState<Language>(brief?.language ?? 'EN');
  const [failed, setFailed] = useState(false);
  const [pending, start] = useTransition();

  return (
    <Sheet className="mb-10 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="oi-eyebrow m-0">In plain words</p>
        {/* In the language from their brief, and switchable — the person
            reading it may not be the person who filled it in. */}
        <div className="flex gap-1 print:hidden" role="group" aria-label="Language">
          {LANGUAGES.map((l) => (
            <button
              key={l}
              type="button"
              aria-pressed={language === l}
              onClick={() => {
                setLanguage(l);
                setResult(null);
                setFailed(false);
              }}
              className="min-h-9 cursor-pointer rounded-full border px-3 text-[13px]"
              style={{
                borderColor: language === l ? 'var(--acc)' : 'var(--line)',
                background: language === l ? 'var(--acc-wash)' : 'transparent',
                color: language === l ? 'var(--acc-ink)' : 'var(--ink2)',
              }}
            >
              {LANGUAGE_LABELS[l]}
            </button>
          ))}
        </div>
        {!result ? (
          <button
            type="button"
            disabled={pending || !brief}
            onClick={() =>
              start(async () => {
                const r = await explainComparisonAction({
                  slugs,
                  brief,
                  kitchenRunMm: measured?.kitchenRunMm ?? null,
                  measured: measured?.source ?? null,
                  language,
                }).catch(() => null);
                if (r) setResult(r);
                else setFailed(true);
              })
            }
            className="min-h-11 cursor-pointer rounded-full border border-[var(--line)] bg-transparent px-5 py-2.5 text-[14px] font-semibold text-[var(--ink)] hover:border-[var(--ink2)] disabled:opacity-50 print:hidden"
          >
            {pending ? 'Reading the numbers…' : 'Explain the differences'}
          </button>
        ) : null}
      </div>
      {result ? (
        <>
          <p className="m-0 mt-4 max-w-[68ch] text-[14.5px] leading-[1.65]" lang={result.language.toLowerCase()}>
            {result.text}
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <p className="oi-label m-0">
              {result.source === 'model'
                ? 'Written by AI from these quotes — every figure in it was checked against them'
                : language === 'EN'
                  ? 'From the numbers above, by our rules'
                  : 'From the numbers above, by our rules — in English, because a written version was not available just now'}
            </p>
            <Listen text={result.text} language={result.language} />
          </div>
          {result.rules.questions.length > 0 ? (
            <>
              <p className="oi-eyebrow m-0 mb-2 mt-5">Worth asking every studio</p>
              <ul className="m-0 flex list-disc flex-col gap-1 pl-5">
                {result.rules.questions.map((q) => (
                  <li key={q} className="text-[13.5px] text-[var(--ink2)]">
                    {q}
                  </li>
                ))}
              </ul>
            </>
          ) : null}
        </>
      ) : failed ? (
        <p className="m-0 mt-3 text-[13.5px] text-[var(--ink2)]">
          Could not write it just now — everything it would say is in the sections below.
        </p>
      ) : (
        <p className="m-0 mt-3 text-[13.5px] text-[var(--ink2)]">
          Where the cost changes, how the materials differ, and what each studio charges for the same
          material — in a few sentences.
        </p>
      )}
    </Sheet>
  );
}

/**
 * Ask your quote (queue item 24): a question in their words, answered only
 * from these quotes — every figure in the answer is checked against them on
 * the server, and when it cannot be answered from them, it says so.
 */
export function AskYourQuote({ slugs, brief, plan }: { slugs: string[]; brief: Brief | null; plan: FloorPlan | null }) {
  const measured = plan && plan.source !== 'standard' && plan.kitchenRunMm ? plan : null;
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState<QuoteAnswer | null>(null);
  const [pending, start] = useTransition();
  const examples = ['Why is the kitchen so different between them?', 'Where does most of the money go?'];
  const ask = (q: string) =>
    start(async () => {
      setAnswer(null);
      const r = await askQuoteAction({
        slugs,
        brief,
        kitchenRunMm: measured?.kitchenRunMm ?? null,
        measured: measured?.source ?? null,
        question: q,
      }).catch(() => null);
      setAnswer(r ?? { text: 'Could not answer just now. Try again in a minute.', source: 'none' });
    });
  return (
    <Sheet className="mb-10 p-6 print:hidden">
      <p className="oi-eyebrow m-0 mb-2">Ask your quote</p>
      <p className="m-0 mb-4 text-[13.5px] text-[var(--ink2)]">
        Answered only from the figures on these quotes — nothing made up, and every number checked.
      </p>
      <form
        className="flex flex-wrap gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (question.trim().length >= 5) ask(question);
        }}
      >
        <input
          value={question}
          onChange={(e) => setQuestion(e.target.value.slice(0, 300))}
          placeholder="Why is one studio’s kitchen more?"
          className="min-h-11 min-w-[16rem] flex-1 rounded-full border border-[var(--line)] bg-[var(--card)] px-4 text-[15px]"
          aria-label="Your question about these quotes"
        />
        <button
          type="submit"
          disabled={pending || !brief || question.trim().length < 5}
          className="oi-cta min-h-11 cursor-pointer border-0 px-5 text-[14px] disabled:opacity-50"
        >
          {pending ? 'Reading your quotes…' : 'Ask'}
        </button>
      </form>
      <div className="mt-3 flex flex-wrap gap-2">
        {examples.map((q) => (
          <button
            key={q}
            type="button"
            disabled={pending || !brief}
            onClick={() => {
              setQuestion(q);
              ask(q);
            }}
            className="cursor-pointer rounded-full border border-[var(--line)] bg-transparent px-3 py-1.5 text-[12.5px] text-[var(--ink2)]"
          >
            {q}
          </button>
        ))}
      </div>
      {answer ? (
        <div className="mt-4 border-t border-[var(--line)] pt-4">
          <p className="m-0 max-w-[62ch] text-[15px] leading-relaxed text-[var(--ink)]">{answer.text}</p>
          {answer.source === 'model' ? (
            <div className="mt-2">
              <Listen text={answer.text} />
            </div>
          ) : null}
        </div>
      ) : null}
    </Sheet>
  );
}
