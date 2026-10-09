import { redirect } from 'next/navigation';
import { briefQuestions } from '@/modules/consultation/brief-questions';
import { CallOffer } from '@/components/oi/CallOffer';
import { BenefitChips } from '@/components/oi/ExpertPitch';
import { currentOffer } from '@/modules/consultation/offer-store';
import type { Metadata } from 'next';
import { AppFooter, AppHeader, Spine } from '@/components/oi/Chrome';
import { Wrap, Chapter, Sheet, Established, Flag, Tick } from '@/components/oi';
import { BriefRescue } from '@/components/BriefRescue';
import { prisma } from '@/lib/prisma';
import { loadBrief, readAnonKey } from '@/modules/brief/repository';
import { decodePreviewBrief } from '@/modules/brief/preview-param';
import { buildFirstQuote, homeShapeFor, standardKitchenRunMm } from '@/modules/quotation/first-quote';
import { resolveRatesFor } from '@/modules/quotation/resolve-rates';
import type { Brief } from '@/modules/brief/types';
import { hasDatabase } from '@/lib/env';
import { getCurrentUser } from '@/modules/auth/session';
import { studioRepository } from '@/modules/studio/repository';
import { rankOnServer } from '@/modules/matching/rank-server';
import { availableSlots } from '@/modules/consultation/availability';
import { quoteBrief } from '@/modules/quotation/generate';
import { quotesAsSeen } from '@/modules/consultation/pack';
import { MIN_STUDIOS, MAX_STUDIOS } from '@/modules/consultation/request';
import { ARCHITECT, ARCHITECT_IS_REAL, architectFacts } from '@/modules/consultation/architect';
import { TIER } from '@/modules/quotation/tiers';
import { PROPERTY_LABELS, PUNE_LOCALITIES, STYLE_LABELS } from '@/modules/brief/types';
import { ExpertForm } from './ExpertForm';
import { getLang } from '@/modules/i18n/server';
import { translator, tx, type Lang } from '@/modules/i18n/site';
import { EXPERT_DICT, known } from '@/modules/i18n/site/expert';
import { PROPERTY_TX } from '@/modules/i18n/site/labels';

export async function generateMetadata(): Promise<Metadata> {
  const t = translator(await getLang(), EXPERT_DICT);
  return {
    title: t('meta.title'),
    robots: { index: false, follow: false },
  };
}

export const dynamic = 'force-dynamic';

export default async function ExpertPage({
  searchParams,
}: {
  searchParams: Promise<{ slot?: string; preview?: string }>;
}) {
  const { slot, preview } = await searchParams;
  const user = await getCurrentUser();
  const lang = await getLang();
  const t = translator(lang, EXPERT_DICT);
  /* Sign-in (a WhatsApp code) is only asked for here when the phone code is
     switched on (owner, 9 Oct 2026: "I don't want the OTP enabled right now").
     Off, the call books on the brief this browser holds, as on the app. */
  if (!user && process.env.NEXT_PUBLIC_APP_PHONE_CODE === '1') redirect('/sign-in?next=/expert&reason=expert');

  // Both of these mean the same thing — the server has no brief for this
  // person — and neither is grounds for restarting them. The browser may still
  // hold it; let the client try to hand it over. See BriefRescue.
  const loaded = await loadBrief();
  /* A build with no database renders from the brief BriefRescue put in the
     address; booking then says it cannot be taken here. */
  const previewBrief = !hasDatabase() ? decodePreviewBrief(preview) : null;
  const brief = previewBrief ?? loaded.brief;
  const found = previewBrief ? true : loaded.found;
  const id = previewBrief?.completedAt ? 'preview' : found && brief.completedAt ? await briefId() : null;

  if (!id) {
    return (
      <div className="oi-app oi-quick min-h-dvh bg-[var(--bg)]">
        <AppHeader />
        <Spine at="expert" />
        <BriefRescue destination={t('rescue.destination')} previewable />
        <AppFooter />
      </div>
    );
  }

  const studios = await studioRepository.list({ activeOnly: true });
  const ranked = (await rankOnServer(brief, studios, 9, { lang })).slice(0, MAX_STUDIOS);
  const [result, slots, callOffer] = await Promise.all([
    quoteBrief(brief, ranked.map((r) => r.studioId)),
    availableSlots(),
    currentOffer(),
  ]);
  /* The quotes the customer actually saw, compared studios first and
     pre-ticked (plan §9). Priced afresh only when none are stored — a brief
     finished on another device. */
  const seen = previewBrief
    ? await previewQuotes(previewBrief, ranked.map((r) => r.studioId), studios)
    : await quotesAsSeen(id, ranked.map((r) => r.studioId));
  if (seen.length === 0 && !result.ok) redirect('/match');
  const offer =
    seen.length > 0
      ? { quotes: seen, skipped: [] as { name: string }[] }
      : {
          quotes: result.ok
            ? result.quotes.map((q) => ({
                studioId: q.studioId,
                studioName: q.studioName,
                lowPaise: q.quote.lowPaise,
                highPaise: q.quote.highPaise,
                compared: false,
              }))
            : [],
          skipped: result.ok ? result.skipped : [],
        };

  /**
   * The minimum is what the roster can actually offer.
   *
   * On a roster of two, one studio with an incomplete rate card left exactly
   * one checkbox above a permanently greyed-out button asking for two picks.
   * The customer had no way to proceed and no way to know why. The server
   * computes the same figure independently in `requestConsultation` — this one
   * is only so the button is not lying about what it will accept.
   */
  const minStudios = Math.max(1, Math.min(MIN_STUDIOS, offer.quotes.length));

  const facts = [
    brief.propertyType ? { label: t('fact.home'), value: propertyLabel(brief.propertyType, lang) ?? '—' } : null,
    brief.carpetAreaSqft ? { label: t('fact.carpet'), value: `${brief.carpetAreaSqft} sqft` } : null,
    localityLabel(brief.locality) ? { label: t('fact.where'), value: localityLabel(brief.locality)! } : null,
    brief.tier ? { label: t('fact.level'), value: TIER[brief.tier].label } : null,
    { label: t('fact.quotes'), value: String(offer.quotes.length) },
  ].filter((f): f is { label: string; value: string } => f !== null);

  return (
    <div className="oi-app oi-quick min-h-dvh bg-[var(--bg)]">
      <AppHeader />
      <Spine
        at="expert"
        facts={[
          { id: 'quote', fact: t('spine.priced', { n: offer.quotes.length }) },
          { id: 'expert', fact: t('spine.reading') },
        ]}
      />

      <Wrap className="py-12">
        <Chapter
          eyebrow={t('ch.eyebrow')}
          title={t('ch.title')}
          aside={
            <p className="oi-num m-0 whitespace-nowrap text-[10.5px] uppercase tracking-[0.18em] text-[var(--ink2)]">
              {t('ch.aside')}
            </p>
          }
        >
          {t('ch.body')}
        </Chapter>

        {/* ── Who is actually going to ring ──
            Everything else in this product is specific — a quantity on every
            line, a named studio behind every quote. Asking for a phone number
            on behalf of "an expert" was the one place we sounded like a sales
            queue. */}
        <div className="oi-pane mb-10 p-[clamp(22px,3vw,32px)]">
          <div className="mb-5 flex flex-wrap items-baseline justify-between gap-x-8 gap-y-2">
            <div>
              <p className="oi-eyebrow m-0 mb-2">{t('who.eyebrow')}</p>
              <h2 className="oi-display m-0 text-[clamp(1.4rem,1.15rem+1vw,1.85rem)]">
                {ARCHITECT.name}
              </h2>
              <p className="m-0 mt-1.5 text-[14px] text-[var(--ink2)]">
                {known(lang, 'architect.role', ARCHITECT.role)}
              </p>
            </div>
          </div>

          <p className="m-0 mb-6 max-w-[60ch] text-[15px] leading-[1.65] text-[var(--ink)]">
            &ldquo;{known(lang, 'architect.says', ARCHITECT.says)}&rdquo;
          </p>

          <CallOffer offer={callOffer} className="mb-5" />
          <BenefitChips worth className="mb-6" />

          <div className="flex flex-wrap items-center gap-x-8 gap-y-3 border-t border-[var(--line)] pt-5">
            {architectFacts().map((f) => (
              <p key={f.label} className="m-0 flex items-baseline gap-2">
                <span className="oi-label m-0">{architectFactText(lang, f.label)}</span>
                <span className="oi-num text-[13px]">{architectFactText(lang, f.value)}</span>
              </p>
            ))}
          </div>

          {/* Honest failure mode for unfinished content is a visible label, not
              a plausible-looking fiction — the same rule the stock photography
              and the placeholder films follow. */}
          {!ARCHITECT_IS_REAL ? (
            <p className="m-0 mt-5">
              <Flag>
                {t('flag.placeholder')}
              </Flag>
            </p>
          ) : null}
        </div>

        {/* What they will already have read. "Briefed, not a cold intro" is a
            claim; this is the evidence, and everything in it is drawn from the
            brief — nothing here is aspirational. */}
        <div className="mb-10">
          <p className="oi-label m-0 mb-3">{t('reads.label', { name: firstName(ARCHITECT.name) })}</p>
          <Established facts={facts} />
          <ul className="m-0 mt-4 flex list-none flex-col gap-2 p-0">
            <Read label={t('reads.brief')} />
            <Read
              label={
                brief.styleLikes.length || brief.styleDislikes.length
                  ? [
                      brief.styleLikes.length
                        ? t('reads.leaning', { styles: brief.styleLikes.map((s) => STYLE_LABELS[s]).join(', ') })
                        : null,
                      brief.styleDislikes.length
                        ? t('reads.ruledOut', { styles: brief.styleDislikes.map((s) => STYLE_LABELS[s]).join(', ') })
                        : null,
                    ]
                      .filter(Boolean)
                      .join(' · ')
                  : t('reads.styleAnswers')
              }
            />
            <Read label={t('reads.allQuotes', { n: offer.quotes.length })} />
            <Read label={t('reads.verification')} />
          </ul>
          <p className="m-0 mt-4 max-w-[58ch] text-[13.5px] leading-[1.6] text-[var(--ink2)]">
            {t('reads.noExplain')}
          </p>
        </div>

        {/* Studios that were ranked for this brief and could not be priced.
            Named rather than dropped: a customer who sees two studios where
            they expected four should be told it is about rates and not about
            fit, and a studio absent for a reason we could state and did not is
            the sort of silence people notice later. */}
        {offer.skipped.length > 0 ? (
          <Sheet className="mb-8 px-5 py-4">
            <p className="m-0 max-w-[58ch] text-[14.5px] leading-[1.6] text-[var(--ink2)]">
              {offer.skipped.length === 1
                ? t('skipped.one', { name: offer.skipped[0]!.name })
                : t('skipped.many', { n: offer.skipped.length })}
            </p>
          </Sheet>
        ) : null}

        {offer.quotes.length === 1 ? (
          <Sheet className="mb-8 px-5 py-4">
            <p className="m-0 max-w-[58ch] text-[14.5px] leading-[1.6]">
              {t('onlyOne')}
            </p>
          </Sheet>
        ) : null}

        <ExpertForm
          briefId={id}
          minStudios={minStudios}
          maxStudios={MAX_STUDIOS}
          defaultName={user?.name ?? null}
          defaultEmail={user?.email ?? null}
          slots={slots.map((s) => s.startsAt)}
          initialSlot={typeof slot === 'string' ? slot : null}
          fromBrief={briefQuestions(brief)}
          studios={offer.quotes.map((q) => ({
            id: q.studioId,
            name: q.studioName,
            lowPaise: q.lowPaise,
            highPaise: q.highPaise,
          }))}
          preselected={offer.quotes.filter((q) => q.compared).map((q) => q.studioId)}
        />
      </Wrap>

      <AppFooter />
    </div>
  );
}

/** One thing already read. Sage tick — this is verification, not an action. */
function Read({ label }: { label: string }) {
  return (
    <li className="flex items-start gap-2.5 text-[14px] leading-snug">
      <span className="flex h-[21px] flex-none items-center">
        <Tick style={{ color: 'var(--sec)' }} />
      </span>
      <span>{label}</span>
    </li>
  );
}

/** "Ar. Firstname Surname" → "Firstname": a title is not a name. */
function firstName(full: string): string {
  const words = full.split(' ').filter((w) => !/^(ar|dr|mr|ms|mrs)\.?$/i.test(w));
  return words[0] ?? full;
}

function localityLabel(slug: string | null): string | null {
  if (!slug) return null;
  return PUNE_LOCALITIES.find((l) => l.slug === slug)?.label ?? null;
}

/**
 * Prisma's PropertyType enum carries values our own union does not, so an
 * unmapped value must render as nothing rather than as `undefined` — a defect
 * this codebase has already shipped once.
 */
function propertyLabel(type: keyof typeof PROPERTY_LABELS, lang: Lang): string | null {
  if (!PROPERTY_LABELS[type]) return null;
  const entry = PROPERTY_TX[type];
  return entry ? tx(lang, entry) : PROPERTY_LABELS[type];
}

/** The architect's facts (consultation/architect.ts), translated while the English still matches. */
function architectFactText(lang: Lang, english: string): string {
  const years = /^(\d+) years$/.exec(english);
  if (years) return known(lang, 'architect.years', english, { n: years[1]! });
  if (english === 'Practising') return known(lang, 'architect.practising', english);
  if (english === 'Briefs read here') return known(lang, 'architect.briefsRead', english);
  if (english === 'Paid by a studio') return known(lang, 'architect.paidBy', english);
  if (english === 'Never') return known(lang, 'architect.never', english);
  return english;
}

async function briefId(): Promise<string | null> {
  const user = await getCurrentUser();
  if (user) {
    const row = await prisma.brief.findUnique({ where: { userId: user.id }, select: { id: true } });
    if (row) return row.id;
  }
  const anonKey = await readAnonKey();
  if (!anonKey) return null;
  const row = await prisma.brief.findUnique({ where: { anonKey }, select: { id: true } });
  return row?.id ?? null;
}

/**
 * A build with no database has no rate cards, so `quoteBrief` prices nothing.
 * Price the way /match does there — each studio's sample rates through the
 * same engine — so the walkthrough reaches the call form.
 */
async function previewQuotes(
  brief: Brief,
  rankedIds: string[],
  studios: { id: string; slug: string; tradeName: string }[],
) {
  const shape = homeShapeFor(brief);
  const out = [];
  for (const id of rankedIds) {
    const studio = studios.find((s) => s.id === id);
    if (!studio) continue;
    const { rates } = await resolveRatesFor(studio.slug);
    const quote = buildFirstQuote(
      {
        ...shape,
        kitchenRunMm: shape.plan?.kitchenRunMm ?? standardKitchenRunMm(shape.bhk),
        runSource: shape.plan ? 'floor_plan' : 'standard',
      },
      rates,
    );
    if (quote.totalPaise <= 0) continue;
    out.push({
      studioId: studio.id,
      studioName: studio.tradeName,
      lowPaise: quote.lowPaise,
      highPaise: quote.highPaise,
      compared: false,
    });
  }
  return out;
}
