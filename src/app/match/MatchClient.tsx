'use client';

/**
 * Who fits your brief.
 *
 * ## What this screen was, and why it is not that any more
 *
 * It was four hundred and eighty lines: score rings, tier badges, factor
 * breakdowns, pills, a shortlist bar, an explanation of the engine. All of it
 * true, and together it asked somebody who wanted to know *who should do my
 * kitchen* to first learn how our matching works.
 *
 * A match screen has one job: hand over a short list, say why each one is on
 * it, and get out of the way. Everything else belongs on the studio's own
 * page, where somebody who has decided to look closely can look closely.
 *
 * So: one row per studio. A score, the reason it scored, and two doors —
 * read about them, or price them. Nothing else.
 *
 * ## Why the quote is offered here and not only inside the profile
 *
 * Because the impatient path is legitimate. Somebody who already knows they
 * want three numbers should get three numbers without reading three profiles
 * first. The quote lands in the studio's profile either way — this is a
 * shortcut to it, not a second home for it.
 */

import { revealSteps } from '@/modules/matching/reveal';
import { StyleDnaCard } from '@/components/oi/StyleDnaCard';
import { SEEN_KEY, readSeen, welcomeBack, type Seen } from '@/modules/matching/welcome-back';
import { ExpertPitch } from '@/components/oi/ExpertPitch';
import type { OfferState } from '@/modules/consultation/offer';
import { NextStepBar } from '@/components/oi/NextStepBar';
import { QuoteCanvas } from '@/components/oi/QuoteCanvas';
import { draftChanged, draftFrom, priceDraft, type CanvasDraft } from '@/modules/quotation/canvas';
import { saveBriefAction } from '@/app/quiz/actions';
import { useEffect, useMemo, useState } from 'react';
import { loadBrief, saveBrief } from '@/modules/brief/store';
import { cleanName } from '@/modules/brief/steps';
import { TIER } from '@/modules/quotation/tiers';
import { formatINRCompact } from '@/lib/money';
import {
  rankStudios,
  whyNotTheOthers,
  wideningsFor,
  type MatchResult,
  type Widening,
} from '@/modules/matching/score';

/**
 * Offer "show the band above too" when fewer than three fit — the owner's
 * yes, 30 Sep 2026. Always the customer's tap, and every studio it adds is
 * marked as the band above.
 */
const BAND_UP_APPROVED = true;

import {
  loadProject,
  saveProject,
  EMPTY_PROJECT,
  MIN_TO_COMPARE,
  type FloorPlan,
  type Project,
} from '@/modules/quotation/project-store';
import { AppFooter, AppHeader, Spine } from '@/components/oi/Chrome';
import { QuoteFlow, QuoteDocument, type QuoteRequest } from '@/components/oi/QuoteFlow';
import { Building, stagesFor } from '@/components/oi/Building';
import { kitchenFor, priceMatches, quoteKey } from '@/modules/quotation/price-all';
import { runSourceOf } from '@/modules/quotation/first-quote';
import { filedRatesFor, ratesAreReal } from '@/data/filed-rates';
import { scopePhrase, selectionOf, type ScopeSelection } from '@/modules/quotation/scope';
import { hasRates } from '@/modules/quotation/rate-policy';
import { placementIn, scopeBandRange } from '@/modules/quotation/scope-band';
import type { FirstQuote } from '@/modules/quotation/first-quote';
import { homeShapeFor } from '@/modules/quotation/first-quote';
import type { StudioRates } from '@/modules/quotation/catalogue';
import { Wrap, Chapter, Sheet, Quiet } from '@/components/oi';
import { StudioCard } from './StudioCard';
import { MatchHero } from './MatchHero';
import { CompareBar } from './CompareBar';
import { useScrollFocus } from '@/components/oi/useScrollFocus';
import { saveQuoteAction, saveDecisionAction } from './journey-actions';
import type { Studio } from '@/modules/studio/types';
import { localityLabel, type Brief } from '@/modules/brief/types';
import { useLang, useSiteT } from '@/components/app/i18n';
import type { Lang } from '@/modules/i18n/site';
import { MATCH_DICT, type MatchT } from '@/modules/i18n/site/match';
import { PROPERTY_TX, ROOM_TX, SCOPE_TX, lbl } from '@/modules/i18n/site/labels';

/**
 * `scopePhrase`, in the chosen language. English is `scopePhrase` itself, so
 * it cannot drift; Hindi and Marathi are built the same way from the shared
 * labels.
 */
function scopePhraseIn(lang: Lang, t: MatchT, selection: ScopeSelection): string | null {
  if (lang === 'en') return scopePhrase(selection);
  const rooms = selection.scopeRooms.filter((r) => r in ROOM_TX).map((r) => lbl(lang, ROOM_TX, r));
  const list = rooms.length <= 1 ? rooms.join('') : `${rooms.slice(0, -1).join(', ')} ${t('scope.and')} ${rooms.at(-1)}`;
  switch (selection.scope) {
    case 'FULL_HOME':
    case 'KITCHEN_WARDROBE':
      return lbl(lang, SCOPE_TX, selection.scope);
    case 'SINGLE_ROOM':
      return list || lbl(lang, SCOPE_TX, selection.scope);
    case 'RENOVATION':
      return list ? t('scope.renoWith', { rooms: list }) : t('scope.reno');
    default:
      return null;
  }
}

/**
 * "your 3 BHK in Kharadi · Premium" — what the ranking is for, in their terms.
 * Built from what they told us; a part they skipped is simply left out.
 */
function forWhat(brief: Brief | null, lang: Lang, t: MatchT): string | null {
  if (!brief) return null;
  const home = brief.propertyType ? lbl(lang, PROPERTY_TX, brief.propertyType) : null;
  const where = localityLabel(brief.locality);
  const level = brief.tier ? TIER[brief.tier].label : null;
  const place = home
    ? where
      ? t('for.homeIn', { home, where })
      : t('for.home', { home })
    : where
      ? t('for.anyHomeIn', { where })
      : t('for.anyHome');
  return level ? `${place} · ${level}` : place;
}

/**
 * "Inside your Premium range for kitchen & wardrobes (₹8.3 L–₹11.5 L)." — or
 * how far outside it. Before GST, as the bands are. Null when they chose no
 * band or the scope has no range (civil-only).
 */
function bandLine(
  brief: Brief | null,
  shape: { bhk: number; carpetAreaSqft: number; bathrooms: number },
  quote: FirstQuote,
  lang: Lang,
  t: MatchT,
): string | null {
  if (!brief?.tier) return null;
  const selection = selectionOf(brief);
  const band = scopeBandRange(brief.tier, shape, selection);
  if (!band) return null;
  const level = TIER[brief.tier].label;
  const phrase = scopePhraseIn(lang, t, selection) ?? '';
  const what =
    selection.scope && selection.scope !== 'FULL_HOME'
      ? t('band.what', { scope: lang === 'en' ? phrase.toLowerCase() : phrase })
      : '';
  const range =
    band.highPaise === null
      ? t('band.from', { amount: formatINRCompact(band.lowPaise) })
      : `${formatINRCompact(band.lowPaise)}–${formatINRCompact(band.highPaise)}`;
  // The headline total includes GST and the bands do not, so name the
  // pre-GST figure — "₹29 L … inside ₹20.7 L–₹28.75 L" reads as a mistake.
  const beforeGst = quote.totalPaise - quote.gstPaise;
  const place = placementIn(beforeGst, band);
  const lead = t('band.lead', { amount: formatINRCompact(beforeGst) });
  if (place.kind === 'inside') return t('band.inside', { lead, level, what, range });
  return t(place.kind === 'above' ? 'band.above' : 'band.below', {
    lead,
    by: formatINRCompact(place.byPaise),
    level,
    what,
    range,
  });
}

/** "Sanyam · 3 BHK · Kharadi · Kitchen & wardrobes" — who and what a quote is for. */
function preparedFor(brief: Brief | null, lang: Lang, t: MatchT): string | null {
  if (!brief) return null;
  const parts = [
    cleanName(brief.contactName),
    lbl(lang, PROPERTY_TX, brief.propertyType) || null,
    localityLabel(brief.locality),
    scopePhraseIn(lang, t, selectionOf(brief)),
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(' · ') : null;
}

/** Bedrooms by configuration, for the quote request. */
const BEDROOMS: Record<string, number> = {
  BHK_1: 1,
  BHK_2: 2,
  BHK_3: 3,
  BHK_4_PLUS: 4,
  VILLA: 4,
};

export function MatchClient({
  studios,
  allowUnverified,
  filedRates,
  savedBrief = null,
  offer,
}: {
  studios: Studio[];
  /** The expert call's launch offer, counted on the server (offer-store.ts). */
  offer: OfferState;
  allowUnverified: boolean;
  /** The server's copy, used when this tab holds no brief. See page.tsx. */
  savedBrief?: Brief | null;
  /**
   * Resolved rates per studio slug, from the server.
   *
   * Threaded rather than fetched here because this is a client component and
   * the live rates live in Postgres. Absent for any studio that has not filed
   * an archive, which is most of them — `QuoteFlow` falls back to the
   * placeholder table per studio, not for the whole page.
   */
  filedRates?: Record<string, StudioRates>;
}) {
  const t = useSiteT(MATCH_DICT);
  const lang = useLang();
  const [brief, setBrief] = useState<Brief | null>(null);
  const [project, setProject] = useState<Project>(EMPTY_PROJECT);
  const [quoting, setQuoting] = useState<QuoteRequest | null>(null);

  useEffect(() => {
    const local = loadBrief();
    if (local.propertyType === null && savedBrief) {
      // A new tab or another device: take the brief we hold, and keep it here.
      setBrief(savedBrief);
      saveBrief(savedBrief);
    } else {
      setBrief(local);
    }
    setProject(loadProject());
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once, on arrival
  }, []);

  /**
   * A brief with nothing in it is not a brief.
   *
   * `rankStudios` will happily score an empty one — it returned five studios
   * at 100, 80, 70, 38 and 7 off a single factor out of six. Those are the
   * roster in arbitrary order wearing numbers, and a perfect score derived
   * from nothing is precisely the unearned figure this product exists to
   * argue against. So the list is gated on the brief, not on the list.
   */
  const briefed = brief !== null && brief.propertyType !== null;

  /* One-tap widenings the customer has chosen — offered by name, with the
     count each adds, when fewer than three studios fit (plan §4.4). */
  const [widen, setWiden] = useState<Widening[]>([]);
  const rankOptions = useMemo(
    () => ({
      allowUnverified,
      // Each studio's rates, so the budget priority reads its quote for THIS home.
      ratesFor: (slug: string) => filedRates?.[slug] ?? filedRatesFor(slug),
      // The engine's sentences (evidence, reasons, timing) in their language.
      lang,
    }),
    [allowUnverified, filedRates, lang],
  );

  const matches = useMemo(
    () => (briefed && brief ? rankStudios(brief, studios, 6, { ...rankOptions, widen }) : []),
    [briefed, brief, studios, rankOptions, widen],
  );

  const offers = useMemo(
    () =>
      briefed && brief && matches.length < 3
        ? wideningsFor(brief, studios, rankOptions, BAND_UP_APPROVED).filter((o) => !widen.includes(o.kind))
        : [],
    [briefed, brief, studios, rankOptions, matches.length, widen],
  );

  const others = useMemo(
    () => (briefed && brief ? whyNotTheOthers(brief, studios, { ...rankOptions, widen }) : []),
    [briefed, brief, studios, rankOptions, widen],
  );

  const byId = useMemo(() => new Map(studios.map((s) => [s.id, s])), [studios]);

  /* Depth of field down the list — whatever is near the middle of the
     viewport is in focus. Declared here with the other hooks because the
     quote view below returns early, and a hook after a conditional return
     is the classic order-of-hooks crash. */
  const { register, focus, open } = useScrollFocus<HTMLLIElement>(matches.length);

  /* The quote replaces the whole page, but the scroll offset survived the
     swap: pressing "Get a quote" on the third card opened the gate already
     scrolled past its heading, on the one screen whose first line explains
     what it is asking for. Both ways — opening a quote and coming back. */
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [quoting]);

  const update = (next: Project) => {
    setProject(next);
    saveProject(next);
  };

  const requestFor = (studio: Studio): QuoteRequest => ({
    studioSlug: studio.slug,
    studioName: studio.tradeName,
    ...homeShapeFor(brief ?? { propertyType: null, carpetAreaSqft: null }),
  });

  /* ── Every match priced at once ──
     The same lines, the same kitchen, each studio's own rates — the moment
     the page opens, and again whenever the brief changes something a quote
     depends on. See modules/quotation/price-all.ts. */
  const shape = useMemo(
    () => homeShapeFor(brief ?? { propertyType: null, carpetAreaSqft: null }),
    [brief],
  );
  const kitchen = kitchenFor(shape, shape.plan, project.plan);
  const pricedFor = quoteKey(shape, kitchen);

  useEffect(() => {
    if (!briefed || matches.length === 0) return;
    const fresh = priceMatches({
      shape,
      plan: kitchen,
      studios: matches
        .map((m) => byId.get(m.studioId))
        .filter((s): s is Studio => Boolean(s))
        .map((s) => ({
          slug: s.slug,
          name: s.tradeName,
          curatedDiscountPct: s.matchingProfile?.curatedDiscountPct ?? null,
        })),
      existing: project.quotes,
      ratesFor: (slug) => filedRates?.[slug] ?? filedRatesFor(slug),
    });
    if (fresh.length === 0) return;
    // The durable copies, behind the screen — see onBuilt below for why
    // these are not awaited.
    for (const q of fresh) void saveQuoteAction({ studioSlug: q.studioSlug, quote: q.quote, plan: kitchen });
    update({
      ...project,
      plan: kitchen,
      quotes: { ...project.quotes, ...Object.fromEntries(fresh.map((q) => [q.studioSlug, q])) },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed on what a quote depends on
  }, [briefed, matches, pricedFor, project.quotes]);

  /* ── The Home Canvas, v0 (docs/HOME-CANVAS.md) ──
     The quote made editable. The draft is what the customer has changed on
     the quote screen and not yet saved; every matched studio is re-priced on
     it on every render — pure arithmetic, a few milliseconds for the lot. */
  const [draft, setDraft] = useState<CanvasDraft | null>(null);
  const liveDraft = draft ?? draftFrom(shape);
  const drafted = draftChanged(shape, liveDraft);
  const canvasStudios = useMemo(
    () =>
      matches
        .map((m) => byId.get(m.studioId))
        .filter((s): s is Studio => Boolean(s))
        .map((s) => ({ slug: s.slug, name: s.tradeName, curatedDiscountPct: s.matchingProfile?.curatedDiscountPct ?? null })),
    [matches, byId],
  );
  const priced = priceDraft({
    shape,
    plan: kitchen,
    draft: liveDraft,
    studios: canvasStudios,
    ratesFor: (slug) => filedRates?.[slug] ?? filedRatesFor(slug),
  });

  /** Write the draft to the brief, and re-price every match on it straight away. */
  const saveDraft = () => {
    if (!brief) return;
    const next: Brief = { ...brief, excludedItems: liveDraft.excludedItems };
    setBrief(next);
    saveBrief(next);
    void saveBriefAction({ ...next, contactName: null }).catch(() => {});
    const nextShape = homeShapeFor(next);
    const nextPlan: FloorPlan =
      liveDraft.kitchenRunMm !== null
        ? { fileName: null, kitchenRunMm: liveDraft.kitchenRunMm, source: 'customer' }
        : kitchenFor(nextShape, nextShape.plan, project.plan);
    // Priced here rather than left to the effect above, so the open quote
    // never sees a moment where its stored copy is stale and the build
    // screen takes over.
    const fresh = priceMatches({
      shape: nextShape,
      plan: nextPlan,
      studios: canvasStudios,
      existing: {},
      ratesFor: (slug) => filedRates?.[slug] ?? filedRatesFor(slug),
    });
    for (const q of fresh) void saveQuoteAction({ studioSlug: q.studioSlug, quote: q.quote, plan: nextPlan });
    update({
      ...project,
      plan: nextPlan,
      quotes: { ...project.quotes, ...Object.fromEntries(fresh.map((q) => [q.studioSlug, q])) },
    });
    setDraft(null);
  };

  /* ── Welcome back (queue item 16) ──
     Which studios this device last showed, and when; anything new since
     earns a line at the top. Stored in this browser only. */
  /* What the line is made of, not the line — so switching language
     re-words it without re-reading (and overwriting) the stored visit. */
  const [lastVisit, setLastVisit] = useState<{ seen: Seen | null; ids: string[]; now: Date } | null>(null);
  const welcome = lastVisit ? welcomeBack(lastVisit.seen, lastVisit.ids, lastVisit.now, lang) : null;
  const matchIds = matches.map((m) => m.studioId).join(',');
  useEffect(() => {
    if (!briefed || !matchIds) return;
    try {
      const ids = matchIds.split(',');
      setLastVisit({ seen: readSeen(localStorage.getItem(SEEN_KEY)), ids, now: new Date() });
      localStorage.setItem(SEEN_KEY, JSON.stringify({ ids, at: new Date().toISOString() }));
    } catch {
      // Storage blocked: no welcome line, nothing else changes.
    }
  }, [briefed, matchIds]);

  // ── The quote, over everything ──
  if (quoting) {
    const built = project.quotes[quoting.studioSlug];
    const current = built?.key === pricedFor;
    // While the canvas holds unsaved changes, the document below it is the
    // draft's, so the whole page answers the change at once.
    const shownQuote =
      (drafted ? priced.find((p) => p.slug === quoting.studioSlug)?.quote : undefined) ?? built?.quote;
    /* Already priced (every match is): straight to the document. The build
       plays once a visit, the first time — "a quote in ten seconds" watched
       once, not sat through six times. */
    if (built && current) {
      return (
        <div className="oi-app min-h-dvh bg-[var(--bg)]">
          <AppHeader />
          <Wrap className="py-10">
            <button
              type="button"
              onClick={() => setQuoting(null)}
              className="oi-num mb-8 cursor-pointer border-0 bg-transparent p-0 text-[11px] uppercase tracking-[0.16em] text-[var(--ink2)] hover:text-[var(--ink)] print:hidden"
            >
              {t('quote.back')}
            </button>
            {project.seenBuild ? (
              <>
              <QuoteCanvas
                shape={shape}
                plan={kitchen}
                draft={liveDraft}
                onDraft={setDraft}
                priced={priced}
                currentSlug={quoting.studioSlug}
                savedTotalPaise={built.quote.totalPaise}
                onPick={(slug) => {
                  const s = studios.find((x) => x.slug === slug);
                  if (s) setQuoting(requestFor(s));
                }}
                onSave={saveDraft}
              />
              <QuoteDocument
                quote={shownQuote}
                studioName={quoting.studioName}
                plan={kitchen}
                preparedFor={preparedFor(brief, lang, t)}
                paymentPhases={studios.find((s) => s.slug === quoting.studioSlug)?.paymentPhases ?? null}
                bandLine={bandLine(brief, shape, built.quote, lang, t)}
                onMeasured={(runMm) =>
                  update({ ...project, plan: { fileName: null, kitchenRunMm: runMm, source: 'customer' } })
                }
              />
              </>
            ) : (
              <Building
                studioName={quoting.studioName}
                stages={stagesFor({
                  bhk: shape.bhk,
                  measured: runSourceOf(kitchen) !== 'standard',
                  ratesAreReal: ratesAreReal(),
                })}
                onDone={() => update({ ...project, seenBuild: true })}
                seenQuestions={project.askedQuestions}
                onAsked={(id) =>
                  update({
                    ...project,
                    askedQuestions: project.askedQuestions.includes(id)
                      ? project.askedQuestions
                      : [...project.askedQuestions, id],
                  })
                }
              />
            )}
          </Wrap>
          {project.seenBuild ? (
            <NextStepBar
              label={t('quote.label', { studio: quoting.studioName })}
              totalPaise={shownQuote!.totalPaise}
              offer={offer}
              change={
                drafted && shownQuote!.totalPaise !== built.quote.totalPaise
                  ? t('quote.change', { change: `${shownQuote!.totalPaise < built.quote.totalPaise ? '−' : '+'}${formatINRCompact(Math.abs(shownQuote!.totalPaise - built.quote.totalPaise))}` })
                  : undefined
              }
            />
          ) : null}
          <AppFooter />
        </div>
      );
    }
    return (
      <div className="oi-app min-h-dvh bg-[var(--bg)]">
        <AppHeader />
        <Wrap className="py-10">
          <button
            type="button"
            onClick={() => setQuoting(null)}
            className="oi-num mb-8 cursor-pointer border-0 bg-transparent p-0 text-[11px] uppercase tracking-[0.16em] text-[var(--ink2)] hover:text-[var(--ink)] print:hidden"
          >
            {t('quote.back')}
          </button>

          <QuoteFlow
            filedRates={filedRates?.[quoting.studioSlug]}
            request={quoting}
            // A plan confirmed on the brief wins over an earlier gate answer.
            plan={quoting.plan ?? project.plan}
            seenQuestions={project.askedQuestions}
            onAsked={(id) =>
              update({
                ...project,
                askedQuestions: project.askedQuestions.includes(id)
                  ? project.askedQuestions
                  : [...project.askedQuestions, id],
              })
            }
            onBuilt={(quote, plan) => {
              /* The durable copy, written behind the screen.
                 Deliberately not awaited: sessionStorage below has already
                 put the quote in front of the customer, and a slow or
                 unreachable database must not hold up a document they are
                 looking at. If it fails we lose a row, which is where this
                 product was before the table existed. */
              void saveQuoteAction({ studioSlug: quoting.studioSlug, quote, plan });

              update({
                ...project,
                plan,
                quotes: {
                  ...project.quotes,
                  [quoting.studioSlug]: {
                    studioSlug: quoting.studioSlug,
                    studioName: quoting.studioName,
                    builtAt: new Date().toISOString(),
                    quote,
                  },
                },
              });
            }}
          />

          {built ? (
            <ExpertPitch
              offer={offer}
              lead={t('quote.ring', { studio: quoting.studioName })}
              className="mt-10 max-w-[40rem]"
            />
          ) : null}
          {built ? (
            <div className="mt-8 flex flex-wrap items-center gap-4">
              <Quiet href={`/studios/${quoting.studioSlug}`}>
                {t('quote.onPage', { studio: quoting.studioName })}
              </Quiet>
              <button
                type="button"
                onClick={() => setQuoting(null)}
                className="cursor-pointer border-0 bg-transparent p-0 text-[13.5px] text-[var(--ink2)] underline hover:text-[var(--ink)]"
              >
                {t('quote.another')}
              </button>
            </div>
          ) : null}
        </Wrap>
        <AppFooter />
      </div>
    );
  }

  const quoted = Object.values(project.quotes);
  const comparing = project.comparing;

  return (
    <div className="oi-app oi-quick min-h-dvh bg-[var(--bg)]">
      <AppHeader />
      <Spine
        at="match"
        facts={[
          ...(briefed && brief?.propertyType
            ? [{ id: 'brief' as const, fact: t('spine.bhk', { n: BEDROOMS[brief.propertyType] ?? 2 }) }]
            : []),
          ...(briefed ? [{ id: 'match' as const, fact: t('spine.fit', { n: matches.length }) }] : []),
          ...(quoted.length > 0
            ? [{ id: 'quote' as const, fact: t('spine.priced', { n: quoted.length }) }]
            : []),
          ...(comparing.length >= MIN_TO_COMPARE
            ? [{ id: 'compare' as const, fact: t('spine.selected', { n: comparing.length }) }]
            : []),
        ]}
      />

      <Wrap className="py-12">
        {welcome ? (
          <p className="mx-auto mb-6 max-w-[40rem] rounded-full border border-[var(--acc)] px-5 py-2.5 text-center text-[14px] text-[var(--ink)]">
            {welcome}
          </p>
        ) : null}
        {briefed && matches.length > 0 ? (
          <MatchHero
            fit={matches.length}
            reveal={brief ? revealSteps(brief, studios, matches.length, rankOptions) : []}
            name={cleanName(brief?.contactName)}
            forWhat={forWhat(brief, lang, t)}
          />
        ) : (
          <Chapter
            eyebrow={t('empty.eyebrow')}
            title={
              !briefed ? t('empty.noBrief') : t('empty.noFit')
            }
          />
        )}

        {!briefed ? (
          <Sheet className="p-8">
            <p className="m-0 mb-4 max-w-[54ch] text-[15px] leading-[1.6]">
              {t('empty.noBriefBody')}
            </p>
            <Quiet href="/quiz">{t('empty.start')}</Quiet>
          </Sheet>
        ) : matches.length === 0 && offers.length === 0 ? (
          <Sheet className="p-8">
            <p className="m-0 mb-4 max-w-[54ch] text-[15px] leading-[1.6]">
              {t('empty.noFitBody')}
            </p>
            <Quiet href="/quiz">{t('empty.change')}</Quiet>
          </Sheet>
        ) : matches.length === 0 ? null : (
          <ul className="mx-auto m-0 mt-12 flex max-w-[40rem] list-none flex-col gap-6 p-0">
            {matches.map((match: MatchResult, i) => {
              const studio = byId.get(match.studioId);
              if (!studio || !brief) return null;

              const stored = project.quotes[studio.slug];

              return (
                <StudioCard
                  key={studio.id}
                  cardRef={register(i)}
                  focus={focus[i] ?? 'near'}
                  wingsOpen={open[i] ?? false}
                  studio={studio}
                  match={match}
                  brief={brief}
                  rank={i}
                  quotedTotalPaise={stored?.quote.totalPaise ?? null}
                  ratesFiled={hasRates(rankOptions.ratesFor(studio.slug))}
                  inCompare={comparing.includes(studio.slug)}
                  cachedRead={project.reads?.[studio.id]}
                  onRead={(id, read) =>
                    update({ ...project, reads: { ...project.reads, [id]: read } })
                  }
                  onQuote={() => setQuoting(requestFor(studio))}
                  onToggleCompare={() => {
                    const next = comparing.includes(studio.slug)
                      ? comparing.filter((x) => x !== studio.slug)
                      : [...comparing, studio.slug];
                    update({ ...project, comparing: next });
                    void saveDecisionAction({
                      comparedSlugs: next,
                      starredCodes: project.starred,
                    });
                  }}
                />
              );
            })}
          </ul>
        )}

        {briefed && matches.length > 0 ? (
          <ExpertPitch offer={offer} className="mx-auto mt-10 max-w-[40rem]" />
        ) : null}

        {briefed && brief && brief.styleLikes.length > 0 ? (
          <StyleDnaCard likes={brief.styleLikes} className="mx-auto mt-10 max-w-[40rem]" />
        ) : null}

        {/* Fewer than three: said plainly, with named one-tap widenings and
            what each adds — never a silent loosening of what they asked for. */}
        {briefed && offers.length > 0 ? (
          <Sheet className="mx-auto mt-10 max-w-[40rem] p-6">
            <p className="m-0 mb-4 text-[15px] leading-[1.6]">
              {matches.length === 0
                ? t('few.none')
                : matches.length === 1
                  ? t('few.one')
                  : t('few.many', { n: matches.length })}{' '}
              {t('few.honest')}
            </p>
            <div className="flex flex-wrap gap-3">
              {offers.map((o) => (
                <button
                  key={o.kind}
                  type="button"
                  onClick={() => setWiden((w) => [...w, o.kind])}
                  className="min-h-11 cursor-pointer rounded-full border border-[var(--line)] bg-transparent px-5 py-2.5 text-[14px] font-semibold text-[var(--ink)] hover:border-[var(--ink2)]"
                >
                  {t(`widen.${o.kind}`)} (+{o.adds})
                </button>
              ))}
            </div>
          </Sheet>
        ) : null}

        {/* Why not the others — the roster is small enough to say, and a
            customer who knows a studio by name should not wonder. */}
        {briefed && others.length > 0 ? (
          <details className="mx-auto mt-10 max-w-[40rem]">
            <summary className="cursor-pointer text-[14px] font-semibold text-[var(--ink2)]">
              {t('others.summary', { n: others.length })}
            </summary>
            <ul className="m-0 mt-3 flex list-none flex-col gap-1.5 p-0">
              {others.map((o) => (
                <li key={o.studioId} className="text-[13.5px] text-[var(--ink2)]">
                  <span className="text-[var(--ink)]">{o.name}</span> — {t(`why.${o.reason}`)}
                </li>
              ))}
            </ul>
          </details>
        ) : null}
      </Wrap>

      <CompareBar selected={comparing.length} minimum={MIN_TO_COMPARE} priced={quoted.length} />

      <AppFooter />
    </div>
  );
}
