/**
 * What of a customer's project crosses to the customer — the left column of
 * docs/studio-workspace/STUDIO-WORKSPACE-BUILD.md §5, and nothing from the
 * right. Pure: the select and the mapping, so tests/customer-projection.test.ts
 * can feed it a row stuffed with internal fields and check none come out.
 *
 * ## Two locks, on purpose
 *
 * 1. `CUSTOMER_PROJECT_SELECT` names every column read. A new internal
 *    column (a transcript, a studio cost, the team's notes) is not read
 *    until somebody adds it here, in a file whose whole job is saying what
 *    the customer may see.
 * 2. `toCustomerProject` builds the output field by field, never by
 *    spreading a row. So even a row that carries more than the select
 *    asked for — a test's, or a future `include` — cannot leak through.
 *
 * ## The fixes the audit asked for
 *
 * - `phases` is the payment plan AS SIGNED (`HomeProject.paymentPhases`),
 *   not the studio's current schedule: a studio changing its terms next
 *   month must not rewrite what this customer agreed. Only trackers ops
 *   started by hand, before signing in the app, have no signed copy; they
 *   keep showing the studio's filed schedule, which is all there is.
 * - Documents are only those the studio shared (`sharedAt` set). Drafts and
 *   internal drawings stay with the studio.
 *
 * ## Stages
 *
 * Read from the plan built at signing (`HomeProjectStage`) when the project
 * has one, else from the fixed stages and `doneStages` as before
 * (tracker.ts `projectStages`), so nothing changes for a project until the
 * backfill gives it a plan. The payload keeps its shape — `key`, `label`,
 * `targetOn`, `state`, `late` — with each kind going out under the old key
 * the app already translates (tracker.ts `KIND_KEY`: civil → `SITE`,
 * carpentry → `INSTALL`) and the studio's stage name as the label.
 */

import type { Prisma } from '@prisma/client';
import { fromDb } from '@/lib/money';
import { readPhases, type PaymentPhase } from '@/modules/studio/payment-phases';
import { projectStages, type StageView } from './tracker';
import { daysLeft, decisionState, parseOptions, type DecisionOption, type DecisionState } from './decisions';
import { snagLine } from './snags';
import { DOC_KINDS, docMeta, type DocKind } from './documents';
import { changesSoFar, moneyView, readSignedStages, type ChangesView, type MoneyView } from './payments';
import { planName, type PlanName } from './plans';

export interface CustomerDecision {
  id: string;
  title: string;
  why: string;
  dueOn: string;
  daysLeft: number;
  state: DecisionState;
  options: DecisionOption[];
  chosenIndex: number | null;
  chosenAt: string | null;
  byStudio: boolean;
  /** Family votes: advice to the owner, who chooses. */
  votes: { name: string; optionIndex: number; note: string | null; mine: boolean }[];
}

export interface CustomerSnag {
  id: string;
  title: string;
  room: string | null;
  note: string | null;
  status: 'OPEN' | 'FIXED';
  line: string | null;
  raisedAt: string;
  raisedByStudio: boolean;
  photos: string[];
  fixedNote: string | null;
  fixedPhotos: string[];
}

export interface CustomerDocument {
  id: string;
  kind: DocKind;
  title: string;
  meta: string;
  /** A signed link that lasts minutes; "" when it could not be made. */
  url: string;
}

export interface CustomerProject {
  id: string;
  /** The owner chooses and approves; family see everything and vote. */
  role: 'owner' | 'family';
  /** Basic or Assured (portal/plans.ts). Asking for Assured does not change it; ops does. */
  plan: PlanName;
  studio: string;
  startOn: string;
  stages: StageView[];
  /** The payment plan as signed; the studio's filed one only on a project never signed in the app. */
  phases: PaymentPhase[] | null;
  /** The signed total and its stages in rupees; null on a project started before signing in the app. */
  money: MoneyView | null;
  /** Every option chosen on a decision, and what they add to the price. */
  changes: ChangesView;
  updates: { id: string; note: string; stage: string | null; at: string; byStudio: boolean; photos: string[] }[];
  decisions: CustomerDecision[];
  snags: CustomerSnag[];
  documents: CustomerDocument[];
}

export const UPDATES_SHOWN = 30;

/** Every column the customer projection reads. Adding one here is deciding the customer may see it. */
export const CUSTOMER_PROJECT_SELECT = {
  id: true,
  startOn: true,
  totalDays: true,
  doneStages: true,
  /* The plan built from the signed quote (quote-to-plan.ts). The stage's
     name is the studio's, chosen for the customer to read; the checklist and
     materials are not read here yet. */
  stages: { orderBy: { sortOrder: 'asc' }, select: { kind: true, name: true, plannedEnd: true, actualEnd: true } },
  plan: true,
  contractPaise: true,
  paymentPhases: true,
  paidPhases: true,
  introduction: {
    select: {
      brief: { select: { userId: true } },
      studio: { select: { tradeName: true, paymentPhases: true } },
    },
  },
  updates: {
    orderBy: { createdAt: 'desc' },
    take: UPDATES_SHOWN,
    select: { id: true, note: true, stage: true, createdAt: true, byStudio: true, photoPaths: true },
  },
  decisions: {
    orderBy: { dueOn: 'asc' },
    select: {
      id: true,
      title: true,
      why: true,
      dueOn: true,
      options: true,
      chosenIndex: true,
      chosenAt: true,
      byStudio: true,
      votes: { orderBy: { createdAt: 'asc' }, select: { userId: true, optionIndex: true, note: true } },
    },
  },
  family: { where: { joinedAt: { not: null }, removedAt: null }, select: { userId: true, name: true } },
  snags: {
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      title: true,
      room: true,
      note: true,
      status: true,
      createdAt: true,
      raisedByStudio: true,
      photoPaths: true,
      fixBy: true,
      fixedAt: true,
      fixedNote: true,
      fixedPhotoPaths: true,
    },
  },
  documents: {
    where: { deletedAt: null, sharedAt: { not: null } },
    orderBy: { createdAt: 'desc' },
    select: { id: true, kind: true, title: true, storageKey: true, contentType: true, bytes: true, createdAt: true },
  },
} satisfies Prisma.HomeProjectSelect;

export type CustomerProjectRow = Prisma.HomeProjectGetPayload<{ select: typeof CUSTOMER_PROJECT_SELECT }>;

/** Signed links, made by the server module; empty arrays when links were not asked for. */
export interface CustomerProjectLinks {
  updatePhotos: string[][];
  snagPhotos: string[][];
  fixedPhotos: string[][];
  docUrls: string[];
}

export const NO_LINKS: CustomerProjectLinks = { updatePhotos: [], snagPhotos: [], fixedPhotos: [], docUrls: [] };

/**
 * The payment plan the customer sees: the signed stages when there are any
 * (their percentage, or worked out from the amounts when the stage was signed
 * as an amount), else the studio's filed schedule.
 */
export function customerPhases(signedRaw: unknown, studioRaw: unknown): PaymentPhase[] | null {
  const signed = readSignedStages(signedRaw);
  if (!signed) return readPhases(studioRaw);
  const total = signed.reduce((a, s) => a + s.amountPaise, 0);
  return signed.map((s) => ({ label: s.label, pct: s.pct ?? (total > 0 ? Math.round((s.amountPaise * 100) / total) : 0) }));
}

/** One project, as the customer (or their family) sees it. Field by field; never a spread row. */
export function toCustomerProject(p: CustomerProjectRow, userId: string, now: Date, links: CustomerProjectLinks = NO_LINKS): CustomerProject {
  const names = new Map(p.family.map((f) => [f.userId, f.name]));
  return {
    id: p.id,
    role: p.introduction.brief.userId === userId ? 'owner' : 'family',
    plan: planName(p.plan),
    studio: p.introduction.studio.tradeName,
    startOn: p.startOn.toISOString(),
    stages: projectStages(p, now),
    phases: customerPhases(p.paymentPhases, p.introduction.studio.paymentPhases),
    money: moneyView(p.contractPaise === null ? null : fromDb(p.contractPaise), p.paymentPhases, p.paidPhases),
    changes: changesSoFar(
      p.decisions.map((d) => ({
        id: d.id,
        title: d.title,
        options: parseOptions(d.options) ?? [],
        chosenIndex: d.chosenIndex,
        chosenAt: d.chosenAt?.toISOString() ?? null,
      })),
    ),
    updates: p.updates.map((u, i) => ({
      id: u.id,
      note: u.note,
      stage: u.stage,
      at: u.createdAt.toISOString(),
      byStudio: u.byStudio,
      photos: links.updatePhotos[i] ?? [],
    })),
    decisions: p.decisions.map((d) => ({
      id: d.id,
      title: d.title,
      why: d.why,
      dueOn: d.dueOn.toISOString(),
      daysLeft: daysLeft(d.dueOn, now),
      state: decisionState(d, now),
      options: parseOptions(d.options) ?? [],
      chosenIndex: d.chosenIndex,
      chosenAt: d.chosenAt?.toISOString() ?? null,
      byStudio: d.byStudio,
      votes: d.votes.map((v) => ({ name: names.get(v.userId) ?? 'Family', optionIndex: v.optionIndex, note: v.note, mine: v.userId === userId })),
    })),
    snags: p.snags.map((s, i) => ({
      id: s.id,
      title: s.title,
      room: s.room,
      note: s.note,
      status: s.status === 'FIXED' ? 'FIXED' : 'OPEN',
      line: snagLine(s),
      raisedAt: s.createdAt.toISOString(),
      raisedByStudio: s.raisedByStudio,
      photos: links.snagPhotos[i] ?? [],
      fixedNote: s.fixedNote,
      fixedPhotos: links.fixedPhotos[i] ?? [],
    })),
    documents: p.documents.map((d, i) => ({
      id: d.id,
      kind: (d.kind in DOC_KINDS ? d.kind : 'OTHER') as DocKind,
      title: d.title,
      meta: docMeta(d),
      url: links.docUrls[i] ?? '',
    })),
  };
}
