import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { hasDatabase } from '@/lib/env';
import { signoffDocument } from '@/modules/project/signoffs';
import { QuotationDocument } from '@/app/studio/quotations/doc/QuotationDocument';
import '@/app/studio/quotations/doc/quote-doc.css';
import { SignoffScreen } from './SignoffScreen';

export const metadata: Metadata = { title: 'Read and sign', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

/**
 * Read and sign a quotation (owner, 15 Oct 2026; project/signoffs.ts): the
 * revision the studio asked the client to sign, in the quotation's own
 * format (the same document as the PDF), scrollable, then "I have read and
 * agree", the typed full name, and Sign. Once signed, this page is the signed
 * copy the Locker opens ("Signed by … on …"). The phone app opens this page
 * inside the app. Open to the owner of the project and their family (only
 * the owner signs), the studio on the project who sees its money, and ops.
 */
export default async function SignoffPage({ params }: { params: Promise<{ id: string }> }) {
  if (!hasDatabase()) notFound();
  const { id } = await params;
  const d = await signoffDocument(id);
  if (!d) notFound();
  return (
    <SignoffScreen
      id={d.id}
      kind={d.kind}
      quoteNumber={d.quoteNumber}
      revision={d.revision}
      state={d.state}
      canSign={d.canSign}
      viewer={d.viewer}
      hash={d.hash}
      changedSince={d.changedSince}
      signed={d.signed}
    >
      <QuotationDocument
        embedded
        studio={d.doc.studio}
        brandPages={d.doc.brandPages}
        head={d.doc.head}
        lines={d.doc.lines}
        roomOrder={d.doc.roomOrder}
        totals={d.doc.totals}
        feeBps={d.doc.feeBps}
        discountBps={d.doc.discountBps}
        gstBps={d.doc.gstBps}
        onSpotLabel={d.doc.onSpotLabel}
        schedule={d.doc.schedule}
        spec={d.doc.spec}
        terms={d.doc.terms}
        welcomeNote={d.doc.welcomeNote}
        showMark={false}
        markText=""
      />
    </SignoffScreen>
  );
}
