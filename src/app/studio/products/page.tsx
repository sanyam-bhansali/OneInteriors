import Link from 'next/link';
import type { Metadata } from 'next';
import { PageHead, PageBody } from '../StudioShell';
import { myProducts } from '@/modules/studio-quote/store';
import { ProductTable } from './ProductTable';

export const metadata: Metadata = {
  title: 'Product master',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

/**
 * The studio's own catalogue.
 *
 * ## What this is not
 *
 * It is not `/studio/rates`. That page holds six broad category rates we use to
 * produce an INDICATIVE quote on a customer's comparison screen — our number,
 * for making two studios comparable. This is the studio's own price list, in
 * their own product names, that their own quotations are built from and that we
 * never see the output of.
 *
 * Two price lists sounds like one too many and is not: ours has to be six
 * comparable buckets or the comparison is meaningless, and theirs has to be
 * thirty-eight specific products or the quotation is useless. Collapsing them
 * would break one or the other.
 *
 * ## Why every rate arrives blank
 *
 * `/studio/rates` promises, in these words: *"We do not set your prices.
 * Nothing here is pre-filled, there is no suggested figure, and we will never
 * nudge you toward one."* A starter catalogue with plausible Pune rates in it
 * would break that on the first screen of the software — and break it in the
 * worst way, because a studio in a hurry would accept them and we would have
 * quietly priced a business we also take a commission from.
 *
 * So what ships is the shape: names, units, work codes and the sizes that
 * recur. The numbers are theirs.
 */
export default async function ProductsPage() {
  const products = await myProducts();
  const priced = products.filter((p) => p.ratePaise > 0).length;
  const blank = products.length - priced;

  return (
    <>
      <PageHead
        title="Product master"
        sub={
          products.length === 0
            ? 'Nothing here yet.'
            : blank === 0
              ? `${products.length} products, all priced.`
              : `${priced} of ${products.length} priced · ${blank} still need a rate`
        }
      />

      <PageBody>
        {blank > 0 ? (
          <div className="s-card mb-6 border-l-[3px] !border-l-[var(--s-warn)] p-5">
            <p className="m-0 mb-2 text-[14.5px] font-semibold">These are your prices, not ours.</p>
            <p className="m-0 max-w-[68ch] text-[14px] leading-relaxed text-[var(--s-ink-2)]">
              We have given you the shape of a catalogue — what the line is called, how it is
              measured, and whether it is factory or site work. Every rate is blank on purpose: we
              told you we would never suggest a figure, and a default you accept in a hurry is a
              price we set. A product with no rate simply does not appear when you build a
              quotation.
            </p>
          </div>
        ) : null}

        {products.length === 0 ? (
          <div className="s-card p-8 text-center">
            <p className="m-0 text-[15px] text-[var(--s-ink-3)]">
              Your catalogue could not be loaded. If this persists, tell us — it is ours to fix.
            </p>
          </div>
        ) : (
          <ProductTable products={products} />
        )}

        <p className="m-0 mt-8 max-w-[68ch] text-[13.5px] leading-relaxed text-[var(--s-ink-3)]">
          Nobody sees this but you. Not customers, not other studios, and we never publish an
          average of it —{' '}
          <Link href="/studio/rates" className="text-[var(--s-accent)]">
            the six rates we quote you at
          </Link>{' '}
          are a separate, shorter list, and changing one here does not change the other.
        </p>
      </PageBody>
    </>
  );
}
