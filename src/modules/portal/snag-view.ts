/**
 * A snag's progress as the customer sees it (studio workspace Phase 4),
 * computed from its events by project/snag-status.ts. Pure; called from
 * customer-project-view.ts `toCustomerProject`, one key per snag
 * (`progress`), so the existing snag fields keep their shape for the app.
 *
 * Crosses (brief §5): the state, the fix-by date, the written fix sentence,
 * the studio's dispute reason, the customer's own "not fixed" reason, when
 * it closed and how. The before/after photos are the snag's existing
 * `photos` and `fixedPhotos` links (the legacy columns are kept in step on
 * every fix). Never: who on the crew it was given to, the PM's internal
 * note, the voice recording or its transcript — those are not even selected.
 */

import { eventsOrLegacy, snagStatus, type SnagEventLike, type SnagState } from '@/modules/project/snag-status';

/** The event columns the customer projection selects. Never `internalNote`, `voicePath`, `transcript`, `assigneeId`, `byId`. */
export const CUSTOMER_SNAG_EVENT_SELECT = { id: true, kind: true, at: true, fixBy: true, customerText: true, note: true } as const;

export interface CustomerSnagProgress {
  state: SnagState;
  /** The fix-by date the studio set (ISO), or null. */
  fixBy: string | null;
  /** When the current fix was made (ISO), while it stands. */
  fixedAt: string | null;
  /** The one sentence the studio wrote (or said) about the fix. */
  fixSentence: string | null;
  /** Why the studio says it is not a defect, while disputed. */
  studioReason: string | null;
  /** The customer's own "not fixed" words, while reopened. */
  notFixedReason: string | null;
  closedAt: string | null;
  /** `you`: the customer confirmed (or agreed); `auto`: seven days passed after the fix. */
  closedBy: 'you' | 'auto' | null;
  /** While fixed and waiting: when it closes by itself if nobody answers (ISO). */
  autoClosesOn: string | null;
  /** Whole days from raising to the fix that closed it ("Fixed in 2 days"), once closed. */
  daysToFix: number | null;
  /** True for the owner of the brief while there is something to answer (a fix, or a dispute to agree to). */
  canAnswer: boolean;
}

type EventRow = { id?: string; kind: string; at: Date; fixBy: Date | null; customerText: string | null; note: string | null };
type LegacyRow = { createdAt: Date; status: string; fixBy: Date | null; fixedAt: Date | null; fixedNote: string | null };

export function customerSnagProgress(snag: LegacyRow & { events?: EventRow[] }, owner: boolean, now: Date): CustomerSnagProgress {
  const events = eventsOrLegacy<SnagEventLike>(snag.events ?? [], snag);
  const s = snagStatus(events, now);
  const iso = (d: Date | null) => (d ? d.toISOString() : null);
  const fixSentence = s.fix?.customerText?.trim() || null;
  const daysToFix = s.state === 'closed' && s.fix ? Math.max(0, Math.round((s.fix.at.getTime() - snag.createdAt.getTime()) / 86_400_000)) : null;
  return {
    state: s.state,
    fixBy: iso(s.fixBy),
    fixedAt: iso(s.fixedAt),
    fixSentence,
    studioReason: s.disputeReason,
    notFixedReason: s.notFixedReason,
    closedAt: iso(s.closedAt),
    closedBy: s.closedBy === 'customer' ? 'you' : s.closedBy,
    autoClosesOn: iso(s.autoClosesAt),
    daysToFix,
    canAnswer: owner && (s.state === 'fixed' || s.state === 'disputed'),
  };
}
