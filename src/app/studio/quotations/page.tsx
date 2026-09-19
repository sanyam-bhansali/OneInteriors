import Link from 'next/link';
import type { Metadata } from 'next';
import { PageHead, PageBody } from '../StudioShell';
import { GuidePanel } from '../GuidePanel';
import { guideContext } from '@/modules/studio/guide-store';
import { formatINR } from '@/lib/money';
import { myQuotes, STATUS_LABELS, type QuoteStatusName } from '@/modules/studio-quote/quotes';
import { myBranding, myProducts } from '@/modules/studio-quote/store';
import { NewQuote } from './NewQuote';

export const metadata: Metadata = {
  title: 'Quotations',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

const TONE: Record<QuoteStatusName, string> = {
  DRAFT: '!bg-[var(--s-surface-2)] !text-[var(--s-ink-3)]',
  ISSUED: '!bg-[var(--s-warn-wash)] !text-[var(--s-warn)]',
  ACCEPTED: '!bg-[var(--s-good-wash)] !text-[var(--s-good)]',
  DECLINED: '!bg-[var(--s-bad-wash)] !text-[var(--s-bad)]',
};

/**
 * Every quotation a studio has written.
 *
 * Sorted by what they touched last, not by value — the one they were working on
 * this morning is the one they came back for. Value ordering is for a report,
 * and this is a work surface.
 */
export default async function QuotationsPage() {
  const [quotes, branding, products] = await Promise.all([myQuotes(), myBranding(), myProducts()]);

  const priced = products.filter((p) => p.ratePaise > 0).length;
  const blocked = !branding || priced === 0;

  /* Every step is derived from the studio's own rows — there is no way to
     mark one done without having done it. See modules/studio/guide.ts. */
  const { state, facts } = await guideContext();
  const dismissed = state.dismissed.includes('quotations');

  return (
    <>
      <PageHead
        title="Quotations"
        sub={
          quotes.length === 0
            ? 'Nothing written yet.'
            : `${quotes.length} · ${quotes.filter((q) => q.status === 'DRAFT').length} still in draft`
        }
        action={
          <div className="relative">
            <NewQuote blocked={blocked} />
          </div>
        }
      />

      <PageBody>
        {/* The two prerequisites used to be a blocker card: a wall telling
            somebody to go to two other screens and come back. They are now
            steps one and two of the walkthrough, which is the same
            information arranged as a way forward rather than a refusal.
            `blocked` still governs whether the New button renders, and
            createQuote() still enforces branding server-side. */}
        <GuidePanel guide="quotations" facts={facts} dismissed={dismissed} />

        {quotes.length === 0 ? (
          <div className="s-card p-8">
            <p className="m-0 mb-2 text-[15.5px] font-semibold">
              Every quotation you write lives here.
            </p>
            <p className="m-0 max-w-[62ch] text-[14.5px] leading-relaxed text-[var(--s-ink-2)]">
              Yours, on your letterhead, for your own clients as much as the ones we introduce. We
              never see what you charge on one and we take nothing from a project that did not come
              through us.
            </p>
          </div>
        ) : (
          <ul className="m-0 grid list-none grid-cols-1 gap-3 p-0 xl:grid-cols-2">
            {quotes.map((q) => (
              <li key={q.id}>
                <Link
                  href={`/studio/quotations/${q.id}`}
                  className="s-card flex flex-col gap-2.5 p-4 no-underline transition-colors hover:border-[var(--s-ink-3)]"
                >
                  <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                    <span className="text-[15.5px] font-semibold">{q.clientName}</span>
                    <span className="s-num s-label">{q.number}</span>
                    <span className={`s-tag ml-auto ${TONE[q.status]}`}>
                      {STATUS_LABELS[q.status]}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {q.config ? <span className="s-tag">{q.config}</span> : null}
                    {q.society ? <span className="s-tag">{q.society}</span> : null}
                    {q.fromMarketplace ? (
                      <span className="s-tag !bg-[var(--s-accent-wash)] !text-[var(--s-accent-deep)]">
                        One Interiors
                      </span>
                    ) : null}
                  </div>

                  <div className="flex flex-wrap items-baseline justify-between gap-x-4 border-t border-[var(--s-rule-soft)] pt-2.5">
                    <span className="text-[13px] text-[var(--s-ink-3)]">
                      {q.lineCount === 0
                        ? 'No lines yet'
                        : `${q.lineCount} line${q.lineCount === 1 ? '' : 's'}`}
                    </span>
                    <span className="s-num text-[16px] font-semibold">
                      {q.totalPaise > 0 ? formatINR(q.totalPaise) : '—'}
                    </span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </PageBody>
    </>
  );
}
