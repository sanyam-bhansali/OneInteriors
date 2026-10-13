import type { Metadata } from 'next';
import { myBranding, myTier } from '@/modules/studio-quote/store';
import { logoUploadEnabled, signedLogoUrl } from '@/modules/storage/studio-logo';
import { BrandingForm } from './BrandingForm';
import { LogoAndMark } from './LogoAndMark';
import { BrandPages } from './BrandPages';
import { WarrantyForm } from './WarrantyForm';
import { myWarranty } from '@/modules/studio/warranty';

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

  /* In parallel: neither depends on the other, and the signed URL is a round
     trip to storage that should not sit behind a subscription lookup. */
  const [logoUrl, tier, warranty, brandPageUrls] = await Promise.all([
    signedLogoUrl(branding?.logoPath ?? null),
    myTier(),
    myWarranty().catch(() => null),
    Promise.all((branding?.brandPages ?? []).map((p) => signedLogoUrl(p))),
  ]);

  return (
    <>
      <>
        {!branding ? (
          <div className="card mb-6 border-l-[3px] !border-l-[var(--s-accent)] p-5">
            <p className="m-0 mb-2 text-[14.5px] font-semibold">
              Your quotations go out under your name, not ours.
            </p>
            <p className="m-0 max-w-[68ch] text-[14px] leading-relaxed muted">
              Nothing below is filled in yet, and nothing has a default we invented. A quotation
              with a client&rsquo;s name on it is a document you are answerable for, so the words
              on it should be yours — including the ones you would rather leave off.
            </p>
          </div>
        ) : null}

        <BrandingForm branding={branding} />

        {/* Below the form, because both of these hang off the branding row the
            form creates — and because a file picker at the top of a page of
            text fields is the thing everybody tries first and cannot use. */}
        <div className="mt-6">
          <LogoAndMark
            logoUrl={logoUrl}
            hasBranding={branding !== null}
            uploadEnabled={logoUploadEnabled()}
            tier={tier}
            hideRequested={branding?.hideOurMark ?? false}
          />
        </div>
        {/* The quotation PDF's opening pages (owner, 13 Oct 2026). */}
        <div className="mt-6 max-w-[52rem]">
          <BrandPages pages={brandPageUrls.map((url) => ({ url }))} hasBranding={branding !== null} uploadEnabled={logoUploadEnabled()} />
        </div>
        {/* The project lifecycle (owner, 13 Oct 2026): months of warranty after the client signs off the handover. */}
        {warranty ? <WarrantyForm months={warranty.months} canEdit={warranty.canEdit} /> : null}
      </>
    </>
  );
}
