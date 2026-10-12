import 'server-only';

/**
 * The design phase from the studio's side (Studio OS Phase 2,
 * docs/studio-os/PHASE-2-DESIGN.md): the project's Design tab and the
 * designers' page. Reads only; the writes are in design-flow.ts. Rules in
 * rules.ts.
 *
 * Access (studio/roles.ts, through studio/access.ts on every read):
 * - the Design tab: `project.read` on the project — a designer only on the
 *   projects they are the designer on (their team row). What the tab may DO
 *   is said by `canWork` (`design.work`), `canAssign` (`design.assign`) and
 *   `canEditPlan` (`plan.edit`).
 * - no money crosses to a designer: a payment gate says which payment and
 *   whether it is recorded, never an amount.
 * - the designers' page: owner and PM see every designer
 *   (`design.workload`); a designer sees their own projects.
 */

import { prisma } from '@/lib/prisma';
import { fromDb } from '@/lib/money';
import { currentMember, memberOnProject } from '@/modules/studio/access';
import { can } from '@/modules/studio/roles';
import { homeLabel, firstName } from '@/modules/studio/workspace-view';
import { readSignedStages } from '@/modules/portal/payments';
import { ledger } from '@/modules/project/payment-ledger';
import { toLedgerRow } from '@/modules/project/payments-flow';
import { progressOf } from '@/modules/project/step-rules';
import { dayFromDb, istDay } from '@/modules/project/working-days';
import { signedDocUrls } from '@/modules/storage/project-docs';
import { prepForBrief, type OpsPrepRoom } from '@/modules/prepare/prep';
import { ROOM_KEYS, ROOM_LABELS } from '@/modules/prepare/rooms';
import { elementsForRoom } from '@/modules/prepare/board';
import { readDesignChanges, type CustomerDesignChanges } from './customer-view';
import {
  dueAndLate,
  designerLoad,
  drawingsOf,
  DESIGN_KINDS,
  formatLength,
  gateOf,
  lateDays,
  nextStep,
  reasonLabel,
  reminderText,
  waitingDays,
  type DesignKind,
  type DrawingState,
  type GateStage,
} from './rules';
import { bhkOf, isResponsible, RESPONSIBLE_LABEL, type Responsible } from './template';

const ROW_SELECT = {
  id: true,
  stageIndex: true,
  amountPaise: true,
  receivedOn: true,
  mode: true,
  receiptDocumentId: true,
  correctsId: true,
  recordedById: true,
  recordedAt: true,
  customerConfirmedAt: true,
  disputedAt: true,
} as const;

/** The payment stages as the gates read them: label and state only, never an amount. */
export function gateStagesOf(p: {
  paymentPhases: unknown;
  payments: Parameters<typeof toLedgerRow>[0][];
  quoteChanges: { deltaPaise: bigint; stageIndex: number | null }[];
}): GateStage[] | null {
  const stages = readSignedStages(p.paymentPhases);
  if (!stages) return null;
  const l = ledger(
    stages,
    p.quoteChanges.map((c) => ({ deltaPaise: fromDb(c.deltaPaise), stageIndex: c.stageIndex })),
    p.payments.map(toLedgerRow),
  );
  return l.stages.map((s) => ({ index: s.index, label: s.label, state: s.state }));
}

export const GATE_SELECT = {
  paymentPhases: true,
  payments: { select: ROW_SELECT },
  quoteChanges: { select: { deltaPaise: true, stageIndex: true } },
} as const;

export interface DesignStepView {
  id: string;
  label: string;
  responsible: Responsible | null;
  responsibleLabel: string | null;
  needsDocument: boolean;
  gatePayment: number | null;
  /** Null when open; the payment's name when locked. */
  lockedBy: string | null;
  inScope: boolean;
  done: boolean;
  doneOn: string | null;
  plannedOn: string | null;
  lateDays: number;
  /** The step's share of the design phase, as a percentage. */
  sharePct: number;
  /** The team's sentence when it was ticked. Never the customer's. */
  doneNote: string | null;
  doneFile: { id: string; title: string; url: string } | null;
  /** Its moves, oldest first. */
  moves: { from: string; to: string; side: 'CLIENT' | 'STUDIO'; reason: string; note: string | null; at: string }[];
  /** Starred: a design milestone the client sees (docs/studio-os/CUSTOMER-MILESTONES.md). */
  milestone: boolean;
}

export interface DrawingView {
  id: string;
  title: string;
  kind: DesignKind;
  kindLabel: string;
  room: string | null;
  version: number;
  revisions: number;
  state: DrawingState;
  url: string;
  sharedOn: string | null;
  waitingDays: number;
  answer: { verdict: 'APPROVED' | 'CHANGES'; comment: string | null; on: string } | null;
  askedFor: string | null;
  /** For the designer's own WhatsApp; shown once it has waited a few days. */
  reminder: string | null;
}

export interface DesignTab {
  projectId: string;
  today: string;
  customerFirst: string;
  studio: string;
  bhk: number | null;
  designer: { id: string; name: string } | null;
  /** Who may be picked: active designers, PMs and owners. Empty for those who cannot pick. */
  designers: { id: string; name: string; role: string }[];
  stage: { id: string; name: string; plannedStart: string; plannedEnd: string; done: boolean } | null;
  steps: DesignStepView[];
  pct: number | null;
  next: DesignStepView | null;
  /** The last open step's day past the stage's planned end, in days; 0 when inside. */
  overrunDays: number;
  /** Steps made before Phase 2 (no responsible role on any): offer to apply the studio's design steps. */
  legacySteps: boolean;
  payments: { index: number; label: string }[];
  moodBoard: {
    sharedOn: string | null;
    note: string | null;
    rooms: OpsPrepRoom[];
    roomOptions: { key: string; label: string; pieces: { slug: string; label: string }[] }[];
  };
  visits: { id: string; at: string; purpose: string; status: 'BOOKED' | 'DONE' | 'CANCELLED'; note: string | null }[];
  measurements: { room: string; length: string; width: string; height: string; note: string | null }[];
  drawings: DrawingView[];
  final: {
    /** False for a member who sees no money (a designer): the quotations, their links and the totals stay out (null below). */
    seesQuotes: boolean;
    signed: { id: string; number: string } | null;
    designFinal: { id: string; number: string; status: string } | null;
    closedOn: string | null;
    changes: CustomerDesignChanges | null;
  };
  canWork: boolean;
  canAssign: boolean;
  canEditPlan: boolean;
}

export type DesignTabResult = { ok: true; tab: DesignTab } | { ok: false; error: string };

const fmt = (mm: number | null) => (mm ? formatLength(mm) : '');

/** The Design tab of one project. */
export async function designForStudio(projectId: string, now = new Date()): Promise<DesignTabResult> {
  const check = await memberOnProject(projectId, 'project.read');
  if (!check.ok) return check;
  const may = check.access.may;
  const p = await prisma.homeProject.findUnique({
    where: { id: projectId },
    select: {
      id: true,
      signedQuoteId: true,
      designFinalQuoteId: true,
      designClosedAt: true,
      designChanges: true,
      moodBoardSharedAt: true,
      moodBoardNote: true,
      designer: { select: { id: true, user: { select: { name: true, phone: true } } } },
      ...GATE_SELECT,
      introduction: {
        select: {
          studioId: true,
          studio: { select: { tradeName: true } },
          brief: { select: { id: true, contactName: true, propertyType: true, user: { select: { name: true } } } },
        },
      },
      stages: {
        where: { kind: 'DESIGN' },
        take: 1,
        select: {
          id: true,
          name: true,
          plannedStart: true,
          plannedEnd: true,
          actualEnd: true,
          items: {
            orderBy: { sortOrder: 'asc' },
            select: {
              id: true,
              label: true,
              responsible: true,
              needsDocument: true,
              gatePayment: true,
              plannedOn: true,
              doneAt: true,
              doneNote: true,
              doneDocumentId: true,
              inScope: true,
              weightBp: true,
              customerMilestone: true,
              delays: { orderBy: { at: 'asc' }, select: { fromDate: true, toDate: true, side: true, reason: true, note: true, at: true } },
            },
          },
        },
      },
      siteVisits: { orderBy: { at: 'asc' }, select: { id: true, at: true, purpose: true, status: true, note: true } },
      measurements: { orderBy: { sortOrder: 'asc' }, select: { room: true, lengthMm: true, widthMm: true, heightMm: true, note: true } },
      documents: {
        where: { deletedAt: null, designKind: { not: null } },
        orderBy: { createdAt: 'asc' },
        select: { id: true, title: true, designKind: true, room: true, version: true, supersedesId: true, sharedAt: true, deletedAt: true, createdAt: true, storageKey: true },
      },
      designReviews: { orderBy: { at: 'asc' }, select: { documentId: true, verdict: true, comment: true, at: true } },
    },
  });
  if (!p) return { ok: false, error: 'That project is not one of yours.' };

  const brief = p.introduction.brief;
  const customerFirst = firstName(brief.contactName || brief.user?.name);
  const studio = p.introduction.studio.tradeName;
  const today = istDay(now);
  const stage = p.stages[0] ?? null;
  const items = stage?.items ?? [];
  const gates = gateStagesOf(p);
  const progress = progressOf(items.map((i) => ({ id: i.id, stageId: 'design', weightBp: i.weightBp, inScope: i.inScope, done: i.doneAt !== null })));
  const stageBp = progress.stages.get('design')?.totalBp ?? 0;

  // Files the steps were ticked with (filed in the locker; may be drafts the customer never sees).
  const fileIds = items.map((i) => i.doneDocumentId).filter((x): x is string => Boolean(x));
  const stepFiles = fileIds.length
    ? await prisma.homeDocument.findMany({ where: { projectId, id: { in: fileIds } }, select: { id: true, title: true, storageKey: true } })
    : [];
  const designDocs = p.documents;
  const urls = await signedDocUrls([...stepFiles.map((f) => f.storageKey), ...designDocs.map((d) => d.storageKey)]).catch(() => [] as string[]);
  const fileUrl = new Map(stepFiles.map((f, i) => [f.id, { id: f.id, title: f.title, url: urls[i] ?? '' }]));
  const docUrl = new Map(designDocs.map((d, i) => [d.id, urls[stepFiles.length + i] ?? '']));

  const steps: DesignStepView[] = items.map((i) => {
    const gate = gateOf(i.gatePayment, gates);
    const plannedOn = i.plannedOn ? dayFromDb(i.plannedOn) : null;
    const done = i.doneAt !== null;
    return {
      id: i.id,
      label: i.label,
      responsible: isResponsible(i.responsible) ? i.responsible : null,
      responsibleLabel: isResponsible(i.responsible) ? RESPONSIBLE_LABEL[i.responsible] : null,
      needsDocument: i.needsDocument,
      gatePayment: i.gatePayment,
      lockedBy: !done && !gate.open ? gate.payment : null,
      inScope: i.inScope,
      done,
      doneOn: i.doneAt ? istDay(i.doneAt) : null,
      plannedOn,
      lateDays: i.inScope ? lateDays({ plannedOn, done }, today) : 0,
      sharePct: i.inScope && stageBp > 0 ? Math.round(((progress.weights.get(i.id) ?? 0) * 1000) / stageBp) / 10 : 0,
      doneNote: i.doneNote,
      doneFile: i.doneDocumentId ? (fileUrl.get(i.doneDocumentId) ?? null) : null,
      moves: i.delays.map((d) => ({
        from: dayFromDb(d.fromDate),
        to: dayFromDb(d.toDate),
        side: d.side,
        reason: reasonLabel(d.reason),
        note: d.note,
        at: d.at.toISOString(),
      })),
      milestone: i.customerMilestone,
    };
  });
  const lastOpen = [...steps].reverse().find((s) => s.inScope && !s.done && s.plannedOn);
  const stageEnd = stage ? dayFromDb(stage.plannedEnd) : null;
  const overrunDays =
    lastOpen?.plannedOn && stageEnd && lastOpen.plannedOn > stageEnd
      ? Math.round((Date.parse(lastOpen.plannedOn) - Date.parse(stageEnd)) / 86_400_000)
      : 0;

  const answers = p.designReviews.map((r) => ({ documentId: r.documentId, verdict: r.verdict, comment: r.comment, at: r.at }));
  const drawings: DrawingView[] = drawingsOf(designDocs, answers).map((d) => {
    const w = waitingDays(d, now);
    return {
      id: d.id,
      title: d.title,
      kind: d.kind,
      kindLabel: DESIGN_KINDS[d.kind],
      room: d.room,
      version: d.version,
      revisions: d.revisions,
      state: d.state,
      url: docUrl.get(d.id) ?? '',
      sharedOn: d.sharedAt ? istDay(d.sharedAt) : null,
      waitingDays: w,
      answer: d.answer ? { verdict: d.answer.verdict, comment: d.answer.comment, on: istDay(d.answer.at) } : null,
      askedFor: d.askedFor,
      reminder: w >= 3 ? reminderText(customerFirst, d, studio) : null,
    };
  });

  const canAssign = may('design.assign');
  // No money crosses to a designer: the quotations (numbers, links) and the frozen totals go only to those who see payments or write quotes.
  const seesQuotes = may('payment.read') || may('quote.write');
  const [designers, signed, designFinal, rooms] = await Promise.all([
    canAssign
      ? prisma.studioMember.findMany({
          where: { studioId: check.member.studioId, status: 'ACTIVE', role: { in: ['DESIGNER', 'PM', 'OWNER'] } },
          orderBy: { createdAt: 'asc' },
          select: { id: true, role: true, user: { select: { name: true, phone: true, email: true } } },
        })
      : Promise.resolve([]),
    seesQuotes && p.signedQuoteId ? prisma.studioQuote.findFirst({ where: { id: p.signedQuoteId, studioId: p.introduction.studioId }, select: { id: true, number: true } }) : Promise.resolve(null),
    seesQuotes && p.signedQuoteId
      ? prisma.studioQuote.findFirst({
          where: p.designFinalQuoteId
            ? { id: p.designFinalQuoteId, studioId: p.introduction.studioId }
            : { studioId: p.introduction.studioId, basedOnId: p.signedQuoteId, stage: 'DESIGN' },
          orderBy: { createdAt: 'desc' },
          select: { id: true, number: true, status: true },
        })
      : Promise.resolve(null),
    prepForBrief(brief.id).catch(() => [] as OpsPrepRoom[]),
  ]);

  const nextS = nextStep(steps);
  return {
    ok: true,
    tab: {
      projectId,
      today,
      customerFirst,
      studio,
      bhk: bhkOf(brief.propertyType),
      designer: p.designer ? { id: p.designer.id, name: p.designer.user.name || p.designer.user.phone || 'Designer' } : null,
      designers: designers.map((m) => ({ id: m.id, name: m.user.name || m.user.phone || m.user.email || 'Someone', role: m.role })),
      stage: stage
        ? { id: stage.id, name: stage.name, plannedStart: dayFromDb(stage.plannedStart), plannedEnd: dayFromDb(stage.plannedEnd), done: stage.actualEnd !== null }
        : null,
      steps,
      pct: progress.stages.get('design')?.pct ?? null,
      next: nextS,
      overrunDays,
      legacySteps: items.length > 0 && items.every((i) => !i.responsible),
      payments: (readSignedStages(p.paymentPhases) ?? []).map((s, index) => ({ index, label: s.label })),
      moodBoard: {
        sharedOn: p.moodBoardSharedAt ? istDay(p.moodBoardSharedAt) : null,
        note: p.moodBoardNote,
        rooms,
        roomOptions: ROOM_KEYS.map((key) => ({ key, label: ROOM_LABELS[key], pieces: elementsForRoom(key).map((e) => ({ slug: e.slug, label: e.label })) })),
      },
      visits: p.siteVisits.map((v) => ({ id: v.id, at: v.at.toISOString(), purpose: v.purpose, status: v.status, note: v.note })),
      measurements: p.measurements.map((m) => ({ room: m.room, length: fmt(m.lengthMm), width: fmt(m.widthMm), height: fmt(m.heightMm), note: m.note })),
      drawings,
      final: {
        seesQuotes,
        signed: seesQuotes ? (signed ?? null) : null,
        designFinal: seesQuotes ? (designFinal ?? null) : null,
        closedOn: p.designClosedAt ? istDay(p.designClosedAt) : null,
        changes: seesQuotes && p.designClosedAt ? readDesignChanges(p.designChanges) : null,
      },
      canWork: may('design.work'),
      canAssign,
      canEditPlan: may('plan.edit'),
    },
  };
}

// ── The designers' page ───────────────────────────────────────

export interface DesignProjectRow {
  id: string;
  home: string;
  customer: string;
  bhk: number | null;
  pct: number;
  next: { label: string; plannedOn: string | null; lockedBy: string | null } | null;
  due: number;
  late: number;
  /** The design stage's planned end. */
  endsOn: string | null;
}

export interface DesignerRow {
  id: string | null;
  name: string;
  projects: DesignProjectRow[];
  load: ReturnType<typeof designerLoad>;
}

export interface DesignWorkload {
  /** Owner or PM: every designer. A designer: only themself. */
  everyone: boolean;
  today: string;
  designers: DesignerRow[];
}

/**
 * The designers' page: every project still in design (its DESIGN stage not
 * done, not cancelled), grouped by designer, with what is next, due this
 * week and late, and each designer's rough load. Projects nobody designs yet
 * come under "No designer yet" for the owner and PM.
 */
export async function designWorkload(now = new Date()): Promise<DesignWorkload | null> {
  const member = await currentMember();
  if (!member || member.status !== 'ACTIVE') return null;
  const everyone = can(member, 'design.workload');
  if (!everyone && member.role !== 'DESIGNER') return null;
  const today = istDay(now);
  const projects = await prisma.homeProject.findMany({
    where: {
      cancelledAt: null,
      introduction: { studioId: member.studioId },
      stages: { some: { kind: 'DESIGN', actualEnd: null } },
      ...(everyone ? {} : { designerId: member.id, team: { some: { memberId: member.id } } }),
    },
    orderBy: { startOn: 'asc' },
    take: 300,
    select: {
      id: true,
      designerId: true,
      ...GATE_SELECT,
      introduction: { select: { brief: { select: { society: true, locality: true, propertyType: true, contactName: true, user: { select: { name: true } } } } } },
      stages: {
        where: { kind: 'DESIGN' },
        take: 1,
        select: { plannedEnd: true, items: { orderBy: { sortOrder: 'asc' }, select: { id: true, label: true, weightBp: true, inScope: true, doneAt: true, plannedOn: true, gatePayment: true } } },
      },
    },
  });
  const members = await prisma.studioMember.findMany({
    where: { studioId: member.studioId, ...(everyone ? { OR: [{ role: 'DESIGNER', status: 'ACTIVE' }, { designing: { some: {} } }] } : { id: member.id }) },
    orderBy: { createdAt: 'asc' },
    select: { id: true, user: { select: { name: true, phone: true } } },
  });
  // Money stays inside for a designer: only the gate's word is read here, and only to say a step is locked.
  const rows = projects.map((p) => {
    const b = p.introduction.brief;
    const st = p.stages[0];
    const items = st?.items ?? [];
    const gates = gateStagesOf(p);
    const steps = items.map((i) => ({ ...i, done: i.doneAt !== null, plannedOn: i.plannedOn ? dayFromDb(i.plannedOn) : null }));
    const progress = progressOf(steps.map((i) => ({ id: i.id, stageId: 'd', weightBp: i.weightBp, inScope: i.inScope, done: i.done })));
    const n = nextStep(steps);
    const gate = n ? gateOf(n.gatePayment, gates) : { open: true as const };
    const dl = dueAndLate(steps, today);
    return {
      designerId: p.designerId,
      row: {
        id: p.id,
        home: homeLabel(b),
        customer: firstName(b.contactName || b.user?.name),
        bhk: bhkOf(b.propertyType),
        pct: progress.stages.get('d')?.pct ?? 0,
        next: n ? { label: n.label, plannedOn: n.plannedOn, lockedBy: gate.open ? null : gate.payment } : null,
        due: dl.due,
        late: dl.late,
        endsOn: st ? dayFromDb(st.plannedEnd) : null,
      } satisfies DesignProjectRow,
    };
  });
  const designers: DesignerRow[] = members.map((m) => {
    const mine = rows.filter((r) => r.designerId === m.id).map((r) => r.row);
    return { id: m.id, name: m.user.name || m.user.phone || 'Designer', projects: mine, load: designerLoad(mine.map((r) => ({ bhk: r.bhk, designPct: r.pct }))) };
  });
  if (everyone) {
    const nobody = rows.filter((r) => !r.designerId).map((r) => r.row);
    if (nobody.length) designers.push({ id: null, name: 'No designer yet', projects: nobody, load: designerLoad([]) });
  }
  return { everyone, today, designers };
}
