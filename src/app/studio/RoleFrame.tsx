import { prisma } from '@/lib/prisma';
import { getLang } from '@/modules/i18n/server';
import type { StudioMemberRef } from '@/modules/studio/access';
import { ROLE_NAMES } from '@/modules/studio/team-rules';
import { LangSwitch } from './LangSwitch';

/**
 * The frame for a studio team member who does not work in the office: a site
 * supervisor (site mode, phone first, in their language) or accounts (the
 * payments desk). No office rail, no client search — there is nothing behind
 * them for these roles, and showing it would be a sign on a locked door.
 */
export async function RoleFrame({
  member,
  name,
  signOut,
  children,
}: {
  member: StudioMemberRef;
  name: string | null;
  signOut: React.ReactNode;
  children: React.ReactNode;
}) {
  const studio = await prisma.studio
    .findUnique({ where: { id: member.studioId }, select: { tradeName: true } })
    .catch(() => null);
  const site = member.role === 'SUPERVISOR';
  const lang = site ? await getLang() : 'en';

  return (
    <div className="studio-app min-h-dvh bg-[var(--s-ground)] text-[var(--s-ink)]">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--s-rule)] bg-[var(--s-rail)] px-5 py-3 sm:px-7">
        <div className="min-w-0">
          <p className="m-0 truncate text-[15px] font-semibold tracking-tight">{studio?.tradeName ?? 'Your studio'}</p>
          <p className="m-0 truncate text-[12.5px] text-[var(--s-ink-3)]">
            {[name, ROLE_NAMES[member.role]].filter(Boolean).join(' · ')}
          </p>
        </div>
        <div className="flex items-center gap-4">
          {site ? <LangSwitch value={lang} /> : null}
          {signOut}
        </div>
      </header>
      <main className={site ? 'mx-auto w-full max-w-[560px]' : 'min-w-0'}>{children}</main>
    </div>
  );
}
