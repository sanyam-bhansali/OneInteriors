/**
 * What of the design phase crosses to the customer (Studio OS Phase 2,
 * docs/studio-os/PHASE-2-DESIGN.md §7). Pure: the columns it needs are named
 * in `CUSTOMER_DESIGN_SELECT` (spread into portal/customer-project-view.ts's
 * select) and the output is built field by field, so
 * tests/customer-projection.test.ts can feed it a row stuffed with internal
 * fields and check none come out.
 *
 * May cross: the designer's first name; the design's % done (from every
 * in-scope step); the STARRED design steps only — the milestones (owner,
 * 12 Oct 2026; docs/studio-os/CUSTOMER-MILESTONES.md): names, done, days,
 * whose step it is when it is the client's, which payment opens a locked
 * one, a moved step's reason in plain words; what waits on the client now
 * (the payment that opens the next step, the client's own step); the mood
 * board's message; site visits' day, time, purpose and status;
 * measurements; shared drawings with their version and the client's own
 * answers; the frozen "what changed" at closing.
 *
 * Never: a step the studio did not star (its name, day or count), a step's
 * note (`doneNote`), its file id, who ticked it, a visit's note, a delay's
 * note or who moved it, drafts, any member id or phone.
 */

import type { Prisma } from '@prisma/client';
import { progressOf } from '@/modules/project/step-rules';
import { dayFromDb, istDay } from '@/modules/project/working-days';
import { CUSTOMER_REASON, DESIGN_KINDS, drawingsOf, formatLength, gateOf, isDelayReasonKey, nextStep, type DesignKind, type GateStage } from './rules';

/** The project columns the design card reads, besides the stages and documents the projection already selects. */
export const CUSTOMER_DESIGN_SELECT = {
  /* The designer's name only — never their member id or phone. */
  designer: { select: { user: { select: { name: true } } } },
  moodBoardSharedAt: true,
  moodBoardNote: true,
  designClosedAt: true,
  designChanges: true,
  /* Day, time, purpose, status. Never the team's `note` or `byId`. */
  siteVisits: { orderBy: { at: 'asc' }, select: { at: true, purpose: true, status: true } },
  measurements: { orderBy: { sortOrder: 'asc' }, select: { room: true, lengthMm: true, widthMm: true, heightMm: true } },
  /* The customer's own answers: verdict, their words, when. Never `byUserId`. */
  designReviews: { orderBy: { at: 'asc' }, select: { documentId: true, verdict: true, comment: true, at: true } },
  /* Which step moved, to when, and why (a key read as plain words). Never `note` or `byId`. */
  stepDelays: { orderBy: { at: 'asc' }, select: { stepId: true, toDate: true, reason: true } },
} satisfies Prisma.HomeProjectSelect;

export interface DesignStepRow {
  id?: string;
  label: string;
  doneAt: Date | null;
  plannedOn: Date | null;
  weightBp: number;
  inScope: boolean;
  responsible?: string | null;
  gatePayment?: number | null;
  /** The studio's star: only starred steps cross by name. */
  customerMilestone?: boolean;
}

export interface DesignDocRow {
  id: string;
  title: string;
  designKind?: string | null;
  room?: string | null;
  version?: number | null;
  supersedesId?: string | null;
  createdAt: Date;
}

export interface DesignRow {
  designer?: { user: { name: string | null } | null } | null;
  moodBoardSharedAt?: Date | null;
  moodBoardNote?: string | null;
  designClosedAt?: Date | null;
  designChanges?: unknown;
  siteVisits?: readonly { at: Date; purpose: string; status: string }[];
  measurements?: readonly { room: string; lengthMm: number | null; widthMm: number | null; heightMm: number | null }[];
  designReviews?: readonly { documentId: string; verdict: string; comment: string | null; at: Date }[];
  stepDelays?: readonly { stepId: string; toDate: Date; reason: string }[];
}

export interface CustomerDesignStep {
  label: string;
  done: boolean;
  doneOn: string | null;
  plannedOn: string | null;
  /** The client's own step (they do it). */
  yours: boolean;
  /** Locked until this payment is recorded; null when open. */
  waitingFor: string | null;
  /** Why it moved, in plain words; null when it never moved. */
  moved: string | null;
}

export interface CustomerDrawing {
  /** The shared document's id: what the client answers. */
  id: string;
  kind: DesignKind;
  kindLabel: string;
  room: string | null;
  title: string;
  version: number;
  state: 'waiting' | 'approved' | 'changes' | 'shared';
  answeredOn: string | null;
  /** The client's own words on this version. */
  comment: string | null;
}

export interface CustomerDesignChanges {
  salesTotalPaise: number;
  designTotalPaise: number;
  lines: { kind: 'ADDED' | 'REMOVED' | 'REPRICED'; room: string; product: string; wasPaise: number; nowPaise: number }[];
}

export interface CustomerDesign {
  designer: string | null;
  /** Whole percent of design done; null when nothing in it is in scope. */
  pct: number | null;
  done: boolean;
  closedOn: string | null;
  /** The design milestones: the starred in-scope steps, in order. Never a step the studio did not star. */
  steps: CustomerDesignStep[];
  /** The next milestone not done yet; its `waitingFor` is the payment holding up the design right now, if any. */
  next: CustomerDesignStep | null;
  /** The payment that opens the design's next step (starred or not), when it is not recorded yet. */
  waitingFor: string | null;
  /** The design's next step when it is the client's own to do (starred or not): its name, so they know it is on them. */
  yourStep: string | null;
  moodBoard: { shared: boolean; sharedOn: string | null; note: string | null };
  visits: { at: string; purpose: string; status: 'booked' | 'done' }[];
  measurements: { room: string; size: string; height: string | null }[];
  drawings: CustomerDrawing[];
  changes: CustomerDesignChanges | null;
}

/** A moment (a tick, sharing, closing) as its day in India: 01:00 IST on the 13th is the 13th, not the 12th. */
const isoDay = (d: Date | null | undefined): string | null => (d ? istDay(d) : null);
/** A `@db.Date` column (a planned day), stored as UTC midnight. */
const dbDay = (d: Date | null | undefined): string | null => (d ? dayFromDb(d) : null);
const firstName = (n: string | null | undefined): string | null => n?.trim().split(/\s+/)[0] || null;

/** The frozen summary as stored at closing, read defensively: a malformed one is dropped, never half shown. */
export function readDesignChanges(raw: unknown): CustomerDesignChanges | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  if (typeof o.salesTotalPaise !== 'number' || typeof o.designTotalPaise !== 'number' || !Array.isArray(o.lines)) return null;
  const lines = o.lines.flatMap((l): CustomerDesignChanges['lines'] => {
    if (!l || typeof l !== 'object') return [];
    const x = l as Record<string, unknown>;
    const kind = x.kind === 'ADDED' || x.kind === 'REMOVED' || x.kind === 'REPRICED' ? x.kind : null;
    if (!kind || typeof x.room !== 'string' || typeof x.product !== 'string') return [];
    return [{ kind, room: x.room, product: x.product, wasPaise: Number(x.wasPaise) || 0, nowPaise: Number(x.nowPaise) || 0 }];
  });
  return { salesTotalPaise: o.salesTotalPaise, designTotalPaise: o.designTotalPaise, lines };
}

/**
 * The design card, from the DESIGN stage's steps, the shared documents, the
 * design columns and the payment stages' states (for the gates). Null when
 * the project has no DESIGN stage.
 */
export function toCustomerDesign(
  stage: { actualEnd: Date | null; items: readonly DesignStepRow[] } | null,
  row: DesignRow,
  docs: readonly DesignDocRow[],
  gateStages: readonly GateStage[] | null,
): CustomerDesign | null {
  if (!stage) return null;
  const live = (stage.items ?? []).filter((i) => i.inScope !== false);
  const progress = progressOf(live.map((i, k) => ({ id: String(k), stageId: 'design', weightBp: i.weightBp, inScope: true, done: i.doneAt !== null })));
  const movedById = new Map<string, string>();
  for (const d of row.stepDelays ?? []) if (isDelayReasonKey(d.reason)) movedById.set(d.stepId, CUSTOMER_REASON[d.reason]);
  const all: CustomerDesignStep[] = live.map((i) => {
    const gate = gateOf(i.gatePayment ?? null, gateStages);
    return {
      label: i.label,
      done: i.doneAt !== null,
      doneOn: isoDay(i.doneAt),
      plannedOn: dbDay(i.plannedOn),
      yours: i.responsible === 'CLIENT',
      waitingFor: i.doneAt === null && !gate.open ? gate.payment : null,
      moved: i.id ? (movedById.get(i.id) ?? null) : null,
    };
  });
  const answers = (row.designReviews ?? []).map((r) => ({ documentId: r.documentId, verdict: r.verdict === 'APPROVED' ? ('APPROVED' as const) : ('CHANGES' as const), comment: r.comment, at: r.at }));
  // The projection's documents are shared and live already; drawings are the ones with a design kind.
  const drawings = drawingsOf(
    docs.map((d) => ({
      id: d.id,
      title: d.title,
      designKind: d.designKind ?? null,
      room: d.room ?? null,
      version: d.version ?? 1,
      supersedesId: d.supersedesId ?? null,
      sharedAt: d.createdAt,
      deletedAt: null,
      createdAt: d.createdAt,
    })),
    answers,
  ).flatMap((d): CustomerDrawing[] =>
    d.state === 'draft'
      ? []
      : [
          {
            id: d.id,
            kind: d.kind,
            kindLabel: DESIGN_KINDS[d.kind],
            room: d.room,
            title: d.title,
            version: d.version,
            state: d.state,
            answeredOn: d.answer ? isoDay(d.answer.at) : null,
            comment: d.answer?.comment ?? null,
          },
        ],
  );
  /* What waits on the client right now comes from the design's next step, starred or not; only its payment and (when it is theirs) its name cross. */
  const upNext = nextStep(live.map((i, k) => ({ k, done: i.doneAt !== null, inScope: true })));
  const nowStep = upNext ? all[upNext.k]! : null;
  const waitingFor = nowStep?.waitingFor ?? null;
  /* The client reads only the starred steps by name. */
  const steps = all.filter((_, k) => live[k]!.customerMilestone === true);
  const nextMilestone = steps.find((s) => !s.done) ?? null;
  return {
    designer: firstName(row.designer?.user?.name),
    pct: progress.stages.get('design')?.pct ?? null,
    done: stage.actualEnd !== null,
    closedOn: isoDay(row.designClosedAt),
    steps,
    next: nextMilestone ? { ...nextMilestone, waitingFor: waitingFor ?? nextMilestone.waitingFor } : null,
    waitingFor,
    yourStep: nowStep?.yours ? nowStep.label : null,
    moodBoard: { shared: Boolean(row.moodBoardSharedAt), sharedOn: isoDay(row.moodBoardSharedAt), note: row.moodBoardSharedAt ? (row.moodBoardNote ?? null) : null },
    visits: (row.siteVisits ?? [])
      .filter((v) => v.status !== 'CANCELLED')
      .map((v) => ({ at: v.at.toISOString(), purpose: v.purpose, status: v.status === 'DONE' ? ('done' as const) : ('booked' as const) })),
    measurements: (row.measurements ?? []).map((m) => ({
      room: m.room,
      size: `${formatLength(m.lengthMm)} × ${formatLength(m.widthMm)}`,
      height: m.heightMm ? formatLength(m.heightMm) : null,
    })),
    drawings,
    changes: row.designClosedAt ? readDesignChanges(row.designChanges) : null,
  };
}
