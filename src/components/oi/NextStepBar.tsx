'use client';

import { Pill } from '@/components/home/parts';
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
 *
 * Dressed as the landing's nav once you scroll (owner, 10 Oct 2026): white
 * with a blur, a hairline shadow, the call a dark pill, the total set like
 * the landing's live price. `.cb cb-part` so it is styled on any page.
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
      className="cb cb-part sticky bottom-0 z-20 print:hidden"
      style={{
        background: 'rgba(255,255,255,.82)',
        backdropFilter: 'saturate(1.4) blur(14px)',
        WebkitBackdropFilter: 'saturate(1.4) blur(14px)',
        boxShadow: '0 -1px 0 var(--line)',
        overflowX: 'visible',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
      }}
    >
      <Wrap>
        <div className="flex items-center justify-between gap-4 py-3">
          <div className="min-w-0">
            <p className="m-0 truncate text-[13px] text-[var(--ink-2)]">
              {label}
              {change ? <span className="ml-2 text-[var(--accent-ink)]">{change}</span> : null}
            </p>
            {totalPaise !== undefined ? (
              <p className="m-0 mt-0.5 text-[22px] font-medium leading-none tracking-[-0.04em] text-[var(--ink)] tabular-nums sm:text-[26px]">
                {formatINRCompact(totalPaise)}{' '}
                <span className="text-[12.5px] font-normal tracking-normal text-[var(--ink-2)]">{t('bar.inclGst')}</span>
              </p>
            ) : (
              <p className="m-0 text-[15px] font-medium leading-tight tracking-[-0.01em] text-[var(--ink)]">{note}</p>
            )}
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1">
            {/* One row on a phone: the short label there, the full one wider.
                The breakpoint classes sit on wrappers — `.pill` sets its own
                display, which a utility on the pill itself cannot undo. */}
            <span className="sm:hidden">
              <Pill href="/expert">
                {offer && !offer.free ? t('bar.bookShort') : t('bar.bookFreeShort')}
              </Pill>
            </span>
            <span className="hidden sm:inline-flex">
              <Pill href="/expert" arrow>
                {offer && !offer.free ? t('bar.bookLong') : t('bar.bookFreeLong')}
              </Pill>
            </span>
            {totalPaise !== undefined ? (
              <span className="hidden text-[12px] text-[var(--ink-2)] sm:block">{note}</span>
            ) : null}
          </div>
        </div>
      </Wrap>
    </div>
  );
}
