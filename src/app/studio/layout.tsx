import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Container } from '@/components/ui';
import { Mark } from '@/components/brand';
import { getCurrentUser, hasRole } from '@/modules/auth/session';
import { signOutAction } from '@/app/sign-in/actions';

/**
 * The studio surface's auth gate.
 *
 * Like `/ops`, this reads the session from Postgres in a server component
 * rather than trusting middleware — the edge runtime cannot query the database,
 * so `src/middleware.ts` is only a cookie pre-filter and is explicitly not the
 * authorisation model.
 */
export default async function StudioLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();

  if (!user) redirect('/sign-in?next=/studio');
  if (!hasRole(user, 'STUDIO')) redirect('/');

  return (
    <div className="min-h-dvh bg-[var(--color-paper)]">
      <header className="border-b border-[var(--color-rule)] bg-[var(--color-paper-2)]">
        <Container size="wide">
          <div className="flex items-center justify-between gap-4 py-3.5">
            <Link href="/studio" className="flex items-center gap-2.5 no-underline">
              <Mark className="h-6 w-6 text-[var(--color-petrol)]" />
              <span className="font-[family-name:var(--font-display)] text-[19px] leading-none text-[var(--color-ink)]">
                One Interiors
              </span>
              <span className="rounded-full bg-[var(--color-petrol-soft)] px-2 py-0.5 font-[family-name:var(--font-mono)] text-[9.5px] uppercase tracking-[0.14em] text-[var(--color-petrol)]">
                Studio
              </span>
            </Link>
            <div className="flex items-center gap-5">
              <span className="hidden text-[13.5px] text-[var(--color-ink-3)] sm:inline">
                {user.email}
              </span>
              {/* A form, not a link. Next prefetches links, so a GET sign-out
                  can log you out just by hovering the nav. */}
              <form action={signOutAction}>
                <button
                  type="submit"
                  className="font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.11em] text-[var(--color-ink-3)] hover:text-[var(--color-ink)]"
                >
                  Sign out
                </button>
              </form>
            </div>
          </div>
        </Container>
      </header>

      {children}
    </div>
  );
}
