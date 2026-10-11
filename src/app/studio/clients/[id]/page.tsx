import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { PageHead, PageBody } from '../../StudioShell';
import { timelineFor } from '@/modules/studio-practice/events';
import { marketplaceContextFor } from '@/modules/studio-practice/marketplace-context';
import { duplicatesOf } from '@/modules/studio-practice/merge';
import { introStateForClient } from '@/modules/studio/introduction';
import { currentMember } from '@/modules/studio/access';
import { can } from '@/modules/studio/roles';
import { leadPage } from '@/modules/studio-sales/leads';
import { bookingDraft } from '@/modules/studio-sales/booking';
import { telLink, whatsappLink } from '@/modules/studio-sales/lead-rules';
import { Timeline } from './Timeline';
import { BriefPanel } from './BriefPanel';
import { Duplicates } from './Duplicates';
import { LogContact } from './LogContact';
import { FinalQuote } from './FinalQuote';
import { IntroAnswer } from './IntroAnswer';
import { AssignBox, BookingBox, ContactBar, Details, FilesBox, MeetingBox, NextStepButton, NoteBox, QuotesBox } from './SalesPanels';

export const metadata: Metadata = {
  title: 'Lead',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

/**
 * One lead, and everything that has happened to it — the place the
 * salesperson lives (Studio OS Phase 1, docs/studio-os/PHASE-1-SALES.md §2).
 *
 * The header says who it is, how to reach them (tap to call; "Open
 * WhatsApp" opens the salesperson's own WhatsApp — we send nothing) and the
 * one next step. Below: the call log and a note, the floor plan and files,
 * the quotations with their revisions and sales final, the booking, and the
 * history. The facts and the meeting sit beside it.
 *
 * Opens for anyone who may see this lead: owner and PM, any lead; a
 * salesperson, their own (studio/lead-scope.ts). Anyone else gets a 404.
 */
export default async function ClientPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const page = await leadPage(id);
  if (!page) notFound();
  const { client } = page;
  const member = await currentMember();
  const seesAll = page.may.assign;

  const [events, brief, dupes, intro, draft] = await Promise.all([
    timelineFor(id),
    client.fromMarketplace ? marketplaceContextFor(id) : Promise.resolve(null),
    seesAll ? duplicatesOf(id) : Promise.resolve([]),
    client.fromMarketplace ? introStateForClient(id) : Promise.resolve(null),
    page.bookableQuoteId && page.may.book ? bookingDraft(member, page.bookableQuoteId) : Promise.resolve(null),
  ]);

  const tel = telLink(client.phone);
  const fromOneInteriors = client.source === 'ONE_INTERIORS' || client.fromMarketplace;
  const seesProject = member !== null && can(member, 'project.read', { assigned: true });

  return (
    <>
      <PageHead
        title={client.name}
        sub={
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="rounded-full px-2 py-px text-[12px] font-medium" style={{ background: 'var(--s-rail-active)' }}>
              {client.stageName}
            </span>
            {client.isDemo ? <span className="s-tag s-tag-demo">Sample</span> : null}
            {client.phone ? <span className="s-num">{client.phone}</span> : <span>No phone yet</span>}
          </span>
        }
        action={
          <div className="flex flex-wrap items-center gap-2">
            <Link href="/studio/clients" className="s-btn-ghost no-underline">
              Back to the board
            </Link>
            <NextStepButton
              step={page.next}
              clientId={client.id}
              phone={tel}
              quoteId={page.nextQuoteId}
              projectId={seesProject ? (page.booking?.projectId ?? null) : null}
              mayBook={page.may.book}
            />
          </div>
        }
      />

      <PageBody>
        <div className="mb-5">
          <ContactBar
            tel={tel}
            whatsapp={whatsappLink(client.phone)}
            budget={page.budgetText}
            meeting={page.meetingText}
            source={page.sourceText}
            owner={client.assignedToName}
          />
        </div>

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_300px]">
          <div className="order-2 flex min-w-0 flex-col gap-5 lg:order-1">
            {dupes.length > 0 ? <Duplicates clientId={client.id} clientName={client.name} candidates={dupes} /> : null}
            {intro ? <IntroAnswer state={intro} /> : null}
            {brief ? <BriefPanel ctx={brief} /> : null}
            {client.fromMarketplace && page.may.quote ? <FinalQuote clientId={client.id} /> : null}

            {page.may.edit ? (
              <div id="contact" className="scroll-mt-20">
                <LogContact clientId={client.id} lastContactedAt={client.lastContactedAt} />
              </div>
            ) : null}
            {page.may.edit ? <NoteBox clientId={client.id} /> : null}

            <FilesBox clientId={client.id} files={page.files} may={page.may.edit} mayReadRooms={page.may.readRooms} />
            <QuotesBox clientId={client.id} quotes={page.quotes} mayQuote={page.may.quote} fromOneInteriors={fromOneInteriors} />
            <BookingBox
              clientId={client.id}
              booking={page.booking}
              draft={draft}
              mayRefund={page.may.refund}
              isOwner={member?.role === 'OWNER'}
              seesProject={seesProject}
            />

            <div>
              <h2 className="m-0 mb-4 text-[15.5px] font-semibold">History</h2>
              <Timeline rows={events} />
            </div>
          </div>

          <aside className="order-1 flex flex-col gap-5 lg:order-2">
            <Details
              clientId={client.id}
              may={page.may.edit && !client.isDemo}
              fromOneInteriors={client.source === 'ONE_INTERIORS'}
              sources={page.sources}
              v={{
                name: client.name,
                phone: client.phone ?? '',
                email: client.email ?? '',
                society: client.society ?? '',
                config: client.config ?? '',
                budgetPaise: client.budgetPaise,
                source: client.source,
                leadSourceId: client.leadSourceId,
                carpetSqft: client.carpetSqft,
                locality: client.locality,
              }}
            />
            <MeetingBox clientId={client.id} at={client.meetingAt ? client.meetingAt.toISOString() : null} note={client.meetingNote} may={page.may.edit} />
            {page.may.assign && page.members.length > 0 ? <AssignBox clientId={client.id} assignedToId={client.assignedToId} members={page.members} /> : null}
            {client.notes ? (
              <section className="rounded-[12px] border border-[var(--s-rule)] px-4 py-3.5">
                <h2 className="s-label m-0 mb-2 text-[var(--s-ink-3)]">Notes from when it came in</h2>
                <p className="m-0 whitespace-pre-wrap text-[13.5px] leading-relaxed">{client.notes}</p>
              </section>
            ) : null}
          </aside>
        </div>
      </PageBody>
    </>
  );
}
