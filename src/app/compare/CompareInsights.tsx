'use client';

/**
 * The compare sections plan §8 adds: fit first, then price by room, price per
 * material, and a written summary whose every figure is checked.
 *
 * Shared by /compare and the printable /compare/brief, so nothing in here uses
 * the landing's scroll reveals (`data-reveal`, `<Split>`): a block that had not
 * scrolled into view yet would print blank. The page around them adds motion.
 */

import { useState, useTransition } from 'react';
import { formatINRCompact } from '@/lib/money';
import { PillButton } from '@/components/home/parts';
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

/** The landing's soft rounded card. On paper it loses its fill, so it loses its inset too. */
const CARD = 'flow-card break-inside-avoid print:!rounded-none print:!px-0';

/** Listen, drawn as the landing's line pill. */
const LISTEN_PILL = '[&_button]:border-[rgba(11,11,11,0.22)] [&_button]:px-5 [&_button]:font-medium';

/** A terracotta dot — the accent as a mark, never a fill. */
export function Dot({ size = 7 }: { size?: number }) {
  return (
    <span
      aria-hidden
      className="inline-block flex-none -translate-y-px rounded-full bg-[var(--accent)]"
      style={{ width: size, height: size }}
    />
  );
}

/** Fit, first: the decision is a designer, not a price list. */
export function FitBlock({
  entries,
  studios,
  matches,
  className = 'mb-6',
}: {
  entries: Entry[];
  studios: Studio[];
  matches: Map<string, MatchResult>;
  className?: string;
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
    <section className={`${CARD} ${className}`}>
      <h2 className="h-m">{t('fit.eyebrow')}</h2>
      {/* Its own sideways scroll on a phone, inside the card — the page itself never scrolls sideways. */}
      <div className="mt-6 overflow-x-auto">
        <table className="w-full min-w-[36rem] border-collapse text-[14.5px] tabular-nums">
          <thead>
            <tr>
              <th className="w-[9.5rem]" />
              {cols.map((c) => (
                <th
                  key={c.entry.slug}
                  scope="col"
                  className="pb-4 pr-4 text-left align-bottom text-[clamp(1.05rem,0.95rem+0.5vw,1.35rem)] font-medium leading-tight tracking-[-0.02em] text-[var(--ink)]"
                >
                  {c.entry.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.label} className="border-t border-[var(--line)] align-top">
                <th scope="row" className="py-3.5 pr-4 text-left text-[13px] font-medium text-[var(--ink-2)]">
                  {r.label}
                </th>
                {cols.map((c) => (
                  <td key={c.entry.slug} className="py-3.5 pr-4 leading-snug text-[var(--ink)]">
                    {r.cell(c.studio!, matches.get(c.studio!.id))}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

/** "Kitchen: ₹2.1 L – ₹2.9 L across your four studios." */
export function RoomPrices({ entries, className = 'mb-6' }: { entries: Entry[]; className?: string }) {
  const t = useSiteT(COMPARE_DICT);
  const lang = useLang();
  const rooms = roomSpreads(entries);
  if (rooms.length === 0) return null;
  return (
    <section className={`${CARD} ${className}`}>
      <h2 className="h-m">{t('room.eyebrow')}</h2>
      <ul className="m-0 mt-6 flex list-none flex-col p-0">
        {rooms.map((r) => (
          <li key={r.room} className="border-t border-[var(--line)] py-4 last:pb-0">
            <p className="m-0 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
              <span className="text-[16px] font-medium">
                {r.room in ROOM_TX ? lbl(lang, ROOM_TX, r.room) : r.label}
              </span>
              <span className="whitespace-nowrap text-[17px] font-medium tracking-[-0.01em] tabular-nums">
                {r.spreadPaise === 0 ? money(r.lowPaise) : `${money(r.lowPaise)} – ${money(r.highPaise)}`}
              </span>
            </p>
            <p className="m-0 mt-1 text-[13.5px] leading-snug text-[var(--ink-2)] tabular-nums">
              {r.cells.map((c) => `${c.name} ${c.subtotalPaise === null ? t('notPriced') : money(c.subtotalPaise)}`).join(' · ')}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Each studio's price and material for the same item at the same size — never a per-sq-ft rate. */
export function MaterialPrices({ entries, className = 'mb-6' }: { entries: Entry[]; className?: string }) {
  const t = useSiteT(COMPARE_DICT);
  const lang = useLang();
  const rows = materialRows(entries);
  if (rows.length === 0) return null;
  return (
    <section className={`${CARD} ${className}`}>
      <h2 className="h-m">{t('mat.eyebrow')}</h2>
      <p className="m-0 mt-3 max-w-[60ch] text-[15px] leading-[1.6] text-[var(--ink-2)]">{t('mat.intro')}</p>
      <ul className="m-0 mt-6 flex list-none flex-col p-0">
        {rows.map((row) => {
          const shared = sameSpecGroups(row).filter((g) => g.studios.length > 1);
          return (
            <li key={row.code} className="break-inside-avoid border-t border-[var(--line)] py-4 last:pb-0">
              <p className="m-0 mb-2 text-[16px] font-medium">{itemLabel(lang, row.label)}</p>
              <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
                {row.cells.map((c) => (
                  <li key={c.slug} className="text-[14px] leading-snug text-[var(--ink-2)]">
                    <span className="font-medium text-[var(--ink)]">{c.name}</span>{' '}
                    {c.amountPaise === null ? (
                      t('notQuotedLower')
                    ) : (
                      <span className="font-medium tabular-nums text-[var(--ink)]">{money(c.amountPaise)}</span>
                    )}
                    {c.spec ? ` — ${c.spec}` : ''}
                  </li>
                ))}
              </ul>
              {shared.map((g) => (
                <p key={g.spec} className="m-0 mt-2.5 flex items-baseline gap-2 text-[14px] leading-snug text-[var(--ink)]">
                  <Dot />
                  <span>
                    {t('mat.same', {
                      n: g.studios.length,
                      list: g.studios.map((s) => t('mat.at', { amount: money(s.amountPaise), name: s.name })).join(', '),
                    })}
                  </span>
                </p>
              ))}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/** "Explain the differences" — on demand, written by AI or by the rules, and labelled which. */
export function ExplainDifferences({
  slugs,
  brief,
  plan,
  className = 'mb-6',
}: {
  slugs: string[];
  brief: Brief | null;
  plan: FloorPlan | null;
  className?: string;
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
    /* A tinted tile, as the landing's figures sit on: the one block on the
       page written in sentences rather than rows. */
    <section className={`${CARD} ${className}`} style={{ background: 'var(--lilac)' }}>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h2 className="h-m">{t('explain.eyebrow')}</h2>
        {!result ? (
          // The wrapper hides it on paper: the pill's own display wins over a utility.
          <span className="print:hidden">
            <PillButton
              tone="dark"
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
            >
              {pending ? t('explain.pending') : t('explain.button')}
            </PillButton>
          </span>
        ) : null}
      </div>
      {result ? (
        <>
          <p
            className="m-0 mt-5 max-w-[64ch] text-[clamp(1.05rem,1rem+0.3vw,1.2rem)] leading-[1.6]"
            lang={result.language.toLowerCase()}
          >
            {result.text}
          </p>
          <div className="mt-5 flex flex-wrap items-center gap-3">
            <p className="m-0 text-[13px] text-[var(--ink-2)]">
              {result.source === 'model'
                ? t('explain.byAI')
                : language === 'EN'
                  ? t('explain.byRules')
                  : t('explain.byRulesEnglish')}
            </p>
            <span className={LISTEN_PILL}>
              <Listen text={result.text} language={result.language} />
            </span>
          </div>
          {result.rules.questions.length > 0 ? (
            <div className="mt-6 rounded-[var(--r-m)] bg-[var(--paper)] p-5">
              <p className="eyebrow">{t('worthAsking')}</p>
              <ul className="m-0 flex list-none flex-col gap-2 p-0">
                {result.rules.questions.map((q) => (
                  <li key={q} className="flex items-baseline gap-2.5 text-[14.5px] leading-snug">
                    <Dot size={6} />
                    {q}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </>
      ) : failed ? (
        <p className="m-0 mt-4 max-w-[60ch] text-[15px] leading-[1.6] text-[var(--ink-2)]">{t('explain.failed')}</p>
      ) : (
        <p className="m-0 mt-4 max-w-[60ch] text-[15px] leading-[1.6] text-[var(--ink-2)]">{t('explain.intro')}</p>
      )}
    </section>
  );
}

/**
 * Ask your quote (queue item 24): a question in their words, answered only
 * from these quotes — every figure in the answer is checked against them on
 * the server, and when it cannot be answered from them, it says so.
 */
export function AskYourQuote({
  slugs,
  brief,
  plan,
  className = 'mb-6',
}: {
  slugs: string[];
  brief: Brief | null;
  plan: FloorPlan | null;
  className?: string;
}) {
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
    <section className={`${CARD} ${className} print:hidden`}>
      <h2 className="h-m">{t('ask.eyebrow')}</h2>
      <p className="m-0 mt-3 max-w-[60ch] text-[15px] leading-[1.6] text-[var(--ink-2)]">{t('ask.intro')}</p>
      <form
        className="mt-6 flex flex-wrap items-center gap-2.5"
        onSubmit={(e) => {
          e.preventDefault();
          if (question.trim().length >= 5) ask(question);
        }}
      >
        {/* White on the grey card: the field's own soft fill would vanish into it. */}
        <input
          value={question}
          onChange={(e) => setQuestion(e.target.value.slice(0, 300))}
          placeholder={t('ask.placeholder')}
          className="flow-input min-w-[min(16rem,100%)] flex-1"
          style={{ background: 'var(--paper)' }}
          aria-label={t('ask.aria')}
        />
        <PillButton type="submit" tone="dark" arrow disabled={pending || !brief || question.trim().length < 5}>
          {pending ? t('ask.pending') : t('ask.button')}
        </PillButton>
      </form>
      <div className="mt-4 flex flex-wrap gap-2">
        {examples.map((q) => (
          <button
            key={q}
            type="button"
            disabled={pending || !brief}
            onClick={() => {
              setQuestion(q);
              ask(q);
            }}
            className="flow-opt disabled:cursor-not-allowed disabled:opacity-50"
            style={{ fontSize: 14, lineHeight: 1.35, padding: '10px 18px', minHeight: 44, textAlign: 'left' }}
          >
            {q}
          </button>
        ))}
      </div>
      {answer ? (
        <div className="mt-5 rounded-[var(--r-m)] bg-[var(--paper)] p-5">
          <p className="m-0 max-w-[62ch] text-[16px] leading-[1.6] text-[var(--ink)]">{answer.text}</p>
          {answer.source === 'model' ? (
            <div className={`mt-4 ${LISTEN_PILL}`}>
              <Listen text={answer.text} />
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
