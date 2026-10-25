import 'server-only';

/**
 * A project's documents for the studio (owner and Hauspire's design team,
 * 24 Oct 2026; docs/studio-os/DESIGN-PROCESS-PLAN.md §3.4–3.5): every version
 * of every type for the repository ("Show all versions"), the finals for the
 * handover pack, and the folders of the Documents app. Reads only; the rules
 * are documents.ts. Whoever may read the project (memberOnProject).
 */

import { prisma } from '@/lib/prisma';
import { memberOnProject } from '@/modules/studio/access';
import { currentMember } from '@/modules/studio/access';
import { projectsVisibleTo } from '@/modules/studio/roles';
import { istDay } from '@/modules/project/working-days';
import { signedDocDownloads } from '@/modules/storage/project-docs';
import { homeLabel } from '@/modules/studio/workspace-view';
import { DOC_TYPES, docFileName, extOf, finalsOf, handoverMissing, isDocType, versionLabels, type DocType, type FinalDoc } from './documents';

export interface DocVersionView {
  id: string;
  /** The upload's place in its chain (1, 2, 3…). */
  version: number;
  versionLabel: string;
  /** 'replaced': an older version nobody answered, a newer one came after it. */
  state: 'approved' | 'changes' | 'waiting' | 'shared' | 'draft' | 'replaced';
  on: string;
  by: string;
  fileName: string;
  url: string;
  comment: string | null;
}

export interface DocChainView {
  type: DocType;
  typeLabel: string;
  room: string | null;
  /** Newest first. */
  versions: DocVersionView[];
}

export interface ProjectDocsView {
  projectId: string;
  home: string;
  client: string;
  chains: DocChainView[];
  finals: (FinalDoc & { typeLabel: string; versionLabel: string; fileName: string; url: string; on: string })[];
  handoverMissing: string[];
}

export async function projectDocuments(projectId: string): Promise<ProjectDocsView | null> {
  const check = await memberOnProject(projectId);
  if (!check.ok) return null;
  const p = await prisma.homeProject.findUnique({
    where: { id: projectId },
    select: {
      introduction: {
        select: {
          studio: { select: { tradeName: true, branding: { select: { documentName: true } } } },
          brief: { select: { society: true, locality: true, propertyType: true, contactName: true, user: { select: { name: true } } } },
        },
      },
      documents: {
        where: { deletedAt: null, designKind: { not: null } },
        orderBy: { createdAt: 'asc' },
        select: { id: true, designKind: true, room: true, version: true, supersedesId: true, sharedAt: true, createdAt: true, storageKey: true, uploadedById: true },
      },
      designReviews: { orderBy: { at: 'asc' }, select: { documentId: true, verdict: true, comment: true } },
    },
  });
  if (!p) return null;
  const b = p.introduction.brief;
  const client = b.contactName?.trim() || b.user?.name?.trim() || 'Client';
  const studio = p.introduction.studio.branding?.documentName?.trim() || p.introduction.studio.tradeName;
  const docs = p.documents.filter((d) => isDocType(d.designKind));
  const last = new Map<string, { verdict: 'APPROVED' | 'CHANGES'; comment: string | null }>();
  for (const r of p.designReviews) last.set(r.documentId, { verdict: r.verdict, comment: r.comment });
  const approved = new Set([...last.entries()].filter(([, v]) => v.verdict === 'APPROVED').map(([k]) => k));
  const labels = versionLabels(docs, approved);
  const names = docs.map((d) => docFileName({ type: d.designKind as DocType, room: d.room, studio, client, at: d.createdAt, version: labels.get(d.id) ?? '1.0', ext: extOf(d.storageKey) }));
  const urls = await signedDocDownloads(docs.map((d, k) => ({ key: d.storageKey, name: names[k]! }))).catch(() => docs.map(() => ''));
  const people = await prisma.user.findMany({ where: { id: { in: [...new Set(docs.map((d) => d.uploadedById))] } }, select: { id: true, name: true } });
  const byName = (id: string) => people.find((u) => u.id === id)?.name?.trim() || 'The team';

  const superseded = new Set(docs.map((d) => d.supersedesId).filter((x): x is string => Boolean(x)));
  const views = docs.map((d, k): DocVersionView & { type: DocType; room: string | null } => {
    const a = last.get(d.id);
    const needs = DOC_TYPES[d.designKind as DocType].approval;
    const replaced = superseded.has(d.id) && !a;
    return {
      id: d.id,
      type: d.designKind as DocType,
      room: d.room,
      version: d.version,
      versionLabel: labels.get(d.id) ?? '1.0',
      state: a?.verdict === 'APPROVED' ? 'approved' : replaced ? 'replaced' : !d.sharedAt ? 'draft' : !needs ? 'shared' : a?.verdict === 'CHANGES' ? 'changes' : 'waiting',
      on: istDay(d.createdAt),
      by: byName(d.uploadedById),
      fileName: names[k]!,
      url: urls[k] ?? '',
      comment: a?.comment ?? null,
    };
  });
  const chainsMap = new Map<string, DocChainView>();
  for (const v of views) {
    const key = `${v.type}|${(v.room ?? '').toLowerCase()}`;
    const c = chainsMap.get(key) ?? { type: v.type, typeLabel: DOC_TYPES[v.type].label, room: v.room, versions: [] };
    c.versions.push(v);
    chainsMap.set(key, c);
  }
  const order = Object.keys(DOC_TYPES);
  const chains = [...chainsMap.values()]
    .map((c) => ({ ...c, versions: [...c.versions].sort((x, y) => y.version - x.version) }))
    .sort((a, b) => order.indexOf(a.type) - order.indexOf(b.type) || (a.room ?? '').localeCompare(b.room ?? ''));
  const finals = finalsOf(
    docs.map((d) => ({ id: d.id, type: d.designKind as DocType, room: d.room, version: d.version, supersedesId: d.supersedesId, shared: d.sharedAt !== null, answer: last.get(d.id)?.verdict ?? null, at: d.createdAt })),
  ).map((f) => {
    const v = views.find((x) => x.id === f.id)!;
    return { ...f, typeLabel: DOC_TYPES[f.type].label, versionLabel: v.versionLabel, fileName: v.fileName, url: v.url, on: v.on };
  });
  return { projectId, home: homeLabel(b), client, chains, finals, handoverMissing: handoverMissing(finals) };
}

export interface DocFolder {
  projectId: string;
  client: string;
  home: string;
  phase: string;
  documents: number;
  approved: number;
}

/** The Documents app: one folder per project the member sees, with how many documents and how many approved. */
export async function documentFolders(): Promise<DocFolder[] | null> {
  const member = await currentMember();
  if (!member) return null;
  const projects = await prisma.homeProject.findMany({
    where: { ...projectsVisibleTo(member), cancelledAt: null },
    orderBy: { startOn: 'desc' },
    take: 400,
    select: {
      id: true,
      phase: true,
      introduction: { select: { brief: { select: { society: true, locality: true, propertyType: true, contactName: true, user: { select: { name: true } } } } } },
      documents: { where: { deletedAt: null, designKind: { not: null } }, select: { id: true } },
      designReviews: { orderBy: { at: 'asc' }, select: { documentId: true, verdict: true } },
    },
  });
  return projects.map((p) => {
    const last = new Map<string, string>();
    for (const r of p.designReviews) last.set(r.documentId, r.verdict);
    const b = p.introduction.brief;
    return {
      projectId: p.id,
      client: b.contactName?.trim() || b.user?.name?.trim() || 'Client',
      home: homeLabel(b),
      phase: p.phase,
      documents: p.documents.length,
      approved: p.documents.filter((d) => last.get(d.id) === 'APPROVED').length,
    };
  });
}
