import 'server-only';

/**
 * Who a client can call about their home, for the Chats tab until chat is
 * built (owner, 1 Nov 2026: clients join first; the tab says "coming soon"
 * with the designer's call button). The people on the project's team who
 * speak to the client: its designer and project manager, never site crew.
 * Only the client's own projects, not ones they follow as family.
 */

import { prisma } from '@/lib/prisma';

export interface ProjectContact {
  name: string;
  role: 'Designer' | 'Project manager';
  /** "+919822041736", for a tel: link. */
  phone: string | null;
}

export interface ContactsView {
  studio: string;
  contacts: ProjectContact[];
}

const ROLE_WORDS = { DESIGNER: 'Designer', PM: 'Project manager' } as const;

export async function projectContacts(userId: string): Promise<ContactsView | null> {
  const project = await prisma.homeProject.findFirst({
    where: { cancelledAt: null, introduction: { brief: { userId } } },
    orderBy: { startOn: 'desc' },
    select: {
      introduction: { select: { studio: { select: { tradeName: true } } } },
      /* The project's designer (HomeProject.designerId) first: it is who the client talks to. */
      designer: { select: { id: true, status: true, user: { select: { name: true, phone: true } } } },
      team: {
        where: { member: { role: { in: ['DESIGNER', 'PM'] }, status: 'ACTIVE' } },
        orderBy: { createdAt: 'asc' },
        select: { member: { select: { id: true, role: true, user: { select: { name: true, phone: true } } } } },
      },
    },
  });
  if (!project) return null;
  const designer = project.designer && project.designer.status === 'ACTIVE' ? project.designer : null;
  const contacts: ProjectContact[] = [
    ...(designer ? [{ name: designer.user.name?.trim() || 'Designer', role: 'Designer' as const, phone: designer.user.phone }] : []),
    ...project.team
      .filter(({ member }) => member.id !== designer?.id && (member.role === 'PM' || !designer))
      .map(({ member }) => {
        const role = ROLE_WORDS[member.role as keyof typeof ROLE_WORDS];
        return { name: member.user.name?.trim() || role, role, phone: member.user.phone };
      }),
  ];
  return { studio: project.introduction.studio.tradeName, contacts };
}
