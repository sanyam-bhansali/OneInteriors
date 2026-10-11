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
  | { kind: 'document'; studio: string; title: string }
  | { kind: 'payment-due'; stage: string; amountPaise: number; studio: string; dueLabel: string }
  | { kind: 'payment-recorded'; stage: string; amountPaise: number; studio: string }
  // Between the customer and the studio, before signing.
  | { kind: 'introduced'; clientId: string | null; home: string; contactReleased: boolean }
  | { kind: 'quote-sent'; quoteId: string; studio: string; number: string }
  | { kind: 'quote-signed'; quoteId: string; client: string; number: string; totalPaise: number }
  | { kind: 'intro-declined'; studio: string; reason: string }
  // To ops: GEIO passed a customer's question to the expert.
  | { kind: 'geio-handover'; customer: string; home: string | null; note: string };

/** Events a studio also gets by email: it works from a laptop, not our app. */
export const EMAILED_TO_STUDIO: ProjectEvent['kind'][] = ['introduced', 'quote-signed', 'decision-made', 'snag-raised'];

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
    case 'snag-fixed':
      return {
        template: 'snag.fixed',
        title: 'Snag fixed',
        body: clip(e.title, 160),
        url: `/app/snags`,
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
    case 'document':
      return {
        template: 'project.document',
        title: `New document · ${e.studio}`,
        body: clip(e.title, 160),
        url: '/app/locker',
      };
  }
}
