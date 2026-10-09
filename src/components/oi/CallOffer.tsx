'use client';

import type { OfferState } from '@/modules/consultation/offer';
import { useLang, useSiteT } from '@/components/app/i18n';
import { EXPERT_DICT, offerText } from '@/modules/i18n/site/expert';

/** "₹5,000 → Free for the first 1,000 customers", with how many are left once it matters. */
export function CallOffer({ offer, className = '' }: { offer: OfferState; className?: string }) {
  const t = useSiteT(EXPERT_DICT);
  const { headline, rest, remaining } = offerText(useLang(), offer);
  if (!offer.free) {
    return <p className={`oi-num m-0 text-[13px] text-[var(--ink2)] ${className}`}>{headline}</p>;
  }
  return (
    <p className={`m-0 flex flex-wrap items-baseline gap-x-2 gap-y-1 ${className}`}>
      <s className="oi-num text-[14px] text-[var(--ink2)]" aria-label={t('offer.usually', { price: offer.price })}>
        {offer.price}
      </s>
      <span className="oi-num text-[15px] font-semibold text-[var(--acc)]">{t('offer.free')}</span>
      <span className="text-[13px] text-[var(--ink2)]">
        {rest}
        {remaining ? ` · ${remaining}` : ''}
      </span>
    </p>
  );
}
