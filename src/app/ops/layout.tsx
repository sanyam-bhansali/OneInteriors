import { redirect } from 'next/navigation';
import { getCurrentUser, hasRole } from '@/modules/auth/session';
import { opsWithoutAuth } from '@/lib/env';

/**
 * Every /ops route is gated here.
 *
 * This replaces the `middleware.ts` 404 stopgap, which was a lock on a door
 * rather than a security model — it depended on an env var and would have
 * exposed legal names and GSTINs if that var were ever set carelessly.
 *
 * The check runs in a layout rather than middleware on purpose: middleware
 * cannot query Postgres (it runs on the edge runtime), so a role check there
 * would have to trust a claim in the cookie. Reading the role from the database
 * per request means a revoked or downgraded user loses access immediately.
 *
 * Note this protects rendering, not mutation. Every server action under /ops
 * calls `requireRole` itself — a layout guard is not an authorisation model for
 * writes, because actions are directly invocable.
 */
export default async function OpsLayout({ children }: { children: React.ReactNode }) {
  /**
   * The development bypass, and the banner that makes it impossible to forget.
   *
   * `opsWithoutAuth()` is off unless explicitly set and refuses to work once the
   * roster is declared real — read its comment before touching it. While it is
   * on, everything under /ops is readable by anyone who guesses the URL.
   */
  if (opsWithoutAuth()) {
    return (
      <>
        <div className="bg-[var(--color-atrisk)] py-2 text-center">
          <p className="m-0 font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.11em] text-white">
            Dev · ops console is open to anyone with this URL · no sign-in required
          </p>
        </div>
        {children}
      </>
    );
  }

  const user = await getCurrentUser();

  if (!user) redirect('/sign-in');
  if (!hasRole(user, 'OPS')) redirect('/');

  return <>{children}</>;
}
