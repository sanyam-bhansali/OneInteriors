'use client';

import { Pill } from '@/components/home/parts';
import { useLang, useSiteT } from '@/components/app/i18n';
import { EXPERT_DICT, known } from '@/modules/i18n/site/expert';
import { CallOffer } from './CallOffer';
import { showcase, showcaseWorthPaise } from '@/modules/portal/benefits';
import { formatINR } from '@/lib/money';
import { ARCHITECT } from '@/modules/consultation/architect';
import type { OfferState } from '@/modules/consultation/offer';

/**
 * The expert call, pitched where a customer is deciding whether to ring a
 * studio directly: after the matches, after a quote, on the comparison.
 *
 * Nothing is withheld to force it (the pilot stays open —
 * docs/FUTURE-REQUIREMENTS.md). It says what the call is, what it costs, and
 * what booking through us brings that going direct does not.
 *
 * Set as the landing's own architect tile (owner, 10 Oct 2026): a peach tile,
 * the phone in a white disc, a large medium-weight heading, the landing's
 * offer (struck price, a big "Free") and a dark pill. Needs a `.cb` ancestor
 * for the pill and the offer — FlowShell, or `cb cb-part` (DirectVsUs).
 */
export function ExpertPitch({
  offer,
  lead,
  className = '',
}: {
  offer: OfferState;
  lead?: string;
  className?: string;
}) {
  const t = useSiteT(EXPERT_DICT);
  return (
    <aside
      className={`rounded-[var(--r-l,24px)] bg-[var(--peach,#fbe6dc)] p-[clamp(22px,3vw,36px)] text-[var(--ink)] ${className}`}
      aria-label={t('pitch.cta')}
    >
      <span
        aria-hidden="true"
        className="mb-5 grid h-10 w-10 place-items-center rounded-full bg-white/70 text-[18px]"
      >
        ☏
      </span>
      <p className="eyebrow" style={{ marginBottom: 12 }}>
        {lead ?? t('pitch.lead')}
      </p>
      <h3 className="m-0 max-w-[20ch] text-[clamp(1.6rem,1.1rem+1.8vw,2.4rem)] font-medium leading-[1.06] tracking-[-0.035em] [text-wrap:balance]">
        {t('pitch.title', { name: ARCHITECT.name })}
      </h3>
      <p className="m-0 mt-3 max-w-[54ch] text-[15px] leading-[1.6] text-[var(--ink-2)]">
        {t('pitch.body')}
      </p>
      <div className="mt-6">
        <CallOffer offer={offer} />
      </div>
      <BenefitChips worth className="mt-6" />
      <div className="mt-6">
        <Pill href="/expert" arrow>
          {t('pitch.cta')}
        </Pill>
      </div>
    </aside>
  );
}

/** "Through One Interiors: Up to ₹50,000 cashback · Free cab to the studio · …" */
export function BenefitChips({
  limit,
  worth = false,
  className = '',
}: {
  limit?: number;
  /** Add "worth up to ₹76,000" to the label. */
  worth?: boolean;
  className?: string;
}) {
  const t = useSiteT(EXPERT_DICT);
  const lang = useLang();
  const items = showcase().slice(0, limit);
  return (
    <div className={className}>
      <p className="m-0 mb-3 text-[12px] font-medium uppercase tracking-[0.08em] text-[var(--ink-2)]">
        {t('benefits.label')}{worth ? t('benefits.worth', { amount: formatINR(showcaseWorthPaise()) }) : ''}
      </p>
      {/* Soft white pills, as the landing sets a row of short facts. */}
      <ul className="m-0 flex list-none flex-wrap gap-1.5 p-0">
        {items.map((b) => (
          <li
            key={b.id}
            title={known(lang, `benefit.${b.id}.terms`, b.terms)}
            className="rounded-full bg-white px-3 py-1.5 text-[13px] text-[var(--ink)]"
          >
            {known(lang, `benefit.${b.id}.short`, b.short)}
          </li>
        ))}
      </ul>
    </div>
  );
}
