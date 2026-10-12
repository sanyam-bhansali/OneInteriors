import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import '../clients.css';
import { timelineFor } from '@/modules/studio-practice/events';
import { marketplaceContextFor } from '@/modules/studio-practice/marketplace-context';
import { duplicatesOf } from '@/modules/studio-practice/merge';
import { introStateForClient } from '@/modules/studio/introduction';
import { currentMember } from '@/modules/studio/access';
import { can } from '@/modules/studio/roles';
import { leadPage } from '@/modules/studio-sales/leads';
import { bookingDraft } from '@/modules/studio-sales/booking';
import { telLink, whatsappLink } from '@/modules/studio-sales/lead-rules';
import { myStages } from '@/modules/studio-practice/stages';
import { myFields } from '@/modules/studio-practice/fields';
import { SOURCE_LABELS } from '@/modules/studio-practice/vocabulary';
import { leadTags, studioTags } from '@/modules/studio-sales/lead-extras';
import { taskPeople, tasksForLead } from '@/modules/studio-sales/tasks';
import { Timeline } from './Timeline';
import { BriefPanel } from './BriefPanel';
import { Duplicates } from './Duplicates';
import { LogContact } from './LogContact';
import { FinalQuote } from './FinalQuote';
import { IntroAnswer } from './IntroAnswer';
import { AssignBox, BookingBox, Details, FilesBox, MeetingBox, NextStepButton, QuotesBox } from './SalesPanels';
import { LeadTasks } from './LeadTasks';
import { NextCall } from './NextCall';
import { Attribution, FollowUpPanel, LeadHeader, LeadTabs, NotesPanel, TagsPanel } from './AxLead';
import { CustomFieldsPanel } from './CustomFieldsPanel';

export const metadata: Metadata = {
  title: 'Lead',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

/**
 * One lead, laid out as AxLeads' lead page is (12 Oct 2026), around the
 * Studio OS Phase 1 sales flow.
 *
 * The header: the source chip and tags; WhatsApp (opens the person's own
 * WhatsApp — we send nothing), Log call, Note, Tag, + Action (schedule a
 * call, send a quotation, schedule a site visit); the name and phone; the
 * stage dropdown and the owner; Converted (the booking, when a sales final
 * waits for it) and delete (owner and PM).
 *
 * Left: tabs — the Timeline (with the call log), Floor plan & quotations
 * (files, quotations with their revisions and sales final, the booking:
 * Phase 1's panels, unchanged), Tasks — then the internal notes. Right: the
 * lead's details and the studio's own fields, the follow-up, tags,
 * attribution, the meeting, who has it.
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

  const [events, brief, dupes, intro, draft, tasks, taskWho, stages, fields, tags, vocab] = await Promise.all([
    timelineFor(id),
    client.fromMarketplace ? marketplaceContextFor(id) : Promise.resolve(null),
    seesAll ? duplicatesOf(id) : Promise.resolve([]),
    client.fromMarketplace ? introStateForClient(id) : Promise.resolve(null),
    page.bookableQuoteId && page.may.book ? bookingDraft(member, page.bookableQuoteId) : Promise.resolve(null),
    tasksForLead(id),
    taskPeople(),
    myStages(),
    myFields(),
    leadTags(id),
    studioTags(),
  ]);

  const tel = telLink(client.phone);
  const fromOneInteriors = client.source === 'ONE_INTERIORS' || client.fromMarketplace;
  const seesProject = member !== null && can(member, 'project.read', { assigned: true });
  const sourceText = client.leadSourceName ?? SOURCE_LABELS[client.source];
  const sourceKey = client.leadSourceId ? 'OTHER' : client.source;
  const notes = events.filter((e) => e.kind === 'NOTE').map((e) => ({ id: e.id, text: e.summary, by: e.byName, byId: e.byId ?? null, at: e.createdAt }));
  const mayDelete = member !== null && can(member, 'lead.delete') && !client.isDemo;
  const mayWork = page.may.edit && !client.isDemo;
  const openTasks = tasks.filter((t) => !t.doneAt).length;

  /* The journey strip (the design's .jour): the studio's own columns in order, lost ones aside. */
  const open = stages.filter((s) => s.kind !== 'LOST');
  const here = open.findIndex((s) => s.id === client.stageId);
  /* A studio may have twenty columns; the strip shows the milestones around
     this client: the first, the one before, this one, the next, and won. */
  const won = open.findIndex((s) => s.kind === 'WON');
  const picks = open.length <= 6 ? open.map((_, i) => i) : [...new Set([0, here - 1, here, here + 1, won].filter((i) => i >= 0 && i < open.length))].sort((a, b) => a - b);
  const journey = picks.map((i) => open[i]!);
  const at = picks.indexOf(here);

  return (
    <main className="content cl-page" style={{ maxWidth: 1440 }}>
      <LeadHeader
        lead={{
          id: client.id,
          name: client.name,
          phone: client.phone,
          email: client.email,
          society: client.society,
          locality: client.locality,
          city: null,
          source: sourceKey,
          sourceLabel: sourceText,
          stageId: client.stageId,
          stageName: client.stageName,
          stageColour: client.stageColour,
          ownerName: client.assignedToName,
          tags,
          booked: client.bookedIntroductionId !== null,
        }}
        tel={tel}
        whatsapp={whatsappLink(client.phone)}
        stages={stages.map((s) => ({ id: s.id, name: s.name, colour: s.colour, kind: s.kind }))}
        may={{ edit: mayWork, quote: page.may.quote, delete: mayDelete }}
        canBook={page.may.book && page.bookableQuoteId !== null}
      />
      {client.isDemo ? <p className="cl-sub">This is the sample lead. Try anything on it; it is never counted.</p> : null}

      {journey.length > 1 ? (
        <section className="card" aria-label="Where this client is">
          <div className="jour" style={{ gridTemplateColumns: `repeat(${Math.min(journey.length, 8)}, minmax(0, 1fr))` }}>
            {journey.map((s, i) => (
              <div key={s.id} className={at >= 0 && i < at ? 'done' : i === at ? 'on' : ''}>
                <i />
                <span>{s.name}</span>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <div className="cols">
        <div className="colmain">
          {/* The next call, and Phase 1's next step one tap away. */}
          <NextCall leadId={client.id} action={client.nextAction} on={client.nextActionOn} may={mayWork}>
            <div className="hstack">
              <NextStepButton
                step={page.next}
                clientId={client.id}
                phone={tel}
                quoteId={page.nextQuoteId}
                projectId={seesProject ? (page.booking?.projectId ?? null) : null}
                mayBook={page.may.book}
              />
              <span className="muted sm">{[page.budgetText, page.meetingText].filter(Boolean).join(' · ')}</span>
            </div>
          </NextCall>

          {dupes.length > 0 ? <Duplicates clientId={client.id} clientName={client.name} candidates={dupes} /> : null}
          {intro ? <IntroAnswer state={intro} /> : null}
          {brief ? <BriefPanel ctx={brief} /> : null}
          {client.fromMarketplace && page.may.quote ? <FinalQuote clientId={client.id} /> : null}

          <LeadTabs
            tabs={[
              {
                key: 'timeline',
                label: 'Timeline',
                content: (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                    {page.may.edit ? (
                      <div id="contact" style={{ scrollMarginTop: 80 }}>
                        <LogContact clientId={client.id} lastContactedAt={client.lastContactedAt} />
                      </div>
                    ) : null}
                    <section className="card">
                      <h2 className="h">What happened</h2>
                      <Timeline rows={events} />
                    </section>
                  </div>
                ),
              },
              {
                key: 'sales',
                label: 'Floor plan & quotations',
                content: (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                    <FilesBox clientId={client.id} files={page.files} may={page.may.edit} mayReadRooms={page.may.readRooms} />
                    <QuotesBox clientId={client.id} quotes={page.quotes} mayQuote={page.may.quote} fromOneInteriors={fromOneInteriors} />
                    <BookingBox clientId={client.id} booking={page.booking} draft={draft} mayRefund={page.may.refund} isOwner={member?.role === 'OWNER'} seesProject={seesProject} />
                  </div>
                ),
              },
              {
                key: 'tasks',
                label: openTasks ? `Tasks (${openTasks})` : 'Tasks',
                content: <LeadTasks leadId={client.id} tasks={tasks} people={taskWho} seesAll={seesAll} meId={member?.id ?? null} may={page.may.edit} />,
              },
            ]}
          />

          <NotesPanel leadId={client.id} notes={notes} meId={member?.id ?? null} seesAll={seesAll} may={mayWork} />
        </div>

        <aside className="colside" style={{ flexBasis: 340 }}>
          <Details
            clientId={client.id}
            may={mayWork}
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
          <CustomFieldsPanel
            leadId={client.id}
            fields={fields.map((f) => ({ key: f.key, label: f.label, type: f.type, options: f.options }))}
            values={Object.fromEntries(Object.entries(client.fields).map(([k, v]) => [k, String(v ?? '')]))}
            may={mayWork}
          />
          <FollowUpPanel leadId={client.id} action={client.nextAction} on={client.nextActionOn} createdAt={client.createdAt} may={mayWork} />
          <TagsPanel leadId={client.id} tags={tags} vocab={vocab} may={mayWork} />
          <Attribution source={sourceKey} sourceLabel={sourceText} note={client.sourceNote} />
          <div id="meeting" style={{ scrollMarginTop: 80 }}>
            <MeetingBox clientId={client.id} at={client.meetingAt ? client.meetingAt.toISOString() : null} note={client.meetingNote} may={page.may.edit} />
          </div>
          {page.may.assign && page.members.length > 0 ? <AssignBox clientId={client.id} assignedToId={client.assignedToId} members={page.members} /> : null}
          {client.notes ? (
            <section className="card">
              <h2 className="h">Notes from when it came in</h2>
              <p style={{ margin: 0, whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>{client.notes}</p>
            </section>
          ) : null}
        </aside>
      </div>
    </main>
  );
}
