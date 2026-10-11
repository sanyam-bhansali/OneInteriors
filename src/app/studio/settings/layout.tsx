import { PageHead } from '../StudioShell';
import { SettingsTabs } from './Tabs';
import { currentMember } from '@/modules/studio/access';
import { can } from '@/modules/studio/roles';

/**
 * One head and one tab bar for every settings screen.
 *
 * In the layout rather than repeated on each page so the tabs cannot drift out
 * of sync with each other, and so adding the fourth one is a single edit.
 */
export default async function SettingsLayout({ children }: { children: React.ReactNode }) {
  const member = await currentMember();
  const team = member !== null && can(member, 'team.manage');
  return (
    <>
      <PageHead
        title="Settings"
        sub="Your details on what you send out, and how this software works for you."
      />
      <div className="border-b border-[var(--s-rule)] bg-[var(--s-rail)]/50 px-5 sm:px-7">
        <SettingsTabs team={team} />
      </div>
      {children}
    </>
  );
}
