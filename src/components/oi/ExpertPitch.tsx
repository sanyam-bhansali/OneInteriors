'use client';

import Link from 'next/link';
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
      className={`rounded-[14px] border border-[var(--acc)] bg-[var(--card)] p-[clamp(20px,3vw,28px)] ${className}`}
      aria-label={t('pitch.cta')}
    >
      <p className="oi-eyebrow m-0 mb-2">{lead ?? t('pitch.lead')}</p>
      <p className="m-0 mb-2 text-[18px] font-semibold leading-snug text-[var(--ink)]">
        {t('pitch.title', { name: ARCHITECT.name })}
      </p>
      <p className="m-0 mb-3 max-w-[58ch] text-[14px] leading-[1.6] text-[var(--ink2)]">
        {t('pitch.body')}
      </p>
      <CallOffer offer={offer} className="mb-4" />
      <BenefitChips worth />
      <Link
        href="/expert"
        className="oi-cta mt-5 inline-flex min-h-11 items-center px-5 py-3 text-[14px] no-underline"
      >
        {t('pitch.cta')}
      </Link>
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
      <p className="oi-label m-0 mb-2">
        {t('benefits.label')}{worth ? t('benefits.worth', { amount: formatINR(showcaseWorthPaise()) }) : ''}
      </p>
      <ul className="m-0 flex list-none flex-wrap gap-1.5 p-0">
        {items.map((b) => (
          <li
            key={b.id}
            title={known(lang, `benefit.${b.id}.terms`, b.terms)}
            className="rounded-full border border-[var(--line)] px-2.5 py-1 text-[12.5px] text-[var(--ink)]"
          >
            {known(lang, `benefit.${b.id}.short`, b.short)}
          </li>
        ))}
      </ul>
    </div>
  );
}
