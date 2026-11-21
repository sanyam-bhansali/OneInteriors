import type { Metadata } from 'next';
import { myInvoiceSettings } from '@/modules/project/invoice-settings';
import { logoUploadEnabled } from '@/modules/storage/studio-logo';
import { InvoiceSettingsForm, SignImage } from './InvoiceSettingsForm';

export const metadata: Metadata = {
  title: 'Invoices',
  robots: { index: false, follow: false },
};
export const dynamic = 'force-dynamic';

/**
 * Settings → Invoices (owner, 21 Nov 2026): what the payment-stage invoices
 * and the statement print besides Your details (legal name, address, GSTIN,
 * logo): who signs, the signature and stamp, the invoice prefix, the SAC
 * code, and bank details (printed only when filled). The owner's alone.
 */
export default async function InvoiceSettingsPage() {
  const s = await myInvoiceSettings();
  if (!s) return <p className="muted">Only the studio owner sets up invoices.</p>;
  const upload = logoUploadEnabled();
  return (
    <div className="flex max-w-[52rem] flex-col gap-6">
      <p className="m-0 max-w-[68ch] text-[14px] leading-relaxed muted">
        Each payment stage on a project&rsquo;s Payments tab has an Invoice, and the project has a Statement. Both print your legal name, address, GSTIN
        and logo from Your details, and what you set here.
      </p>
      {!s.hasBranding ? (
        <p className="m-0 rounded-[10px] bg-[var(--s-surface-2)] px-4 py-3 text-[13.5px] muted">Fill in Your details and save them first: invoices go out under your registered name.</p>
      ) : (
        <>
          <InvoiceSettingsForm settings={s} />
          <section className="card" data-testid="sign-images">
            <h2 className="m-0 mb-1 text-[16px] font-semibold">Signature and stamp</h2>
            <p className="m-0 mb-4 max-w-[62ch] text-[13.5px] leading-relaxed muted">
              Printed above the signatory&rsquo;s name on invoices and the statement. PNG or JPG, up to 2 MB; a PNG with a clear background looks best. Shown
              only on those pages, never as a public link.
            </p>
            {upload ? (
              <div className="grid gap-5 sm:grid-cols-2">
                <SignImage kind="signature" url={s.signatureUrl} />
                <SignImage kind="stamp" url={s.stampUrl} />
              </div>
            ) : (
              <p className="m-0 text-[13.5px] muted">Uploading is not switched on here yet.</p>
            )}
          </section>
        </>
      )}
    </div>
  );
}
