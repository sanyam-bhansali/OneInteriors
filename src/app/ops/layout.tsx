import { redirect } from 'next/navigation';
import { getCurrentUser, hasRole } from '@/modules/auth/session';

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
  const user = await getCurrentUser();

  if (!user) redirect('/sign-in');
  if (!hasRole(user, 'OPS')) redirect('/');

  return <>{children}</>;
}
