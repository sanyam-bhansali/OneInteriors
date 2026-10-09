'use client';

/**
 * The compare sections plan §8 adds: fit first, then price by room, price per
 * material, and a written summary whose every figure is checked.
 */

import { useState, useTransition } from 'react';
import { formatINRCompact } from '@/lib/money';
import { Sheet } from '@/components/oi';
import type { MatchResult } from '@/modules/matching/score';
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
import type { Language } from '@/modules/brief/types';
import { Listen } from '@/components/oi/Listen';
import { useLang, useSiteT } from '@/components/app/i18n';
import { COMPARE_DICT } from '@/modules/i18n/site/compare';
import { MATCH_DICT } from '@/modules/i18n/site/match';
import { ROOM_TX, itemLabel, lbl } from '@/modules/i18n/site/labels';

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
  const t = useSiteT(COMPARE_DICT);
  const tm = useSiteT(MATCH_DICT);
  const rows: { label: string; cell: (s: Studio, m: MatchResult | undefined) => string }[] = [
    {
      label: t('fit.fit'),
      cell: (_, m) =>
        m ? t('fit.score', { score: m.score, scored: m.factorsScored, total: m.factorsTotal }) : t('fit.notInMatches'),
    },
    { label: tm('factor.similarWork'), cell: (_, m) => m?.evidence?.similarWork ?? '—' },
    { label: tm('factor.timeline'), cell: (_, m) => m?.timeline?.line ?? t('notKnown') },
    { label: tm('factor.workingStyle'), cell: (_, m) => m?.evidence?.workingStyle ?? t('notKnown') },
    { label: tm('factor.household'), cell: (_, m) => m?.evidence?.household ?? '—' },
    {
      label: t('fit.checks'),
      cell: (s) => t('fit.checksCell', { passed: s.checks.filter((c) => c.result === 'PASS').length, total: s.checks.length }),
    },
    {
      label: t('fit.delivered'),
      cell: (s) =>
        s.completedProjects === 0
          ? t('fit.deliveredNone')
          : `${t('fit.projects', { n: s.completedProjects })}${s.avgVarianceDays !== null ? (s.avgVarianceDays <= 0 ? t('fit.onTime') : t('fit.late', { d: s.avgVarianceDays })) : ''}`,
    },
  ];
  const cols = entries.map((e) => ({ entry: e, studio: studios.find((s) => s.slug === e.slug) }));
  if (cols.some((c) => !c.studio)) return null;

  return (
    <Sheet className="mb-10 overflow-x-auto p-6">
      <p className="oi-eyebrow m-0 mb-4">{t('fit.eyebrow')}</p>
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
  const t = useSiteT(COMPARE_DICT);
  const lang = useLang();
  const rooms = roomSpreads(entries);
  if (rooms.length === 0) return null;
  return (
    <Sheet className="mb-10 p-6">
      <p className="oi-eyebrow m-0 mb-4">{t('room.eyebrow')}</p>
      <ul className="m-0 flex list-none flex-col gap-3 p-0">
        {rooms.map((r) => (
          <li key={r.room} className="border-b border-[var(--line)] pb-3 last:border-b-0 last:pb-0">
            <p className="m-0 flex flex-wrap items-baseline justify-between gap-3">
              <span className="text-[14.5px] font-medium">
                {r.room in ROOM_TX ? lbl(lang, ROOM_TX, r.room) : r.label}
              </span>
              <span className="oi-num text-[13.5px]">
                {r.spreadPaise === 0 ? money(r.lowPaise) : `${money(r.lowPaise)} – ${money(r.highPaise)}`}
              </span>
            </p>
            <p className="m-0 mt-1 text-[13px] text-[var(--ink2)]">
              {r.cells.map((c) => `${c.name} ${c.subtotalPaise === null ? t('notPriced') : money(c.subtotalPaise)}`).join(' · ')}
            </p>
          </li>
        ))}
      </ul>
    </Sheet>
  );
}

/** Each studio's price and material for the same item at the same size — never a per-sq-ft rate. */
export function MaterialPrices({ entries }: { entries: Entry[] }) {
  const t = useSiteT(COMPARE_DICT);
  const lang = useLang();
  const rows = materialRows(entries);
  if (rows.length === 0) return null;
  return (
    <Sheet className="mb-10 p-6">
      <p className="oi-eyebrow m-0 mb-1">{t('mat.eyebrow')}</p>
      <p className="m-0 mb-4 text-[13px] text-[var(--ink2)]">
        {t('mat.intro')}
      </p>
      <ul className="m-0 flex list-none flex-col gap-4 p-0">
        {rows.map((row) => {
          const shared = sameSpecGroups(row).filter((g) => g.studios.length > 1);
          return (
            <li key={row.code} className="border-b border-[var(--line)] pb-4 last:border-b-0 last:pb-0">
              <p className="m-0 mb-1.5 text-[14.5px] font-medium">
                {itemLabel(lang, row.label)}
              </p>
              <ul className="m-0 flex list-none flex-col gap-1 p-0">
                {row.cells.map((c) => (
                  <li key={c.slug} className="text-[13px] leading-snug text-[var(--ink2)]">
                    <span className="text-[var(--ink)]">{c.name}</span>{' '}
                    {c.amountPaise === null ? t('notQuotedLower') : <span className="oi-num">{money(c.amountPaise)}</span>}
                    {c.spec ? ` — ${c.spec}` : ''}
                  </li>
                ))}
              </ul>
              {shared.map((g) => (
                <p key={g.spec} className="m-0 mt-2 text-[13px] leading-snug text-[var(--ink)]">
                  {t('mat.same', {
                    n: g.studios.length,
                    list: g.studios.map((s) => t('mat.at', { amount: money(s.amountPaise), name: s.name })).join(', '),
                  })}
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
  const t = useSiteT(COMPARE_DICT);
  const lang = useLang();
  const [result, setResult] = useState<ComparisonExplanation | null>(null);
  /* The language chosen at the start of the site (owner, 10 Oct 2026: no
     second language switch here). */
  const language: Language = lang === 'hi' ? 'HI' : lang === 'mr' ? 'MR' : 'EN';
  const [failed, setFailed] = useState(false);
  const [pending, start] = useTransition();

  return (
    <Sheet className="mb-10 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="oi-eyebrow m-0">{t('explain.eyebrow')}</p>
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
            {pending ? t('explain.pending') : t('explain.button')}
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
                ? t('explain.byAI')
                : language === 'EN'
                  ? t('explain.byRules')
                  : t('explain.byRulesEnglish')}
            </p>
            <Listen text={result.text} language={result.language} />
          </div>
          {result.rules.questions.length > 0 ? (
            <>
              <p className="oi-eyebrow m-0 mb-2 mt-5">{t('worthAsking')}</p>
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
          {t('explain.failed')}
        </p>
      ) : (
        <p className="m-0 mt-3 text-[13.5px] text-[var(--ink2)]">
          {t('explain.intro')}
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
  const t = useSiteT(COMPARE_DICT);
  const lang = useLang();
  const examples = [t('ask.ex1'), t('ask.ex2')];
  const ask = (q: string) =>
    start(async () => {
      setAnswer(null);
      const r = await askQuoteAction({
        slugs,
        brief,
        kitchenRunMm: measured?.kitchenRunMm ?? null,
        measured: measured?.source ?? null,
        question: q,
        // The website's language when it is not English; otherwise the server uses the brief's.
        ...(lang === 'hi' ? { language: 'HI' } : lang === 'mr' ? { language: 'MR' } : {}),
      }).catch(() => null);
      setAnswer(r ?? { text: t('ask.error'), source: 'none' });
    });
  return (
    <Sheet className="mb-10 p-6 print:hidden">
      <p className="oi-eyebrow m-0 mb-2">{t('ask.eyebrow')}</p>
      <p className="m-0 mb-4 text-[13.5px] text-[var(--ink2)]">
        {t('ask.intro')}
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
          placeholder={t('ask.placeholder')}
          className="min-h-11 min-w-[16rem] flex-1 rounded-full border border-[var(--line)] bg-[var(--card)] px-4 text-[15px]"
          aria-label={t('ask.aria')}
        />
        <button
          type="submit"
          disabled={pending || !brief || question.trim().length < 5}
          className="oi-cta min-h-11 cursor-pointer border-0 px-5 text-[14px] disabled:opacity-50"
        >
          {pending ? t('ask.pending') : t('ask.button')}
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
