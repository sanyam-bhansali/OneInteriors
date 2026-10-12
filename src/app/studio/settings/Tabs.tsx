'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

/**
 * The settings tabs.
 *
 * Three today and it will be seven — team, alerts, sources, billing. Tabs
 * rather than one long scrolling page because these are unrelated decisions
 * made at unrelated times: branding is set once before the first quotation,
 * the pipeline gets edited in the first week and then rarely, fields get added
 * whenever a studio realises they keep writing the same thing in the notes.
 *
 * Drawn as the design's pill tabs (StudioTeam), with the page's own heading
 * ("Settings" over the tab's name) under them.
 */
const TABS = [
  { href: '/studio/settings', label: 'Your details' },
  { href: '/studio/settings/pipeline', label: 'Pipeline' },
  { href: '/studio/settings/fields', label: 'Fields' },
  { href: '/studio/settings/crew', label: 'Crew' },
  { href: '/studio/settings/sources', label: 'Lead sources' },
];

/** The payment stages for the studio's own sales are the owner's (`payments.template`). */
const PAYMENTS_TAB = { href: '/studio/settings/payments', label: 'Payment stages' };

/** Studio OS Phase 2: the studio's design steps are the owner's too (`design.template`). */
const DESIGN_TAB = { href: '/studio/settings/design', label: 'Design steps' };

/** Studio OS Phase 3: trades, routing and crew settings are the owner's (`crew.settings`). */
const CREWS_TAB = { href: '/studio/settings/trades', label: 'Crews and trades' };

/** Team is the owner's alone (`team.manage`), so the tab is only drawn for them. */
const TEAM_TAB = { href: '/studio/settings/team', label: 'Team' };

const ALL = [...TABS, PAYMENTS_TAB, DESIGN_TAB, CREWS_TAB, TEAM_TAB];

export function SettingsTabs({ team = false }: { team?: boolean }) {
  const pathname = usePathname();
  const tabs = team ? [TEAM_TAB, ...TABS, PAYMENTS_TAB, DESIGN_TAB, CREWS_TAB] : TABS;

  return (
    <nav className="tabs st-tabs" aria-label="Settings">
      {tabs.map((tab) => {
        const active = pathname === tab.href;
        return (
          <Link key={tab.href} href={tab.href} aria-current={active ? 'page' : undefined}>
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}

/** "Settings" over the open tab's name, as the design's Team page has it. */
export function SettingsTitle() {
  const pathname = usePathname();
  const tab = ALL.find((t) => t.href === pathname);
  return (
    <div className="phead">
      <div>
        <span className="eyebrow">Settings</span>
        <h1>{tab?.label ?? 'Settings'}</h1>
      </div>
    </div>
  );
}
