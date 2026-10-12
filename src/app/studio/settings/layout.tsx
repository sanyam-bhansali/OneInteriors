import { SettingsTabs, SettingsTitle } from './Tabs';
import { currentMember } from '@/modules/studio/access';
import { can } from '@/modules/studio/roles';
import '../office-ui.css';
import './settings.css';

/**
 * One head and one tab bar for every settings screen.
 *
 * In the layout rather than repeated on each page so the tabs cannot drift out
 * of sync with each other, and so adding the fourth one is a single edit.
 * The look is the owner's handoff (StudioTeam): pill tabs, then "Settings"
 * over the tab's name, then the page.
 */
export default async function SettingsLayout({ children }: { children: React.ReactNode }) {
  const member = await currentMember();
  const team = member !== null && can(member, 'team.manage');
  return (
    <main className="content ox-page st-page">
      <SettingsTabs team={team} />
      <SettingsTitle />
      {children}
    </main>
  );
}
