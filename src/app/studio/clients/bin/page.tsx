import type { Metadata } from 'next';
import Link from 'next/link';
import { PageHead, PageBody } from '../../StudioShell';
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
    <>
      <PageHead
        title="Deleted clients"
        sub={
          rows.length === 0
            ? 'Nothing here.'
            : `${rows.length} waiting · erased ${BIN_DAYS} days after you delete them`
        }
        action={
          <Link
            href="/studio/clients"
            className="rounded-[8px] border border-[var(--s-rule)] px-3 py-1.5 text-[13px] font-medium no-underline hover:border-[var(--s-ink-3)]"
          >
            Back to clients
          </Link>
        }
      />

      <PageBody>
        <BinList rows={rows} />
      </PageBody>
    </>
  );
}
