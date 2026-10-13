import type { Metadata } from 'next';
import { currentMember } from '@/modules/studio/access';
import { myBranding, myStudioProfile, TERMS_MAX } from '@/modules/studio-quote/store';
import { TermsEditor } from './TermsEditor';
import '../quotes.css';
import './terms.css';

export const metadata: Metadata = {
  title: 'Terms',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

/**
 * Quotations → Terms, as Hauspire's /terms (owner, 13 Oct 2026): the studio's
 * default terms and conditions, edited in one place. It is the field Settings
 * kept (`StudioBranding.terms`) — not a second copy — and every new quotation
 * copies it; the PDF prints it on its own pages under the studio's name.
 *
 * Owner and project manager only (the branding right, `myStudioId`): a
 * salesperson cannot open this page (surfaces.ts) and the save refuses
 * anyone else.
 */
export default async function TermsPage() {
  const member = await currentMember();
  const mayEdit = member !== null && member.status === 'ACTIVE' && (member.role === 'OWNER' || member.role === 'PM');
  const [branding, profile] = mayEdit ? await Promise.all([myBranding(), myStudioProfile()]) : [null, null];

  return (
    <main className="content qpage qterms">
      <div className="phead">
        <div>
          <span className="eyebrow">Quotations</span>
          <h1>Terms &amp; Conditions</h1>
          <p className="muted qsub">
            Printed as the last pages of every quotation PDF. Every new quotation starts with these; one already made keeps the terms it was
            made with.
          </p>
        </div>
      </div>

      {!mayEdit ? (
        <div className="empty">
          <b>Only the studio owner or a project manager changes the terms.</b>
        </div>
      ) : !branding ? (
        <div className="empty">
          <b>Finish your studio details first.</b>
          <span className="muted sm">The terms go on your documents with your registered name, so the details come first.</span>
        </div>
      ) : (
        <TermsEditor
          initial={branding.terms ?? ''}
          studioName={profile?.tradeName || branding.legalName}
          accentHex={branding.accentHex}
          maxLength={TERMS_MAX}
        />
      )}
    </main>
  );
}
