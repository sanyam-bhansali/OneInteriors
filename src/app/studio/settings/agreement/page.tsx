import type { Metadata } from 'next';
import { myAgreementTemplate } from '@/modules/agreement/store';
import { AGREEMENT_MAX, PLACEHOLDERS } from '@/modules/agreement/rules';
import { AgreementEditor } from './AgreementEditor';

export const metadata: Metadata = {
  title: 'Client agreement',
  robots: { index: false, follow: false },
};
export const dynamic = 'force-dynamic';

/**
 * Settings → Client agreement (owner, 21 Nov 2026; docs/studio-os/
 * CLIENT-AGREEMENT.md): the agreement the client e-signs at design closure,
 * written once, with {{placeholders}} filled for each client. Kept apart from
 * the quotation's terms. The owner edits; a project manager reads.
 */
export default async function AgreementSettingsPage() {
  const t = await myAgreementTemplate();
  return (
    <main className="content ox-page">
      <div className="phead">
        <div>
          <h1>Client agreement</h1>
          <p className="muted" style={{ maxWidth: '72ch' }}>
            Signed by the client with Aadhaar eSign at design closure, from the project&rsquo;s Design tab. Your side prints as signed by the
            person below. Not printed on quotations: those keep your Terms. An agreement already sent keeps the words it was sent with.
          </p>
        </div>
      </div>
      {!t ? (
        <p className="muted">Only the studio owner or a project manager opens the client agreement.</p>
      ) : (
        <AgreementEditor
          initial={t.text}
          signatory={t.signatory}
          signatoryRole={t.signatoryRole}
          canEdit={t.canEdit}
          maxLength={AGREEMENT_MAX}
          placeholders={Object.entries(PLACEHOLDERS).map(([key, help]) => ({ key, help }))}
        />
      )}
    </main>
  );
}
