import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { PATH_HEADER, isProjectApp, projectsOnly } from '@/lib/host';
import { hasDatabase } from '@/lib/env';
import { getCurrentUser } from '@/modules/auth/session';
import { customerMustChoose } from '@/modules/auth/customer-password';
import { hasLiveProject } from '@/modules/portal/project-store';
import { AppMode } from '@/components/app/mode';
import '@/components/app/app.css';

export const metadata: Metadata = {
  title: { default: 'One Interiors', template: '%s · One Interiors' },
};

/** Pages a signed-out client, or one with no project yet, must still reach. */
const DOORS = ['/app/sign-in', '/app/password', '/app/connect', '/app/join', '/app/session'];

/**
 * The One Interiors app — the owner's v1 screens (8 Oct 2026), at /app.
 * What the installed icon opens (src/app/manifest.ts). Gated with the rest of
 * the customer side by CUSTOMER_LIVE (lib/host.ts).
 *
 * When only the project app is open (`CUSTOMER_PROJECTS_LIVE`, owner 1 Nov
 * 2026), a real client must never meet the labelled example project: a
 * signed-out visitor is sent to sign in, a signed-in one with no project to
 * "Connect your project". Either way, a one-time password is replaced first.
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const path = (await headers()).get(PATH_HEADER);
  /* No header (middleware did not run) means no redirect: redirecting on a guess could loop. */
  if (path && hasDatabase() && !DOORS.some((d) => path === d || path.startsWith(`${d}/`))) {
    const onlyProjects = projectsOnly() && isProjectApp(path);
    const user = await getCurrentUser();
    if (!user) {
      if (onlyProjects) redirect(`/app/sign-in?next=${encodeURIComponent(path)}`);
    } else {
      if (await customerMustChoose(user.id)) redirect(`/app/password?next=${encodeURIComponent(path)}`);
      if (onlyProjects && user.role === 'CUSTOMER' && !(await hasLiveProject(user.id))) redirect('/app/connect');
    }
  }
  return (
    <div className="oa">
      <AppMode projectsOnly={projectsOnly()}>{children}</AppMode>
    </div>
  );
}
