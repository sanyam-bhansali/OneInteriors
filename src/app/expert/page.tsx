import { redirect } from 'next/navigation';
import { currentOffer } from '@/modules/consultation/offer-store';
import type { Metadata } from 'next';
import { AppFooter, AppHeader, Spine } from '@/components/oi/Chrome';
import { FlowShell } from '@/components/home/FlowShell';
import { Pill, Split } from '@/components/home/parts';
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
import { EXPERT_DICT, offerText } from '@/modules/i18n/site/expert';
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
      <FlowShell>
        <AppHeader />
        <Spine at="expert" />
        <BriefRescue destination={t('rescue.destination')} previewable />
        <AppFooter />
      </FlowShell>
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

  const offerLine = offerText(lang, callOffer);
  // The cards under the header ease in one after another, as the landing's tiles do.
  const delay = (ms: number) => ({ ['--d' as string]: `${ms}ms` });

  return (
    <FlowShell>
      <AppHeader />
      <Spine
        at="expert"
        facts={[
          { id: 'quote', fact: t('spine.priced', { n: offer.quotes.length }) },
          { id: 'expert', fact: t('spine.reading') },
        ]}
      />

      <main className="mx-auto w-full max-w-[1040px] px-[var(--gutter)] pb-[clamp(48px,7vw,100px)] pt-[clamp(24px,4vw,48px)]">
        {/* The phone app's header, on the web (owner, 10 Oct 2026: "make
            something like that"): who rings, why they can be trusted, the
            price — one black block, as the landing's dark panels. */}
        <section
          className="panel-dark overflow-hidden rounded-[var(--r-xl)] px-[clamp(22px,4.4vw,64px)] py-[clamp(28px,4.6vw,64px)]"
          data-reveal=""
          data-auto=""
        >
          <div className="mb-[clamp(22px,3vw,36px)] flex flex-wrap items-center justify-between gap-3">
            <p className="eyebrow" style={{ margin: 0 }}>
              {t('ch.eyebrow')}
            </p>
            <span className="inline-flex items-center gap-2.5 rounded-full bg-white/10 px-4 py-2 text-[13px] font-medium text-white/80">
              <i aria-hidden className="h-[7px] w-[7px] rounded-full bg-[var(--accent)]" />
              {t('hero.meta')}
            </span>
          </div>
          <Split as="h1" className="h-l max-w-[16ch]" text={t('hero.title')} auto />
          <div className="mt-[clamp(24px,3.4vw,40px)] flex items-center gap-4">
            <span
              aria-hidden
              className="flex h-14 w-14 flex-none items-center justify-center rounded-full bg-[var(--accent)] text-[21px] font-medium text-white"
            >
              {ARCHITECT.name.replace(/^(Ar|Dr)\.?\s+/i, '').charAt(0)}
            </span>
            <p className="m-0 max-w-[56ch] text-[clamp(15px,0.9rem+0.2vw,17px)] leading-[1.5] text-white/75">
              {t('hero.body', { name: ARCHITECT.name, n: offer.quotes.length })}
            </p>
          </div>
          {!ARCHITECT_IS_REAL ? (
            <p className="m-0 mt-4 max-w-[64ch] text-[12.5px] leading-[1.5] text-white/45">{t('flag.placeholder')}</p>
          ) : null}
          {/* The offer, set as the landing sets it: the usual price struck
              through, "Free" large, the terms small beside it. */}
          <div className="mt-[clamp(24px,3.4vw,40px)] border-t border-white/15 pt-[clamp(18px,2.4vw,28px)]">
            {callOffer.free ? (
              <p className="m-0 flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <s className="text-[18px] text-white/45" aria-label={t('offer.usually', { price: callOffer.price })}>
                  {callOffer.price}
                </s>
                <strong className="text-[clamp(1.8rem,1.3rem+1.6vw,2.6rem)] font-medium leading-none tracking-[-0.04em] text-white">
                  {t('offer.free')}
                </strong>
                <span className="basis-full text-[14px] text-white/60 sm:basis-auto">
                  {offerLine.rest}
                  {offerLine.remaining ? ` · ${offerLine.remaining}` : ''}
                </span>
              </p>
            ) : (
              <p className="m-0 text-[15px] text-white/75">{offerLine.headline}</p>
            )}
          </div>
        </section>

        <div className="mt-4 flex flex-col gap-4">
          {/* Their brief, read back — what the architect will have read. */}
          <section className="flow-card" data-reveal="" style={delay(80)}>
            <div className="mb-5 flex items-center justify-between gap-3">
              <h2 className="h-m">{t('flow.brief')}</h2>
              <Pill href="/quiz" tone="line" size="sm">
                {t('flow.editBrief')}
              </Pill>
            </div>
            {facts.length > 0 ? (
              <dl className="m-0 flex flex-wrap gap-2">
                {facts.map((f) => (
                  <div key={f.label} className="flex items-baseline gap-2 rounded-full bg-[var(--paper)] px-4 py-2.5 text-[14.5px]">
                    <dt className="text-[var(--ink-2)]">{f.label}</dt>
                    <dd className="m-0 font-medium tabular-nums">{f.value}</dd>
                  </div>
                ))}
              </dl>
            ) : null}
            {brief.styleLikes.length || brief.styleDislikes.length ? (
              <p className="m-0 mt-4 max-w-[64ch] text-[15px] leading-[1.6] text-[var(--ink-2)]">
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
            <div className="flow-card" data-reveal="">
              <p className="m-0 max-w-[60ch] text-[15px] leading-[1.6] text-[var(--ink-2)]">
                {offer.skipped.length === 1
                  ? t('skipped.one', { name: offer.skipped[0]!.name })
                  : t('skipped.many', { n: offer.skipped.length })}
              </p>
            </div>
          ) : null}

          {offer.quotes.length === 1 ? (
            <div className="flow-card" data-reveal="">
              <p className="m-0 max-w-[60ch] text-[15px] leading-[1.6]">{t('onlyOne')}</p>
            </div>
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
        </div>
      </main>

      <AppFooter />
    </FlowShell>
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
