import 'server-only';

/**
 * The customer's project, in the database (docs/CUSTOMER-PLATFORM-PLAN.md,
 * step 1): the one view the phone app (`/api/app/v1/project`) and the laptop
 * site both read, and the actions on it.
 *
 * Who may do what:
 * - the customer whose brief the project is on reads it, chooses decisions
 *   and raises snags;
 * - the studio doing the work, and ops, post decisions and close snags
 *   (site updates are posted through tracker-store.ts). Within the studio,
 *   what each member may do is their role and whether they are on the
 *   project (modules/studio/roles.ts, checked through studio/access.ts).
 * Ownership is checked here, on every call, against the signed-in user — never
 * taken from what the client sent.
 */

import { prisma } from '@/lib/prisma';
import { formatINR } from '@/lib/money';
import { getCurrentUser, hasRole } from '@/modules/auth/session';
import { ACCESS_ERRORS, memberOnProject } from '@/modules/studio/access';
import type { StudioAction } from '@/modules/studio/roles';
import { signedSitePhotoUrls } from '@/modules/storage/site-photos';
import { decisionState, parseOptions, type DecisionInput, type DecisionState } from './decisions';
import { snagLine } from './snags';
import { acceptSnag, markSnagFixed, raiseSnagAsCustomer, raiseSnagAsStudio, snagEventsOn } from '@/modules/project/snag-flow';
import { finalPaymentGate } from '@/modules/project/snag-status';
import { DOC_KINDS, docMeta, type DocKind } from './documents';
import { signedDocUrls } from '@/modules/storage/project-docs';
import { setMark, type MoneyView } from './payments';
import { createDecision, pickOption } from '@/modules/project/decision-flow';
import { setStagePaidFromLegacy } from '@/modules/project/payments-flow';
import { removeDocument as removeLockerDocument, uploadDocument } from '@/modules/project/locker';
import { CUSTOMER_PAYMENT_SELECT, CUSTOMER_QUOTE_CHANGE_SELECT, customerLedger, moneyFromLedger } from './money-locker-view';

export type ActionResult = { ok: true; id?: string } | { ok: false; error: string };

/*
 * The customer's view of a project moved to customer-project.ts (studio
 * workspace Phase 1), where what may cross to the customer is decided in one
 * place. Re-exported, so callers and the tests that mock this module stay as
 * they were.
 */
export { customerProjects, hasLiveProject } from './customer-project';
export type { CustomerDecision, CustomerDocument, CustomerProject, CustomerSnag } from './customer-project';

// ── The customer's actions ─────────────────────────────────────

/**
 * The customer chooses an option (by index, as older apps send it). Phase 5:
 * the pick changes the quote, the final payment and the locker in one go
 * (project/decision-flow.ts `pickOption`); a pick can be changed until the
 * due date, and a first pick after it counts as the customer's delay.
 */
export async function chooseDecision(userId: string, decisionId: string, index: unknown): Promise<ActionResult> {
  return pickOption(userId, decisionId, { index });
}

/**
 * The customer raises a snag on their own project, with up to four photos.
 * The studio hears about it. Phase 4: written with its RAISED event by
 * project/snag-flow.ts (a photo is now required).
 */
export async function raiseSnag(
  userId: string,
  projectId: string,
  input: { title: unknown; room?: unknown; note?: unknown },
  photos: File[] = [],
): Promise<ActionResult> {
  return raiseSnagAsCustomer(userId, projectId, input, photos);
}

// ── The studio's and ops' actions ──────────────────────────────

type Staff =
  | {
      ok: true;
      userId: string;
      byStudio: boolean;
      customerId: string | null;
      studioName: string;
      /** What else this person may do on the project: everything for ops, the role's table for a studio member. */
      may: (action: StudioAction) => boolean;
    }
  | { ok: false; error: string };

/**
 * The signed-in person may act for this project: ops, or a member of the
 * studio doing it whose role allows `action` on it (studio/access.ts — a PM
 * or supervisor only on a project they are assigned to, accounts only on
 * payments, an owner on everything). Without an action, they need only be
 * able to see it.
 */
async function staffFor(projectId: string, action?: StudioAction): Promise<Staff> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: 'Sign in first.' };
  const project = await prisma.homeProject.findUnique({
    where: { id: projectId },
    select: { introduction: { select: { studio: { select: { tradeName: true } }, brief: { select: { userId: true } } } } },
  });
  if (!project) return { ok: false, error: 'That project is gone.' };
  const intro = project.introduction;
  const base = { userId: user.id, customerId: intro.brief.userId, studioName: intro.studio.tradeName };
  if (hasRole(user, 'OPS')) return { ok: true, ...base, byStudio: false, may: () => true };
  const check = await memberOnProject(projectId, action);
  if (!check.ok) return check;
  return { ok: true, ...base, byStudio: true, may: check.access.may };
}

/**
 * A decision for the customer, with a due date and its options, from the
 * older form (name, note, what it adds). Phase 5: written with its options as
 * rows by project/decision-flow.ts; the office's New decision screen calls
 * `createDecision` directly, with photos and the studio's cost.
 */
export async function postDecision(projectId: string, input: DecisionInput): Promise<ActionResult> {
  const options = Array.isArray(input.options)
    ? input.options.map((o) => {
        const r = (o && typeof o === 'object' ? o : {}) as Record<string, unknown>;
        return { label: r.name, detail: r.note, swatch: r.swatch, delta: typeof r.extraPaise === 'number' ? r.extraPaise / 100 : 0 };
      })
    : input.options;
  return createDecision(projectId, { title: input.title, why: input.why, dueOn: input.dueOn, options });
}

/**
 * Mark a snag fixed, with a note and the after photo (required). It does not
 * close: the customer confirms, or it closes after seven days
 * (project/snag-flow.ts). The customer is told.
 */
export async function fixSnag(snagId: string, note: string, photos: File[] = []): Promise<ActionResult> {
  return markSnagFixed(snagId, { photos, text: note });
}

/** Set or move the date a snag will be fixed by: an ACCEPTED step that keeps whoever it is assigned to. */
export async function setSnagFixBy(snagId: string, date: string): Promise<ActionResult> {
  return acceptSnag(snagId, { fixBy: date, assigneeId: undefined }, new Date(), { assigneeOptional: true });
}

// ── What the studio and ops see ────────────────────────────────

export interface StaffWork {
  /** The client's dream board: photos they saved for the studio to see. */
  dream: { url: string; note: string | null }[];
  /** The signed total and stages, for setting due dates and marking payments; null before signing in the app. */
  money: MoneyView | null;
  /** Drafts included: `shared` says whether the customer can see it. */
  documents: { id: string; kind: DocKind; title: string; meta: string; url: string; byStudio: boolean; shared: boolean }[];
  decisions: {
    id: string;
    title: string;
    due: string;
    state: DecisionState;
    options: number;
    /** The customer's choice and what it adds, once made. */
    chosen: string | null;
  }[];
  snags: {
    id: string;
    title: string;
    room: string | null;
    note: string | null;
    status: 'OPEN' | 'FIXED';
    line: string | null;
    /** "YYYY-MM-DD" for the date field, or "". */
    fixBy: string;
    raisedAt: string;
    raisedByStudio: boolean;
    photos: string[];
  }[];
}

/**
 * A project's decisions and snags for the studio doing it, or ops. Null when
 * the signed-in person may not see it. Accounts sees the money and nothing
 * else (studio/roles.ts), so for them every other list comes back empty.
 */
export async function projectWork(projectId: string, now = new Date()): Promise<StaffWork | null> {
  const staff = await staffFor(projectId);
  if (!staff.ok) return null;
  /* Phase 5: paid and balance from the payment rows and quote changes (money-locker-view.ts), never from the marks. */
  const project = await prisma.homeProject.findUnique({
    where: { id: projectId },
    select: { contractPaise: true, paymentPhases: true, paidPhases: true, payments: { select: CUSTOMER_PAYMENT_SELECT }, quoteChanges: { select: CUSTOMER_QUOTE_CHANGE_SELECT } },
  });
  const money = project && project.contractPaise !== null ? moneyFromLedger(customerLedger(project), project.paidPhases) : null;
  if (!staff.may('project.read')) return { dream: [], money: staff.may('payment.read') ? money : null, documents: [], decisions: [], snags: [] };
  const [decisions, snags, documents] = await Promise.all([
    prisma.homeDecision.findMany({ where: { projectId }, orderBy: { dueOn: 'desc' }, take: 50 }),
    prisma.homeSnag.findMany({ where: { projectId }, orderBy: [{ status: 'asc' }, { createdAt: 'desc' }], take: 100 }),
    prisma.homeDocument.findMany({ where: { projectId, deletedAt: null }, orderBy: { createdAt: 'desc' }, take: 100 }),
  ]);
  const [photos, docUrls] = await Promise.all([
    Promise.all(snags.map((s) => signedSitePhotoUrls(s.photoPaths))),
    signedDocUrls(documents.map((d) => d.storageKey)),
  ]);
  const pins = staff.customerId
    ? await prisma.dreamPin.findMany({ where: { userId: staff.customerId, deletedAt: null }, orderBy: { createdAt: 'desc' }, take: 24 })
    : [];
  const pinUrls = await signedSitePhotoUrls(pins.map((p) => p.photoPath));
  return {
    dream: pins.map((p, k) => ({ url: pinUrls[k] ?? '', note: p.note })).filter((p) => p.url),
    money: staff.may('payment.read') ? money : null,
    documents: documents.map((d, i) => ({
      id: d.id,
      kind: (d.kind in DOC_KINDS ? d.kind : 'OTHER') as DocKind,
      title: d.title,
      meta: docMeta(d),
      url: docUrls[i] ?? '',
      byStudio: d.byStudio,
      shared: d.sharedAt !== null,
    })),
    decisions: decisions.map((d) => {
      const options = parseOptions(d.options) ?? [];
      const pick = d.chosenIndex === null ? null : options[d.chosenIndex];
      return {
        id: d.id,
        title: d.title,
        due: d.dueOn.toISOString(),
        state: decisionState(d, now),
        options: options.length,
        chosen: pick ? `${pick.name}${pick.extraPaise > 0 ? ` (+${formatINR(pick.extraPaise)})` : ''}` : null,
      };
    }),
    snags: snags.map((s, i) => ({
      id: s.id,
      title: s.title,
      room: s.room,
      note: s.note,
      status: s.status === 'FIXED' ? 'FIXED' : 'OPEN',
      line: snagLine(s),
      fixBy: s.fixBy ? s.fixBy.toISOString().slice(0, 10) : '',
      raisedAt: s.createdAt.toISOString(),
      raisedByStudio: s.raisedByStudio,
      photos: photos[i] ?? [],
    })),
  };
}

/** A snag found by the studio or at the handover walk-through, raised from the staff side (project/snag-flow.ts). */
export async function raiseSnagAsStaff(
  projectId: string,
  input: { title: unknown; room?: unknown; note?: unknown },
  photos: File[] = [],
): Promise<ActionResult> {
  return raiseSnagAsStudio(projectId, input, photos);
}

/**
 * Upload a document to a project, shared at once. The customer is told it is
 * in their Locker. Phase 5: through project/locker.ts, which also takes
 * drafts and new versions.
 */
export async function addDocument(projectId: string, input: { kind: unknown; title: unknown }, file: File | null): Promise<ActionResult> {
  return uploadDocument(projectId, { kind: input.kind, title: input.title, share: true }, file);
}

/**
 * Take a document off the project. Phase 5: only a draft; a document the
 * customer already has stays and can only be replaced by a new version
 * (project/locker-rules.ts).
 */
export async function removeDocument(documentId: string): Promise<ActionResult> {
  return removeLockerDocument(documentId);
}

// ── Payments: due dates and what is paid ───────────────────────

/**
 * The studio or ops sets when a payment stage is due, or marks it paid. The
 * customer pays the studio directly; this is the record of it, and a paid
 * stage tells the customer it was received.
 */
export async function setPaymentStage(
  projectId: string,
  index: number,
  patch: { dueOn?: string | null; paidOn?: string | null },
): Promise<ActionResult> {
  const staff = await staffFor(projectId);
  if (!staff.ok) return staff;
  /* Received is accounts' and the owner's to say; when it is due is part of
     the schedule, which a PM on the project may also set (studio/roles.ts). */
  const refused =
    (patch.paidOn !== undefined && !staff.may('payment.record')) ||
    (patch.dueOn !== undefined && !staff.may('payment.record') && !staff.may('plan.edit'));
  if (refused) return { ok: false, error: ACCESS_ERRORS.notYourRole };
  for (const v of [patch.dueOn, patch.paidOn]) {
    if (v !== undefined && v !== null && !/^\d{4}-\d{2}-\d{2}$/.test(v)) return { ok: false, error: 'A date, please.' };
  }
  const project = await prisma.homeProject.findUnique({
    where: { id: projectId },
    select: { contractPaise: true, paymentPhases: true, paidPhases: true },
  });
  const money = project && project.contractPaise !== null ? moneyFromLedger(customerLedger({ paymentPhases: project.paymentPhases }), project.paidPhases) : null;
  const stage = money?.stages[index];
  if (!project || !money || !stage) return { ok: false, error: 'That payment stage is not on this project.' };
  // Phase 4: the last payment cannot be due while any snag is open (project/snag-status.ts).
  if (patch.dueOn && index === money.stages.length - 1) {
    const gate = finalPaymentGate({ stageIndex: index, stageCount: money.stages.length, eventsBySnag: await snagEventsOn(projectId), now: new Date() });
    if (!gate.ok) return { ok: false, error: gate.error };
  }
  if (patch.dueOn !== undefined) {
    const marks = setMark(project.paidPhases, index, { dueOn: patch.dueOn });
    await prisma.homeProject.update({ where: { id: projectId }, data: { paidPhases: marks as unknown as object } });
  }
  /* Phase 5: "received" is a payment row (project/payments-flow.ts), the
     stage's open amount, which the customer is asked to confirm; "undo" is a
     correction to zero. `paidPhases[].paidOn` follows the rows. */
  if (patch.paidOn !== undefined) {
    const r = await setStagePaidFromLegacy(projectId, index, patch.paidOn);
    if (!r.ok) return r;
  }
  return { ok: true };
}
