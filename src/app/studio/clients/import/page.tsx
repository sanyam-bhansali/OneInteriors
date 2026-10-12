import type { Metadata } from 'next';
import '../clients.css';
import { myCaptureForm } from '@/modules/studio-practice/capture';
import { Import } from './Import';
import { CaptureLink } from './CaptureLink';
import { myFields } from '@/modules/studio-practice/fields';
import { myLeadSources } from '@/modules/studio-sales/settings';

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
export const dynamic = 'force-dynamic';

export default async function ImportPage() {
  /* Created on first read, like the stage seeder — no migration step, and no
     moment where a studio has an account but not the thing the screen is
     about. */
  const [form, fields, sources] = await Promise.all([myCaptureForm(), myFields(), myLeadSources()]);

  return (
    <main className="content cl-page" style={{ maxWidth: 1100 }}>
      <div className="phead">
        <div>
          <h1>Import a CSV</h1>
          <p className="muted">From a spreadsheet saved as CSV. Nothing is saved until you have seen what it will do.</p>
        </div>
      </div>
      {form ? <CaptureLink slug={form.slug} active={form.active} /> : null}
      <Import fields={fields.map((f) => ({ key: f.key, label: f.label }))} sources={sources.map((o) => ({ id: o.id, name: o.name }))} />
    </main>
  );
}
