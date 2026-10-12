'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { Lang } from '@/modules/i18n/site';
import { HomeIcon, PersonIcon, WrenchIcon } from './icons';
import { siteWords } from './words';

/**
 * Site mode's bottom bar: Today · Snags · Me. Fixed to the bottom of the
 * phone, each tab 60 px tall with an icon and a word. Drawn once for every
 * site screen by site/layout.tsx (Snags is Phase 4's /studio/site/snag), and
 * left out on the full-screen tasks whose own big button sits at the bottom.
 */
export function SiteBar({ lang }: { lang: Lang }) {
  const t = siteWords(lang);
  const path = usePathname() ?? '';
  // Full-screen tasks keep the bottom of the phone for their own big button.
  if (path.startsWith('/studio/site/post/') || /^\/studio\/site\/snag\/[^/]+/.test(path)) return null;
  const tabs = [
    { href: '/studio/site', label: t('bar.today'), icon: <HomeIcon />, on: path === '/studio/site' || path.startsWith('/studio/site/post') },
    { href: '/studio/site/snag', label: t('bar.snags'), icon: <WrenchIcon />, on: path.startsWith('/studio/site/snag') },
    { href: '/studio/site/me', label: t('bar.me'), icon: <PersonIcon />, on: path.startsWith('/studio/site/me') },
  ];
  return (
    <>
      <div aria-hidden="true" style={{ height: 84 }} />
      <nav aria-label="Site mode" className="st-bar">
        <div>
          {tabs.map((tab) => (
            <Link key={tab.href} href={tab.href} aria-current={tab.on ? 'page' : undefined} className="st-tab">
              {tab.icon}
              {tab.label}
            </Link>
          ))}
        </div>
      </nav>
    </>
  );
}
