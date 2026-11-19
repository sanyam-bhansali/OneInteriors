import type { Metadata } from 'next';
import Link from 'next/link';
import { mayQuote } from '@/modules/studio-quote/quotes';
import { myBranding, myProducts } from '@/modules/studio-quote/store';
import { myRatesGate, RATES_GATE_COPY } from '@/modules/studio-quote/rates-gate';
import { canReadPlans } from '@/modules/floorplan/read';
import { RatesGateCard } from '../../RatesGateCard';
import { FirstQuote } from './FirstQuote';
import '../quotes.css';

export const metadata: Metadata = {
  title: 'Quotation builder',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

/**
 * The quotation builder's start (one tab since 19 Nov 2026; it was First
 * quote and Full builder): 1 Floor plan (with a note), 2 Project, 3 Options,
 * 4 Detected from plan — confirm, 5 Discount, then Build, which saves a DRAFT
 * quotation on the lead and opens the full builder on it. The lead's floor
 * plan is on the right the whole time.
 *
 * The build is the standard build every quotation uses (`configure.ts
 * planQuotation`, pure), run on the page from what is filled in; the save
 * prices every line again on the server.
 */
export default async function FirstQuotePage() {
  const [quoting, gate] = await Promise.all([mayQuote(), myRatesGate()]);
  if (!quoting) {
    return (
      <main className="content qpage">
        <div className="empty">
          <b>Quotations are not part of your role.</b>
        </div>
      </main>
    );
  }
  if (gate !== 'OPEN') {
    return (
      <main className="content qpage">
        <div className="phead">
          <div>
            <h1>Quotation builder</h1>
            <p className="muted qsub">Opens once your rates are confirmed.</p>
          </div>
        </div>
        <RatesGateCard gate={gate} {...RATES_GATE_COPY[gate]} where="elsewhere" />
      </main>
    );
  }
  const [products, branding] = await Promise.all([myProducts(), myBranding()]);

  return (
    <main className="hpage qpage">
      <div className="phead hphead">
        <div style={{ minWidth: 0 }}>
          <Link href="/studio/quotations" className="sm muted qback">
            Quotations
          </Link>
          <h1 style={{ marginTop: 4 }}>Quotation builder</h1>
        </div>
      </div>
      <FirstQuote
        products={products}
        terms={{ discountBps: branding?.discountBps ?? 0 }}
        canRead={canReadPlans()}
        leadRequired={!quoting.seesAll}
      />
    </main>
  );
}
