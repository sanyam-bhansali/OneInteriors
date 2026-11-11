import type { Metadata } from 'next';
import Link from 'next/link';
import '../../clients.css';
import '../societies.css';
import { mySocietyAccess, societyPeople } from '@/modules/studio-practice/societies';
import { SocietyImport } from './SocietyImport';

export const metadata: Metadata = {
  title: 'Import a society sheet',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

/** A society sheet in (owner, 11 Nov 2026; Max plan). The file is read in the browser. */
export default async function SocietyImportPage() {
  const access = await mySocietyAccess();
  if (!access || !access.mayImport) {
    return (
      <main className="content cl-page">
        <div className="empty">
          <b>Importing society sheets needs the Max plan and the right to import leads.</b>
        </div>
      </main>
    );
  }
  const people = access.mayManage ? await societyPeople(access.scope.studioId) : [];
  return (
    <main className="content cl-page soc-page">
      <p style={{ margin: 0 }}>
        <Link href="/studio/clients/societies" className="linkbtn">
          ← All societies
        </Link>
      </p>
      <div className="phead">
        <div>
          <h1>Import a society sheet</h1>
          <p className="muted">An Excel (.xlsx) or CSV file. Nothing is saved until you have seen what it will do.</p>
        </div>
      </div>
      <SocietyImport people={people} me={access.scope.member.id} mayGive={access.mayManage} />
    </main>
  );
}
