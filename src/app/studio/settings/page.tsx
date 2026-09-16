import type { Metadata } from 'next';
import { PageBody } from '../StudioShell';
import { myBranding } from '@/modules/studio-quote/store';
import { BrandingForm } from './BrandingForm';

export const metadata: Metadata = {
  title: 'Settings',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

/**
 * What makes the quotation builder theirs rather than ours with their name
 * typed in.
 *
 * The Hauspire quotation app this module is descended from is single-tenant in
 * four separate places that all print: the opening letter names Hauspire, the
 * terms commit "Hauspire Private Limited" to a delay penalty, the PDF filename
 * generator hardcodes the string, and the cover artwork ships in the repo.
 * Handing that to another studio would put a rival's name and a rival's legal
 * commitments on their client's quotation.
 *
 * So every one of those is a field here, and the two copy fields start empty on
 * purpose. A default opening paragraph would be our words going out over their
 * signature, and a default set of terms would be us committing them to promises
 * they have not read.
 */
export default async function SettingsPage() {
  const branding = await myBranding();

  return (
    <>
      <PageBody>
        {!branding ? (
          <div className="s-card mb-6 border-l-[3px] !border-l-[var(--s-accent)] p-5">
            <p className="m-0 mb-2 text-[14.5px] font-semibold">
              Your quotations go out under your name, not ours.
            </p>
            <p className="m-0 max-w-[68ch] text-[14px] leading-relaxed text-[var(--s-ink-2)]">
              Nothing below is filled in yet, and nothing has a default we invented. A quotation
              with a client&rsquo;s name on it is a document you are answerable for, so the words
              on it should be yours — including the ones you would rather leave off.
            </p>
          </div>
        ) : null}

        <BrandingForm branding={branding} />
      </PageBody>
    </>
  );
}
