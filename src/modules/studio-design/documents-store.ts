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
import { signedLine } from '@/modules/project/signoff-rules';
import { DOC_TYPES, docFileName, extOf, finalsOf, handoverMissing, isDocType, markFinalWarning, nameWord, versionLabels, type DocType, type FinalDoc } from './documents';

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
  /** The designer marked it the final of its type and room. */
  markedFinal: boolean;
  /** Said when marking it final: the client has not approved it (documents.ts `markFinalWarning`). */
  finalWarning: string | null;
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
  /** The quotations and the agreement for the handover pack (owner, 1 Nov 2026). */
  papers: HandoverPaper[];
  /** May mark finals (`design.work`). */
  canWork: boolean;
}

/**
 * A quotation or the agreement in the handover pack (walkthrough, 27 Oct
 * 2026: "the final quotation comes in too"; owner, 1 Nov 2026). A quotation is
 * a page, not a file: `href` opens its print page (Save as PDF). The agreement
 * signed on paper is a file, so it has a `url` and goes in the zip.
 */
export interface HandoverPaper {
  key: string;
  label: string;
  /** "Signed by … on …", "Not signed yet", or the date it was filed. */
  line: string;
  done: boolean;
  href: string | null;
  url: string | null;
  fileName: string | null;
}

export async function projectDocuments(projectId: string): Promise<ProjectDocsView | null> {
  const check = await memberOnProject(projectId);
  if (!check.ok) return null;
  const p = await prisma.homeProject.findUnique({
    where: { id: projectId },
    select: {
      signedQuoteId: true,
      designFinalQuoteId: true,
      introduction: {
        select: {
          studio: { select: { tradeName: true, branding: { select: { documentName: true } } } },
          brief: { select: { society: true, locality: true, propertyType: true, contactName: true, user: { select: { name: true } } } },
        },
      },
      documents: {
        where: { deletedAt: null, designKind: { not: null } },
        orderBy: { createdAt: 'asc' },
        select: { id: true, designKind: true, room: true, version: true, supersedesId: true, sharedAt: true, createdAt: true, storageKey: true, uploadedById: true, markedFinalAt: true },
      },
      designReviews: { orderBy: { at: 'asc' }, select: { documentId: true, verdict: true, comment: true } },
    },
  });
  if (!p) return null;
  const paperAgreements = await prisma.homeDocument.findMany({
    where: { projectId, deletedAt: null, kind: 'SIGNED_AGREEMENT' },
    orderBy: { createdAt: 'desc' },
    take: 1,
    select: { storageKey: true, createdAt: true },
  });
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
      markedFinal: d.markedFinalAt !== null,
      finalWarning: markFinalWarning({ type: d.designKind as DocType, answer: a?.verdict ?? null }),
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
    docs.map((d) => ({ id: d.id, type: d.designKind as DocType, room: d.room, version: d.version, supersedesId: d.supersedesId, shared: d.sharedAt !== null, answer: last.get(d.id)?.verdict ?? null, at: d.createdAt, markedFinal: d.markedFinalAt !== null })),
  ).map((f) => {
    const v = views.find((x) => x.id === f.id)!;
    return { ...f, typeLabel: DOC_TYPES[f.type].label, versionLabel: v.versionLabel, fileName: v.fileName, url: v.url, on: v.on };
  });
  const papers = check.access.may('payment.read') ? await handoverPapers(projectId, check.member.studioId, { ...p, paper: paperAgreements[0] ?? null }, client) : [];
  return { projectId, home: homeLabel(b), client, chains, finals, handoverMissing: handoverMissing(finals), papers, canWork: check.access.may('design.work') };
}

/** The sales final and the design final, each with its signature, and the agreement: signed in the app, or the paper copy. */
async function handoverPapers(
  projectId: string,
  studioId: string,
  p: { signedQuoteId: string | null; designFinalQuoteId: string | null; paper: { storageKey: string; createdAt: Date } | null },
  client: string,
): Promise<HandoverPaper[]> {
  const ids = [p.signedQuoteId, p.designFinalQuoteId].filter((x): x is string => Boolean(x));
  const [quotes, signed] = await Promise.all([
    ids.length ? prisma.studioQuote.findMany({ where: { id: { in: ids }, studioId }, select: { id: true, number: true } }) : Promise.resolve([]),
    prisma.homeQuoteSignoff.findMany({
      where: { projectId, signedAt: { not: null }, withdrawnAt: null },
      orderBy: { signedAt: 'desc' },
      select: { kind: true, quoteId: true, revisionN: true, signerName: true, signedAt: true },
    }),
  ]);
  const signedOf = (kind: string, quoteId: string | null) => signed.find((s) => s.kind === kind && (!quoteId || s.quoteId === quoteId));
  const out: HandoverPaper[] = [];
  const quoteRow = (key: string, label: string, kind: string, quoteId: string | null) => {
    if (!quoteId) return;
    const q = quotes.find((x) => x.id === quoteId);
    const s = signedOf(kind, quoteId);
    out.push({
      key,
      label: `${label}${q ? ` ${q.number}` : ''}${s ? ` · R${s.revisionN}` : ''}`,
      line: s?.signedAt && s.signerName ? signedLine(s.signerName, s.signedAt) : 'Not signed yet',
      done: Boolean(s),
      href: `/studio/quotations/${quoteId}/print`,
      url: null,
      fileName: null,
    });
  };
  quoteRow('sales', 'Sales final quotation', 'SALES_FINAL', p.signedQuoteId);
  quoteRow('design', 'Design final quotation', 'DESIGN_FINAL', p.designFinalQuoteId);
  if (p.paper) {
    const ext = extOf(p.paper.storageKey);
    const fileName = `Agreement_${nameWord(client, 'Client')}_${istDay(p.paper.createdAt)}${ext ? `.${ext}` : ''}`;
    const [url] = await signedDocDownloads([{ key: p.paper.storageKey, name: fileName }]).catch(() => ['']);
    out.push({ key: 'agreement', label: 'Agreement (signed on paper)', line: `Filed ${istDay(p.paper.createdAt)}`, done: true, href: null, url: url || null, fileName });
  } else {
    const s = signedOf('AGREEMENT', null);
    out.push({
      key: 'agreement',
      label: 'Agreement',
      line: s?.signedAt && s.signerName ? signedLine(s.signerName, s.signedAt) : 'Not signed yet',
      done: Boolean(s),
      href: s ? `/studio/quotations/${s.quoteId}/print` : null,
      url: null,
      fileName: null,
    });
  }
  return out;
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
