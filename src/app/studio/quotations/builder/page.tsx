import Link from 'next/link';
import type { Metadata } from 'next';
import { mayQuote } from '@/modules/studio-quote/quotes';
import { myProducts } from '@/modules/studio-quote/store';
import { myRatesGate, RATES_GATE_COPY } from '@/modules/studio-quote/rates-gate';
import { RatesGateCard } from '../../RatesGateCard';
import { StartQuote } from '../NewQuote';
import { LineIcon } from '../../ui/icons';
import '../quotes.css';

export const metadata: Metadata = {
  title: 'Full builder',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

/**
 * Full Builder, as Hauspire's /builder (owner, 13 Oct 2026): start a new
 * quotation and land in the builder. The same start as the Quotations home
 * (`StartQuote` → `createQuoteAction`, which opens the new quotation in the
 * builder), on its own page so the tab goes straight to it. A salesperson's
 * quotation is for a lead, as everywhere.
 */
export default async function FullBuilderPage() {
  const [quoting, gate, products] = await Promise.all([mayQuote(), myRatesGate(), myProducts()]);
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
            <h1>Full builder</h1>
            <p className="muted qsub">Opens once your rates are confirmed.</p>
          </div>
        </div>
        <RatesGateCard gate={gate} {...RATES_GATE_COPY[gate]} where="elsewhere" />
      </main>
    );
  }

  return (
    <main className="content qpage hhome">
      <div className="phead">
        <div style={{ minWidth: 0 }}>
          <Link href="/studio/quotations" className="sm muted qback">
            <LineIcon name="back" size={15} />
            Quotations
          </Link>
          <h1 style={{ marginTop: 4 }}>🧱 Full builder</h1>
          <p className="muted qsub">Who it is for and the flat, then the builder opens: add rooms and products, edit sizes, fine-tune every line.</p>
        </div>
      </div>
      <StartQuote
        priced={products.filter((p) => p.ratePaise > 0).length}
        standard={products.filter((p) => p.inStandardBuild).length}
        total={products.length}
        leadRequired={quoting.seesAll === false}
      />
    </main>
  );
}
