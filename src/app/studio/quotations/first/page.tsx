import type { Metadata } from 'next';
import Link from 'next/link';
import { mayQuote, myStudioPhases } from '@/modules/studio-quote/quotes';
import { myBranding, myProducts } from '@/modules/studio-quote/store';
import { myRatesGate, RATES_GATE_COPY } from '@/modules/studio-quote/rates-gate';
import { canReadPlans } from '@/modules/floorplan/read';
import { RatesGateCard } from '../../RatesGateCard';
import { FirstQuote } from './FirstQuote';
import '../quotes.css';

export const metadata: Metadata = {
  title: 'First quote',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

/**
 * First quote, in the layout of Hauspire's First Quote page: 1 Floor plan,
 * 2 Project, 3 Options, 4 Detected from plan — confirm, then Build; the
 * quotation, the 2D plan and the PDF preview on the right. "Revise in Full
 * Builder" makes it a DRAFT quotation on the lead and opens the builder.
 *
 * The build is the standard build every quotation uses (`configure.ts
 * planQuotation`, pure), run on the page so it can be seen before it is
 * saved; the save prices every line again on the server.
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
            <h1>First quote</h1>
            <p className="muted qsub">Opens once your rates are confirmed.</p>
          </div>
        </div>
        <RatesGateCard gate={gate} {...RATES_GATE_COPY[gate]} where="elsewhere" />
      </main>
    );
  }
  const [products, branding, phases] = await Promise.all([myProducts(), myBranding(), myStudioPhases()]);

  return (
    <main className="hpage qpage">
      <div className="phead hphead">
        <div style={{ minWidth: 0 }}>
          <Link href="/studio/quotations" className="sm muted qback">
            Quotations
          </Link>
          <h1 style={{ marginTop: 4 }}>⚡ First quote</h1>
        </div>
      </div>
      <FirstQuote
        products={products}
        studioName={branding?.legalName ?? 'Your studio'}
        terms={{
          discountBps: branding?.discountBps ?? 0,
          gstBps: branding?.gstBps ?? 0,
          bookingAdvancePaise: branding?.bookingAdvancePaise ?? 0,
          phases,
        }}
        canRead={canReadPlans()}
        leadRequired={!quoting.seesAll}
      />
    </main>
  );
}
