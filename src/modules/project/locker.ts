import 'server-only';

/**
 * The home locker, from the studio's side (studio workspace Phase 5, brief
 * §6): what is filed by itself and what the studio adds.
 *
 * Filed by itself, nobody uploading anything: the agreement and the final
 * quote at signing (Phase 1, portal/plan-write.ts), a receipt with each
 * recorded payment (payments-flow.ts), each decision's outcome
 * (`fileDecisionOutcome`, called by decision-flow.ts).
 *
 * Added by the studio (`document.upload`: owner and the PM on the project):
 * drawings and documents — as a draft only the team sees, or shared — new
 * versions of them (a shared document is never edited or removed, only
 * superseded: locker-rules.ts), and the product code on a material once it
 * is ordered.
 *
 * Each write is one transaction with its `HomeProjectEvent`.
 */

import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { notify } from '@/modules/notify/service';
import { checkDoc, DECISION_CONTENT_TYPE, DOC_KINDS, docMeta, type DocKind } from '@/modules/portal/documents';
import { signedDocUrls, storeProjectDoc } from '@/modules/storage/project-docs';
import { recordEvent, type ProjectActor } from './events';
import { staffOn } from './flow-access';
import { canRemove, canSupersede, checkProductCode, customerVisible, decisionDocKey, decisionDocTitle, newestVersions } from './locker-rules';

export type LockerResult = { ok: true; id?: string } | { ok: false; error: string };

const DOC_SELECT = {
  id: true,
  projectId: true,
  kind: true,
  title: true,
  storageKey: true,
  contentType: true,
  bytes: true,
  createdAt: true,
  byStudio: true,
  sharedAt: true,
  deletedAt: true,
  version: true,
  supersedesId: true,
} as const;

/**
 * Upload a document to the locker: shared at once, or as a draft only the
 * team sees; optionally as the next version of one already there. The
 * customer is told when it is shared.
 */
export async function uploadDocument(
  projectId: string,
  input: { kind: unknown; title: unknown; share?: unknown; supersedesId?: unknown },
  file: File | null,
): Promise<LockerResult> {
  const staff = await staffOn(projectId, 'document.upload');
  if (!staff.ok) return staff;
  const supersedesId = typeof input.supersedesId === 'string' && input.supersedesId ? input.supersedesId.slice(0, 64) : null;
  let version = 1;
  let previous: { kind: string; title: string } | null = null;
  if (supersedesId) {
    const all = await prisma.homeDocument.findMany({ where: { projectId }, select: DOC_SELECT });
    const doc = all.find((d) => d.id === supersedesId);
    if (!doc) return { ok: false, error: 'That document is not on this project.' };
    const allowed = canSupersede(doc, all);
    if (!allowed.ok) return allowed;
    version = allowed.version;
    previous = doc;
  }
  const check = checkDoc({ kind: input.kind || previous?.kind, title: input.title || previous?.title });
  if (!check.ok) return check;
  if (!file || file.size === 0) return { ok: false, error: 'Choose the file.' };
  const stored = await storeProjectDoc(projectId, file);
  if (!stored.ok) return stored;
  const share = input.share === true || input.share === 'true' || input.share === 'on';
  const doc = await prisma.$transaction(async (tx) => {
    const row = await tx.homeDocument.create({
      data: {
        projectId,
        ...check.value,
        storageKey: stored.path,
        originalName: file.name.slice(0, 200),
        contentType: file.type,
        bytes: file.size,
        uploadedById: staff.userId,
        byStudio: staff.byStudio,
        sharedAt: share ? new Date() : null,
        version,
        supersedesId,
      },
      select: { id: true },
    });
    await recordEvent(tx, {
      projectId,
      type: supersedesId ? 'document.superseded' : 'document.filed',
      actor: staff.actor,
      refId: row.id,
      payload: { kind: check.value.kind, version, shared: share, ...(supersedesId ? { supersedes: supersedesId } : {}) },
    });
    if (share) await recordEvent(tx, { projectId, type: 'document.shared', actor: staff.actor, refId: row.id, payload: { version } });
    return row;
  });
  if (share && staff.customerId) void notify(staff.customerId, { kind: 'document', studio: staff.studioName, title: check.value.title });
  return { ok: true, id: doc.id };
}

/** Share a draft with the customer. Once shared it stays: it can only be replaced by a new version. */
export async function shareDocument(documentId: string): Promise<LockerResult> {
  const doc = await prisma.homeDocument.findUnique({ where: { id: documentId }, select: DOC_SELECT });
  if (!doc || doc.deletedAt) return { ok: false, error: 'That document is not on the project.' };
  const staff = await staffOn(doc.projectId, 'document.upload');
  if (!staff.ok) return staff;
  if (doc.sharedAt) return { ok: true, id: doc.id };
  const shared = await prisma.$transaction(async (tx) => {
    const { count } = await tx.homeDocument.updateMany({ where: { id: doc.id, sharedAt: null, deletedAt: null }, data: { sharedAt: new Date() } });
    if (count === 0) return false;
    await recordEvent(tx, { projectId: doc.projectId, type: 'document.shared', actor: staff.actor, refId: doc.id, payload: { version: doc.version } });
    return true;
  });
  if (shared && staff.customerId) void notify(staff.customerId, { kind: 'document', studio: staff.studioName, title: doc.title });
  return { ok: true, id: doc.id };
}

/** Take a DRAFT off the project (kept for the record). A shared document is refused: replace it with a new version. */
export async function removeDocument(documentId: string): Promise<LockerResult> {
  const doc = await prisma.homeDocument.findUnique({ where: { id: documentId }, select: DOC_SELECT });
  if (!doc) return { ok: false, error: 'That document is gone.' };
  const staff = await staffOn(doc.projectId, 'document.upload');
  if (!staff.ok) return staff;
  const allowed = canRemove(doc);
  if (!allowed.ok) return allowed;
  if (doc.deletedAt) return { ok: true, id: doc.id };
  await prisma.homeDocument.updateMany({ where: { id: doc.id, sharedAt: null }, data: { deletedAt: new Date() } });
  return { ok: true, id: doc.id };
}

/**
 * The product code of a material, and whether it is ordered. Ordering
 * stamps the day; the customer's locker shows the code from then on.
 */
export async function setMaterialCode(materialId: string, input: { code: unknown; ordered?: unknown }): Promise<LockerResult> {
  const m = await prisma.homeMaterial.findUnique({ where: { id: materialId }, select: { id: true, projectId: true, productCode: true, orderedAt: true } });
  if (!m) return { ok: false, error: 'That material is not on the project.' };
  const staff = await staffOn(m.projectId, 'document.upload');
  if (!staff.ok) return staff;
  const code = checkProductCode(input.code);
  if (!code.ok) return code;
  const ordered = input.ordered === undefined ? code.value !== null || m.orderedAt !== null : input.ordered === true || input.ordered === 'true' || input.ordered === 'on';
  const orderedAt = ordered ? (m.orderedAt ?? new Date()) : null;
  const newlyOrdered = orderedAt !== null && (m.orderedAt === null || m.productCode !== code.value);
  await prisma.$transaction(async (tx) => {
    await tx.homeMaterial.update({ where: { id: m.id }, data: { productCode: code.value, orderedAt } });
    if (newlyOrdered) {
      await recordEvent(tx, { projectId: m.projectId, type: 'material.ordered', actor: staff.actor, refId: m.id, payload: { coded: code.value !== null } });
    }
  });
  return { ok: true, id: m.id };
}

/**
 * File a decision's outcome in the locker, inside the pick's transaction: a
 * record pointing at the decision, shared (the customer made it). A re-pick
 * files the next version, superseding the last.
 */
export async function fileDecisionOutcome(
  tx: Prisma.TransactionClient,
  input: { projectId: string; decisionId: string; title: string; option: string; price: string; actor: ProjectActor; userId: string },
): Promise<string> {
  const key = decisionDocKey(input.decisionId);
  const last = await tx.homeDocument.findFirst({
    where: { projectId: input.projectId, storageKey: key, deletedAt: null },
    orderBy: { version: 'desc' },
    select: { id: true, version: true },
  });
  const title = decisionDocTitle(input.title, input.option, input.price);
  const doc = await tx.homeDocument.create({
    data: {
      projectId: input.projectId,
      kind: 'OTHER',
      title,
      storageKey: key,
      originalName: title,
      contentType: DECISION_CONTENT_TYPE,
      bytes: 0,
      uploadedById: input.userId,
      byStudio: false,
      sharedAt: new Date(),
      version: last ? last.version + 1 : 1,
      supersedesId: last?.id ?? null,
    },
    select: { id: true },
  });
  await recordEvent(tx, {
    projectId: input.projectId,
    type: last ? 'document.superseded' : 'document.filed',
    actor: input.actor,
    refId: doc.id,
    payload: { kind: 'DECISION', decisionId: input.decisionId, version: last ? last.version + 1 : 1 },
  });
  return doc.id;
}

// ── What the studio reads ─────────────────────────────────────

export interface LockerDoc {
  id: string;
  kind: DocKind;
  kindLabel: string;
  title: string;
  meta: string;
  url: string;
  version: number;
  shared: boolean;
  /** Filed by itself (signing, a receipt, a decision): nothing to upload or replace. */
  automatic: boolean;
}

export interface LockerMaterial {
  id: string;
  room: string;
  item: string;
  spec: string | null;
  productCode: string | null;
  ordered: boolean;
}

export interface StudioLocker {
  projectId: string;
  /** The newest version of each document, drafts included. */
  docs: LockerDoc[];
  /** How many the customer can open. */
  sharedCount: number;
  drafts: number;
  materials: LockerMaterial[];
  canUpload: boolean;
}

const AUTOMATIC = (d: { kind: string; contentType: string; storageKey: string }) =>
  d.kind === 'RECEIPT' || d.contentType === DECISION_CONTENT_TYPE || d.storageKey.startsWith('signed-quote:');

/** The locker for the studio's workspace card (`project.read`). */
export async function studioLocker(projectId: string): Promise<StudioLocker | null> {
  const staff = await staffOn(projectId, 'project.read');
  if (!staff.ok) return null;
  const [all, materials] = await Promise.all([
    prisma.homeDocument.findMany({ where: { projectId }, orderBy: { createdAt: 'desc' }, take: 300, select: DOC_SELECT }),
    prisma.homeMaterial.findMany({
      where: { projectId },
      orderBy: { sortOrder: 'asc' },
      take: 300,
      select: { id: true, room: true, item: true, spec: true, productCode: true, orderedAt: true },
    }),
  ]);
  const docs = newestVersions(all);
  const urls = await signedDocUrls(docs.map((d) => d.storageKey));
  return {
    projectId,
    docs: docs.map((d, i) => {
      const kind = (d.kind in DOC_KINDS ? d.kind : 'OTHER') as DocKind;
      return {
        id: d.id,
        kind,
        kindLabel: DOC_KINDS[kind],
        title: d.title,
        meta: docMeta(d),
        url: urls[i] ?? '',
        version: d.version,
        shared: d.sharedAt !== null,
        automatic: AUTOMATIC(d),
      };
    }),
    sharedCount: customerVisible(all).length,
    drafts: docs.filter((d) => d.sharedAt === null).length,
    materials: materials.map((m) => ({ id: m.id, room: m.room, item: m.item, spec: m.spec, productCode: m.productCode, ordered: m.orderedAt !== null })),
    canUpload: staff.may('document.upload'),
  };
}
