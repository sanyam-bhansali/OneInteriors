import type { Metadata } from 'next';
import { priceThese } from '@/modules/studio-crews/store';
import { PriceRows } from './PriceRows';
import '../../office-ui.css';
import '../vendors.css';

export const metadata: Metadata = { title: 'Price these', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

/**
 * Price these (Studio OS Phase 3 §5): the lines that did not price
 * themselves. The quotation priced them as a lump sum (false ceiling,
 * painting, electricals, customised work), so they need a quantity or a
 * price; a site measurement can correct an estimate later. Owner and
 * accounts; the PM enters quantities on the project's Crews tab.
 */
export default async function PriceThesePage() {
  const data = await priceThese();
  if (!data) {
    return (
      <main className="content ox-page">
        <p className="ox-note">Pricing crews&apos; work is for the studio owner and accounts.</p>
      </main>
    );
  }
  const total = data.price.length + data.qty.length;
  return (
    <main className="content ox-page">
      <div className="phead">
        <div>
          <h1>Price these</h1>
          <p className="muted">{total === 0 ? 'Every line on every work order has a price and a quantity.' : `${data.qty.length} need a quantity, ${data.price.length} need a price`}</p>
        </div>
      </div>
      {data.qty.length ? (
        <section className="card flush" aria-labelledby="h-qty">
          <div className="chead">
            <div>
              <h2 id="h-qty">Needs a quantity</h2>
              <span className="muted sm">An estimate is fine: the site measurement replaces it when the PM enters one.</span>
            </div>
          </div>
          <PriceRows rows={data.qty} kind="qty" />
        </section>
      ) : null}
      {data.price.length ? (
        <section className="card flush" aria-labelledby="h-price">
          <div className="chead">
            <div>
              <h2 id="h-price">Needs a price</h2>
              <span className="muted sm">A rate is for this project only (the crew&apos;s card is unchanged). An agreed amount replaces rate × quantity for the line.</span>
            </div>
          </div>
          <PriceRows rows={data.price} kind="price" />
        </section>
      ) : null}
      {total === 0 ? (
        <div className="empty">
          <b>Nothing to price.</b>
        </div>
      ) : null}
    </main>
  );
}
