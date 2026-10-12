import type { Metadata } from 'next';
import { PageHead, PageBody } from '../../StudioShell';
import { priceThese } from '@/modules/studio-crews/store';
import { CrewsNav } from '../CrewsNav';
import { PriceRows } from './PriceRows';

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
      <PageBody>
        <p className="m-0 text-[15px] text-[var(--s-ink-2)]">Pricing crews&apos; work is for the studio owner and accounts.</p>
      </PageBody>
    );
  }
  const total = data.price.length + data.qty.length;
  return (
    <>
      <PageHead title="Price these" sub={total === 0 ? 'Every line on every work order has a price and a quantity.' : `${data.qty.length} need a quantity, ${data.price.length} need a price`} />
      <CrewsNav at="price" />
      <PageBody>
        <div className="flex flex-col gap-6">
          {data.qty.length ? (
            <section className="flex flex-col gap-2">
              <h2 className="m-0 text-[15px] font-semibold">Needs a quantity</h2>
              <p className="m-0 max-w-[70ch] text-[13px] text-[var(--s-ink-3)]">An estimate is fine: the site measurement replaces it when the PM enters one.</p>
              <PriceRows rows={data.qty} kind="qty" />
            </section>
          ) : null}
          {data.price.length ? (
            <section className="flex flex-col gap-2">
              <h2 className="m-0 text-[15px] font-semibold">Needs a price</h2>
              <p className="m-0 max-w-[70ch] text-[13px] text-[var(--s-ink-3)]">
                A rate is for this project only (the crew&apos;s card is unchanged). An agreed amount replaces rate × quantity for the line.
              </p>
              <PriceRows rows={data.price} kind="price" />
            </section>
          ) : null}
          {total === 0 ? <p className="s-card m-0 p-5 text-[14px] text-[var(--s-ink-2)]">Nothing to price.</p> : null}
        </div>
      </PageBody>
    </>
  );
}
