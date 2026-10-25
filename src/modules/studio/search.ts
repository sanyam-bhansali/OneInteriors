import 'server-only';

/**
 * Ctrl K, beyond clients (the design meeting, 24 Oct 2026;
 * docs/studio-os/DESIGN-PROCESS-PLAN.md §5): "Rohan 2D layout" opens Rohan's
 * documents; "iron bar" finds the note that said it. Projects, quotations,
 * documents and notes, each only as far as the member may read (projects
 * they see, quotations they see, notes on leads they see and projects they
 * are on). Reads only, scoped by the member's studio; a few rows a group.
 */

import { prisma } from '@/lib/prisma';
import { currentMember } from './access';
import { can, projectsVisibleTo, quotesVisibleTo } from './roles';
import { leadScopeFor } from './lead-scope';
import { homeLabel } from './workspace-view';
import { DOC_TYPES, type DocType } from '@/modules/studio-design/documents';

export interface FoundThing {
  key: string;
  group: 'Projects' | 'Quotations' | 'Documents' | 'Notes';
  title: string;
  sub: string;
  href: string;
}

const TAKE = 6;

/** Words that name a document type ("2d", "3d", "wd", "working", "electrical", "material", "cut"). */
const TYPE_WORDS: { re: RegExp; type: DocType }[] = [
  { re: /^(2d|layout|layouts)$/i, type: 'LAYOUT_2D' },
  { re: /^(3d|render|renders)$/i, type: 'RENDER_3D' },
  { re: /^(wd|working)$/i, type: 'WORKING' },
  { re: /^(elec|electrical)$/i, type: 'ELECTRICAL' },
  { re: /^(material|materials|matlist)$/i, type: 'MATERIAL_LIST' },
  { re: /^(cut|cutlist)$/i, type: 'CUT_LIST' },
];
const FILLER = /^(drawing|drawings|list|and|&|the|of|for|quotation|final)$/i;

export async function searchEverything(raw: string): Promise<FoundThing[]> {
  const member = await currentMember();
  if (!member) return [];
  const q = String(raw ?? '').trim().slice(0, 80);
  if (q.length < 2) return [];
  const words = q.split(/\s+/);
  const docType = TYPE_WORDS.find((t) => words.some((w) => t.re.test(w)))?.type ?? null;
  const nameWords = words.filter((w) => !TYPE_WORDS.some((t) => t.re.test(w)) && !FILLER.test(w));
  const name = nameWords.join(' ');
  const out: FoundThing[] = [];
  const studioId = member.studioId;
  const projectScope = can(member, 'project.read', { assigned: true }) ? projectsVisibleTo(member) : null;

  // Projects (and, with a type word, their documents): by the client's name or society.
  if (projectScope && name.length >= 2) {
    const projects = await prisma.homeProject.findMany({
      where: {
        AND: [projectScope],
        cancelledAt: null,
        introduction: { studioId, brief: { OR: [{ contactName: { contains: name, mode: 'insensitive' } }, { society: { contains: name, mode: 'insensitive' } }, { user: { name: { contains: name, mode: 'insensitive' } } }] } },
      },
      orderBy: { startOn: 'desc' },
      take: TAKE,
      select: { id: true, phase: true, introduction: { select: { brief: { select: { contactName: true, society: true, locality: true, propertyType: true, user: { select: { name: true } } } } } } },
    });
    for (const p of projects) {
      const b = p.introduction.brief;
      const client = b.contactName?.trim() || b.user?.name?.trim() || 'Client';
      if (docType) out.push({ key: `d:${p.id}:${docType}`, group: 'Documents', title: `${DOC_TYPES[docType].label} · ${client}`, sub: homeLabel(b), href: `/studio/projects/${p.id}/documents` });
      out.push({ key: `p:${p.id}`, group: 'Projects', title: client, sub: homeLabel(b), href: `/studio/projects/${p.id}` });
    }
  }

  // Quotations: by number or the client's name.
  const quoteScope = quotesVisibleTo(member);
  {
    const quotes = await prisma.studioQuote.findMany({
      where: { AND: [quoteScope], studioId, OR: [{ number: { contains: q, mode: 'insensitive' } }, { clientName: { contains: name || q, mode: 'insensitive' } }] },
      orderBy: { updatedAt: 'desc' },
      take: TAKE,
      select: { id: true, number: true, clientName: true, stage: true, status: true },
    });
    for (const x of quotes) out.push({ key: `q:${x.id}`, group: 'Quotations', title: `${x.number} · ${x.clientName}`, sub: `${x.stage === 'DESIGN' ? 'Design final' : 'Sales'} · ${x.status.toLowerCase()}`, href: `/studio/quotations/${x.id}` });
  }

  // Notes: on leads they see, on projects they are on (team notes), and sales' notes for design. Three letters at least.
  if (q.length >= 3) {
    const lead = leadScopeFor(member);
    if (lead) {
      const notes = await prisma.studioClientEvent.findMany({
        where: { studioId, kind: 'NOTE', summary: { contains: q, mode: 'insensitive' }, client: { AND: [lead.leads], deletedAt: null } },
        orderBy: { createdAt: 'desc' },
        take: TAKE,
        select: { id: true, summary: true, createdAt: true, client: { select: { id: true, name: true } } },
      });
      for (const n of notes) out.push({ key: `n:${n.id}`, group: 'Notes', title: n.summary.slice(0, 90), sub: `${n.client.name} · ${n.createdAt.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}`, href: `/studio/clients/${n.client.id}` });
    }
    if (projectScope) {
      const team = await prisma.homeProject.findMany({
        where: { AND: [projectScope], cancelledAt: null, teamNotes: { contains: q, mode: 'insensitive' } },
        take: TAKE,
        select: { id: true, teamNotes: true, introduction: { select: { brief: { select: { contactName: true, user: { select: { name: true } } } } } } },
      });
      for (const p of team) {
        const text = p.teamNotes ?? '';
        const at = text.toLowerCase().indexOf(q.toLowerCase());
        out.push({ key: `t:${p.id}`, group: 'Notes', title: text.slice(Math.max(0, at - 30), at + 60).trim(), sub: `Team notes · ${p.introduction.brief.contactName?.trim() || p.introduction.brief.user?.name || 'Client'}`, href: `/studio/projects/${p.id}` });
      }
    }
    const salesNotes = await prisma.studioQuote.findMany({
      where: { AND: [quoteScope], studioId, salesFinalNotes: { contains: q, mode: 'insensitive' } },
      take: TAKE,
      select: { id: true, number: true, clientName: true, salesFinalNotes: true },
    });
    for (const x of salesNotes) {
      const text = x.salesFinalNotes ?? '';
      const at = text.toLowerCase().indexOf(q.toLowerCase());
      out.push({ key: `s:${x.id}`, group: 'Notes', title: text.slice(Math.max(0, at - 30), at + 60).trim(), sub: `Sales notes · ${x.number} · ${x.clientName}`, href: `/studio/quotations/${x.id}` });
    }
  }
  return out;
}
