'use client';

/**
 * Side by side.
 *
 * ## The screen the whole product is an argument for
 *
 * The landing page's Problem section holds up three quotes for one flat that
 * line up on nothing — four lines on a letterhead, a photograph of a printout,
 * eleven pages with no total. This is the answer to that, and it only works
 * because of a decision made three files away: **we own the line items.** Every
 * studio is priced on the same catalogue at their own rates, so the labels and
 * the sizes are identical down every column and the eye can travel across a row.
 *
 * ## What the reader is actually meant to notice
 *
 * Not the totals. Two quotes ₹1.25 L apart are usually not both more expensive
 * — one has thicker board in it. So the material sits under every amount, and
 * a row where the studios disagree about it is pulled to the top of the page
 * under "Where the difference is". That short list is what an architect would
 * point at, and it is the difference between a comparison and a price list.
 *
 * ## Why a missing line is a row and not a gap in the maths
 *
 * A studio who did not price the mandir is usually the cheapest studio, and
 * the reason is that they are not building a mandir. Dropping the row would
 * make their total look like better value; showing it as "not quoted" — never
 * as ₹0, which reads as free — makes it a decision.
 */

import { ExpertPitch } from '@/components/oi/ExpertPitch';
import type { OfferState } from '@/modules/consultation/offer';
import { Fragment, useEffect, useMemo, useState, type ReactNode } from 'react';
import { formatINRCompact } from '@/lib/money';
import { compareMany, type ComparedLine } from '@/modules/quotation/first-quote';
import { tallyStarred, starredGap } from '@/modules/quotation/starred';
import { loadProject, saveProject, MIN_TO_COMPARE, type Project } from '@/modules/quotation/project-store';
import { splitSpec, type Material } from '@/modules/materials/glossary';
import { ratesAreReal } from '@/data/filed-rates';
import { saveDecisionAction } from '@/app/match/journey-actions';
import { AppFooter, AppHeader, Spine } from '@/components/oi/Chrome';
import { NextStepBar } from '@/components/oi/NextStepBar';
import { Spec, MaterialChip, MaterialPanel } from '@/components/oi/Material';
import { FlowShell } from '@/components/home/FlowShell';
import { Pill, Split } from '@/components/home/parts';
import { ExplainDifferences, AskYourQuote, Dot, FitBlock, MaterialPrices, RoomPrices } from './CompareInsights';
import { rankStudios, type MatchResult } from '@/modules/matching/score';
import { loadBrief } from '@/modules/brief/store';
import { filedRatesFor } from '@/data/filed-rates';
import type { Brief } from '@/modules/brief/types';
import type { Studio } from '@/modules/studio/types';
import type { StudioRates } from '@/modules/quotation/catalogue';
import { useLang, useSiteT } from '@/components/app/i18n';
import { COMPARE_DICT } from '@/modules/i18n/site/compare';
import { ROOM_TX, itemLabel, lbl } from '@/modules/i18n/site/labels';
import type { Lang } from '@/modules/i18n/site';

const money = (p: number | null) => (p === null ? null : formatINRCompact(p));

/** A room's name in this language; the English label for a room the labels do not know. */
export function roomName(lang: Lang, room: string, english: string): string {
  return room in ROOM_TX ? lbl(lang, ROOM_TX, room) : english;
}

/** A translated sentence with `{key}` placeholders filled by elements rather than strings. */
function withNodes(text: string, nodes: Record<string, ReactNode>): ReactNode[] {
  return text.split(/(\{\w+\})/).map((part, i) => {
    const m = /^\{(\w+)\}$/.exec(part);
    return m && m[1] in nodes ? <Fragment key={i}>{nodes[m[1]]}</Fragment> : part;
  });
}

/** One studio's column width. Wide enough for a material, narrow enough for four. */
const COL = 'min-w-[13.5rem]';

/** The space between the page's groups of blocks, as the landing spaces its sections. */
const GROUP = 'mt-[clamp(48px,7vw,100px)]';

/** The dearest price on a row, which every bar on it is scaled against. */
function dearest(line: ComparedLine): number {
  return Math.max(0, ...line.cells.map((c) => c.amountPaise ?? 0));
}

/** A reveal's stagger, for `data-reveal` blocks laid side by side. */
const stagger = (i: number) => ({ ['--d' as string]: `${i * 80}ms` });

/**
 * A warning in words, with the accent as a dot beside it — "not quoted",
 * "pre-launch". Never ₹0 and never a red box: the dot is enough to stop the eye.
 */
function Note({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-baseline gap-2 text-[13.5px] font-medium leading-snug text-[var(--accent-ink)]">
      <Dot />
      <span>{children}</span>
    </span>
  );
}

/** The cheapest amount on a row: a mint tint behind the figure, not a colour change. */
function Amount({ paise, best, className = '' }: { paise: number; best: boolean; className?: string }) {
  return (
    <span
      className={`inline-block whitespace-nowrap font-medium tabular-nums ${best ? '-mx-2 rounded-full bg-[var(--mint)] px-2' : ''} ${className}`}
    >
      {money(paise)}
    </span>
  );
}

/** A row's price as a bar against the dearest on that row. */
function Bar({ width, best }: { width: number; best: boolean }) {
  return (
    <span aria-hidden className="mt-2 block h-[3px] overflow-hidden rounded-full bg-[var(--soft-2)]">
      <span
        className="block h-full rounded-full"
        style={{ width: `${width}%`, background: best ? 'var(--accent)' : 'var(--ink-3)' }}
      />
    </span>
  );
}

/**
 * A spec rendered as chips, with whatever we do not recognise left as text.
 *
 * The comparison used to print the whole spec sentence in every cell. At four
 * studios wide that is four paragraphs across one row and it is not read. The
 * chips carry the same words in a shape the eye can skip over, and each is one
 * tap from the card that explains it.
 */
function MaterialList({ text, onPick }: { text: string; onPick: (m: Material) => void }) {
  const parts = splitSpec(text);
  const chips = parts.filter((p) => p.kind === 'term');
  const rest = parts
    .filter((p) => p.kind === 'text')
    .map((p) => p.text)
    .join('')
    .replace(/[·\s]+/g, ' ')
    .trim();

  if (chips.length === 0) {
    return <span className="mt-2.5 block text-[13px] leading-snug text-[var(--ink-2)]">{text}</span>;
  }

  return (
    <span className="mt-2.5 flex flex-wrap items-center gap-1.5">
      {chips.map((c, i) => (
        <MaterialChip key={i} material={(c as { material: Material }).material} onPick={onPick} />
      ))}
      {rest ? <span className="text-[12.5px] text-[var(--ink-2)]">{rest}</span> : null}
    </span>
  );
}

/**
 * The star. A real button, 44px, and it says what it does.
 *
 * Not a decoration and not a favourite — pressing it changes the verdict at
 * the top of the page, so the label says so. Drawn as the landing's option
 * pill, round: white with a hairline, filled with ink once starred.
 */
function Star({
  on,
  label,
  onToggle,
}: {
  on: boolean;
  label: string;
  onToggle: () => void;
}) {
  const t = useSiteT(COMPARE_DICT);
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={on}
      aria-label={on ? t('star.on', { label }) : t('star.off', { label })}
      className="flow-opt flex-none"
      style={{ width: 44, height: 44, minHeight: 44, padding: 0, fontSize: 16, lineHeight: 1 }}
    >
      <span aria-hidden>{on ? '★' : '☆'}</span>
    </button>
  );
}

/** A small option pill for the quiet actions — Remove, Clear stars. */
const SMALL_OPT = { minHeight: 44, padding: '0 16px', fontSize: 14 } as const;

export function CompareClient({
  studios: roster = [],
  allowUnverified = false,
  filedRates,
  offer,
}: {
  studios?: Studio[];
  allowUnverified?: boolean;
  filedRates?: Record<string, StudioRates>;
  /** The expert call's launch offer, from the server. */
  offer?: OfferState;
} = {}) {
  const [project, setProject] = useState<Project | null>(null);
  const [brief, setBrief] = useState<Brief | null>(null);
  const [term, setTerm] = useState<Material | null>(null);
  const t = useSiteT(COMPARE_DICT);
  const lang = useLang();

  useEffect(() => {
    setProject(loadProject());
    const b = loadBrief();
    setBrief(b.propertyType ? b : null);
  }, []);

  /* Ranked exactly as the match page ranks — same gate, same rates — so the
     fit shown here is the fit shown there. */
  const fit = useMemo(() => {
    if (!brief) return new Map<string, MatchResult>();
    const ranked = rankStudios(brief, roster, 99, {
      allowUnverified,
      ratesFor: (slug) => filedRates?.[slug] ?? filedRatesFor(slug),
      lang,
    });
    return new Map(ranked.map((r) => [r.studioId, r]));
  }, [brief, roster, allowUnverified, filedRates, lang]);

  const entries = useMemo(() => {
    if (!project) return [];
    return project.comparing
      .map((slug) => project.quotes[slug])
      .filter((q): q is NonNullable<typeof q> => q !== undefined)
      .map((q) => ({ slug: q.studioSlug, name: q.studioName, quote: q.quote }));
  }, [project]);

  const comparison = useMemo(
    () => (entries.length >= MIN_TO_COMPARE ? compareMany(entries) : null),
    [entries],
  );

  if (!project) return null;

  const save = (next: Project) => {
    setProject(next);
    saveProject(next);
  };

  const drop = (slug: string) => {
    const comparing = project.comparing.filter((s) => s !== slug);
    save({ ...project, comparing });
    void saveDecisionAction({ comparedSlugs: comparing, starredCodes: project.starred });
  };

  /**
   * A star is the most direct statement of intent in the whole product.
   *
   * Not what somebody said they wanted in the quiz, before they had seen a
   * price — which work they checked the price of twice. It used to live only
   * in sessionStorage and evaporate with the tab.
   */
  const toggleStar = (code: string) => {
    const starred = project.starred.includes(code)
      ? project.starred.filter((c) => c !== code)
      : [...project.starred, code];
    save({ ...project, starred });
    void saveDecisionAction({ comparedSlugs: project.comparing, starredCodes: starred });
  };

  if (!comparison) {
    return (
      <FlowShell className="oi-quick">
        <AppHeader />
        <Spine at="compare" />
        <div className="wrap py-[clamp(48px,7vw,100px)]">
          <header className="max-w-[900px]">
            <p className="eyebrow">{t('eyebrow')}</p>
            <Split as="h1" className="h-l" text={t('empty.title')} auto />
            <p className="lede" data-reveal="" style={stagger(2)}>
              {t('empty.body')}
            </p>
            <div className="mt-10" data-reveal="" style={stagger(3)}>
              <Pill href="/match" arrow>
                {t('back')}
              </Pill>
            </div>
          </header>
        </div>
        <AppFooter />
      </FlowShell>
    );
  }

  const { studios, rooms, tellingRows } = comparison;
  const cheapestTotal = Math.min(...studios.map((s) => s.quote.totalPaise));

  const allLines = rooms.flatMap((r) => r.lines);
  const tally = tallyStarred(allLines, project.starred, studios);
  const gap = starredGap(tally);
  /* The landing's tile tints, in its order, for the "where the difference
     is" tiles. Soft enough that none of them reads as a warning. */
  const TINTS = ['var(--sand)', 'var(--lilac)', 'var(--mint)', 'var(--peach)'];

  return (
    <FlowShell className="oi-quick">
      <AppHeader />
      <Spine
        at="compare"
        facts={[
          { id: 'quote', fact: t('fact.priced', { n: Object.keys(project.quotes).length }) },
          { id: 'compare', fact: t('fact.compare', { n: studios.length }) },
        ]}
      />

      <div className="wrap py-[clamp(40px,6vw,80px)]">
        <header className="mb-[clamp(36px,5vw,64px)] max-w-[900px]">
          <p className="eyebrow">{t('eyebrow')}</p>
          <Split as="h1" className="h-l" text={t('title', { n: studios.length })} auto />
          <p className="lede" data-reveal="" style={stagger(2)}>
            {t('intro')}
          </p>
          <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-3" data-reveal="" style={stagger(3)}>
            <span className="inline-flex min-h-9 items-center rounded-full bg-[var(--soft)] px-4 text-[13px] font-medium">
              {t('aside')}
            </span>
            {!ratesAreReal() ? <Note>{t('prelaunch')}</Note> : null}
          </div>
        </header>

        {/* ── Fit, first ── */}
        {roster.length > 0 ? (
          <div data-reveal="">
            <FitBlock entries={entries} studios={roster} matches={fit} />
          </div>
        ) : null}

        {/* ── The totals ── */}
        <div className="mb-6 grid gap-3 sm:gap-4" style={{ gridTemplateColumns: `repeat(auto-fit,minmax(min(15rem,100%),1fr))` }}>
          {studios.map((s, i) => {
            const isLowest = s.quote.totalPaise === cheapestTotal && studios.length > 1;
            return (
              <section
                key={s.slug}
                className="flow-card flex flex-col"
                data-reveal=""
                style={{ ...stagger(i), ...(isLowest ? { background: 'var(--mint)' } : null) }}
              >
                <div className="flex items-start justify-between gap-3">
                  <h2 className="m-0 pt-2 text-[clamp(1.15rem,1rem+0.6vw,1.5rem)] font-medium leading-tight tracking-[-0.02em]">
                    {s.name}
                  </h2>
                  <button
                    type="button"
                    onClick={() => drop(s.slug)}
                    aria-label={t('remove.aria', { name: s.name })}
                    className="flow-opt flex-none"
                    style={SMALL_OPT}
                  >
                    {t('remove')}
                  </button>
                </div>
                <p className="m-0 mt-8 text-[clamp(2.2rem,1.6rem+2vw,3.4rem)] font-medium leading-none tracking-[-0.04em] tabular-nums">
                  {money(s.quote.totalPaise)}
                </p>
                <p className="m-0 mt-2 text-[14px] text-[var(--ink-2)] tabular-nums">
                  {money(s.quote.lowPaise)}–{money(s.quote.highPaise)}
                </p>
                <p className="m-0 mt-4 border-t border-[var(--line)] pt-4 text-[13.5px] text-[var(--ink-2)] tabular-nums">
                  {t('factory', { factory: money(s.quote.modularPaise) ?? '', site: money(s.quote.nonModularPaise) ?? '' })}
                </p>
                {isLowest ? (
                  <p className="m-0 mt-4">
                    <span className="inline-flex min-h-8 items-center gap-2 rounded-full bg-[var(--paper)] px-3 text-[12.5px] font-medium">
                      <Dot size={6} />
                      {t('lowest')}
                    </span>
                  </p>
                ) : null}
              </section>
            );
          })}
        </div>

        {/* ── Your verdict ──
            The totals above answer "which of these different jobs costs
            less", which is not a question anybody asked. This answers the one
            they did: on the work I actually care about, who is better. It
            appears only once they have starred something, because an empty
            panel explaining a feature is worse than no panel. */}
        {tally.codes.length > 0 ? (
          <section className="flow-card" data-reveal="">
            <div className="mb-6 flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
              <h2 className="h-m">
                {t(tally.codes.length === 1 ? 'starred.one' : 'starred.many', { n: tally.codes.length })}
              </h2>
              <button
                type="button"
                onClick={() => {
                  save({ ...project, starred: [] });
                  void saveDecisionAction({
                    comparedSlugs: project.comparing,
                    starredCodes: [],
                  });
                }}
                className="flow-opt"
                style={SMALL_OPT}
              >
                {t('clearStars')}
              </button>
            </div>

            <ul className="m-0 mb-5 flex list-none flex-col p-0">
              {tally.studios.map((s, i) => (
                <li
                  key={s.slug}
                  className="flex flex-wrap items-baseline justify-between gap-x-5 gap-y-1 border-t border-[var(--line)] py-3.5"
                >
                  <span className="text-[16px] font-medium">
                    {s.name}
                    {s.missing.length > 0 ? (
                      <span className="ml-2 text-[13.5px] font-normal text-[var(--ink-2)]">
                        {t('didNotQuote', { items: s.missing.map((m) => itemLabel(lang, m)).join(', ') })}
                      </span>
                    ) : null}
                  </span>
                  <span className="text-[19px] tracking-[-0.01em]">
                    <Amount
                      paise={s.totalPaise}
                      best={s.missing.length === 0 && i === 0 && tally.leader?.slug === s.slug}
                    />
                    {s.missing.length > 0 ? (
                      <span className="ml-1.5 text-[12.5px] text-[var(--ink-2)]">{t('partOnly')}</span>
                    ) : null}
                  </span>
                </li>
              ))}
            </ul>

            {/* A studio missing a starred line is excluded from the verdict
                rather than credited with zero — not quoting the mandir is how
                you win a comparison you should have lost. */}
            {tally.leader && gap !== null && gap > 0 ? (
              <p className="m-0 max-w-[48ch] text-[clamp(1.15rem,1rem+0.6vw,1.45rem)] font-medium leading-[1.35] tracking-[-0.015em]">
                {withNodes(t('verdict.cheaper'), {
                  name: <span>{tally.leader.name}</span>,
                  gap: (
                    <span className="whitespace-nowrap rounded-full bg-[var(--mint)] px-2 tabular-nums">{money(gap)}</span>
                  ),
                })}
              </p>
            ) : tally.leader && gap === 0 ? (
              <p className="m-0 max-w-[48ch] text-[clamp(1.15rem,1rem+0.6vw,1.45rem)] font-medium leading-[1.35] tracking-[-0.015em]">
                {t('verdict.level')}
              </p>
            ) : (
              <p className="m-0 max-w-[60ch] text-[15px] leading-[1.6] text-[var(--ink-2)]">{t('verdict.onlyOne')}</p>
            )}

            {/* Never allowed to travel alone. A price verdict with no material
                beside it is the disease this product was built against. */}
            {tally.caveats.length > 0 ? (
              <p className="m-0 mt-4 max-w-[64ch]">
                <Note>{t('caveat', { items: tally.caveats.map((c) => itemLabel(lang, c)).join(', ') })}</Note>
              </p>
            ) : null}
          </section>
        ) : (
          <section className="flow-card flex items-center gap-4" data-reveal="">
            <span
              aria-hidden
              className="grid h-11 w-11 flex-none place-items-center rounded-full bg-[var(--paper)] text-[18px] leading-none"
            >
              ☆
            </span>
            <p className="m-0 max-w-[56ch] text-[16px] font-medium leading-snug">
              {t('starHint')}
              <span className="mt-1 block text-[14px] font-normal text-[var(--ink-2)]">{t('starHintSub')}</span>
            </p>
          </section>
        )}

        {/* ── Where the difference is ──
            One tinted tile per row the studios disagree on, the gap set large
            — the landing's figure tiles, holding what an architect would point at. */}
        {tellingRows.length > 0 ? (
          <section className={GROUP}>
            <Split as="h2" className="h-l" text={t('diff.title')} />
            <ul className="m-0 mt-[clamp(28px,4vw,48px)] grid list-none grid-cols-1 gap-3 p-0 sm:gap-4 md:grid-cols-2">
              {tellingRows.map((row, i) => (
                <li
                  key={row.code}
                  className="flex flex-col gap-4 rounded-[var(--r-l)] p-[clamp(22px,2.6vw,34px)]"
                  style={{ background: TINTS[i % TINTS.length], ...stagger(i % 2) }}
                  data-reveal=""
                >
                  <p className="m-0 text-[17px] font-medium leading-snug">{itemLabel(lang, row.label)}</p>
                  {row.spreadPaise > 0 ? (
                    <p className="m-0 text-[clamp(2rem,1.5rem+1.8vw,3rem)] font-medium leading-none tracking-[-0.04em] tabular-nums">
                      {t('diff.apart', { amount: money(row.spreadPaise) ?? '' })}
                    </p>
                  ) : null}
                  {row.materialsDiffer ? (
                    <ul className="m-0 mt-auto flex list-none flex-col gap-1.5 p-0">
                      {row.cells.map((cell) => {
                        const studio = studios.find((s) => s.slug === cell.slug)!;
                        return (
                          <li key={cell.slug} className="text-[14px] leading-snug text-[var(--ink-2)]">
                            <span className="font-medium text-[var(--ink)]">{studio.name}</span>
                            {' — '}
                            {cell.spec ? <Spec text={cell.spec} onPick={setTerm} /> : t('notQuotedLower')}
                          </li>
                        );
                      })}
                    </ul>
                  ) : row.cells.some((c) => c.amountPaise === null) ? (
                    <p className="m-0 mt-auto text-[14px] leading-snug text-[var(--ink-2)]">
                      {t('diff.didNot', {
                        names: row.cells
                          .filter((c) => c.amountPaise === null)
                          .map((c) => studios.find((s) => s.slug === c.slug)?.name)
                          .join(', '),
                      })}
                    </p>
                  ) : (
                    <p className="m-0 mt-auto text-[14px] leading-snug text-[var(--ink-2)]">{t('diff.same')}</p>
                  )}
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <div className={GROUP} data-reveal="">
          <ExplainDifferences slugs={entries.map((e) => e.slug)} brief={brief} plan={project.plan} className="mb-4" />
          <p className="m-0 mb-6">
            <Pill href="/compare/brief" tone="line" arrow className="pill-wrap">
              {t('briefLink')}
            </Pill>
          </p>
        </div>
        <div data-reveal="">
          <AskYourQuote slugs={entries.map((e) => e.slug)} brief={brief} plan={project.plan} />
        </div>
        <div data-reveal="">
          <RoomPrices entries={entries} />
        </div>
        <div data-reveal="">
          <MaterialPrices entries={entries} className="" />
        </div>

        {/* ── Every line, on a phone ──
            The table below is unusable under about 700px: the pinned item
            column plus one 13.5rem studio column leaves nothing, and the rail
            hides its own scrollbars so there is not even a cue that more
            exists. There was no alternative layout at all — this is it.

            One card per line, every studio inside it. The comparison is
            vertical instead of horizontal, which is the right axis on a
            phone and keeps the thing that matters: the material sits under
            the amount, and a studio that did not quote shows as not quoted
            rather than as a gap. */}
        <ul className={`${GROUP} m-0 flex list-none flex-col gap-3 p-0 md:hidden`}>
          {rooms.map((room) => (
            <li key={room.room} className="mt-6 first:mt-0">
              <p className="eyebrow">{roomName(lang, room.room, room.label)}</p>
              <ul className="m-0 flex list-none flex-col gap-3 p-0">
                {room.lines.map((line: ComparedLine) => (
                  <li key={line.code} className="rounded-[var(--r-m)] bg-[var(--soft)] p-4">
                    <div className="flex items-start gap-3">
                      <Star
                        on={project.starred.includes(line.code)}
                        label={itemLabel(lang, line.label)}
                        onToggle={() => toggleStar(line.code)}
                      />
                      <div className="min-w-0 flex-1 pt-1">
                        <p className="m-0 text-[16px] font-medium leading-snug">{itemLabel(lang, line.label)}</p>
                        <p className="m-0 mt-0.5 text-[13px] leading-snug text-[var(--ink-2)] tabular-nums">{line.size}</p>
                      </div>
                    </div>

                    <ul className="m-0 mt-4 flex list-none flex-col gap-4 border-t border-[var(--line)] p-0 pt-4">
                      {line.cells.map((cell) => {
                        const studio = studios.find((s) => s.slug === cell.slug)!;
                        const best = line.cheapest.includes(cell.slug);
                        const width =
                          dearest(line) > 0 && cell.amountPaise !== null
                            ? Math.max(6, Math.round((cell.amountPaise / dearest(line)) * 100))
                            : 0;

                        return (
                          <li key={cell.slug}>
                            <div className="flex items-baseline justify-between gap-4">
                              <span className="text-[14px] text-[var(--ink-2)]">{studio.name}</span>
                              {cell.amountPaise === null ? (
                                <Note>{t('notQuoted')}</Note>
                              ) : (
                                <Amount paise={cell.amountPaise} best={best} className="text-[15.5px]" />
                              )}
                            </div>
                            {cell.amountPaise !== null ? (
                              <>
                                <Bar width={width} best={best} />
                                <MaterialList text={cell.spec ?? ''} onPick={setTerm} />
                              </>
                            ) : null}
                          </li>
                        );
                      })}
                    </ul>
                  </li>
                ))}
              </ul>
            </li>
          ))}

          {/* The totals, set large on ink — the line everything above adds up to. */}
          <li className="mt-3 flex flex-col gap-3 rounded-[var(--r-l)] bg-[var(--ink)] p-5 text-white">
            <p className="eyebrow" style={{ color: 'rgba(255,255,255,0.6)', marginBottom: 4 }}>
              {t('total')}
            </p>
            {studios.map((s) => (
              <span key={s.slug} className="flex items-baseline justify-between gap-4">
                <span className="text-[14.5px] text-white/70">{s.name}</span>
                <span className="whitespace-nowrap text-[clamp(1.5rem,1.2rem+1.4vw,2rem)] font-medium leading-none tracking-[-0.035em] tabular-nums">
                  {money(s.quote.totalPaise)}
                </span>
              </span>
            ))}
          </li>
        </ul>

        {/* ── Every line, with room to put it side by side ──
            Scrolls in both directions inside its own box with the item column
            and the studio names both pinned. The height cap is what makes the
            sticky header work at all: `overflow-x: auto` already made this a
            scroll container, but with no height it never scrolled vertically,
            so `position: sticky` had nothing to stick to and the studio names
            left the screen after the first few rows — twenty-three rows of
            money with nothing saying whose. */}
        <div
          className={`${GROUP} oi-cmp oi-rail hidden max-h-[min(78vh,900px)] overflow-auto rounded-[var(--r-l)] bg-[var(--soft)] md:block`}
        >
          <table className="w-full border-collapse text-left">
            <thead>
              <tr>
                <th
                  scope="col"
                  className="eyebrow sticky left-0 top-0 z-30 border-b border-[var(--line)] bg-[var(--soft)] px-5 pb-4 pt-6 align-bottom"
                >
                  {t('lineItem')}
                </th>
                {studios.map((s) => (
                  <th
                    key={s.slug}
                    scope="col"
                    className={`sticky top-0 z-20 border-b border-[var(--line)] bg-[var(--soft)] px-5 pb-4 pt-6 align-bottom ${COL}`}
                  >
                    <span className="block text-[clamp(1.1rem,0.95rem+0.5vw,1.4rem)] font-medium leading-tight tracking-[-0.02em]">
                      {s.name}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>

            {rooms.map((room) => (
              <tbody key={room.room}>
                <tr>
                  <th
                    scope="colgroup"
                    colSpan={studios.length + 1}
                    className="eyebrow sticky left-0 z-10 bg-[var(--paper)] px-5 py-3 text-left"
                  >
                    {roomName(lang, room.room, room.label)}
                  </th>
                </tr>
                {room.lines.map((line: ComparedLine) => (
                  <tr key={line.code}>
                    <th
                      scope="row"
                      className="sticky left-0 z-10 border-b border-[var(--line)] bg-[var(--soft)] px-5 py-4 align-top font-normal"
                    >
                      <span className="flex items-start gap-3">
                        <Star
                          on={project.starred.includes(line.code)}
                          label={itemLabel(lang, line.label)}
                          onToggle={() => toggleStar(line.code)}
                        />
                        <span className="min-w-0 pt-1">
                          <span className="block text-[15.5px] font-medium leading-snug">{itemLabel(lang, line.label)}</span>
                          <span className="mt-0.5 block text-[13px] leading-snug text-[var(--ink-2)] tabular-nums">
                            {line.size}
                          </span>
                        </span>
                      </span>
                    </th>

                    {line.cells.map((cell) => {
                      const best = line.cheapest.includes(cell.slug);
                      /* The bar is the point of this cell. Four prices in a
                         row are four numbers to hold in your head; four bars
                         are one shape, and the eye does the comparison before
                         the reader decides to. Scaled against the dearest on
                         THIS row, so it says "relative to its neighbours" and
                         never "relative to the whole table". */
                      const width =
                        dearest(line) > 0 && cell.amountPaise !== null
                          ? Math.max(6, Math.round((cell.amountPaise / dearest(line)) * 100))
                          : 0;

                      return (
                        <td key={cell.slug} className={`border-b border-[var(--line)] px-5 py-4 align-top ${COL}`}>
                          {cell.amountPaise === null ? (
                            // Never ₹0 — a zero reads as free.
                            <Note>{t('notQuoted')}</Note>
                          ) : (
                            <>
                              <Amount paise={cell.amountPaise} best={best} className="text-[15.5px]" />
                              <Bar width={width} best={best} />

                              {/* Materials as chips rather than a sentence.
                                  At four columns a sentence per cell is a
                                  paragraph nobody reads; a chip is a thing you
                                  tap when you do not recognise it. */}
                              <MaterialList text={cell.spec ?? ''} onPick={setTerm} />
                            </>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            ))}

            {/* The totals, set large on ink — the line everything above adds up to. */}
            <tfoot>
              <tr>
                <th
                  scope="row"
                  className="eyebrow sticky left-0 z-10 bg-[var(--ink)] px-5 py-6 text-left align-bottom"
                  style={{ color: 'rgba(255,255,255,0.6)' }}
                >
                  {t('total')}
                </th>
                {studios.map((s) => (
                  <td key={s.slug} className={`bg-[var(--ink)] px-5 py-6 align-bottom text-white ${COL}`}>
                    <span className="whitespace-nowrap text-[clamp(1.6rem,1.2rem+1.2vw,2.3rem)] font-medium leading-none tracking-[-0.04em] tabular-nums">
                      {money(s.quote.totalPaise)}
                    </span>
                  </td>
                ))}
              </tr>
            </tfoot>
          </table>
        </div>

        {offer ? (
          <div className={GROUP} data-reveal="">
            <ExpertPitch offer={offer} lead={t('pitchLead')} className="max-w-[44rem]" />
          </div>
        ) : null}

        <div className="mt-10 flex flex-wrap items-center gap-4">
          <Pill href="/match" tone="line">
            {t('another')}
          </Pill>
          {/* The one primary action on this screen is the expert pitch above. */}
        </div>

        <p className="m-0 mt-6 max-w-[58ch] text-[13.5px] leading-[1.6] text-[var(--ink-2)]">{t('footnote')}</p>
      </div>

      {/* Reference you read WHILE comparing, so it is deliberately not a
          modal — it does not take focus and it does not stop you scrolling
          the table behind it. Escape closes it. */}
      <MaterialPanel material={term} onClose={() => setTerm(null)} />

      <NextStepBar label={t('bar.label', { n: entries.length })} offer={offer} />
      <AppFooter />
    </FlowShell>
  );
}
