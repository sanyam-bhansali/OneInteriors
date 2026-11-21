import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { stageInvoice } from '@/modules/project/invoice';
import { nameWord } from '@/modules/studio-design/documents';
import { PrintStatement } from '../../statement/PrintStatement';
import { InvoiceDoc } from './InvoiceDoc';

export const metadata: Metadata = { title: 'Invoice', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

/**
 * One payment stage's invoice (owner, 21 Nov 2026: "one TAX INVOICE per
 * payment stage", from the approved sample-invoice.html; no "GST included"
 * wording). TAX INVOICE when the stage carries part of the project's GST,
 * else INVOICE. The number is given the first time it is opened
 * (project/invoice.ts); the figures are the payment ledger's, as on the
 * Payments tab. Print or save as a PDF, as the statement does.
 */

export default async function InvoicePage({ params }: { params: Promise<{ id: string; stage: string }> }) {
  const { id, stage } = await params;
  const index = /^\d{1,2}$/.test(stage) ? Number(stage) - 1 : -1;
  const inv = await stageInvoice(id, index);
  if (!inv) notFound();
  const filename = `Invoice_${inv.number.replace(/\//g, '-')}_${nameWord(inv.client.name, 'Client')}`;

  return (
    <main className="mdoc-wrap px-4 py-6" style={{ background: '#ebe9ee' }}>
      <PrintStatement filename={filename} backHref={`/studio/projects/${id}?tab=payments`} />
      <InvoiceDoc inv={inv} />
    </main>
  );
}
