import Link from 'next/link';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { electricalRates } from '@/modules/project/electrical-bill';
import { RateList } from './RateList';
import '../../office-ui.css';

export const metadata: Metadata = { title: 'Electrical rate list', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

/**
 * The electrical rate list (owner, 22 Nov 2026): the items a designer picks
 * on a project's electrical bill, with the unit, description and rate. Kept
 * by the owner or the design head; everyone else reads it.
 */
export default async function ElectricalRatesPage() {
  const data = await electricalRates();
  if (!data) notFound();
  return (
    <main className="content ox-page">
      <div className="phead">
        <div>
          <h1>Electrical rate list</h1>
          <p className="muted" style={{ maxWidth: '72ch' }}>
            The items on a project&rsquo;s electrical bill. The designer picks an item and sets the quantity; the description and rate come from here.
            {data.canEdit ? '' : ' The owner or the design head changes it.'}
          </p>
        </div>
        <Link href="/studio/products" className="btn sec">
          Product master
        </Link>
      </div>
      <RateList rows={data.rows} canEdit={data.canEdit} />
    </main>
  );
}
