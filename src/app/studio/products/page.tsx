import type { Metadata } from 'next';
import { myProducts } from '@/modules/studio-quote/store';
import { ProductTable } from './ProductTable';
import { RatesGateCard } from '../RatesGateCard';
import { myRatesGate, RATES_GATE_COPY } from '@/modules/studio-quote/rates-gate';
import './products.css';

export const metadata: Metadata = {
  title: 'Product master',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

/**
 * The studio's own catalogue (StudioRates in the owner's UI handoff).
 *
 * ## One price list
 *
 * This is the studio's own price list, in their own product names, that
 * their own quotations are built from — and, since 10 Oct 2026, the first
 * quote One Interiors shows a customer for them. `/studio/rates` (the old
 * six-category rate card) sends here.
 *
 * ## Why every rate arrives blank
 *
 * We promised: *"We do not set your prices. Nothing here is pre-filled, there
 * is no suggested figure, and we will never nudge you toward one."* A starter
 * catalogue with plausible Pune rates in it would break that on the first
 * screen of the software. So what ships is the shape: names, units, work
 * codes and the sizes that recur. The numbers are theirs.
 */
export default async function ProductsPage() {
  const [products, gate] = await Promise.all([myProducts(), myRatesGate()]);
  const priced = products.filter((p) => p.ratePaise > 0).length;
  const blank = products.length - priced;
  const standard = products.filter((p) => p.inStandardBuild).length;

  const notes = (
    <>
      {gate !== 'OPEN' ? <RatesGateCard gate={gate} {...RATES_GATE_COPY[gate]} where="products" /> : null}

      {blank > 0 && gate === 'OPEN' ? (
        <section className="card pnote warn">
          <div className="chead">
            <h2>These are your prices, not ours.</h2>
            <span className="chip warn">
              <span className="dot" />
              {blank} still need a rate
            </span>
          </div>
          <p className="muted" style={{ margin: 0, maxWidth: '72ch', lineHeight: 1.55 }}>
            We have given you the shape of a catalogue — what the line is called, how it is measured, and whether it is factory or
            site work. Every rate is blank on purpose: we told you we would never suggest a figure, and a default you accept in a
            hurry is a price we set. A product with no rate still lands on a quotation when you build one — at zero, flagged —
            because a line you can see is unfinished is better than one that silently went missing.
          </p>
        </section>
      ) : null}

      {/* The highest-leverage control in the studio software, and one
          nobody would find on their own: a catalogue with nothing ticked
          makes "Build the 3 BHK" produce an empty quotation. Said once, at
          the top, and only while it is still true. */}
      {products.length > 0 && standard === 0 ? (
        <section className="card pnote">
          <div className="chead">
            <h2>Tick what you fit as standard.</h2>
          </div>
          <p className="muted" style={{ margin: 0, maxWidth: '72ch', lineHeight: 1.55 }}>
            Most of a quotation is the same twenty-five lines every time — base and wall cabinets, a wardrobe in each bedroom, a
            vanity in each bathroom, false ceiling, painting. Tick those here and the quotation builder assembles a whole 3 BHK in
            one press, sized and priced from this list, for you to correct rather than type. It is a different question from
            whether you sell something: a walk-in wardrobe is priced, active, and not standard.
          </p>
        </section>
      ) : null}
    </>
  );

  return (
    <main className="content ppage">
      {products.length === 0 ? (
        <>
          <div className="phead">
            <div>
              <h1>Product master</h1>
              <p className="muted psub">Your items and your rates. We never fill in or suggest a price.</p>
            </div>
          </div>
          {notes}
          <div className="empty">
            <b>Your catalogue could not be loaded.</b>
            <span className="muted sm">If this persists, tell us — it is ours to fix.</span>
          </div>
        </>
      ) : (
        <ProductTable
          products={products}
          summary={blank === 0 ? `${products.length} products, all priced` : `${priced} of ${products.length} priced`}
          allPriced={blank === 0}
          notes={notes}
        />
      )}

      <p className="muted sm" style={{ margin: 0, maxWidth: '78ch', lineHeight: 1.55 }}>
        Changing a rate here never changes a quotation already sent. Each quote keeps the rates it was made with. Nobody sees these
        rates but you — not other studios, and never a customer: what a customer sees is the quote they come to for their home,
        never a rate per sq ft. This is your one price list: your own quotations are built from it, and so is the first quote One
        Interiors shows a customer for you.
      </p>
    </main>
  );
}
