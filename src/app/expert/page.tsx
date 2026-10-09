import { redirect } from 'next/navigation';
import { CallOffer } from '@/components/oi/CallOffer';
import { currentOffer } from '@/modules/consultation/offer-store';
import type { Metadata } from 'next';
import { AppFooter, AppHeader, Spine } from '@/components/oi/Chrome';
import { Wrap, Sheet, Established, Flag } from '@/components/oi';
import { BriefRescue } from '@/components/BriefRescue';
import { prisma } from '@/lib/prisma';
import { loadBrief, loadBriefContact, readAnonKey } from '@/modules/brief/repository';
import { decodePreviewBrief } from '@/modules/brief/preview-param';
import { openSlots } from '@/modules/consultation/slots';
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
import { ARCHITECT, ARCHITECT_IS_REAL } from '@/modules/consultation/architect';
import { TIER } from '@/modules/quotation/tiers';
import { PROPERTY_LABELS, PUNE_LOCALITIES, STYLE_LABELS } from '@/modules/brief/types';
import { ExpertForm } from './ExpertForm';
import { getLang } from '@/modules/i18n/server';
import { translator, tx, type Lang } from '@/modules/i18n/site';
import { EXPERT_DICT } from '@/modules/i18n/site/expert';
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
  // The number they gave at the end of the brief, so the booking only confirms it.
  const contact = previewBrief ? null : await loadBriefContact();
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
        {/* The phone app's header, on the web (owner, 10 Oct 2026: "make
            something like that"): who rings, why they can be trusted, the
            price — one dark card. */}
        <section className="mb-5 overflow-hidden rounded-[28px] bg-[#0b0b0b] px-[clamp(22px,3.4vw,40px)] py-[clamp(24px,3.6vw,40px)] text-white">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <p className="oi-eyebrow m-0 text-white/60">{t('ch.eyebrow')}</p>
            <div className="flex items-center gap-3">
              <span className="text-[13px] text-white/60">{t('hero.meta')}</span>
              {!ARCHITECT_IS_REAL ? <Flag>{t('flag.placeholder')}</Flag> : null}
            </div>
          </div>
          <h1 className="oi-display m-0 max-w-[20ch] text-[clamp(1.9rem,1.2rem+2.6vw,3rem)] leading-[1.05] text-white">
            {t('hero.title')}
          </h1>
          <div className="mt-6 flex items-center gap-4">
            <span
              aria-hidden
              className="flex h-12 w-12 flex-none items-center justify-center rounded-full text-[19px] font-semibold text-white"
              style={{ background: 'var(--acc)' }}
            >
              {ARCHITECT.name.replace(/^(Ar|Dr)\.?\s+/i, '').charAt(0)}
            </span>
            <p className="m-0 max-w-[56ch] text-[15px] leading-[1.5] text-white/85">
              {t('hero.body', { name: ARCHITECT.name, n: offer.quotes.length })}
            </p>
          </div>
          <div className="mt-6 border-t border-white/10 pt-5 [&_*]:!text-white/80">
            <CallOffer offer={callOffer} />
          </div>
        </section>

        {/* Their brief, read back — what the architect will have read. */}
        <section className="mb-5 rounded-[22px] border border-[var(--line)] bg-[var(--card)] p-[clamp(18px,2.6vw,28px)]">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="oi-display m-0 text-[clamp(1.2rem,1.05rem+0.6vw,1.5rem)]">{t('flow.brief')}</h2>
            <a
              href="/quiz"
              className="rounded-full border border-[var(--line)] px-4 py-1.5 text-[13px] font-medium text-[var(--ink2)] no-underline hover:border-[var(--ink)] hover:text-[var(--ink)]"
            >
              {t('flow.editBrief')}
            </a>
          </div>
          <Established facts={facts} />
          {brief.styleLikes.length || brief.styleDislikes.length ? (
            <p className="m-0 mt-4 text-[14px] leading-[1.6] text-[var(--ink2)]">
              {[
                brief.styleLikes.length
                  ? t('reads.leaning', { styles: brief.styleLikes.map((s) => STYLE_LABELS[s]).join(', ') })
                  : null,
                brief.styleDislikes.length
                  ? t('reads.ruledOut', { styles: brief.styleDislikes.map((s) => STYLE_LABELS[s]).join(', ') })
                  : null,
              ]
                .filter(Boolean)
                .join(' · ')}
            </p>
          ) : null}
        </section>

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
          defaultName={user?.name ?? contact?.name ?? brief.contactName ?? null}
          defaultPhone={user?.phone ?? contact?.phone ?? null}
          defaultEmail={user?.email ?? null}
          preview={Boolean(previewBrief)}
          slots={(previewBrief && slots.length === 0 ? usualHours() : slots).map((s) => s.startsAt)}
          initialSlot={typeof slot === 'string' ? slot : null}
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

/**
 * A build with no database has no calendar: show the architect's usual hours
 * (Tue–Sun, 11 am – 7 pm), as the phone app does, and book nothing.
 */
function usualHours() {
  const hours = [2, 3, 4, 5, 6, 0].map((weekday) => ({ expertUserId: 'sample', weekday, startMin: 660, endMin: 1140 }));
  return openSlots({ hours, blocked: new Map(), booked: new Map(), now: new Date() });
}
