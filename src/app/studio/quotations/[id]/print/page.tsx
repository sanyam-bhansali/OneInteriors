import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { getQuote, totalsFor } from '@/modules/studio-quote/quotes';
import { quoteDocContext } from '@/modules/studio-quote/document-data';
import { docHead, quoteFileName } from '@/modules/studio-quote/document';
import { roomsOfLines } from '@/modules/studio-quote/rooms';
import { PrintButton } from './PrintButton';
import { FloorPlanView } from '@/components/floorplan/FloorPlanView';
import { QuotationDocument } from '../../doc/QuotationDocument';
/* Change orders (15 Oct 2026): the approved extra work after sign-off, as its own section. */
import { extrasOnQuote } from '@/modules/project/change-orders';
import { ExtrasAfterSignOff } from '../../../projects/[id]/ExtrasAfterSignOff';

export const metadata: Metadata = {
  title: 'Quotation',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

/**
 * The document, as the client receives it — in the one format every studio
 * uses (the owner's sample of 13 Oct 2026, `doc/QuotationDocument.tsx`): the
 * studio's brand pages (or a cover drawn from its details), the header grid,
 * one table per room with Amount and Discounted, the summary by room with a
 * donut, the totals, the payment stages with their end deliverables, the
 * material specification, and the terms on their own pages.
 *
 * ## The rule this page exists to keep
 *
 * **Nothing of ours appears on it.** Not our name, not our logo, not our words,
 * not our terms. The studio's registered name, their GSTIN and address, their
 * opening note and their terms are the only prose on the page. A quotation is
 * a document a studio is legally answerable for, and putting our sentences on
 * it would be committing them to promises they never read.
 *
 * ## The one qualification, added deliberately
 *
 * A single attribution line sits in the footer ("Prepared with One
 * Interiors"): beneath their GSTIN, never in the header, never inside the
 * terms, never at the weight of their own name. Studios on Premium can remove
 * it; see `modules/studio-quote/mark.ts`.
 *
 * ## Why print rather than a generated PDF
 *
 * The browser's own print-to-PDF, styled with `@media print`. A server-side
 * renderer means headless Chrome or LibreOffice on the deployment — neither
 * exists on Vercel's serverless runtime. The studio gets a real PDF,
 * selectable and sharp, from the button they already know; the print styles
 * hide the studio app's header so nothing but the paper prints.
 */
export default async function PrintPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const quote = await getQuote(id);
  if (!quote) notFound();

  const [ctx, extras] = await Promise.all([quoteDocContext(quote), extrasOnQuote(quote.id).catch(() => [])]);
  const studioName = ctx.studio?.tradeName || ctx.branding?.legalName || '';

  return (
    <>
      <PrintButton filename={quoteFileName(quote.clientName, studioName, quote.number, quote.quoteDate)} />
      <QuotationDocument
        studio={ctx.studio}
        brandPages={ctx.brandPages}
        head={docHead(quote, ctx.branding?.city ?? null)}
        lines={quote.lines}
        roomOrder={roomsOfLines(quote.lines)}
        totals={totalsFor(quote)}
        feeBps={quote.feeBps}
        discountBps={quote.discountBps}
        gstBps={quote.gstBps}
        onSpotLabel={quote.onSpotLabel}
        schedule={ctx.schedule}
        spec={ctx.spec}
        terms={ctx.terms}
        welcomeNote={quote.welcomeNote}
        showMark={ctx.showMark}
        markText={ctx.markText}
        validDays={ctx.validDays}
        extra={
          <>
            <ExtrasAfterSignOff extras={extras} />
            {/* Their flat, from their floor plan, when their brief came with one. */}
            {quote.planRooms.length > 0 ? (
              <div className="qd-keep" style={{ marginBottom: '5mm' }}>
                <p className="qd-bandline">Your floor plan</p>
                <FloorPlanView rooms={quote.planRooms} printable />
              </div>
            ) : null}
          </>
        }
      />
    </>
  );
}
