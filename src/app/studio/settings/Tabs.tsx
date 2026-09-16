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
 */
const TABS = [
  { href: '/studio/settings', label: 'Your details' },
  { href: '/studio/settings/pipeline', label: 'Pipeline' },
  { href: '/studio/settings/fields', label: 'Fields' },
];

export function SettingsTabs() {
  const pathname = usePathname();

  return (
    <nav className="flex gap-1 overflow-x-auto">
      {TABS.map((tab) => {
        const active = pathname === tab.href;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? 'page' : undefined}
            className={`-mb-px flex-none border-b-2 px-3 py-2.5 text-[14px] no-underline transition-colors ${
              active
                ? 'border-[var(--s-accent)] font-medium text-[var(--s-ink)]'
                : 'border-transparent text-[var(--s-ink-2)] hover:text-[var(--s-ink)]'
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
