import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { CREWS_HOME, DESIGN_HOME, PAYMENTS_HOME } from '@/modules/studio/surfaces';
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
          {/* Studio OS Phase 2: a designer's one way home from a project. */}
          {member.role === 'DESIGNER' ? (
            <Link href={DESIGN_HOME} className="text-[13.5px] font-medium text-[var(--s-accent)] no-underline hover:underline">
              My design work
            </Link>
          ) : null}
          {/* Studio OS Phase 3: accounts keeps and pays the crews as well as the payments desk. */}
          {member.role === 'ACCOUNTS' ? (
            <nav aria-label="Accounts" className="flex items-center gap-4">
              <Link href={PAYMENTS_HOME} className="text-[13.5px] font-medium text-[var(--s-accent)] no-underline hover:underline">
                Payments desk
              </Link>
              <Link href={CREWS_HOME} className="text-[13.5px] font-medium text-[var(--s-accent)] no-underline hover:underline">
                Crews
              </Link>
              <Link href={`${CREWS_HOME}/pay`} className="text-[13.5px] font-medium text-[var(--s-accent)] no-underline hover:underline">
                Pay crews
              </Link>
            </nav>
          ) : null}
          {site ? <LangSwitch value={lang} /> : null}
          {signOut}
        </div>
      </header>
      <main className={site ? 'mx-auto w-full max-w-[560px]' : 'min-w-0'}>{children}</main>
    </div>
  );
}
