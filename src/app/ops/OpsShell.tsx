'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { LineIcon } from '@/app/studio/ui/icons';
import { ThemeToggle } from '@/app/studio/ui/theme';

/**
 * The ops console in the studio app's look (owner, 7 Nov 2026): the same
 * colours, Geist type, light and dark themes and grouped side rail as the
 * studio workspace, so the two internal surfaces feel like one product.
 *
 * Grouped by the job rather than listed flat: studios coming in, customers
 * going through, and the numbers. Every page that was in the old dark band is
 * still here.
 */

interface Item {
  href: string;
  label: string;
}

const GROUPS: { title: string; items: Item[] }[] = [
  { title: 'Today', items: [{ href: '/ops', label: 'Overview' }] },
  {
    title: 'Studios',
    items: [
      { href: '/ops/applications', label: 'Applications' },
      { href: '/ops/verification', label: 'Verification' },
      { href: '/ops/allocation', label: 'Allocation' },
      { href: '/ops/coverage', label: 'Coverage' },
      { href: '/ops/discover-photos', label: 'Discover photos' },
    ],
  },
  {
    title: 'Customers',
    items: [
      { href: '/ops/consultations', label: 'Calls' },
      { href: '/ops/follow-ups', label: 'Follow-ups' },
      { href: '/ops/introductions', label: 'Introductions' },
      { href: '/ops/chats', label: 'Chats' },
      { href: '/ops/waitlist', label: 'Waitlist' },
    ],
  },
  {
    title: 'Numbers',
    items: [
      { href: '/ops/funnel', label: 'Funnel' },
      { href: '/ops/experts', label: 'Expert hours' },
      { href: '/ops/data', label: 'Data' },
      { href: '/ops/challenge', label: 'Challenge' },
    ],
  },
];

function isCurrent(path: string, href: string): boolean {
  return href === '/ops' ? path === '/ops' : path === href || path.startsWith(`${href}/`);
}

export function OpsShell({ userName, children }: { userName: string | null; children: React.ReactNode }) {
  const path = usePathname() ?? '';
  const [open, setOpen] = useState(false);
  const current = GROUPS.flatMap((g) => g.items).find((i) => isCurrent(path, i.href));
  const initials = (userName ?? 'Ops')
    .split(/\s+/)
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="app ops-app">
      <aside className={`rail ops-rail${open ? ' open' : ''}`} aria-label="Ops pages">
        <Link href="/ops" className="brand" onClick={() => setOpen(false)}>
          <span className="mark">oi</span>
          <span className="bn">
            <b>One Interiors</b>
            <small>Ops console</small>
          </span>
        </Link>
        {GROUPS.map((g) => (
          <nav key={g.title} aria-label={g.title} className="ops-group">
            <p className="rh">{g.title}</p>
            {g.items.map((i) => (
              <Link
                key={i.href}
                href={i.href}
                className="ri"
                aria-current={isCurrent(path, i.href) ? 'page' : undefined}
                onClick={() => setOpen(false)}
              >
                {i.label}
              </Link>
            ))}
          </nav>
        ))}
        <div className="rfoot">
          <Link href="/" className="ri">
            Public site
          </Link>
          <div className="me">
            <span className="av">{initials}</span>
            <span>
              <b>{userName ?? 'Ops'}</b>
              <small>One Interiors team</small>
            </span>
          </div>
        </div>
      </aside>
      <div className="main">
        <header className="top">
          <button
            type="button"
            className="iconbtn ops-menu"
            aria-label={open ? 'Close the menu' : 'Open the menu'}
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
            style={{ border: 0, cursor: 'pointer' }}
          >
            <LineIcon name="grid" />
          </button>
          <div className="ops-title">
            <small>Ops</small>
            <b>{current?.label ?? 'Console'}</b>
          </div>
          <div className="topr">
            <ThemeToggle />
          </div>
        </header>
        <div className="ops-page">{children}</div>
      </div>
    </div>
  );
}
