import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { PageHead, PageBody } from '../../StudioShell';
import { formatINR } from '@/lib/money';
import { getQuote, totalsFor, STATUS_LABELS } from '@/modules/studio-quote/quotes';
import { myProducts, myBranding } from '@/modules/studio-quote/store';
import { ROOM_CATEGORIES } from '@/modules/studio-quote/starter-catalogue';
import { isUnpriced } from '@/modules/studio-quote/pricing';
import { QuoteBuilder } from './QuoteBuilder';
import { StatusBar } from './StatusBar';

export const metadata: Metadata = {
  title: 'Quotation',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

/**
 * The builder.
 *
 * Lines on the left, money on the right, and the money stays in view while you
 * work — a studio adding a wardrobe wants to see what it did to the total
 * without scrolling to the bottom of forty lines. That is the whole reason this
 * is two columns rather than a long page with a summary at the foot.
 */
export default async function QuotePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const [quote, products, branding] = await Promise.all([
    getQuote(id),
    myProducts(),
    myBranding(),
  ]);

  if (!quote) notFound();

  const totals = totalsFor(quote);
  const unpriced = quote.lines.filter(isUnpriced).length;

  return (
    <>
      <PageHead
        title={quote.clientName}
        sub={
          <span className="flex flex-wrap items-center gap-2">
            <span className="s-num">{quote.number}</span>
            {quote.config ? <span>· {quote.config}</span> : null}
            {quote.society ? <span>· {quote.society}</span> : null}
            {quote.fromMarketplace ? (
              <span className="s-tag !bg-[var(--s-accent-wash)] !text-[var(--s-accent-deep)]">
                One Interiors
              </span>
            ) : null}
          </span>
        }
        action={<StatusBar quoteId={quote.id} status={quote.status} canPrint={quote.lines.length > 0} />}
      />

      <PageBody>
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <div className="min-w-0">
            {quote.lines.length === 0 ? (
              <div className="s-card mb-4 p-5">
                <p className="m-0 mb-1.5 text-[14.5px] font-semibold">Add the first line.</p>
                <p className="m-0 max-w-[62ch] text-[14px] leading-relaxed text-[var(--s-ink-2)]">
                  Pick from your product master below, room by room. Sizes and rates come across
                  as a starting point and every one of them is editable here — changing a line
                  never changes your catalogue, and changing your catalogue never changes a
                  quotation you have already sent.
                </p>
              </div>
            ) : null}

            {unpriced > 0 ? (
              <p className="s-card mb-4 border-l-[3px] !border-l-[var(--s-warn)] px-4 py-3 text-[13.5px] leading-relaxed text-[var(--s-ink-2)]">
                {unpriced} {unpriced === 1 ? 'line has' : 'lines have'} no figure yet — a
                measurement or a rate is missing. They are counted as zero in the total below,
                which is almost certainly not what you want to send.
              </p>
            ) : null}

            <QuoteBuilder
              quote={quote}
              products={products}
              rooms={[...ROOM_CATEGORIES]}
            />
          </div>

          {/* The money. Sticky, because it is the thing you are watching. */}
          <aside className="lg:sticky lg:top-5 lg:self-start">
            <div className="s-card overflow-hidden">
              <div className="bg-[var(--s-surface-2)] px-4 py-2.5">
                <h2 className="m-0 text-[14.5px] font-semibold">The total</h2>
              </div>

              <dl className="m-0 flex flex-col gap-2 px-4 py-4 text-[13.5px]">
                <Row label="Modular" value={totals.modularPaise} />
                <Row label="On-site" value={totals.onsitePaise} />
                <Row
                  label={`Professional fee · ${quote.feeBps / 100}%`}
                  value={totals.feePaise}
                />
                <div className="my-1 border-t border-[var(--s-rule-soft)]" />
                <Row label="Sub-total" value={totals.subTotalPaise} bold />
                {totals.discountPaise > 0 ? (
                  <Row
                    label={`Discount · ${quote.discountBps / 100}% on modular`}
                    value={-totals.discountPaise}
                  />
                ) : null}
                {totals.onSpotPaise > 0 ? (
                  <Row label="On the spot" value={-totals.onSpotPaise} />
                ) : null}
              </dl>

              <div className="flex items-baseline justify-between gap-3 border-t border-[var(--s-rule)] bg-[var(--s-accent-wash)] px-4 py-3">
                <span className="text-[14px] font-semibold">What the client pays</span>
                <span className="s-num text-[18px] font-semibold">
                  {formatINR(totals.totalPaise)}
                </span>
              </div>
            </div>

            {totals.stages.length > 0 ? (
              <div className="s-card mt-4 overflow-hidden">
                <div className="bg-[var(--s-surface-2)] px-4 py-2.5">
                  <h2 className="m-0 text-[14.5px] font-semibold">Payment schedule</h2>
                </div>
                <ul className="m-0 flex list-none flex-col p-0">
                  {totals.stages.map((s) => (
                    <li
                      key={s.label}
                      className="flex items-baseline justify-between gap-3 border-b border-[var(--s-rule-soft)] px-4 py-2.5 last:border-b-0"
                    >
                      <span className="text-[13.5px]">{s.label}</span>
                      <span className="s-num text-[13.5px] font-medium">
                        {formatINR(s.amountPaise)}
                      </span>
                    </li>
                  ))}
                </ul>
                <p className="m-0 border-t border-[var(--s-rule-soft)] px-4 py-2.5 text-[12px] leading-snug text-[var(--s-ink-3)]">
                  These add up to the total exactly. Set the fee, discount and advance in{' '}
                  <Link href="/studio/settings" className="text-[var(--s-accent)]">
                    Settings
                  </Link>
                  .
                </p>
              </div>
            ) : null}

            {!branding ? (
              <p className="s-card mt-4 border-l-[3px] !border-l-[var(--s-accent)] px-4 py-3 text-[13px] leading-relaxed">
                <Link href="/studio/settings" className="font-medium text-[var(--s-accent)]">
                  Add your studio details
                </Link>{' '}
                before you print — the document needs your registered name on it.
              </p>
            ) : null}

            <p className="m-0 mt-3 px-1 text-[12px] text-[var(--s-ink-3)]">
              {STATUS_LABELS[quote.status]}
              {quote.issuedOn
                ? ` · sent ${quote.issuedOn.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}`
                : ''}
            </p>
          </aside>
        </div>
      </PageBody>
    </>
  );
}

function Row({ label, value, bold = false }: { label: string; value: number; bold?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className={`m-0 ${bold ? 'font-semibold' : 'text-[var(--s-ink-2)]'}`}>{label}</dt>
      <dd className={`s-num m-0 ${bold ? 'font-semibold' : ''}`}>
        {value < 0 ? `− ${formatINR(Math.abs(value))}` : formatINR(value)}
      </dd>
    </div>
  );
}
