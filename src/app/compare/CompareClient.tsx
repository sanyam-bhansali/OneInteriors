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
import Link from 'next/link';
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
import { Wrap, Chapter, Sheet, Quiet, Flag } from '@/components/oi';
import { ExplainDifferences, AskYourQuote, FitBlock, MaterialPrices, RoomPrices } from './CompareInsights';
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

/** The dearest price on a row, which every bar on it is scaled against. */
function dearest(line: ComparedLine): number {
  return Math.max(0, ...line.cells.map((c) => c.amountPaise ?? 0));
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
    return (
      <span className="mt-2 block text-[12.5px] leading-snug text-[var(--ink2)]">{text}</span>
    );
  }

  return (
    <span className="mt-2 flex flex-wrap items-center gap-1.5">
      {chips.map((c, i) => (
        <MaterialChip key={i} material={(c as { material: Material }).material} onPick={onPick} />
      ))}
      {rest ? <span className="text-[12px] text-[var(--ink2)]">{rest}</span> : null}
    </span>
  );
}

/**
 * The star. A real button, 44px, and it says what it does.
 *
 * Not a decoration and not a favourite — pressing it changes the verdict at
 * the top of the page, so the label says so.
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
      aria-label={
        on ? t('star.on', { label }) : t('star.off', { label })
      }
      className="-ml-1.5 flex h-11 w-9 flex-none cursor-pointer items-center justify-center border-0 bg-transparent p-0 text-[15px] leading-none transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--acc)]"
      style={{ color: on ? 'var(--acc-ink)' : 'var(--ink2)' }}
    >
      <span aria-hidden>{on ? '★' : '☆'}</span>
    </button>
  );
}

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
      <div className="oi-app oi-quick min-h-dvh bg-[var(--bg)]">
        <AppHeader />
        <Spine at="compare" />
        <Wrap className="py-12">
          <Chapter eyebrow={t('eyebrow')} title={t('empty.title')}>
            {t('empty.body')}
          </Chapter>
          <Sheet className="p-8">
            <Quiet href="/match">{t('back')}</Quiet>
          </Sheet>
        </Wrap>
        <AppFooter />
      </div>
    );
  }

  const { studios, rooms, tellingRows } = comparison;
  const cheapestTotal = Math.min(...studios.map((s) => s.quote.totalPaise));

  const allLines = rooms.flatMap((r) => r.lines);
  const tally = tallyStarred(allLines, project.starred, studios);
  const gap = starredGap(tally);

  return (
    <div className="oi-app oi-quick min-h-dvh bg-[var(--bg)]">
      <AppHeader />
      <Spine
        at="compare"
        facts={[
          { id: 'quote', fact: t('fact.priced', { n: Object.keys(project.quotes).length }) },
          { id: 'compare', fact: t('fact.compare', { n: studios.length }) },
        ]}
      />

      <Wrap className="py-12">
        <Chapter
          eyebrow={t('eyebrow')}
          title={t('title', { n: studios.length })}
          aside={
            <p className="oi-num m-0 whitespace-nowrap text-[10.5px] uppercase tracking-[0.18em] text-[var(--ink2)]">
              {t('aside')}
            </p>
          }
        >
          {t('intro')}
        </Chapter>

        {!ratesAreReal() ? (
          <p className="m-0 mb-8">
            <Flag>{t('prelaunch')}</Flag>
          </p>
        ) : null}

        {/* ── Fit, first ── */}
        {roster.length > 0 ? <FitBlock entries={entries} studios={roster} matches={fit} /> : null}

        {/* ── The totals ── */}
        <div className="mb-10 grid gap-4" style={{ gridTemplateColumns: `repeat(auto-fit,minmax(15rem,1fr))` }}>
          {studios.map((s) => {
            const isLowest = s.quote.totalPaise === cheapestTotal;
            return (
              <Sheet key={s.slug} className="p-5">
                <div className="mb-3 flex items-baseline justify-between gap-3">
                  <h2 className="oi-display m-0 text-[18px]">{s.name}</h2>
                  <button
                    type="button"
                    onClick={() => drop(s.slug)}
                    aria-label={t('remove.aria', { name: s.name })}
                    className="oi-num -mr-2 -mt-2 flex min-h-11 cursor-pointer items-center rounded-full border-0 bg-transparent px-2.5 text-[9.5px] uppercase tracking-[0.16em] text-[var(--ink2)] transition-colors hover:text-[var(--ink)]"
                  >
                    {t('remove')}
                  </button>
                </div>
                <p className="oi-num m-0 text-[24px] leading-none">
                  {money(s.quote.totalPaise)}
                </p>
                <p className="oi-num m-0 mt-2 text-[10.5px] uppercase tracking-[0.14em] text-[var(--ink2)]">
                  {money(s.quote.lowPaise)}–{money(s.quote.highPaise)}
                </p>
                <p className="oi-num m-0 mt-3 border-t border-[var(--line)] pt-3 text-[10.5px] uppercase tracking-[0.12em] text-[var(--ink2)]">
                  {t('factory', { factory: money(s.quote.modularPaise) ?? '', site: money(s.quote.nonModularPaise) ?? '' })}
                </p>
                {isLowest && studios.length > 1 ? (
                  <p
                    className="oi-num m-0 mt-3 text-[10px] uppercase tracking-[0.14em]"
                    style={{ color: 'var(--sec-ink)' }}
                  >
                    {t('lowest')}
                  </p>
                ) : null}
              </Sheet>
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
          <Sheet className="mb-10 p-6">
            <div className="mb-4 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
              <p className="oi-eyebrow m-0">
                {t(tally.codes.length === 1 ? 'starred.one' : 'starred.many', { n: tally.codes.length })}
              </p>
              <button
                type="button"
                onClick={() => {
                  save({ ...project, starred: [] });
                  void saveDecisionAction({
                    comparedSlugs: project.comparing,
                    starredCodes: [],
                  });
                }}
                className="oi-num -my-2 flex min-h-11 cursor-pointer items-center rounded-full border-0 bg-transparent px-2.5 text-[10.5px] uppercase tracking-[0.14em] text-[var(--ink2)] transition-colors hover:text-[var(--ink)]"
              >
                {t('clearStars')}
              </button>
            </div>

            <ul className="m-0 mb-4 flex list-none flex-col gap-2.5 p-0">
              {tally.studios.map((s, i) => (
                <li
                  key={s.slug}
                  className="flex flex-wrap items-baseline justify-between gap-x-5 gap-y-1"
                >
                  <span className="text-[14.5px]">
                    {s.name}
                    {s.missing.length > 0 ? (
                      <span className="ml-2 text-[13px] text-[var(--ink2)]">
                        {t('didNotQuote', { items: s.missing.map((m) => itemLabel(lang, m)).join(', ') })}
                      </span>
                    ) : null}
                  </span>
                  <span
                    className="oi-num text-[15px]"
                    style={
                      s.missing.length === 0 && i === 0 && tally.leader?.slug === s.slug
                        ? { color: 'var(--sec-ink)' }
                        : undefined
                    }
                  >
                    {money(s.totalPaise)}
                    {s.missing.length > 0 ? (
                      <span className="ml-1.5 text-[11px] text-[var(--ink2)]">{t('partOnly')}</span>
                    ) : null}
                  </span>
                </li>
              ))}
            </ul>

            {/* A studio missing a starred line is excluded from the verdict
                rather than credited with zero — not quoting the mandir is how
                you win a comparison you should have lost. */}
            {tally.leader && gap !== null && gap > 0 ? (
              <p className="m-0 border-t border-[var(--line)] pt-4 text-[14.5px] leading-[1.6]">
                {withNodes(t('verdict.cheaper'), {
                  name: <span className="font-medium">{tally.leader.name}</span>,
                  gap: (
                    <span className="oi-num" style={{ color: 'var(--sec-ink)' }}>
                      {money(gap)}
                    </span>
                  ),
                })}
              </p>
            ) : tally.leader && gap === 0 ? (
              <p className="m-0 border-t border-[var(--line)] pt-4 text-[14.5px] leading-[1.6]">
                {t('verdict.level')}
              </p>
            ) : (
              <p className="m-0 border-t border-[var(--line)] pt-4 text-[14px] leading-[1.6] text-[var(--ink2)]">
                {t('verdict.onlyOne')}
              </p>
            )}

            {/* Never allowed to travel alone. A price verdict with no material
                beside it is the disease this product was built against. */}
            {tally.caveats.length > 0 ? (
              <p className="m-0 mt-3 max-w-[64ch] text-[13.5px] leading-[1.6]">
                <Flag>
                  {t('caveat', { items: tally.caveats.map((c) => itemLabel(lang, c)).join(', ') })}
                </Flag>
              </p>
            ) : null}
          </Sheet>
        ) : (
          <Sheet className="mb-10 flex flex-wrap items-center gap-x-4 gap-y-2 p-5">
            <span aria-hidden className="text-[19px] leading-none text-[var(--ink2)]">
              ☆
            </span>
            <p className="m-0 max-w-[52ch] text-[14.5px] leading-snug">
              {t('starHint')}
              <span className="block text-[13.5px] text-[var(--ink2)]">
                {t('starHintSub')}
              </span>
            </p>
          </Sheet>
        )}

        {/* ── Where the difference is ── */}
        {tellingRows.length > 0 ? (
          <Sheet className="mb-10 p-6">
            <p className="oi-eyebrow m-0 mb-4">{t('diff.title')}</p>
            <ul className="m-0 flex list-none flex-col gap-4 p-0">
              {tellingRows.map((row) => (
                <li key={row.code} className="border-b border-[var(--line)] pb-4 last:border-b-0 last:pb-0">
                  <p className="m-0 mb-1.5 flex flex-wrap items-baseline justify-between gap-3">
                    <span className="text-[14.5px] font-medium">{itemLabel(lang, row.label)}</span>
                    {row.spreadPaise > 0 ? (
                      <span className="oi-num text-[13px]" style={{ color: 'var(--acc-ink)' }}>
                        {t('diff.apart', { amount: money(row.spreadPaise) ?? '' })}
                      </span>
                    ) : null}
                  </p>
                  {row.materialsDiffer ? (
                    <ul className="m-0 flex list-none flex-col gap-1 p-0">
                      {row.cells.map((cell) => {
                        const studio = studios.find((s) => s.slug === cell.slug)!;
                        return (
                          <li key={cell.slug} className="text-[13px] leading-snug text-[var(--ink2)]">
                            <span className="text-[var(--ink)]">{studio.name}</span>
                            {' — '}
                            {cell.spec ? (
                              <Spec text={cell.spec} onPick={setTerm} />
                            ) : (
                              t('notQuotedLower')
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  ) : row.cells.some((c) => c.amountPaise === null) ? (
                    <p className="m-0 text-[13px] leading-snug text-[var(--ink2)]">
                      {t('diff.didNot', {
                        names: row.cells
                          .filter((c) => c.amountPaise === null)
                          .map((c) => studios.find((s) => s.slug === c.slug)?.name)
                          .join(', '),
                      })}
                    </p>
                  ) : (
                    <p className="m-0 text-[13px] leading-snug text-[var(--ink2)]">
                      {t('diff.same')}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          </Sheet>
        ) : null}

        <ExplainDifferences slugs={entries.map((e) => e.slug)} brief={brief} plan={project.plan} />
        <p className="m-0 -mt-6 mb-10">
          <Link href="/compare/brief" className="text-[14px] font-semibold text-[var(--ink)] underline">
            {t('briefLink')}
          </Link>
        </p>
        <AskYourQuote slugs={entries.map((e) => e.slug)} brief={brief} plan={project.plan} />
        <RoomPrices entries={entries} />
        <MaterialPrices entries={entries} />

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
        <ul className="m-0 flex list-none flex-col gap-3 p-0 md:hidden">
          {rooms.map((room) => (
            <li key={room.room}>
              <p className="oi-label m-0 mb-2 mt-4 first:mt-0">{roomName(lang, room.room, room.label)}</p>
              <ul className="m-0 flex list-none flex-col gap-3 p-0">
                {room.lines.map((line: ComparedLine) => (
                  <li key={line.code} className="border border-[var(--line)] bg-[var(--card)] p-4">
                    <div className="flex items-start gap-1.5">
                      <Star
                        on={project.starred.includes(line.code)}
                        label={itemLabel(lang, line.label)}
                        onToggle={() => toggleStar(line.code)}
                      />
                      <div className="min-w-0 flex-1 pt-2.5">
                        <p className="m-0 text-[14.5px] font-medium">{itemLabel(lang, line.label)}</p>
                        <p className="oi-num m-0 mt-1 text-[12px] leading-snug text-[var(--ink2)]">
                          {line.size}
                        </p>
                      </div>
                    </div>

                    <ul className="m-0 mt-3 flex list-none flex-col gap-3 border-t border-[var(--line)] p-0 pt-3">
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
                              <span className="text-[13.5px] text-[var(--ink2)]">{studio.name}</span>
                              {cell.amountPaise === null ? (
                                <Flag>{t('notQuoted')}</Flag>
                              ) : (
                                <span
                                  className="oi-num text-[14px]"
                                  style={best ? { color: 'var(--sec-ink)' } : undefined}
                                >
                                  {money(cell.amountPaise)}
                                </span>
                              )}
                            </div>
                            {cell.amountPaise !== null ? (
                              <>
                                <span aria-hidden className="mt-1.5 block h-[3px] bg-[var(--line)]">
                                  <span
                                    className="block h-full"
                                    style={{
                                      width: `${width}%`,
                                      background: best ? 'var(--sec-ink)' : 'var(--ink2)',
                                    }}
                                  />
                                </span>
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

          <li className="mt-2 flex flex-col gap-2 border-t-2 border-[var(--ink)] bg-[var(--card)] p-4">
            <p className="oi-label m-0">{t('total')}</p>
            {studios.map((s) => (
              <span key={s.slug} className="flex items-baseline justify-between gap-4">
                <span className="text-[13.5px] text-[var(--ink2)]">{s.name}</span>
                <span className="oi-num text-[16px]">{money(s.quote.totalPaise)}</span>
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
        <div className="oi-cmp oi-rail hidden max-h-[min(78vh,900px)] overflow-auto border border-[var(--line)] bg-[var(--card)] md:block">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr>
                <th
                  scope="col"
                  className="oi-label sticky left-0 top-0 z-30 border-b border-[var(--ink)] bg-[var(--card)] p-4 align-bottom"
                >
                  {t('lineItem')}
                </th>
                {studios.map((s) => (
                  <th
                    key={s.slug}
                    scope="col"
                    className={`sticky top-0 z-20 border-b border-[var(--ink)] bg-[var(--card)] p-4 align-bottom ${COL}`}
                  >
                    <span className="oi-display block text-[15px]">{s.name}</span>
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
                    className="oi-label sticky left-0 z-10 bg-[var(--bg)] px-4 py-2.5 text-left"
                  >
                    {roomName(lang, room.room, room.label)}
                  </th>
                </tr>
                {room.lines.map((line: ComparedLine) => (
                  <tr key={line.code}>
                    <th
                      scope="row"
                      className="sticky left-0 z-10 border-b border-[var(--line)] bg-[var(--card)] p-4 align-top font-normal"
                    >
                      <span className="flex items-start gap-1.5">
                        <Star
                          on={project.starred.includes(line.code)}
                          label={itemLabel(lang, line.label)}
                          onToggle={() => toggleStar(line.code)}
                        />
                        <span className="min-w-0 pt-2.5">
                          <span className="block text-[14.5px] font-medium">{itemLabel(lang, line.label)}</span>
                          <span className="oi-num mt-1 block text-[12px] leading-snug text-[var(--ink2)]">
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
                        <td
                          key={cell.slug}
                          className={`border-b border-[var(--line)] p-4 align-top ${COL}`}
                        >
                          {cell.amountPaise === null ? (
                            // Never ₹0 — a zero reads as free.
                            <Flag>{t('notQuoted')}</Flag>
                          ) : (
                            <>
                              <span
                                className="oi-num block text-[14px]"
                                style={best ? { color: 'var(--sec-ink)' } : undefined}
                              >
                                {money(cell.amountPaise)}
                              </span>
                              <span
                                aria-hidden
                                className="mt-1.5 block h-[3px] bg-[var(--line)]"
                              >
                                <span
                                  className="block h-full"
                                  style={{
                                    width: `${width}%`,
                                    // --sec-ink: raw sage is 2.32:1 on the hairline track.
                                    background: best ? 'var(--sec-ink)' : 'var(--ink2)',
                                  }}
                                />
                              </span>

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

            <tfoot>
              <tr>
                <th
                  scope="row"
                  className="oi-label sticky left-0 z-10 border-t border-[var(--ink)] bg-[var(--card)] p-4 text-left"
                >
                  {t('total')}
                </th>
                {studios.map((s) => (
                  <td
                    key={s.slug}
                    className={`border-t border-[var(--ink)] p-4 ${COL}`}
                  >
                    <span className="oi-num text-[17px]">{money(s.quote.totalPaise)}</span>
                  </td>
                ))}
              </tr>
            </tfoot>
          </table>
        </div>

        {offer ? (
          <ExpertPitch
            offer={offer}
            lead={t('pitchLead')}
            className="mt-10 max-w-[44rem]"
          />
        ) : null}

        <div className="mt-8 flex flex-wrap items-center gap-4">
          <Quiet href="/match">{t('another')}</Quiet>
          {/* The one terracotta action on this screen is the expert pitch above. */}
        </div>

        <p className="m-0 mt-6 max-w-[58ch] text-[13px] leading-[1.6] text-[var(--ink2)]">
          {t('footnote')}
        </p>
      </Wrap>

      {/* Reference you read WHILE comparing, so it is deliberately not a
          modal — it does not take focus and it does not stop you scrolling
          the table behind it. Escape closes it. */}
      <MaterialPanel material={term} onClose={() => setTerm(null)} />

      <NextStepBar label={t('bar.label', { n: entries.length })} offer={offer} />
      <AppFooter />
    </div>
  );
}
