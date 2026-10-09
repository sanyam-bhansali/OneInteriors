'use client';

/**
 * One studio, as one of the landing page's soft tiles (owner, 10 Oct 2026):
 * the score set like the landing's big figures, the facts and the checks on
 * white inner tiles, pills for every action.
 *
 * ## Layout — vertical
 *
 * One column, read top to bottom: the mark, the percentage, the name, what
 * they are, then the facts that decide a shortlist, then the written read,
 * then everything else behind one press.
 *
 * It was a wide three-across row first — score, identity, mark — which at
 * full container width made a banner rather than a card, and put the name
 * (the thing you are actually choosing between) in the middle of a horizontal
 * scan instead of at the top of a vertical one. The list is width-capped so
 * the card stays portrait at every screen size.
 *
 * ## The mark is a monogram, and that is a placeholder
 *
 * `Studio` has no logo column in the schema — there is `StudioBranding`, but
 * that is the studio's own white-label for documents it sends its clients,
 * not a marketplace listing asset. So the mark is initials on a white disc.
 * It looks deliberate rather than broken, and when a `logoPath` lands on
 * Studio this is the one component that changes.
 *
 * ## Why the percentage carries a second line
 *
 * A bare "82%" implies we measured six things and scored them. Often we
 * measured four, because the brief did not answer the rest. The small pill
 * beside the mark says which, for the same reason every other number in this
 * product carries its source: a score whose basis is hidden is the kind of
 * figure this whole product exists to argue against.
 */

import { BenefitChips } from '@/components/oi/ExpertPitch';
import { useEffect, useMemo, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Pill, PillButton } from '@/components/home/parts';
import { formatINRCompact } from '@/lib/money';
import { briefKey, type StoredRead } from '@/modules/quotation/project-store';
import { explainAction } from './actions';
import type { Explanation } from '@/modules/matching/explain';
import { DUR, EASE_OUT, riseCard } from '@/components/oi/motion';
import { Glass, revealProps } from '@/components/oi/Surfaces';
import { ProjectWings } from './ProjectWings';
import { Listen } from '@/components/oi/Listen';
import type { Focus } from '@/components/oi/useScrollFocus';
import type { Studio } from '@/modules/studio/types';
import { useLang, useSiteT } from '@/components/app/i18n';
import { MATCH_DICT } from '@/modules/i18n/site/match';
import { CHECK_TX, lbl } from '@/modules/i18n/site/labels';
import { ENGINE_VERSION, FACTOR_LABELS, type FactorKey, type MatchResult } from '@/modules/matching/score';
import { localityLabel, type Brief } from '@/modules/brief/types';

/** Two letters from the trade name. "Chitra & Co." → CC, "Teakline" → TE. */
function monogram(name: string): string {
  const words = name
    .replace(/[^A-Za-z\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
  if (words.length === 0) return '··';
  if (words.length === 1) return words[0]!.slice(0, 2).toUpperCase();
  return (words[0]![0]! + words[1]![0]!).toUpperCase();
}

/** One figure over what it is — the landing's figure-and-caption, in small. */
function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="m-0 text-[22px] font-medium leading-none tracking-[-0.03em] tabular-nums text-[var(--ink)]">{value}</p>
      <p className="m-0 mt-2 text-[12.5px] leading-snug text-[var(--ink-2)]">{label}</p>
    </div>
  );
}

/** The landing's line pill for an outside link — `<Pill>` (next/link) does not open a new tab. */
function OutPill({ href, children }: { href: string; children: string }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className="pill pill-line pill-sm" data-magnetic="">
      <span className="mag-inner">
        <span className="roll">
          <span data-t={children}>{children}</span>
        </span>
      </span>
    </a>
  );
}

export function StudioCard({
  studio,
  match,
  brief,
  rank,
  focus,
  wingsOpen,
  quotedTotalPaise,
  ratesFiled = true,
  inCompare,
  cachedRead,
  onQuote,
  onToggleCompare,
  onRead,
  cardRef,
}: {
  studio: Studio;
  match: MatchResult;
  brief: Brief;
  rank: number;
  focus: Focus;
  /**
   * Is this card in the middle of the viewport? Drives the wings out and, when
   * it goes false again, back in. Not latched — see useScrollFocus.
   *
   * Named `wingsOpen` rather than `open` because the card already has an
   * `open` of its own for the More/Less disclosure, and two booleans called
   * open in one component is how the wrong one gets read.
   */
  wingsOpen: boolean;
  quotedTotalPaise: number | null;
  /** False once the roster is real and this studio has no approved rates (rate-policy.ts). */
  ratesFiled?: boolean;
  inCompare: boolean;
  cachedRead: StoredRead | undefined;
  onQuote: () => void;
  onToggleCompare: () => void;
  onRead: (studioId: string, read: StoredRead) => void;
  cardRef: (el: HTMLLIElement | null) => void;
}) {
  const reduced = useReducedMotion();
  const t = useSiteT(MATCH_DICT);
  const lang = useLang();
  const [open, setOpen] = useState(false);

  // The engine version is part of the key: a read written under an older
  // engine explains a score that no longer exists. So is the language, past
  // English, so an English read is never shown to a Hindi or Marathi reader.
  const key = `${briefKey(brief)}|${ENGINE_VERSION}${lang === 'en' ? '' : `|${lang}`}`;
  const fresh = cachedRead?.briefKey === key ? cachedRead : undefined;
  // Held with the key it was written for, so switching language never
  // leaves the previous language's read on the card.
  const [got, setGot] = useState<(Explanation & { key: string }) | null>(null);
  const read: Explanation | null = fresh
    ? { text: fresh.text, source: fresh.source }
    : got?.key === key
      ? got
      : null;

  /**
   * The written read arrives per card, so the page fills in rather than
   * waiting on the slowest call. Skipped entirely when one already exists for
   * this brief — six cards is six paid calls, and without the cache every
   * return to this page spends them again.
   */
  useEffect(() => {
    if (fresh) return;
    let live = true;
    explainAction(brief, studio.id, lang)
      .then((r) => {
        if (!live || !r.text) return;
        setGot({ ...r, key });
        onRead(studio.id, { text: r.text, source: r.source, briefKey: key });
      })
      .catch(() => {
        /* The card is complete without it. */
      });
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fresh, studio.id, key]);

  const pct = Math.round(match.score);

  const tags = useMemo(() => {
    const out: string[] = [];
    if (studio.localities.length > 0) out.push(studio.localities.slice(0, 2).map((l) => localityLabel(l) ?? l).join(' · '));
    if (studio.yearsActive) out.push(t('card.yrs', { n: studio.yearsActive }));
    if (studio.teamSize) out.push(t('card.team', { n: studio.teamSize }));
    return out;
  }, [studio.localities, studio.yearsActive, studio.teamSize, t]);

  return (
    /* Two elements, and the split is load-bearing.
       Framer Motion writes `transform` as an inline style, which beats any
       class rule — so an entrance animation and the CSS scroll-zoom on the
       same element means the entrance silently wins and the card never
       zooms. The <li> owns the one-off entrance; the panel inside it owns the
       scale, the lift and the depth-of-field, in CSS, for good. */
    <motion.li
      ref={cardRef}
      {...revealProps(wingsOpen, 'list-none')}
      {...riseCard(reduced, rank)}
    >
      {/* The studio's work and the checks it passed, parked behind the card
          and out when you reach it — and back in when you leave. */}
      <ProjectWings
        projects={studio.portfolio}
        checks={studio.checks}
        studioName={studio.tradeName}
        likeYours={match.similarProjects}
      />

      <Glass focus={focus}>
      {/* ── Vertical stack: mark, score, name, what they are ──
          Everything reads top to bottom in one column. The mark and the
          basis of the score share the first line only because they are both
          small objects rather than text — nothing after them competes for a
          row. */}
      <div className="flex items-center justify-between gap-4">
        {/* Monogram, not a logo — Studio has no logo column. */}
        <div
          aria-hidden
          className="flex h-[52px] w-[52px] flex-none items-center justify-center rounded-full bg-[var(--paper)]"
        >
          <span className="text-[16px] font-medium tracking-[0.02em] text-[var(--ink)]">
            {monogram(studio.tradeName)}
          </span>
        </div>
        <span className="whitespace-nowrap rounded-full bg-[var(--paper)] px-3 py-1.5 text-[12.5px] font-medium text-[var(--ink-2)]">
          {t('card.factors', { a: match.factorsScored, b: match.factorsTotal })}
        </span>
      </div>

      {/* The score as the landing sets its figures: big, medium, tight. */}
      <p className="m-0 mt-6 text-[clamp(3rem,2rem+3vw,4.6rem)] font-medium leading-none tracking-[-0.05em] tabular-nums text-[var(--ink)]">
        {pct}
        <span className="ml-0.5 align-super text-[0.4em] tracking-normal">%</span>
      </p>

      <h3 className="h-m" style={{ marginTop: 14 }}>
        {studio.tradeName}
      </h3>

      <p className="m-0 mt-2.5 max-w-[56ch] text-[15px] leading-[1.55] text-[var(--ink-2)]">
        {studio.about || t('card.about', { city: studio.city })}
      </p>

      {tags.length > 0 ? (
        <ul className="m-0 mt-4 flex list-none flex-wrap gap-1.5 p-0">
          {tags.map((tag) => (
            <li key={tag} className="rounded-full bg-[var(--paper)] px-3 py-1.5 text-[13px] text-[var(--ink)]">
              {tag}
            </li>
          ))}
        </ul>
      ) : null}

      {/* ── The facts that decide a shortlist ── */}
      <div className="mt-5 grid grid-cols-2 gap-x-5 gap-y-5 rounded-[var(--r-m)] bg-[var(--paper)] p-5 sm:grid-cols-3">
        <Fact
          label={quotedTotalPaise !== null ? t('card.yourQuote') : ratesFiled ? t('card.notPriced') : t('card.noRates')}
          value={quotedTotalPaise !== null ? formatINRCompact(quotedTotalPaise) : '—'}
        />
        <Fact
          label={t('card.delivered')}
          value={studio.completedProjects > 0 ? String(studio.completedProjects) : '—'}
        />
        {/* Early is said as early: "+-2 days over" read as a typo (review, 8 Oct). */}
        <Fact
          label={
            studio.avgVarianceDays === null
              ? t('card.daysUnmeasured')
              : studio.avgVarianceDays < 0
                ? t('card.daysEarly')
                : t('card.daysOver')
          }
          value={
            studio.avgVarianceDays === null
              ? '—'
              : studio.avgVarianceDays < 0
                ? String(Math.abs(studio.avgVarianceDays))
                : `+${studio.avgVarianceDays}`
          }
        />
      </div>

      {/* When they can start, against when you can — either way, on every card. */}
      {match.timeline ? (
        <p
          className={`m-0 mt-4 text-[14px] leading-[1.5] ${match.timeline.late ? 'text-[var(--accent-ink)]' : 'text-[var(--ink-2)]'}`}
        >
          {match.timeline.line}
        </p>
      ) : null}
      {match.widened ? (
        <p className="m-0 mt-2 text-[13px] font-medium text-[var(--ink-2)]">
          {match.widened === 'ANY_ZONE' ? t('card.widenedZone') : t('card.widenedBand')}
        </p>
      ) : null}

      {/* ── The checks, on every screen size ──
          The wings beside the card only fit on a wide screen, so on a phone
          the checks were invisible. A badge is believed when its rules are
          public (principle 7, docs/UX-PRINCIPLES-PLAN.md; Airbnb's Guest
          favourite, Thumbtack's Top Pro): each check with who verified it
          and when. */}
      <CheckList checks={studio.checks} />

      {/* ── The read ── */}
      <div className="mt-7">
        <p className="eyebrow" style={{ marginBottom: 12 }}>
          {t('card.whyFits')}
        </p>
        {/* Their first priority, answered first — flattering or not. */}
        {match.topPriority ? (
          <p className="m-0 mb-2.5 max-w-[56ch] text-[17px] font-medium leading-[1.35] tracking-[-0.01em] text-[var(--ink)]">
            {match.topPriority}
          </p>
        ) : null}
        {read ? (
          <>
            <p className="m-0 max-w-[60ch] text-[15.5px] leading-[1.6] text-[var(--ink)]">{read.text}</p>
            <div className="mt-3">
              <Listen text={read.text} />
            </div>
          </>
        ) : (
          <p className="m-0 text-[15px] text-[var(--ink-2)]">{t('card.reading')}</p>
        )}
      </div>

      {/* ── Their work like yours, on the card itself (queue item 19) ──
          The wings beside the card only fit on wide screens; this is the same
          evidence where everyone can see it. */}
      <LikeYours studio={studio} ids={match.similarProjects ?? []} />

      {/* ── Meet the studio (queue item 18) ── their own short intro. */}
      {studio.matchingProfile?.introVideoUrl ? (
        <div className="mt-5">
          <OutPill href={studio.matchingProfile.introVideoUrl}>{`▶ ${t('card.meet', { studio: studio.tradeName })}`}</OutPill>
        </div>
      ) : null}

      {/* What booking this studio through us brings, on the card itself —
          the moment a customer sees a name is the moment they could ring it. */}
      <BenefitChips limit={4} className="mt-7" />

      {/* ── Actions ── The quote is the one dark pill. Comparing is a choice
          you toggle, so it is the flow's option pill — ink while it is in. */}
      <div className="mt-7 flex flex-wrap items-center gap-2.5">
        {quotedTotalPaise === null && !ratesFiled ? null : quotedTotalPaise === null ? (
          <PillButton onClick={onQuote} arrow>
            {t('card.getQuote')}
          </PillButton>
        ) : (
          <>
            {/* Every match is priced when the page opens, so the quote is the
                first thing to offer — it used to sit behind "More". */}
            <PillButton onClick={onQuote} arrow>
              {t('card.seeQuote')}
            </PillButton>
            <button type="button" onClick={onToggleCompare} aria-pressed={inCompare} className="flow-opt">
              {inCompare ? t('card.inCompare') : t('card.addCompare')}
            </button>
          </>
        )}

        <Pill href={`/studios/${studio.slug}`} tone="line">
          {t('card.theirWork')}
        </Pill>

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="ml-auto inline-flex min-h-11 cursor-pointer items-center gap-2.5 border-0 bg-transparent px-1 text-[14px] font-medium text-[var(--ink-2)] hover:text-[var(--ink)]"
        >
          {open ? t('card.less') : t('card.more')}
          <span
            aria-hidden
            className="grid h-8 w-8 place-items-center rounded-full bg-[var(--paper)] text-[var(--ink)] transition-transform duration-300"
            style={{ transform: open ? 'rotate(45deg)' : undefined }}
          >
            <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
              <path d="M7 1v12M1 7h12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          </span>
        </button>
      </div>

      {open ? (
        <motion.div
          initial={reduced ? false : { opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          transition={{ duration: DUR.expand, ease: EASE_OUT }}
          className="overflow-hidden"
        >
          <div className="mt-5 rounded-[var(--r-m)] bg-[var(--paper)] p-5">
            <p className="eyebrow" style={{ marginBottom: 14 }}>
              {t('card.scoreMadeOf')}
            </p>
            {match.evidence ? (
              <dl className="m-0 mb-4 grid grid-cols-1 gap-x-5 gap-y-1.5 sm:grid-cols-[10rem_1fr] sm:gap-y-2.5">
                {(Object.keys(FACTOR_LABELS) as FactorKey[]).map((key) => (
                  <div key={key} className="contents">
                    <dt className="m-0 mt-2 text-[13.5px] font-medium tabular-nums text-[var(--ink)] sm:mt-0">
                      {t(`factor.${key}`)}
                      {match.breakdown[key] === null ? '' : ` · ${match.breakdown[key]}`}
                    </dt>
                    <dd className="m-0 text-[14px] leading-[1.5] text-[var(--ink-2)]">
                      {match.breakdown[key] === null
                        ? t('card.notKnown')
                        : (match.evidence?.[key] ?? t('card.measured'))}
                    </dd>
                  </div>
                ))}
              </dl>
            ) : null}
            <ul className="m-0 flex list-none flex-col gap-2 p-0">
              {match.reasoning.map((line) => (
                <li key={line} className="text-[14px] leading-[1.5] text-[var(--ink-2)]">
                  {line}
                </li>
              ))}
            </ul>
            {quotedTotalPaise !== null ? (
              <button
                type="button"
                onClick={onQuote}
                className="mt-4 min-h-11 cursor-pointer border-0 bg-transparent p-0 text-[14px] font-medium text-[var(--ink)] underline underline-offset-4"
              >
                {t('card.quoteInFull')}
              </button>
            ) : null}
          </div>
        </motion.div>
      ) : null}
      </Glass>
    </motion.li>
  );
}

/** Up to two of the studio's projects most like this brief, with a cover when there is one. */
function LikeYours({ studio, ids }: { studio: Studio; ids: string[] }) {
  const t = useSiteT(MATCH_DICT);
  const projects = ids
    .map((id) => studio.portfolio.find((p) => p.id === id))
    .filter((p): p is Studio['portfolio'][number] => Boolean(p))
    .slice(0, 2);
  if (projects.length === 0) return null;
  return (
    <div className="mt-7">
      <p className="eyebrow" style={{ marginBottom: 12 }}>
        {t('card.likeYours')}
      </p>
      <ul className="m-0 grid list-none grid-cols-1 gap-3 p-0 sm:grid-cols-2">
        {projects.map((p) => (
          <li key={p.id} className="flex items-center gap-3">
            {p.images[0] ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={p.images[0]} alt="" className="h-14 w-[4.5rem] flex-none rounded-[12px] object-cover" />
            ) : (
              <span className="h-14 w-[4.5rem] flex-none rounded-[12px] bg-[var(--soft-2)]" aria-hidden />
            )}
            <span className="min-w-0">
              <span className="block truncate text-[14px] font-medium text-[var(--ink)]">{p.title}</span>
              <span className="block text-[12.5px] tabular-nums text-[var(--ink-2)]">
                {[localityLabel(p.locality), p.valuePaise ? formatINRCompact(p.valuePaise) : null, p.durationDays ? t('wings.days', { n: p.durationDays }) : null]
                  .filter(Boolean)
                  .join(' · ')}
              </span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** "15 of 15 checks cleared", opening to each check, its source and its date. */
function CheckList({ checks }: { checks: Studio['checks'] }) {
  const t = useSiteT(MATCH_DICT);
  const lang = useLang();
  const counted = checks.filter((c) => c.result !== 'NOT_APPLICABLE');
  const passed = counted.filter((c) => c.result === 'PASS');
  if (counted.length === 0) return null;
  return (
    <details className="group mt-4 rounded-[var(--r-m)] bg-[var(--paper)] px-4 py-3">
      <summary className="flex min-h-9 cursor-pointer list-none flex-wrap items-center justify-between gap-3 text-[14px] font-medium text-[var(--ink)]">
        <span className="rounded-full bg-[var(--mint)] px-3 py-1.5 text-[13px] font-medium">
          {t('card.checksCleared', { a: passed.length, b: counted.length })}
        </span>
        <span aria-hidden className="text-[13.5px] text-[var(--ink-2)] group-open:hidden">
          {t('card.seeThem')}
        </span>
        <span aria-hidden className="hidden text-[13.5px] text-[var(--ink-2)] group-open:inline">
          {t('card.hide')}
        </span>
      </summary>
      <ul className="m-0 mt-3 flex list-none flex-col gap-2.5 p-0 pb-1">
        {counted.map((c) => (
          <li key={c.type} className="flex items-baseline justify-between gap-3 text-[14px]">
            <span className={c.result === 'PASS' ? 'text-[var(--ink)]' : 'text-[var(--ink-2)]'}>
              <span
                aria-hidden
                className={`mr-2 inline-grid h-[18px] w-[18px] place-items-center rounded-full align-[-3px] text-[10px] ${
                  c.result === 'PASS' ? 'bg-[var(--ink)] text-white' : 'bg-[var(--soft-2)] text-[var(--ink-2)]'
                }`}
              >
                {c.result === 'PASS' ? '✓' : '○'}
              </span>
              {lbl(lang, CHECK_TX, c.type)}
              <span className="sr-only">{c.result === 'PASS' ? t('card.cleared') : t('card.notCleared')}</span>
            </span>
            <span className="shrink-0 text-right text-[12.5px] text-[var(--ink-2)]">
              {[c.source, c.checkedAt ? new Date(c.checkedAt).toLocaleDateString(`${lang}-IN`, { month: 'short', year: 'numeric' }) : null]
                .filter(Boolean)
                .join(' · ')}
            </span>
          </li>
        ))}
      </ul>
    </details>
  );
}
