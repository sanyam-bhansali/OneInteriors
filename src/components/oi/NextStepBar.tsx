'use client';

import Link from 'next/link';
import { useLang, useSiteT } from '@/components/app/i18n';
import { OI_DICT } from '@/modules/i18n/site/oi';
import { offerText } from '@/modules/i18n/site/expert';
import { formatINRCompact } from '@/lib/money';
import type { OfferState } from '@/modules/consultation/offer';
import { Wrap } from '@/components/landing/parts';

/**
 * The total and the next step, pinned to the bottom of the quote and the
 * comparison.
 *
 * From the fifty-app research (docs/UX-PRINCIPLES-PLAN.md, principle 5):
 * Airbnb keeps the total and "Reserve" on screen however far you scroll, and
 * the quote is the longest page we have — twenty-odd lines, a plan, the
 * totals, the phases. Before this, the only route from a quote to the
 * architect was a sentence telling people to type "oneinteriors.in/expert".
 *
 * One action, the call; the figure beside it is the quote they are reading,
 * or nothing on the comparison, where there are several. Never printed.
 */
export function NextStepBar({
  label,
  totalPaise,
  offer,
  change,
}: {
  /** "Northlight Studio · your quote", or "2 quotes side by side". */
  label: string;
  /** "−₹87.47 K, not saved" while the quote canvas holds a change. */
  change?: string;
  /** The quote's total, GST included. Omitted when there is no single total. */
  totalPaise?: number;
  offer?: OfferState;
}) {
  const t = useSiteT(OI_DICT);
  const lang = useLang();
  const lines = offer ? offerText(lang, offer) : null;
  const note = offer && lines
    ? offer.free
      ? `${lines.headline}${lines.remaining ? ` · ${lines.remaining}` : ''}`
      : lines.headline
    : t('bar.note');

  return (
    <div
      className="sticky bottom-0 z-20 border-t border-[var(--line)] bg-[var(--bg)]/90 backdrop-blur print:hidden"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      <Wrap>
        <div className="flex items-center justify-between gap-4 py-3">
          <div className="min-w-0">
            <p className="m-0 truncate text-[13px] text-[var(--ink2)]">
              {label}
              {change ? <span className="ml-2 text-[var(--acc-ink)]">{change}</span> : null}
            </p>
            {totalPaise !== undefined ? (
              <p className="m-0 text-[20px] font-medium sm:text-[22px] leading-tight tracking-[-0.02em] text-[var(--ink)] tabular-nums">
                {formatINRCompact(totalPaise)}{' '}
                <span className="text-[12.5px] font-normal tracking-normal text-[var(--ink2)]">{t('bar.inclGst')}</span>
              </p>
            ) : (
              <p className="m-0 text-[14.5px] font-medium leading-tight text-[var(--ink)]">{note}</p>
            )}
          </div>
          <div className="flex flex-col items-end gap-1">
            <Link
              href="/expert"
              className="oi-cta inline-flex min-h-11 shrink-0 items-center whitespace-nowrap rounded-full px-5 py-3 text-[14.5px] no-underline sm:px-6"
            >
              {/* One row on a phone: the short label there, the full one wider. */}
              <span className="sm:hidden">{offer && !offer.free ? t('bar.bookShort') : t('bar.bookFreeShort')}</span>
              <span className="hidden sm:inline">
                {offer && !offer.free ? t('bar.bookLong') : t('bar.bookFreeLong')}
              </span>
            </Link>
            {totalPaise !== undefined ? (
              <span className="hidden text-[12px] text-[var(--ink2)] sm:block">{note}</span>
            ) : null}
          </div>
        </div>
      </Wrap>
    </div>
  );
}
