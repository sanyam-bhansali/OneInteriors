import type { Metadata } from 'next';
import Link from 'next/link';
import { PageHead, PageBody } from '../../StudioShell';
import { Import } from './Import';

export const metadata: Metadata = {
  title: 'Import clients',
  robots: { index: false, follow: false },
};

/**
 * The first five minutes.
 *
 * A studio that has been working for six years arrives with a spreadsheet, and
 * every screen in here is empty until that spreadsheet is in. Asking them to
 * retype two hundred rows is asking them not to bother — so this page is,
 * practically, the difference between software they try and software they use.
 *
 * Nothing on this page is server-rendered: the file is read, parsed and
 * previewed in the browser, and only the agreed file text and column choices
 * are sent. See the note in `actions.ts` for why it is the text and not the
 * rows.
 */
export default function ImportPage() {
  return (
    <>
      <PageHead
        title="Import clients"
        sub="From a CSV. Nothing is saved until you have seen what it will do."
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
        <Import />
      </PageBody>
    </>
  );
}
