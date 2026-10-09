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
 *   (site updates are posted through tracker-store.ts).
 * Ownership is checked here, on every call, against the signed-in user — never
 * taken from what the client sent.
 */

import { prisma } from '@/lib/prisma';
import { formatINR } from '@/lib/money';
import { getCurrentUser, hasRole } from '@/modules/auth/session';
import { currentStudio } from '@/modules/studio/onboarding';
import { readPhases, type PaymentPhase } from '@/modules/studio/payment-phases';
import { signedSitePhotoUrls, storeSitePhoto } from '@/modules/storage/site-photos';
import { notify, notifyStudio } from '@/modules/notify/service';
import { plannedStages, trackerView, type StageView } from './tracker';
import { canChoose, checkDecision, daysLeft, decisionState, parseOptions, type DecisionInput, type DecisionOption, type DecisionState } from './decisions';
import { checkSnag, SNAG_LIMITS, snagLine } from './snags';
import { checkDoc, DOC_KINDS, docMeta, type DocKind } from './documents';
import { signedDocUrls, storeProjectDoc } from '@/modules/storage/project-docs';
import { changesSoFar, moneyView, setMark, type ChangesView, type MoneyView } from './payments';
import { fromDb } from '@/lib/money';

export type ActionResult = { ok: true; id?: string } | { ok: false; error: string };

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

export interface CustomerProject {
  id: string;
  /** The owner chooses and approves; family see everything and vote. */
  role: 'owner' | 'family';
  studio: string;
  startOn: string;
  stages: StageView[];
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

export interface CustomerDocument {
  id: string;
  kind: DocKind;
  title: string;
  meta: string;
  /** A signed link that lasts minutes; "" when it could not be made. */
  url: string;
}

const UPDATES_SHOWN = 30;

/** Every project on this customer's brief, newest first. Empty when they have none yet. */
export async function customerProjects(userId: string, now = new Date()): Promise<CustomerProject[]> {
  const projects = await prisma.homeProject.findMany({
    where: {
      OR: [
        { introduction: { brief: { userId } } },
        { family: { some: { userId, joinedAt: { not: null }, removedAt: null } } },
      ],
    },
    orderBy: { startOn: 'desc' },
    include: {
      introduction: { select: { brief: { select: { userId: true } }, studio: { select: { tradeName: true, paymentPhases: true } } } },
      updates: { orderBy: { createdAt: 'desc' }, take: UPDATES_SHOWN },
      decisions: { orderBy: { dueOn: 'asc' }, include: { votes: { orderBy: { createdAt: 'asc' } } } },
      family: { where: { joinedAt: { not: null }, removedAt: null }, select: { userId: true, name: true } },
      snags: { orderBy: { createdAt: 'desc' } },
      documents: { where: { deletedAt: null }, orderBy: { createdAt: 'desc' } },
    },
  });
  return Promise.all(
    projects.map(async (p) => {
      const [updatePhotos, snagPhotos, fixedPhotos, docUrls] = await Promise.all([
        Promise.all(p.updates.map((u) => signedSitePhotoUrls(u.photoPaths))),
        Promise.all(p.snags.map((s) => signedSitePhotoUrls(s.photoPaths))),
        Promise.all(p.snags.map((s) => signedSitePhotoUrls(s.fixedPhotoPaths))),
        signedDocUrls(p.documents.map((d) => d.storageKey)),
      ]);
      const names = new Map(p.family.map((f) => [f.userId, f.name]));
      return {
        id: p.id,
        role: p.introduction.brief.userId === userId ? 'owner' : 'family',
        studio: p.introduction.studio.tradeName,
        startOn: p.startOn.toISOString(),
        stages: trackerView(plannedStages(p.startOn, p.totalDays), p.doneStages, now),
        phases: readPhases(p.introduction.studio.paymentPhases),
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
          photos: updatePhotos[i] ?? [],
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
          photos: snagPhotos[i] ?? [],
          fixedNote: s.fixedNote,
          fixedPhotos: fixedPhotos[i] ?? [],
        })),
        documents: p.documents.map((d, i) => ({
          id: d.id,
          kind: (d.kind in DOC_KINDS ? d.kind : 'OTHER') as DocKind,
          title: d.title,
          meta: docMeta(d),
          url: docUrls[i] ?? '',
        })),
      } satisfies CustomerProject;
    }),
  );
}

// ── The customer's actions ─────────────────────────────────────

/** The customer chooses an option; a choice can be changed until the due date. The studio hears about it. */
export async function chooseDecision(userId: string, decisionId: string, index: unknown): Promise<ActionResult> {
  const d = await prisma.homeDecision.findUnique({
    where: { id: decisionId },
    include: { project: { select: { introduction: { select: { studioId: true, brief: { select: { userId: true } } } } } } },
  });
  if (!d || d.project.introduction.brief.userId !== userId) return { ok: false, error: 'That decision is not on your project.' };
  const options = parseOptions(d.options) ?? [];
  if (!canChoose(d, options, index)) {
    return { ok: false, error: d.dueOn.getTime() < Date.now() ? 'This decision has closed. Ask your expert.' : 'Pick one of the options.' };
  }
  const i = index as number;
  await prisma.homeDecision.update({ where: { id: d.id }, data: { chosenIndex: i, chosenAt: new Date(), chosenById: userId } });
  void notifyStudio(d.project.introduction.studioId, {
    kind: 'decision-made',
    decisionId: d.id,
    title: d.title,
    choice: options[i]!.name,
    extraPaise: options[i]!.extraPaise,
  });
  return { ok: true, id: d.id };
}

/** The customer raises a snag on their own project, with up to four photos. The studio hears about it. */
export async function raiseSnag(
  userId: string,
  projectId: string,
  input: { title: unknown; room?: unknown; note?: unknown },
  photos: File[] = [],
): Promise<ActionResult> {
  const project = await prisma.homeProject.findUnique({
    where: { id: projectId },
    select: { introduction: { select: { studioId: true, brief: { select: { userId: true } } } } },
  });
  if (!project || project.introduction.brief.userId !== userId) return { ok: false, error: 'That project is not yours.' };
  const check = checkSnag(input);
  if (!check.ok) return check;
  const stored = await storePhotos(projectId, photos);
  if (!stored.ok) return stored;
  const snag = await prisma.homeSnag.create({
    data: { projectId, ...check.value, photoPaths: stored.paths, raisedById: userId, raisedByStudio: false },
  });
  void notifyStudio(project.introduction.studioId, { kind: 'snag-raised', snagId: snag.id, title: snag.title, room: snag.room });
  return { ok: true, id: snag.id };
}

// ── The studio's and ops' actions ──────────────────────────────

/** The signed-in person may act for this project: ops, or a member of the studio doing it. */
async function staffFor(projectId: string): Promise<
  { ok: true; userId: string; byStudio: boolean; customerId: string | null; studioName: string } | { ok: false; error: string }
> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: 'Sign in first.' };
  const project = await prisma.homeProject.findUnique({
    where: { id: projectId },
    select: { introduction: { select: { studioId: true, studio: { select: { tradeName: true } }, brief: { select: { userId: true } } } } },
  });
  if (!project) return { ok: false, error: 'That project is gone.' };
  const intro = project.introduction;
  if (hasRole(user, 'OPS')) return { ok: true, userId: user.id, byStudio: false, customerId: intro.brief.userId, studioName: intro.studio.tradeName };
  const ctx = await currentStudio();
  if (ctx && ctx.studio.id === intro.studioId) {
    return { ok: true, userId: user.id, byStudio: true, customerId: intro.brief.userId, studioName: intro.studio.tradeName };
  }
  return { ok: false, error: 'That project is not one of yours.' };
}

/** A decision for the customer, with a due date and its options. The customer is told. */
export async function postDecision(projectId: string, input: DecisionInput): Promise<ActionResult> {
  const staff = await staffFor(projectId);
  if (!staff.ok) return staff;
  const check = checkDecision(input);
  if (!check.ok) return check;
  const { title, why, dueOn, options } = check.value;
  const d = await prisma.homeDecision.create({
    data: { projectId, title, why, dueOn, options: options as unknown as object, postedById: staff.userId, byStudio: staff.byStudio },
  });
  if (staff.customerId) {
    void notify(staff.customerId, {
      kind: 'decision-posted',
      decisionId: d.id,
      title,
      dueLabel: dueOn.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'Asia/Kolkata' }).replace(',', ''),
    });
  }
  return { ok: true, id: d.id };
}

/** Close a snag, with a note and a photo of the fix. The customer is told. */
export async function fixSnag(snagId: string, note: string, photos: File[] = []): Promise<ActionResult> {
  const snag = await prisma.homeSnag.findUnique({ where: { id: snagId }, select: { projectId: true, title: true, status: true } });
  if (!snag) return { ok: false, error: 'That snag is gone.' };
  const staff = await staffFor(snag.projectId);
  if (!staff.ok) return staff;
  if (snag.status === 'FIXED') return { ok: true, id: snagId };
  const stored = await storePhotos(snag.projectId, photos);
  if (!stored.ok) return stored;
  await prisma.homeSnag.update({
    where: { id: snagId },
    data: { status: 'FIXED', fixedAt: new Date(), fixedNote: note.trim().slice(0, SNAG_LIMITS.note) || null, fixedPhotoPaths: stored.paths },
  });
  if (staff.customerId) void notify(staff.customerId, { kind: 'snag-fixed', snagId, title: snag.title });
  return { ok: true, id: snagId };
}

/** Set or move the date a snag will be fixed by. */
export async function setSnagFixBy(snagId: string, date: string): Promise<ActionResult> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return { ok: false, error: 'A date, please.' };
  const snag = await prisma.homeSnag.findUnique({ where: { id: snagId }, select: { projectId: true } });
  if (!snag) return { ok: false, error: 'That snag is gone.' };
  const staff = await staffFor(snag.projectId);
  if (!staff.ok) return staff;
  await prisma.homeSnag.update({ where: { id: snagId }, data: { fixBy: new Date(`${date}T12:00:00Z`) } });
  return { ok: true, id: snagId };
}

async function storePhotos(projectId: string, photos: File[]): Promise<{ ok: true; paths: string[] } | { ok: false; error: string }> {
  const files = photos.filter((f) => f.size > 0);
  if (files.length > SNAG_LIMITS.photos) return { ok: false, error: `At most ${SNAG_LIMITS.photos} photos.` };
  const paths: string[] = [];
  for (const f of files) {
    const stored = await storeSitePhoto(projectId, f);
    if (!stored.ok) return { ok: false, error: stored.error };
    paths.push(stored.path);
  }
  return { ok: true, paths };
}

// ── What the studio and ops see ────────────────────────────────

export interface StaffWork {
  /** The client's dream board: photos they saved for the studio to see. */
  dream: { url: string; note: string | null }[];
  /** The signed total and stages, for setting due dates and marking payments; null before signing in the app. */
  money: MoneyView | null;
  documents: { id: string; kind: DocKind; title: string; meta: string; url: string; byStudio: boolean }[];
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

/** A project's decisions and snags for the studio doing it, or ops. Null when the signed-in person may not see it. */
export async function projectWork(projectId: string, now = new Date()): Promise<StaffWork | null> {
  const staff = await staffFor(projectId);
  if (!staff.ok) return null;
  const [project, decisions, snags, documents] = await Promise.all([
    prisma.homeProject.findUnique({ where: { id: projectId }, select: { contractPaise: true, paymentPhases: true, paidPhases: true } }),
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
    money: project ? moneyView(project.contractPaise === null ? null : fromDb(project.contractPaise), project.paymentPhases, project.paidPhases) : null,
    documents: documents.map((d, i) => ({
      id: d.id,
      kind: (d.kind in DOC_KINDS ? d.kind : 'OTHER') as DocKind,
      title: d.title,
      meta: docMeta(d),
      url: docUrls[i] ?? '',
      byStudio: d.byStudio,
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

/** A snag found by the studio or at the handover walk-through, raised from the staff side. The customer is told it was logged. */
export async function raiseSnagAsStaff(
  projectId: string,
  input: { title: unknown; room?: unknown; note?: unknown },
  photos: File[] = [],
): Promise<ActionResult> {
  const staff = await staffFor(projectId);
  if (!staff.ok) return staff;
  const check = checkSnag(input);
  if (!check.ok) return check;
  const stored = await storePhotos(projectId, photos);
  if (!stored.ok) return stored;
  const snag = await prisma.homeSnag.create({
    data: { projectId, ...check.value, photoPaths: stored.paths, raisedById: staff.userId, raisedByStudio: staff.byStudio },
  });
  return { ok: true, id: snag.id };
}

/** Upload a document to a project. The customer is told it is in their Locker. */
export async function addDocument(projectId: string, input: { kind: unknown; title: unknown }, file: File | null): Promise<ActionResult> {
  const staff = await staffFor(projectId);
  if (!staff.ok) return staff;
  const check = checkDoc(input);
  if (!check.ok) return check;
  if (!file || file.size === 0) return { ok: false, error: 'Choose the file.' };
  const stored = await storeProjectDoc(projectId, file);
  if (!stored.ok) return stored;
  const doc = await prisma.homeDocument.create({
    data: {
      projectId,
      ...check.value,
      storageKey: stored.path,
      originalName: file.name.slice(0, 200),
      contentType: file.type,
      bytes: file.size,
      uploadedById: staff.userId,
      byStudio: staff.byStudio,
    },
  });
  if (staff.customerId) void notify(staff.customerId, { kind: 'document', studio: staff.studioName, title: check.value.title });
  return { ok: true, id: doc.id };
}

/** Take a document off the project. Kept for the record; the customer stops seeing it. */
export async function removeDocument(documentId: string): Promise<ActionResult> {
  const doc = await prisma.homeDocument.findUnique({ where: { id: documentId }, select: { projectId: true } });
  if (!doc) return { ok: false, error: 'That document is gone.' };
  const staff = await staffFor(doc.projectId);
  if (!staff.ok) return staff;
  await prisma.homeDocument.update({ where: { id: documentId }, data: { deletedAt: new Date() } });
  return { ok: true, id: documentId };
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
  for (const v of [patch.dueOn, patch.paidOn]) {
    if (v !== undefined && v !== null && !/^\d{4}-\d{2}-\d{2}$/.test(v)) return { ok: false, error: 'A date, please.' };
  }
  const project = await prisma.homeProject.findUnique({
    where: { id: projectId },
    select: { contractPaise: true, paymentPhases: true, paidPhases: true },
  });
  const money = project ? moneyView(project.contractPaise === null ? null : fromDb(project.contractPaise), project.paymentPhases, project.paidPhases) : null;
  const stage = money?.stages[index];
  if (!project || !money || !stage) return { ok: false, error: 'That payment stage is not on this project.' };
  const marks = setMark(project.paidPhases, index, patch);
  await prisma.homeProject.update({ where: { id: projectId }, data: { paidPhases: marks as unknown as object } });
  if (patch.paidOn && !stage.paidOn && staff.customerId) {
    void notify(staff.customerId, { kind: 'payment-recorded', stage: stage.label, amountPaise: stage.amountPaise, studio: staff.studioName });
  }
  return { ok: true };
}
