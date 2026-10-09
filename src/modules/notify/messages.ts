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
  | { kind: 'payment-recorded'; stage: string; amountPaise: number; studio: string };

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
    case 'document':
      return {
        template: 'project.document',
        title: `New document · ${e.studio}`,
        body: clip(e.title, 160),
        url: '/app/locker',
      };
  }
}
