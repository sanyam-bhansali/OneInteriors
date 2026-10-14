import type { Metadata } from 'next';
import '../clients.css';
import { myBin } from '@/modules/studio-practice/clients';
import { BIN_DAYS } from '@/modules/studio-practice/vocabulary';
import { BinList } from './Bin';

export const metadata: Metadata = {
  title: 'Deleted clients',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

/**
 * Thirty days of second thoughts.
 *
 * The screen exists so that deleting can stay a one-step action on the board.
 * Without somewhere to get things back, the honest design would be a
 * confirmation dialog on every delete — and people click through those without
 * reading them anyway, so the safety would be theatre.
 */
export default async function BinPage() {
  const rows = await myBin();

  return (
    <main className="content cl-page" style={{ maxWidth: 1100 }}>
      <div className="phead">
        <div>
          <h1>
            Deleted clients <span className="mono n">{rows.length.toLocaleString('en-IN')}</span>
          </h1>
          <p className="muted">{rows.length === 0 ? 'Nothing here.' : `Erased ${BIN_DAYS} days after you delete them. Restore any of them before then.`}</p>
        </div>
      </div>
      <BinList rows={rows} />
    </main>
  );
}
