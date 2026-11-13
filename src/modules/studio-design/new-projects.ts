import 'server-only';

/**
 * "New projects" (owner, 13 Nov 2026): the projects Convert made, in design
 * with no designer yet, at the top of the design head's home and the Design
 * board, each with Assign designer. The rules are in new-projects-rules.ts;
 * the assign is design-flow.ts `assignDesigner` (it checks `design.assign`
 * again on the project).
 *
 * Who sees it: whoever may pick a designer (`design.assign`): the owner, the
 * design head (every project), a PM (the projects they are on). Null for
 * everyone else, so a plain designer's home is unchanged.
 */

import { prisma } from '@/lib/prisma';
import { fromDb } from '@/lib/money';
import { can, currentMember, projectsVisibleTo } from '@/modules/studio/access';
import { siteLabel } from '@/modules/studio/team-rules';
import { CATEGORY_WORDS, asQuoteCategory } from '@/modules/studio-quote/category-rules';
import { newProjectsOf, waitingWords } from './new-projects-rules';

export interface NewProjectCard {
  id: string;
  client: string;
  flat: string;
  /** Essential, Premium or Luxe; null on older projects. */
  category: string | null;
  /** The sales-final quotation it was converted on, and its total. */
  quote: { number: string; totalPaise: number | null } | null;
  /** The handover to design, cut short; the project's Design tab has it in full. */
  handover: string | null;
  waiting: string;
}

export interface NewProjects {
  projects: NewProjectCard[];
  /** Who may be picked: active designers first, then PMs and the owner. */
  designers: { id: string; name: string; role: string }[];
}

const HANDOVER_SHOWN = 220;

/** The new projects for the signed-in member, or null when they may not assign designers. */
export async function newProjectsForMe(now = new Date()): Promise<NewProjects | null> {
  const member = await currentMember();
  if (!member || !can(member, 'design.assign', { assigned: true })) return null;
  const rows = await prisma.homeProject.findMany({
    where: { ...projectsVisibleTo(member), cancelledAt: null, designerId: null, phase: 'DESIGN' },
    orderBy: { createdAt: 'asc' },
    take: 50,
    select: {
      id: true,
      phase: true,
      designerId: true,
      cancelledAt: true,
      createdAt: true,
      category: true,
      contractPaise: true,
      signedQuoteId: true,
      introduction: { select: { studioId: true, brief: { select: { society: true, locality: true, propertyType: true, contactName: true, user: { select: { name: true } } } } } },
    },
  });
  const fresh = newProjectsOf(rows);
  if (fresh.length === 0) return { projects: [], designers: [] };
  const quoteIds = fresh.map((p) => p.signedQuoteId).filter((x): x is string => Boolean(x));
  const [quotes, team] = await Promise.all([
    quoteIds.length
      ? prisma.studioQuote.findMany({ where: { id: { in: quoteIds }, studioId: member.studioId }, select: { id: true, number: true, salesFinalNotes: true } })
      : Promise.resolve([]),
    prisma.studioMember.findMany({
      where: { studioId: member.studioId, status: 'ACTIVE', role: { in: ['DESIGNER', 'PM', 'OWNER'] } },
      orderBy: { createdAt: 'asc' },
      select: { id: true, role: true, user: { select: { name: true, phone: true } } },
    }),
  ]);
  const byId = new Map(quotes.map((q) => [q.id, q]));
  const order: Record<string, number> = { DESIGNER: 0, PM: 1, OWNER: 2 };
  return {
    projects: fresh.map((p) => {
      const b = p.introduction.brief;
      const q = p.signedQuoteId ? byId.get(p.signedQuoteId) : undefined;
      const notes = q?.salesFinalNotes?.trim() || null;
      const cat = asQuoteCategory(p.category);
      return {
        id: p.id,
        client: b.contactName?.trim() || b.user?.name?.trim() || 'Client',
        flat: siteLabel(b),
        category: cat ? CATEGORY_WORDS[cat] : null,
        quote: q ? { number: q.number, totalPaise: p.contractPaise === null ? null : fromDb(p.contractPaise) } : null,
        handover: notes ? (notes.length > HANDOVER_SHOWN ? `${notes.slice(0, HANDOVER_SHOWN).trimEnd()}…` : notes) : null,
        waiting: waitingWords(p.createdAt, now),
      };
    }),
    designers: team
      .map((m) => ({ id: m.id, name: m.user.name?.trim() || m.user.phone || 'Team member', role: m.role }))
      .sort((a, b) => (order[a.role] ?? 3) - (order[b.role] ?? 3)),
  };
}
