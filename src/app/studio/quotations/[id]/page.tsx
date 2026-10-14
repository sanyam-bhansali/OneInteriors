import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { getQuote, STAGE_LABELS, STATUS_LABELS } from '@/modules/studio-quote/quotes';
import { myProducts, myBranding, myTier } from '@/modules/studio-quote/store';
import { showsOurMark, MARK_TEXT } from '@/modules/studio-quote/mark';
import { signedQuoteLogoUrl } from '@/modules/storage/studio-logo';
import { quotingStudioId } from '@/modules/studio/lead-scope';
import { QuoteBuilder } from './QuoteBuilder';
import { StatusBar } from './StatusBar';
import { currentMember } from '@/modules/studio/access';
import { projectForQuote } from '@/modules/project/own-project';
import { quoteSalesView } from '@/modules/studio-sales/revisions';
import { can } from '@/modules/studio/roles';
import { Revisions } from './Revisions';
/* The client's digital sign-off (15 Oct 2026): "Signed by … on …" per revision. */
import { signaturesOfQuote } from '@/modules/project/signoffs';
import { planReaderFor } from '@/modules/studio-quote/from-plan';
import { quoteDocContext } from '@/modules/studio-quote/document-data';
import { LineIcon } from '../../ui/icons';
import '../quotes.css';

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
  const [logoUrl, project, sales, planReader, docCtx] = await Promise.all([
    /* The studio's logo for anyone who may quote for it, sales included (owner, 13 Oct 2026). */
    quotingStudioId().then((sid) => signedQuoteLogoUrl(branding?.logoPath ?? null, sid)),
    // A project running on this quotation, or whether one can start from it (own client, sent or won).
    projectForQuote(member, quote.id),
    // Revisions sent and the sales final (Studio OS Phase 1).
    quoteSalesView(quote.id),
    // Floor plan → first quotation: "Read rooms" on this draft (12 Oct 2026).
    planReaderFor(quote.clientId),
    // The PDF preview tab: brand pages, payment stages, material specification, terms (13 Oct 2026).
    quoteDocContext(quote),
  ]);
  const signatures = await quotingStudioId()
    .then((sid) => (sid ? signaturesOfQuote(quote.id, sid) : new Map<number, string>()))
    .catch(() => new Map<number, string>());
  /* Owner and PM may add a typed line to the product list; a salesperson asks. */
  const mayAddProducts = member !== null && (member.role === 'OWNER' || member.role === 'PM');
  const mayBook = member !== null && can(member, 'booking.record');

  const TONE = { DRAFT: '', ISSUED: 'warn', ACCEPTED: 'good', DECLINED: 'bad' } as const;

  /* Booked: a live project runs on it, and the server refuses writes (write-rules.ts). */
  const locked = Boolean(sales?.projectId ?? project.projectId);
  const lastRev = sales?.revisions[sales.revisions.length - 1] ?? null;
  /* The printable Original vs Final: the Sales Final for a Design Final, else the last two revisions sent. */
  const finalHref = quote.basedOnId
    ? `/studio/quotations/${quote.id}/compare`
    : sales && sales.revisions.length >= 2
      ? `/studio/quotations/${quote.id}/compare?a=${sales.revisions[sales.revisions.length - 2]!.n}&b=${lastRev!.n}`
      : null;

  return (
    <main className="hpage qpage">
      {/* The quotation's own strip: back to the list, the number and the
          client, where it is, and what can happen to it next. */}
      <div className="phead hphead">
        <div style={{ minWidth: 0 }}>
          <Link href="/studio/quotations" className="sm muted qback">
            <LineIcon name="back" size={15} />
            Quotations
          </Link>
          <h1 style={{ marginTop: 4 }}>
            <span className="mono" style={{ letterSpacing: '-.02em' }}>
              {quote.number}
            </span>{' '}
            · {quote.clientName}
          </h1>
          <div className="hstack muted sm qmeta">
            <span className={`chip ${TONE[quote.status]}`}>
              <span className="dot" />
              {STATUS_LABELS[quote.status]}
            </span>
            <span className="chip">{STAGE_LABELS[quote.stage]}</span>
            {quote.fromMarketplace ? <span className="chip oi">One Interiors</span> : null}
            {quote.issuedOn ? (
              <span>
                Sent{' '}
                {quote.issuedOn.toLocaleDateString('en-IN', {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                })}
              </span>
            ) : null}
          </div>
        </div>
        <StatusBar
          quoteId={quote.id}
          status={quote.status}
          canPrint={quote.lines.length > 0}
          stage={quote.stage}
          basedOnId={quote.basedOnId}
          deletable={quote.status === 'DRAFT' && !quote.issuedOn && !quote.fromMarketplace}
          clientFirstName={quote.clientName.split(/\s+/)[0] ?? ''}
        />
      </div>

      {project.projectId ? (
        <div className="qnote good hnoteline">
          <p>A project is running on this quotation.</p>
          <Link href={`/studio/projects/${project.projectId}`} className="btn sec sm">
            Open the project
          </Link>
        </div>
      ) : project.canStart && !quote.clientId ? (
        // A quotation on a lead is booked from its sales final (Record booking), so only unlinked ones keep the older "Start project".
        <div className="qnote hnoteline">
          <p>Has {quote.clientName.split(/\s+/)[0]} accepted this quotation? Start the project from it.</p>
          <Link href={`/studio/projects/start?quote=${quote.id}`} className="btn acc sm">
            Start project
          </Link>
        </div>
      ) : null}
      {!branding ? (
        <div className="qnote warn hnoteline">
          <p>
            <Link href="/studio/settings" className="acc-t" style={{ fontWeight: 600 }}>
              Add your studio details
            </Link>{' '}
            before you send this — the document needs your registered name on it.
          </p>
        </div>
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
          locked={locked}
          sentLabel={lastRev ? lastRev.label : null}
          finalHref={finalHref}
          doc={{
            studio: docCtx.studio,
            brandPages: docCtx.brandPages,
            schedule: docCtx.schedule,
            spec: docCtx.spec,
            terms: docCtx.terms,
            validDays: docCtx.validDays,
          }}
          extras={
            /* Keyed on the revision count so the compare and sales-final pickers start on the newest revision after a send. */
            sales ? (
              <>
                {signatures.size > 0 ? (
                  <section className="card" data-testid="quote-signatures" style={{ padding: 16 }}>
                    <b>Client sign-off</b>
                    <ul className="m-0 mt-2 flex list-none flex-col gap-1 p-0">
                      {[...signatures.entries()]
                        .sort((a, b) => b[0] - a[0])
                        .map(([n, line]) => (
                          <li key={n} className="good-t sm">
                            R{n}: {line}
                          </li>
                        ))}
                    </ul>
                    {lastRev && !signatures.has(lastRev.n) ? <p className="m-0 mt-1 muted sm">R{lastRev.n}, sent after, is not signed yet. Ask for a new sign-off from the project.</p> : null}
                  </section>
                ) : null}
                <Revisions key={sales.revisions.length} view={sales} leadHref={quote.clientId ? `/studio/clients/${quote.clientId}` : null} mayBook={mayBook} />
              </>
            ) : null
          }
        />
    </main>
  );
}
