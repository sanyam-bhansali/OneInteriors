import type { OfferState } from '@/modules/consultation/offer';

/** "₹5,000 → Free for the first 1,000 customers", with how many are left once it matters. */
export function CallOffer({ offer, className = '' }: { offer: OfferState; className?: string }) {
  if (!offer.free) {
    return <p className={`oi-num m-0 text-[13px] text-[var(--ink2)] ${className}`}>{offer.headline}</p>;
  }
  return (
    <p className={`m-0 flex flex-wrap items-baseline gap-x-2 gap-y-1 ${className}`}>
      <s className="oi-num text-[14px] text-[var(--ink2)]" aria-label={`Usually ${offer.price}`}>
        {offer.price}
      </s>
      <span className="oi-num text-[15px] font-semibold text-[var(--acc)]">Free</span>
      <span className="text-[13px] text-[var(--ink2)]">
        {offer.headline.replace(/^Free /, '')}
        {offer.remaining ? ` · ${offer.remaining}` : ''}
      </span>
    </p>
  );
}
