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
 *
 * ## Phases 2–5: what the new tables may add here (not selected yet)
 *
 * The phase that shows each one adds it to the select and the mapper, and
 * the leaky row in tests/customer-projection.test.ts already carries the
 * internal half. May cross (brief §5, left column):
 *
 * - `siteLogs`: date, kind, reason, customerText/customerLang, postedAt,
 *   correctsId; photos: storagePath (to sign), takenAt, fromGallery,
 *   customerText; crew: crewName, crewRole, arrivedAt.
 * - `dateChanges`: field, fromDate, toDate, reason (in plain words) —
 *   selected since Phase 3, with `stageId`, `decisionId` and `at` to group
 *   and attribute them (portal/tracker-view.ts).
 * - snag `events`: kind, at, photoPaths (to sign), customerText, note, fixBy.
 * - decision `choices`: id, label, detail, photoPath (to sign), swatch,
 *   deltaPaise, sortOrder. `pickedOptionId`.
 * - `payments`: stageIndex, amountPaise, receivedOn, mode, receiptDocumentId
 *   (a shared document), correctsId, customerConfirmedAt, disputedAt.
 * - `quoteChanges`: label, deltaPaise, stageIndex, at.
 *
 * Studio OS Phase 2 adds the design card (studio-design/customer-view.ts
 * names its columns and builds it): never a design step's `doneNote` or
 * file, a site visit's or a moved step's `note`, a measurement's note, the
 * designer's id or phone, or a draft drawing.
 *
 * Never: `note` on site logs, date changes and payments; `internalNote`;
 * `voicePath`, `transcript`, `transcriptLang`; `lat`/`lng`;
 * `studioCostDeltaPaise`; crew `phone`; `disputeNote`; any `…ById`,
 * `assigneeId`, `clientRef`; and nothing from `HomeProjectEvent`'s payload.
 */

import type { Prisma } from '@prisma/client';
import { readPhases, type PaymentPhase } from '@/modules/studio/payment-phases';
import { projectStages, type StageView } from './tracker';
import { daysLeft, decisionState, parseOptions, type DecisionOption, type DecisionState } from './decisions';
import { snagLine } from './snags';
import { CUSTOMER_SNAG_EVENT_SELECT, customerSnagProgress, type CustomerSnagProgress } from './snag-view';
import { DOC_KINDS, docMeta, type DocKind } from './documents';
import { readSignedStages, type ChangesView, type MoneyView } from './payments';
import { planName, type PlanName } from './plans';
import { customerTracker, type CustomerStageStatus, type CustomerTracker } from './tracker-view';
import { SITE_LOG_SELECT, siteDays, siteMissedDays, type CustomerSiteDay } from './site-feed-view';
import {
  changesFromQuote,
  customerChoices,
  customerLedger,
  customerMaterials,
  customerPayments,
  CUSTOMER_CHOICE_SELECT,
  CUSTOMER_MATERIAL_SELECT,
  CUSTOMER_PAYMENT_SELECT,
  CUSTOMER_QUOTE_CHANGE_SELECT,
  docDecisionId,
  moneyFromLedger,
  visibleDocIndexes,
  type CustomerMaterial,
  type CustomerPayments,
} from './money-locker-view';
import type { CustomerChoice } from '@/modules/project/decision-rules';
import { CUSTOMER_DESIGN_SELECT, toCustomerDesign, type CustomerDesign } from '@/modules/studio-design/customer-view';
import { effectivePhase, isPhase } from '@/modules/project/lifecycle-rules';
import { windowFromLedger } from '@/modules/project/snag-window';
import { dayFromDb, istDay } from '@/modules/project/working-days';
import { customerLifecycle, type CustomerLifecycle } from './lifecycle-view';
import { toCustomerExtra, type CustomerExtra, type ChangeOrderStatusName } from '@/modules/project/change-order-rules';
import { toCustomerSignoff, type CustomerSignoff } from '@/modules/project/signoff-rules';
import { fromDb } from '@/lib/money';

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
  /* Phase 5 — the options as rows (money-locker-view.ts): photo, price change (may be negative), never the studio's cost. */
  choices: CustomerChoice[];
  /** The option picked, by id; null until picked. */
  pickedOptionId: string | null;
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
  /* Phase 4 — snags (portal/snag-view.ts). From the snag's events: the state, fix-by, the fix sentence, Confirm / Not fixed. */
  progress: CustomerSnagProgress;
  /** Raised during the warranty (project lifecycle). */
  warranty: boolean;
}

export interface CustomerDocument {
  id: string;
  kind: DocKind;
  title: string;
  meta: string;
  /** A signed link that lasts minutes; "" when it could not be made. */
  url: string;
  /* Phase 5: 1 for a first upload; a revision replaces the one before it in this list. */
  version: number;
  /** A filed decision outcome: the decision it opens. */
  decisionId: string | null;
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
  /* Phase 3 — tracker and delays (portal/tracker-view.ts). Computed, never typed. */
  /** Stages planned vs actual with their percentages and starred milestones, the current stage's milestones, moved dates with plain reasons; null for a project with no plan. */
  tracker: CustomerTracker | null;
  /** The step tracker: whole percent of the project done (rounded down); null for a project with no plan. */
  progressPct: number | null;
  /** "Overall · n days late": working days from planned to forecast handover (customer-caused days included, labelled in `tracker.overall`). */
  overallLateDays: number;
  /** "Carpentry · on track": the stage under way; null once handed over. */
  stageStatus: CustomerStageStatus | null;
  /* Phase 5 — payments from the rows, with each entry to confirm (money-locker-view.ts); null before signing in the app. */
  payments: CustomerPayments | null;
  /** What the home is made of: the materials from the quote, the decision picks, product codes once ordered. */
  materials: CustomerMaterial[];
  /* Phase 2 — the daily site log (portal/site-feed-view.ts): one entry per day, newest first, corrections beside the original. */
  siteLogs: CustomerSiteDay[];
  /** Working days of the last two weeks with nothing posted by 21:00 IST: "No update from the studio today". */
  siteMissedDays: string[];
  /* Studio OS Phase 2 — design (studio-design/customer-view.ts): % done, the starred milestones, the next one and the payment that opens the next step, mood board, visits, measurements, drawings to approve, what changed at closing. Null with no DESIGN stage. */
  design: CustomerDesign | null;
  /* The project lifecycle (portal/lifecycle-view.ts): the current step, the next, and what the customer must do to unlock it. */
  lifecycle: CustomerLifecycle;
  /* Change orders (15 Oct 2026; project/change-order-rules.ts): extra work sent to the customer, newest first. Never a draft, a cancelled one, who made it or a rate. */
  extras: CustomerExtra[];
  /* Digital sign-off (15 Oct 2026; project/signoff-rules.ts): quotations the studio asked them to sign, and the signed ones. Never the IP, user agent or signer's id. */
  signoffs: CustomerSignoff[];
}

export const UPDATES_SHOWN = 30;

/** Every column the customer projection reads. Adding one here is deciding the customer may see it. */
export const CUSTOMER_PROJECT_SELECT = {
  id: true,
  startOn: true,
  totalDays: true,
  doneStages: true,
  /* The plan built from the signed quote (quote-to-plan.ts). The stage's
     name is the studio's, chosen for the customer to read; its steps are
     read below, the materials in money-locker-view.ts. */
  stages: {
    orderBy: { sortOrder: 'asc' },
    select: {
      kind: true,
      name: true,
      plannedEnd: true,
      actualEnd: true,
      /* Phase 3: planned vs actual and the steps — labels, group, done and
         days only, never who ticked or the photo. The stored weight and the
         scope are read to work out each step's percentage and to hide
         not-in-scope steps (portal/tracker-view.ts); neither goes out. */
      id: true,
      plannedStart: true,
      /* Studio OS Phase 2: a design step's id (to place a moved day; never sent), whose step it is and its payment gate. */
      items: {
        orderBy: { sortOrder: 'asc' },
        /* customerMilestone: the studio's star. Only starred steps cross by name (tracker-view.ts, studio-design/customer-view.ts). */
        select: { room: true, label: true, doneAt: true, weightBp: true, inScope: true, plannedOn: true, id: true, responsible: true, gatePayment: true, customerMilestone: true, effortMin: true },
      },
    },
  },
  /* Phase 3: moved dates — old, new, reason. Never the PM's `note` or `byId`. */
  dateChanges: {
    orderBy: [{ at: 'asc' }, { id: 'asc' }],
    select: { stageId: true, field: true, fromDate: true, toDate: true, reason: true, decisionId: true, at: true },
  },
  plan: true,
  /* The project lifecycle: the phase and the warranty's end. Never who signed off (handoverSignedById) or the closure's lines and notes. */
  phase: true,
  warrantyEndsOn: true,
  /* The snag window (project/snag-window.ts): the closure day only, to place the window; never sent. */
  closedOutAt: true,
  contractPaise: true,
  paymentPhases: true,
  paidPhases: true,
  introduction: {
    select: {
      brief: { select: { userId: true } },
      studio: {
        select: {
          tradeName: true,
          paymentPhases: true,
          /* Phase 3: the studio's calendar, to count working days late. */
          workingDays: true,
          /* The snag window's length in days (Settings, Warranty). */
          snagWindowDays: true,
          holidays: { select: { day: true } },
        },
      },
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
      /* Phase 5: the options as rows and the pick. Never `studioCostDeltaPaise`. */
      pickedOptionId: true,
      choices: { orderBy: { sortOrder: 'asc' }, select: CUSTOMER_CHOICE_SELECT },
    },
  },
  /* Phase 5: money received, quote changes from decisions, materials (money-locker-view.ts names the columns). */
  payments: { orderBy: [{ recordedAt: 'asc' }, { id: 'asc' }], select: { ...CUSTOMER_PAYMENT_SELECT, changeOrderId: true } },
  quoteChanges: { orderBy: [{ at: 'asc' }, { id: 'asc' }], select: CUSTOMER_QUOTE_CHANGE_SELECT },
  materials: { orderBy: { sortOrder: 'asc' }, select: CUSTOMER_MATERIAL_SELECT },
  /* Phase 2: the daily site log (portal/site-feed-view.ts names the columns; never the voice, transcript, note, place or crew phone). */
  siteLogs: SITE_LOG_SELECT,
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
      warranty: true,
      /* Phase 4: the snag's events (portal/snag-view.ts names the columns; never the internal note, voice, transcript or assignee). */
      events: { orderBy: { at: 'asc' }, select: CUSTOMER_SNAG_EVENT_SELECT },
    },
  },
  documents: {
    where: { deletedAt: null, sharedAt: { not: null } },
    orderBy: { createdAt: 'desc' },
    select: { id: true, kind: true, title: true, storageKey: true, contentType: true, bytes: true, createdAt: true, version: true, supersedesId: true, designKind: true, room: true },
  },
  /* Studio OS Phase 2: the design card's columns (studio-design/customer-view.ts names them). */
  ...CUSTOMER_DESIGN_SELECT,
  /* Change orders: only those sent to the customer. Never `createdById`, `decidedById`, `releasedById`, `quoteId`, a line's rate or product id beyond saying it has a size. */
  changeOrders: {
    where: { status: { in: ['SENT_TO_CLIENT', 'APPROVED', 'DECLINED', 'PAID', 'RELEASED'] } },
    orderBy: { number: 'desc' },
    select: {
      id: true,
      number: true,
      title: true,
      reason: true,
      status: true,
      workPaise: true,
      discountPaise: true,
      gstBps: true,
      gstPaise: true,
      totalPaise: true,
      sentAt: true,
      decidedAt: true,
      declineReason: true,
      photoDocumentId: true,
      lines: { orderBy: { sortOrder: 'asc' }, select: { product: true, room: true, details: true, unit: true, widthMm: true, heightMm: true, qtyMilli: true, productId: true, amountPaise: true } },
    },
  },
  /* Sign-offs the studio asked for, not withdrawn. Never `signedById`, `ip`, `userAgent`, `requestedById` or the hash. */
  signoffs: {
    where: { withdrawnAt: null },
    orderBy: { requestedAt: 'desc' },
    select: {
      id: true,
      kind: true,
      quoteNumber: true,
      revisionN: true,
      totalPaise: true,
      requestedAt: true,
      signedAt: true,
      withdrawnAt: true,
      signerName: true,
      revision: { select: { quote: { select: { revisions: { orderBy: { n: 'desc' }, take: 1, select: { n: true } } } } } },
    },
  },
} satisfies Prisma.HomeProjectSelect;

export type CustomerProjectRow = Prisma.HomeProjectGetPayload<{ select: typeof CUSTOMER_PROJECT_SELECT }>;

/** Signed links, made by the server module; empty arrays when links were not asked for. */
export interface CustomerProjectLinks {
  updatePhotos: string[][];
  snagPhotos: string[][];
  fixedPhotos: string[][];
  docUrls: string[];
  /** Phase 5: per decision, per option (in order), its photo's signed link or "". */
  choicePhotos?: string[][];
  /** Phase 2: per site log, per photo (in order), its signed link or "". */
  siteLogPhotos?: string[][];
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
  const stages = projectStages(p, now);
  const ledgerOf = customerLedger(p);
  const tracked = customerTracker({ stages: p.stages, dateChanges: p.dateChanges, studio: p.introduction.studio }, stages, now);
  const owner = p.introduction.brief.userId === userId;
  const snags: CustomerSnag[] = p.snags.map((s, i) => ({
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
    progress: customerSnagProgress(s, owner, now),
    warranty: s.warranty === true,
  }));
  const payments = customerPayments(ledgerOf, p.paidPhases, owner, new Set(p.documents.map((d) => d.id)));
  const design = toCustomerDesign(
    (p.stages ?? []).find((s) => s.kind === 'DESIGN') ?? null,
    p,
    p.documents ?? [],
    ledgerOf ? ledgerOf.stages.map((s) => ({ index: s.index, label: s.label, state: s.state })) : null,
  );
  const warrantyEndsOn = p.warrantyEndsOn ? dayFromDb(p.warrantyEndsOn) : null;
  const decisions = p.decisions.map((d) => ({ title: d.title, state: decisionState(d, now) }));
  /* Change orders: each one's payments with their ledger status (a correction or a dispute counts as the ledger says). */
  const rowStatus = new Map((ledgerOf?.rows ?? []).map((r) => [r.id, r]));
  const docIndex = new Map((p.documents ?? []).map((d, i) => [d.id, i]));
  const extras = (p.changeOrders ?? [])
    .map((c) =>
      toCustomerExtra(
        {
          id: c.id,
          number: c.number,
          title: c.title,
          reason: c.reason,
          status: c.status as ChangeOrderStatusName,
          workPaise: fromDb(c.workPaise),
          discountPaise: fromDb(c.discountPaise),
          gstBps: c.gstBps,
          gstPaise: fromDb(c.gstPaise),
          totalPaise: fromDb(c.totalPaise),
          sentAt: c.sentAt ? istDay(c.sentAt) : null,
          decidedAt: c.decidedAt ? istDay(c.decidedAt) : null,
          declineReason: c.declineReason,
          lines: c.lines.map((l) => ({ ...l, amountPaise: fromDb(l.amountPaise) })),
          payments: (p.payments ?? [])
            .filter((r) => r.changeOrderId === c.id)
            .map((r) => ({ amountPaise: fromDb(r.amountPaise), status: rowStatus.get(r.id)?.status ?? 'waiting' })),
        },
        owner,
        c.photoDocumentId && docIndex.has(c.photoDocumentId) ? links.docUrls[docIndex.get(c.photoDocumentId)!] || null : null,
      ),
    )
    .filter((x): x is CustomerExtra => x !== null);
  const signoffs = (p.signoffs ?? [])
    .map((s) =>
      toCustomerSignoff(
        {
          id: s.id,
          kind: s.kind,
          quoteNumber: s.quoteNumber,
          revisionN: s.revisionN,
          totalPaise: fromDb(s.totalPaise),
          requestedOn: istDay(s.requestedAt),
          signedOn: s.signedAt ? istDay(s.signedAt) : null,
          signerName: s.signerName,
          signedAt: s.signedAt,
          withdrawnAt: s.withdrawnAt,
        },
        s.revision.quote.revisions[0]?.n ?? s.revisionN,
        owner,
      ),
    )
    .filter((x): x is CustomerSignoff => x !== null);
  const lifecycle = customerLifecycle({
    phase: isPhase(p.phase) ? effectivePhase(p.phase, warrantyEndsOn, now) : 'DESIGN',
    role: owner ? 'owner' : 'family',
    today: istDay(now),
    warrantyEndsOn,
    design,
    tracker: tracked.tracker,
    payments,
    snags,
    decisions,
    extras,
    signoffs,
    snagWindow: windowFromLedger(p.closedOutAt ? istDay(p.closedOutAt) : null, ledgerOf, p.introduction.studio.snagWindowDays),
  });
  return {
    id: p.id,
    role: owner ? 'owner' : 'family',
    plan: planName(p.plan),
    studio: p.introduction.studio.tradeName,
    startOn: p.startOn.toISOString(),
    stages,
    phases: customerPhases(p.paymentPhases, p.introduction.studio.paymentPhases),
    /* Phase 5: from the payment rows and the recorded quote changes, never from what was marked. */
    money: p.contractPaise === null ? null : moneyFromLedger(ledgerOf, p.paidPhases),
    changes: changesFromQuote(p.quoteChanges),
    updates: p.updates.map((u, i) => ({
      id: u.id,
      note: u.note,
      stage: u.stage,
      at: u.createdAt.toISOString(),
      byStudio: u.byStudio,
      photos: links.updatePhotos[i] ?? [],
    })),
    decisions: p.decisions.map((d, i) => ({
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
      choices: customerChoices(d.choices, links.choicePhotos?.[i]),
      pickedOptionId: d.pickedOptionId ?? null,
    })),
    snags,
    documents: visibleDocIndexes(p.documents).map((i) => {
      const d = p.documents[i]!;
      return {
        id: d.id,
        kind: (d.kind in DOC_KINDS ? d.kind : 'OTHER') as DocKind,
        title: d.title,
        meta: docMeta(d),
        url: links.docUrls[i] ?? '',
        version: d.version ?? 1,
        decisionId: docDecisionId(d.storageKey),
      };
    }),
    tracker: tracked.tracker,
    progressPct: tracked.tracker ? tracked.tracker.progressPct : null,

    overallLateDays: tracked.overallLateDays,
    stageStatus: tracked.stageStatus,
    payments,
    materials: customerMaterials(p.materials),
    siteLogs: siteDays(p.siteLogs ?? [], links.siteLogPhotos),
    siteMissedDays: siteMissedDays({ ...p, studio: p.introduction.studio, siteLogs: p.siteLogs ?? [] }, now),
    design,
    lifecycle,
    extras,
    signoffs,
  };
}
