'use client';

import type { OfferState } from '@/modules/consultation/offer';
import { useLang, useSiteT } from '@/components/app/i18n';
import { EXPERT_DICT, offerText } from '@/modules/i18n/site/expert';

/**
 * "₹5,000 → Free for the first 1,000 customers", with how many are left once it matters.
 *
 * The landing's offer line (`.offer` in home-cb.css, owner 10 Oct 2026): the
 * usual price struck through, "Free" large and medium-weight, the terms on a
 * line beneath. Needs a `.cb` ancestor — FlowShell, or `cb cb-part`.
 */
export function CallOffer({ offer, className = '' }: { offer: OfferState; className?: string }) {
  const t = useSiteT(EXPERT_DICT);
  const { headline, rest, remaining } = offerText(useLang(), offer);
  if (!offer.free) {
    return (
      <p className={`offer ${className}`}>
        <span>{headline}</span>
      </p>
    );
  }
  return (
    <p className={`offer ${className}`}>
      <s aria-label={t('offer.usually', { price: offer.price })}>{offer.price}</s>
      <strong>{t('offer.free')}</strong>
      <span>
        {rest}
        {remaining ? ` · ${remaining}` : ''}
      </span>
    </p>
  );
}
