/**
 * What each project event says, on a phone's lock screen and in the app's
 * list (docs/CUSTOMER-PLATFORM-PLAN.md, step 1). Pure, and tested.
 *
 * Short and factual: the studio's name, what happened, and where tapping
 * goes. No urgency words and no marketing: these interrupt someone's day.
 */

import { formatINR } from '@/lib/money';

export type ProjectEvent =
  | { kind: 'update'; studio: string; note: string; photos: number }
  | { kind: 'decision-posted'; decisionId: string; title: string; dueLabel: string }
  | { kind: 'decision-due'; decisionId: string; title: string; daysLeft: number }
  | { kind: 'decision-made'; decisionId: string; title: string; choice: string; extraPaise: number }
  | { kind: 'snag-raised'; snagId: string; title: string; room: string | null }
  | { kind: 'snag-fixed'; snagId: string; title: string }
  // Project lifecycle (owner, 13 Oct 2026): the client signed off the handover in the app; warranty starts.
  | { kind: 'handover-signed'; projectId: string; client: string; home: string; warrantyLabel: string }
  // Studio workspace Phase 2: a working day with no site update by 21:00 IST (to the office, and to ops on Assured).
  | { kind: 'site-missed'; projectId: string; home: string; studio: string; days: number; toOps: boolean }
  // Studio workspace Phase 4: the rest of a snag's life.
  | { kind: 'snag-accepted'; snagId: string; title: string; fixByLabel: string }
  | { kind: 'snag-disputed'; snagId: string; title: string }
  | { kind: 'snag-auto-closed'; snagId: string; title: string }
  | { kind: 'snag-not-fixed'; snagId: string; projectId: string; title: string; site?: boolean }
  | { kind: 'document'; studio: string; title: string }
  // Studio OS Phase 2: something of the design shared with the customer (a drawing to approve, the mood board, a site visit).
  | { kind: 'design'; studio: string; title: string }
  | { kind: 'payment-due'; stage: string; amountPaise: number; studio: string; dueLabel: string }
  | { kind: 'payment-recorded'; stage: string; amountPaise: number; studio: string }
  // Between the customer and the studio, before signing.
  | { kind: 'introduced'; clientId: string | null; home: string; contactReleased: boolean }
  | { kind: 'quote-sent'; quoteId: string; studio: string; number: string }
  | { kind: 'quote-signed'; quoteId: string; client: string; number: string; totalPaise: number }
  | { kind: 'intro-declined'; studio: string; reason: string }
  // To ops: GEIO passed a customer's question to the expert.
  | { kind: 'geio-handover'; customer: string; home: string | null; note: string }
  // To ops: a customer asked for the Assured plan (portal/plans.ts). Ops confirms the fee and switches it.
  | { kind: 'assured-requested'; customer: string; studio: string; atSigning: boolean }
  // Studio workspace Phase 5: the customer confirms a payment the studio recorded…
  | { kind: 'payment-to-confirm'; stage: string; amountPaise: number; studio: string }
  // …or says "I didn't pay this", which goes to our team (ops), not the studio.
  | { kind: 'payment-disputed'; customer: string; studio: string; stage: string; amountPaise: number; note: string | null }
  // To the studio: a decision passed its date with no pick (customer delay from here).
  | { kind: 'decision-expired'; decisionId: string; title: string; projectId: string }
  // Studio OS Phase 1: leads, to the studio's people (never to a customer)
  | { kind: 'lead-assigned'; clientId: string | null; count: number; name: string; by: string | null }
  | { kind: 'lead-new'; clientId: string; name: string; source: string; again: boolean; /** Who "New leads go to" gave it to (22 Oct 2026); absent or null: the pool. */ givenTo?: string | null }
  // Change orders and sign-offs (15 Oct 2026; project/change-orders.ts, project/signoffs.ts). To the customer once when sent (never WhatsApp); to the studio when answered.
  | { kind: 'extra-work'; studio: string; title: string; totalPaise: number }
  | { kind: 'extra-answered'; projectId: string; title: string; approved: boolean; totalPaise: number }
  | { kind: 'signoff-requested'; studio: string; what: string }
  | { kind: 'signoff-signed'; projectId: string; what: string; name: string }
  // Project documents (24 Oct 2026; DESIGN-PROCESS-PLAN.md §3.3), to the studio: the client approved a drawing, or asked for changes.
  | { kind: 'design-answered'; projectId: string; title: string; approved: boolean; comment: string | null }
  // My work (owner, 15 Oct 2026; studio/my-work-rules.ts), to studio staff only: the morning digest,
  // the evening "due tomorrow", and steps someone else completed today on their projects.
  | { kind: 'my-work'; today: number; missed: number; soon: number; first: string }
  | { kind: 'work-due-tomorrow'; count: number; list: string }
  | { kind: 'work-done'; count: number; list: string }
  // Quotation requests (owner, 22 Oct 2026; docs/studio-os/QUOTE-REQUESTS.md), to studio staff only, never a customer:
  // a request handed to a builder (in turn, or by a head), and the salesperson told when it was sent.
  | { kind: 'quote-request'; clientId: string; name: string; by: string | null; how: 'TURN' | 'REASSIGNED'; why: 'FLOOR_PLAN' | 'REQUESTED' }
  | { kind: 'quote-request-done'; clientId: string; name: string; by: string | null; number: string | null };

/** Events a studio also gets by email: it works from a laptop, not our app. */
export const EMAILED_TO_STUDIO: ProjectEvent['kind'][] = ['introduced', 'quote-signed', 'decision-made', 'snag-raised', 'lead-new', 'handover-signed'];

export interface Message {
  title: string;
  body: string;
  /** Where tapping opens, as an app path. */
  url: string;
  /** The template name stored on the Notification row. */
  template: string;
}

const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s);

export function messageFor(e: ProjectEvent): Message {
  switch (e.kind) {
    case 'update':
      return {
        template: 'project.update',
        title: `New from site · ${e.studio}`,
        body: clip(e.photos > 0 ? `${e.note} (${e.photos} photo${e.photos === 1 ? '' : 's'})` : e.note, 160),
        url: '/app/site',
      };
    case 'decision-posted':
      return {
        template: 'decision.posted',
        title: 'A decision for you',
        body: clip(`${e.title}. Due ${e.dueLabel}.`, 160),
        url: `/app/decision?id=${e.decisionId}`,
      };
    case 'decision-due':
      return {
        template: 'decision.due',
        title: e.daysLeft <= 0 ? 'Decision due today' : `Decision due in ${e.daysLeft} day${e.daysLeft === 1 ? '' : 's'}`,
        body: clip(e.title, 160),
        url: `/app/decision?id=${e.decisionId}`,
      };
    case 'decision-made':
      return {
        template: 'decision.made',
        title: 'The customer has chosen',
        body: clip(`${e.title}: ${e.choice}${e.extraPaise > 0 ? ` (+${formatINR(e.extraPaise)})` : ''}.`, 160),
        url: '/studio/updates',
      };
    case 'snag-raised':
      return {
        template: 'snag.raised',
        title: 'New snag raised',
        body: clip(e.room ? `${e.title} · ${e.room}` : e.title, 160),
        url: '/studio/updates',
      };
    case 'handover-signed':
      return {
        template: 'handover.signed',
        title: 'Handover signed off',
        body: clip(`${e.client} signed off ${e.home}. Warranty runs to ${e.warrantyLabel}.`, 160),
        url: `/studio/projects/${e.projectId}`,
      };
    case 'snag-fixed':
      return {
        template: 'snag.fixed',
        title: 'Snag fixed',
        body: clip(e.title, 160),
        url: `/app/snags`,
      };
    case 'snag-accepted':
      return {
        template: 'snag.accepted',
        title: `Snag accepted · fix by ${e.fixByLabel}`,
        body: clip(e.title, 160),
        url: '/app/snags',
      };
    case 'snag-disputed':
      return {
        template: 'snag.disputed',
        title: 'The studio replied about a snag',
        body: clip(`${e.title}. Read their reason in the app.`, 160),
        url: '/app/snags',
      };
    case 'snag-auto-closed':
      return {
        template: 'snag.auto-closed',
        title: 'Snag closed',
        body: clip(`${e.title}. Fixed seven days ago with no answer, so it is closed. Raise it again if it is not right.`, 160),
        url: '/app/snags',
      };
    case 'snag-not-fixed':
      return {
        template: 'snag.not-fixed',
        title: 'Not fixed, says the customer',
        body: clip(e.title, 160),
        url: e.site ? `/studio/site/snag/${e.snagId}` : `/studio/projects/${e.projectId}?tab=snags`,
      };
    case 'payment-due':
      return {
        template: 'payment.due',
        title: `Payment coming up · ${e.studio}`,
        body: clip(`${formatINR(e.amountPaise)} for ${e.stage}, due ${e.dueLabel}. You pay the studio directly.`, 160),
        url: '/app/project',
      };
    case 'payment-recorded':
      return {
        template: 'payment.recorded',
        title: `Payment received · ${e.studio}`,
        body: clip(`${formatINR(e.amountPaise)} for ${e.stage}, marked as received.`, 160),
        url: '/app/project',
      };
    case 'introduced':
      return {
        template: 'intro.new',
        title: 'A new client from One Interiors',
        body: clip(
          e.contactReleased
            ? `${e.home}. Their brief is on your board — accept and call them within a day.`
            : `${e.home}. Their contact details follow once they confirm.`,
          160,
        ),
        url: e.clientId ? `/studio/clients/${e.clientId}` : '/studio/clients',
      };
    case 'quote-sent':
      return {
        template: 'quote.sent',
        title: `Your final quote from ${e.studio}`,
        body: clip(`Quotation ${e.number} is ready to read, with what changed since your first quote.`, 160),
        url: `/app/choose/quote/${e.quoteId}`,
      };
    case 'quote-signed':
      return {
        template: 'quote.signed',
        title: `Signed · ${e.client}`,
        body: clip(`${e.client} signed quotation ${e.number} for ${formatINR(e.totalPaise)}. The project tracker is open.`, 160),
        url: `/studio/quotations/${e.quoteId}`,
      };
    case 'intro-declined':
      return {
        template: 'intro.declined',
        title: `${e.studio} declined an introduction`,
        body: clip(e.reason, 160),
        url: '/ops/introductions',
      };
    case 'geio-handover':
      // No customer page in ops yet; the expert works from the call queue.
      return {
        template: 'geio.handover',
        title: `GEIO handed over · ${clip(e.customer, 40)}`,
        body: clip(e.home ? `${e.home}. ${e.note}` : e.note, 160),
        url: '/ops/consultations',
      };
    case 'assured-requested':
      // The plan is switched on the project's tracker, under its introduction.
      return {
        template: 'plan.assured-requested',
        title: `Assured requested · ${clip(e.customer, 40)}`,
        body: clip(
          `${e.customer} asked for Assured ${e.atSigning ? 'when signing' : 'after signing'} with ${e.studio}. Confirm the fee with them, then switch the plan.`,
          160,
        ),
        url: '/ops/introductions',
      };
    case 'payment-to-confirm':
      return {
        template: 'payment.to-confirm',
        title: `Did you pay ${formatINR(e.amountPaise)}? · ${e.studio}`,
        body: clip(`${e.studio} marked ${formatINR(e.amountPaise)} for ${e.stage} as received. Confirm it, or tell us if you didn't pay it.`, 160),
        url: '/app/project',
      };
    case 'payment-disputed':
      return {
        template: 'payment.disputed',
        title: `Payment disputed · ${clip(e.customer, 40)}`,
        body: clip(`${e.customer} says they did not pay ${formatINR(e.amountPaise)} for ${e.stage} (${e.studio}).${e.note ? ` “${e.note}”` : ''}`, 160),
        url: '/ops/introductions',
      };
    case 'lead-assigned':
      return {
        template: 'lead.assigned',
        title: e.count === 1 ? `A lead for you: ${clip(e.name, 60)}` : `${e.count} leads for you`,
        body: clip(`${e.by ? `${e.by} gave you ` : 'You have '}${e.count === 1 ? e.name : `${e.count} leads, starting with ${e.name}`}. They are on your Today list.`, 160),
        url: e.count === 1 && e.clientId ? `/studio/clients/${e.clientId}` : '/studio/today',
      };
    case 'lead-new':
      return {
        template: e.again ? 'lead.form-again' : 'lead.new',
        title: e.again ? `${clip(e.name, 60)} filled in your form again` : `New lead: ${clip(e.name, 60)}`,
        body: clip(e.again ? 'Their message is on the lead’s timeline.' : e.givenTo ? `From ${e.source}. Given to ${e.givenTo} (your "New leads go to" setting).` : `From ${e.source}. It is in the pool: give it to someone from Today or the lead.`, 160),
        url: `/studio/clients/${e.clientId}`,
      };
    case 'extra-work':
      return {
        template: 'project.extra',
        title: `Extra work to approve · ${e.studio}`,
        body: clip(`${e.title}: ${formatINR(e.totalPaise)}. Approve or decline it in the app; nothing is made until you do.`, 160),
        url: '/app/project',
      };
    case 'extra-answered':
      return {
        template: e.approved ? 'extra.approved' : 'extra.declined',
        title: e.approved ? 'Extra work approved' : 'Extra work declined',
        body: clip(e.approved ? `${e.title} (${formatINR(e.totalPaise)}): approved. Accounts records the payment, then release it.` : `${e.title}: the client declined. Their reason is on the project.`, 160),
        url: `/studio/projects/${e.projectId}?tab=extras`,
      };
    case 'signoff-requested':
      return {
        template: 'project.signoff',
        title: `Please read and sign · ${e.studio}`,
        body: clip(`${e.what} is ready for your signature. Read it in the app, tick I agree and sign.`, 160),
        url: '/app/project',
      };
    case 'design-answered':
      return {
        template: 'design.answered',
        title: e.approved ? 'Approved by the client' : 'Changes asked by the client',
        body: clip(e.approved ? `${e.title}: approved. It is the final now.` : `${e.title}: ${e.comment ?? 'changes asked'}`, 160),
        url: `/studio/projects/${e.projectId}?tab=design`,
      };
    case 'signoff-signed':
      return {
        template: 'signoff.signed',
        title: 'Signed by the client',
        body: clip(`${e.name} signed the ${e.what}. The signed copy is in the project's locker.`, 160),
        url: `/studio/projects/${e.projectId}`,
      };
    case 'decision-expired':
      return {
        template: 'decision.expired',
        title: 'Decision date passed',
        body: clip(`${e.title}: not picked yet. Any delay from here is the customer's.`, 160),
        url: `/studio/projects/${e.projectId}`,
      };
    case 'site-missed':
      return {
        template: 'site.missed',
        title: e.toOps ? `No site update · ${clip(e.studio, 40)} (Assured)` : 'No site update today',
        body: clip(
          `${e.home}: nothing posted from site today${e.days > 1 ? `, ${e.days} working days in a row` : ''}. ${e.toOps ? 'Call the studio.' : 'The customer sees "No update from the studio today".'}`,
          160,
        ),
        url: e.toOps ? '/ops/introductions' : `/studio/projects/${e.projectId}?tab=log`,
      };
    case 'my-work':
      return {
        template: 'studio.my_work',
        title: e.missed > 0 ? `Today: ${e.today} to do, ${e.missed} missed` : `Today: ${e.today} thing${e.today === 1 ? '' : 's'} to do`,
        body: clip([e.first ? `First: ${e.first}.` : null, e.soon > 0 ? `${e.soon} more in the next 3 days.` : null, 'Your list is on your home.'].filter(Boolean).join(' '), 160),
        url: '/studio/home',
      };
    case 'work-due-tomorrow':
      return {
        template: 'studio.work_due_tomorrow',
        title: e.count === 1 ? 'Due tomorrow: 1 thing' : `Due tomorrow: ${e.count} things`,
        body: clip(e.list, 160),
        url: '/studio/home',
      };
    case 'quote-request':
      return {
        template: e.how === 'REASSIGNED' ? 'quote.request-reassigned' : 'quote.request',
        title: `A quotation to build: ${clip(e.name, 60)}`,
        body: clip(
          e.how === 'REASSIGNED'
            ? `${e.by ? `${e.by} gave you` : 'You were given'} the quotation for ${e.name}. It is in Quotations, To build.`
            : `${e.why === 'FLOOR_PLAN' ? 'A floor plan was added' : 'A quotation was requested'}${e.by ? ` by ${e.by}` : ''}. Your turn: it is in Quotations, To build.`,
          160,
        ),
        url: '/studio/quotations/requests',
      };
    case 'quote-request-done':
      return {
        template: 'quote.request-done',
        title: `Quotation sent: ${clip(e.name, 60)}`,
        body: clip(`${e.by ?? 'The builder'} sent ${e.number ? `quotation ${e.number}` : 'the quotation'} you asked for.`, 160),
        url: `/studio/clients/${e.clientId}`,
      };
    case 'work-done':
      return {
        template: 'studio.work_done',
        title: e.count === 1 ? 'Done today on your projects' : `${e.count} steps done today on your projects`,
        body: clip(e.list, 160),
        url: '/studio/home',
      };
    case 'document':
      return {
        template: 'project.document',
        title: `New document · ${e.studio}`,
        body: clip(e.title, 160),
        url: '/app/locker',
      };
    case 'design':
      return {
        template: 'project.design',
        title: `Your design · ${e.studio}`,
        body: clip(e.title, 160),
        url: '/app/project',
      };
  }
}
