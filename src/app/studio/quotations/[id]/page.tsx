import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { PageHead, PageBody } from '../../StudioShell';
import { getQuote, STAGE_LABELS, STATUS_LABELS } from '@/modules/studio-quote/quotes';
import { myProducts, myBranding, myTier } from '@/modules/studio-quote/store';
import { showsOurMark, MARK_TEXT } from '@/modules/studio-quote/mark';
import { signedLogoUrl } from '@/modules/storage/studio-logo';
import { QuoteBuilder } from './QuoteBuilder';
import { StatusBar } from './StatusBar';
import { currentMember } from '@/modules/studio/access';
import { projectForQuote } from '@/modules/project/own-project';
import { quoteSalesView } from '@/modules/studio-sales/revisions';
import { can } from '@/modules/studio/roles';
import { Revisions } from './Revisions';
import { planReaderFor } from '@/modules/studio-quote/from-plan';

export const metadata: Metadata = {
  title: 'Quotation',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

/**
 * The builder.
 *
 * Almost everything below the heading is one client component, and that is
 * the shape of the rewrite: the lines, the total, the room breakdown and the
 * document preview are all derived from a single piece of state that moves as
 * a designer types. A server component cannot do that without a round trip per
 * keystroke, and the round trip is what made the old builder feel like filing
 * a form rather than pricing a job.
 *
 * What stays on the server is what should: the query, the branding, the tier
 * that decides our mark, and the signed logo link.
 */
export default async function QuotePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const [quote, products, branding, tier] = await Promise.all([
    getQuote(id),
    myProducts(),
    myBranding(),
    myTier(),
  ]);

  if (!quote) notFound();

  const member = await currentMember();
  const [logoUrl, project, sales, planReader] = await Promise.all([
    signedLogoUrl(branding?.logoPath ?? null),
    // A project running on this quotation, or whether one can start from it (own client, sent or won).
    projectForQuote(member, quote.id),
    // Revisions sent and the sales final (Studio OS Phase 1).
    quoteSalesView(quote.id),
    // Floor plan → first quotation: "Read rooms" on this draft (12 Oct 2026).
    planReaderFor(quote.clientId),
  ]);
  /* Owner and PM may add a typed line to the product list; a salesperson asks. */
  const mayAddProducts = member !== null && (member.role === 'OWNER' || member.role === 'PM');
  const mayBook = member !== null && can(member, 'booking.record');

  return (
    <>
      <PageHead
        title={quote.clientName}
        sub={
          <span className="flex flex-wrap items-center gap-2">
            <span className="s-num">{quote.number}</span>
            {quote.clientId ? (
              <Link href={`/studio/clients/${quote.clientId}`} className="text-[var(--s-accent)]">
                · open the lead
              </Link>
            ) : null}
            {quote.config ? <span>· {quote.config}</span> : null}
            {quote.society ? <span>· {quote.society}</span> : null}
            <span className="text-[var(--s-ink-3)]">· {STATUS_LABELS[quote.status]}</span>
            <span className="s-tag">{STAGE_LABELS[quote.stage]}</span>
            {quote.issuedOn ? (
              <span className="text-[var(--s-ink-3)]">
                · sent{' '}
                {quote.issuedOn.toLocaleDateString('en-IN', {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                })}
              </span>
            ) : null}
            {quote.fromMarketplace ? (
              <span className="s-tag !bg-[var(--s-accent-wash)] !text-[var(--s-accent-deep)]">
                One Interiors
              </span>
            ) : null}
          </span>
        }
        action={
          <StatusBar
            quoteId={quote.id}
            status={quote.status}
            canPrint={quote.lines.length > 0}
            stage={quote.stage}
            basedOnId={quote.basedOnId}
            deletable={quote.status === 'DRAFT' && !quote.issuedOn && !quote.fromMarketplace}
          />
        }
      />

      <PageBody>
        {/* Keyed on the revision count so the compare and sales-final pickers start on the newest revision after a send. */}
        {sales ? <Revisions key={sales.revisions.length} view={sales} leadHref={quote.clientId ? `/studio/clients/${quote.clientId}` : null} mayBook={mayBook} /> : null}
        {project.projectId ? (
          <p className="s-card mb-4 border-l-[3px] !border-l-[var(--s-good)] px-4 py-3 text-[13.5px] leading-relaxed">
            A project is running on this quotation.{' '}
            <Link href={`/studio/projects/${project.projectId}`} className="font-medium text-[var(--s-accent)]">
              Open the project
            </Link>
          </p>
        ) : project.canStart && !quote.clientId ? (
          // A quotation on a lead is booked from its sales final (Record booking), so only unlinked ones keep the older "Start project".
          <p className="s-card mb-4 flex flex-wrap items-center gap-3 border-l-[3px] !border-l-[var(--s-accent)] px-4 py-3 text-[13.5px] leading-relaxed">
            <span>Has {quote.clientName.split(/\s+/)[0]} accepted this quotation? Start the project from it.</span>
            <Link
              href={`/studio/projects/start?quote=${quote.id}`}
              className="rounded-[8px] bg-[var(--s-accent)] px-3.5 py-1.5 text-[13.5px] font-medium text-white no-underline hover:bg-[var(--s-accent-deep)]"
            >
              Start project
            </Link>
          </p>
        ) : null}
        {!branding ? (
          <p className="s-card mb-4 border-l-[3px] !border-l-[var(--s-accent)] px-4 py-3 text-[13.5px] leading-relaxed">
            <Link href="/studio/settings" className="font-medium text-[var(--s-accent)]">
              Add your studio details
            </Link>{' '}
            before you send this — the document needs your registered name on it.
          </p>
        ) : null}

        <QuoteBuilder
          quote={quote}
          products={products}
          branding={
            branding
              ? {
                  legalName: branding.legalName,
                  addressLine: branding.addressLine,
                  city: branding.city,
                  pincode: branding.pincode,
                  gstin: branding.gstin,
                  phone: branding.phone,
                  email: branding.email,
                  accentHex: branding.accentHex,
                }
              : null
          }
          /* Their wish and their entitlement, resolved on the server. The
             browser is told whether the line prints, never what tier they are
             on — see modules/studio-quote/mark.ts. */
          showMark={showsOurMark({ tier, hideRequested: branding?.hideOurMark ?? false })}
          markText={MARK_TEXT}
          logoUrl={logoUrl}
          planReader={planReader}
          mayAddProducts={mayAddProducts}
        />
      </PageBody>
    </>
  );
}
