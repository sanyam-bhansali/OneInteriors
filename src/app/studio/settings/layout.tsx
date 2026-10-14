import { SettingsTabs, SettingsTitle } from './Tabs';
import { currentMember } from '@/modules/studio/access';
import { can } from '@/modules/studio/roles';
import { mayOpen } from '@/modules/studio/surfaces';

/** Every settings tab's address (Tabs.tsx); the door (`mayOpen`) decides which this member gets. */
const SETTINGS_TAB_HREFS: readonly string[] = ['/studio/settings/team', '/studio/settings', '/studio/settings/pipeline', '/studio/settings/fields', '/studio/settings/crew', '/studio/settings/sources', '/studio/settings/payments', '/studio/settings/design', '/studio/settings/trades'];
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
  /* Each tab only when the door lets this member open it: the owner-only
     tabs, and (owner, 14 Oct 2026) only what a studio without the full
     software has (studio/pilot.ts). */
  const allowed = member ? SETTINGS_TAB_HREFS.filter((href) => mayOpen(member, href)) : undefined;
  return (
    <main className="content ox-page st-page">
      <SettingsTabs team={team} allowed={allowed} />
      <SettingsTitle />
      {children}
    </main>
  );
}
