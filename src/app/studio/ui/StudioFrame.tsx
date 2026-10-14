'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { appForPath, tabForPath, STUDIO_HOME, type StudioApp } from '@/modules/studio/apps';
import type { FoundClient } from '@/modules/studio-practice/clients';
import { searchAction } from '../search-actions';
import { AppIcon, LineIcon } from './icons';
import { Oim, Verified } from './brand';
import { ThemeToggle } from './theme';
import { THEME_KEY } from './theme-script';
import { ProfileMenu } from './ProfileMenu';

/**
 * The studio frame from the owner's UI handoff (12 Oct 2026): no side menu.
 * Inside an app the header carries the apps button, the app's name and tabs,
 * search (Ctrl K), the theme switch, the bell and home. The apps menu shows
 * only this member's apps (`appsFor`, which already asked `mayOpen`), and it
 * closes on every tap and on every page change, so it never reopens on the
 * next page.
 *
 * The role home draws its own header (the launcher), so this frame draws none
 * there, but the search palette and the apps menu work on every page.
 */

export const OPEN_SEARCH_EVENT = 'oi-open-search';

export function StudioFrame({
  apps,
  studioName,
  verified,
  canSearchClients,
  alerts,
  userName,
  signOut,
  children,
}: {
  apps: StudioApp[];
  studioName: string;
  verified: boolean;
  canSearchClients: boolean;
  /** Things waiting on this person (the bell's dot). */
  alerts: number;
  /** The signed-in person, for the profile icon's initials. */
  userName: string | null;
  signOut: () => Promise<void>;
  children: React.ReactNode;
}) {
  const path = usePathname() ?? '';
  const [menu, setMenu] = useState(false);
  const [search, setSearch] = useState(false);

  /* Arriving by an in-app link from outside the studio, the layout's
     pre-paint script did not run: apply the saved theme now. */
  useEffect(() => {
    if (document.documentElement.hasAttribute('data-theme')) return;
    let t: string | null = null;
    try {
      t = localStorage.getItem(THEME_KEY);
    } catch {
      /* private mode */
    }
    document.documentElement.setAttribute('data-theme', t === 'dark' ? 'dark' : 'light');
    window.dispatchEvent(new Event('oi-theme'));
  }, []);

  /* Any page change closes both, so neither reopens on the next page. */
  useEffect(() => {
    setMenu(false);
    setSearch(false);
  }, [path]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setMenu(false);
        setSearch((s) => !s);
      } else if (e.key === 'Escape') {
        setMenu(false);
        setSearch(false);
      }
    };
    const onOpen = () => {
      setMenu(false);
      setSearch(true);
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener(OPEN_SEARCH_EVENT, onOpen);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener(OPEN_SEARCH_EVENT, onOpen);
    };
  }, []);

  const app = appForPath(path, apps);
  const onHome = path === STUDIO_HOME;
  const tab = app ? tabForPath(path, app.tabs) : null;

  return (
    <div className="oi-frame">
      {!onHome && app ? (
        <header className="apphead">
          <button type="button" className="iconbtn" onClick={() => setMenu((m) => !m)} aria-label="All apps" aria-expanded={menu} style={{ border: 0, cursor: 'pointer' }}>
            <LineIcon name="grid" />
          </button>
          <Link href={STUDIO_HOME} className="appid" title="Back to home">
            <span className="appico" style={{ background: app.bg, color: app.fg }}>
              <AppIcon name={app.icon} size={20} />
            </span>
            <b>{app.name}</b>
          </Link>
          {app.tabs.length > 1 ? (
            <nav className="atabs" aria-label={`${app.name} sections`}>
              {app.tabs.map((t) => (
                <Link key={t.href} href={t.href} aria-current={tab?.href === t.href ? 'page' : undefined}>
                  {t.label}
                </Link>
              ))}
            </nav>
          ) : null}
          <div className="topr">
            <button type="button" className="search" onClick={() => setSearch(true)}>
              <LineIcon name="search" size={17} />
              <span>Search</span>
              <kbd>Ctrl K</kbd>
            </button>
            <ThemeToggle />
            <Link href={STUDIO_HOME} className="iconbtn" aria-label={alerts > 0 ? `Notifications, ${alerts} new` : 'Notifications'}>
              <LineIcon name="bell" />
              {alerts > 0 ? <span className="pip" /> : null}
            </Link>
            <Link href={STUDIO_HOME} className="iconbtn" aria-label="Home">
              <LineIcon name="home" />
            </Link>
            <ProfileMenu name={userName} signOut={signOut} />
          </div>
        </header>
      ) : null}

      <div className="oi-page">{children}</div>

      {search ? <Palette apps={apps} canSearchClients={canSearchClients} onClose={() => setSearch(false)} /> : null}
      {menu ? (
        <AppsMenu apps={apps} current={app?.key ?? null} studioName={studioName} verified={verified} signOut={signOut} onClose={() => setMenu(false)} />
      ) : null}
    </div>
  );
}

function AppsMenu({
  apps,
  current,
  studioName,
  verified,
  signOut,
  onClose,
}: {
  apps: StudioApp[];
  current: string | null;
  studioName: string;
  verified: boolean;
  signOut: () => Promise<void>;
  onClose: () => void;
}) {
  return (
    <div className="overlay" style={{ justifyContent: 'flex-start', padding: '64px 24px' }} role="dialog" aria-modal="true" aria-label="All apps">
      <button type="button" className="scrim" aria-label="Close the apps menu" onClick={onClose} />
      <div className="palette" style={{ maxWidth: 600, padding: 18, gap: 16, position: 'relative', zIndex: 1 }}>
        <div className="hstack" style={{ justifyContent: 'space-between' }}>
          <span className="hstack" style={{ gap: 8 }}>
            <b style={{ fontSize: 16 }}>{studioName}</b>
            {verified ? <Verified /> : null}
          </span>
          <button type="button" className="btn ghost sm" onClick={onClose}>
            Close
          </button>
        </div>
        <div className="lgrid2">
          {apps.map((a) => (
            <Link key={a.key} href={a.href} className="lapp" onClick={onClose} aria-current={a.key === current ? 'page' : undefined}>
              <span style={{ background: a.bg, color: a.fg }}>
                <AppIcon name={a.icon} size={22} />
              </span>
              {a.name}
            </Link>
          ))}
        </div>
        <div className="hstack" style={{ justifyContent: 'space-between', borderTop: '1px solid var(--fill2)', paddingTop: 12 }}>
          <Link href={STUDIO_HOME} className="btn ghost sm" onClick={onClose}>
            <LineIcon name="home" size={16} />
            Back to home
          </Link>
          <span className="made" style={{ gap: 6 }}>
            <span>Powered by</span>
            <Oim width={52} />
          </span>
          <form action={signOut}>
            <button type="submit" className="linkbtn">
              Sign out
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

interface Row {
  key: string;
  href: string;
  title: string;
  sub?: string;
  group: 'Apps' | 'Clients';
  app?: StudioApp;
}

function Palette({ apps, canSearchClients, onClose }: { apps: StudioApp[]; canSearchClients: boolean; onClose: () => void }) {
  const router = useRouter();
  const [q, setQ] = useState('');
  const [clients, setClients] = useState<FoundClient[]>([]);
  const [busy, setBusy] = useState(false);
  const [sel, setSel] = useState(0);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => input.current?.focus(), []);

  const query = q.trim();
  useEffect(() => {
    if (!canSearchClients || query.length < 2) {
      setClients([]);
      setBusy(false);
      return;
    }
    setBusy(true);
    let live = true;
    const t = setTimeout(async () => {
      try {
        const found = await searchAction(query);
        if (live) setClients(found);
      } catch {
        if (live) setClients([]);
      } finally {
        if (live) setBusy(false);
      }
    }, 250);
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [query, canSearchClients]);

  const rows = useMemo<Row[]>(() => {
    const ql = query.toLowerCase();
    const appRows: Row[] = [];
    for (const a of apps) {
      if (!ql || a.name.toLowerCase().includes(ql)) appRows.push({ key: `app:${a.key}`, href: a.href, title: a.name, group: 'Apps', app: a });
      for (const t of a.tabs) {
        if (ql && t.href !== a.href && t.label.toLowerCase().includes(ql)) {
          appRows.push({ key: `tab:${t.href}`, href: t.href, title: `${a.name} · ${t.label}`, group: 'Apps', app: a });
        }
      }
    }
    const clientRows: Row[] = clients.map((c) => ({
      key: `c:${c.id}`,
      href: `/studio/clients/${c.id}`,
      title: c.name,
      sub: [c.society, c.stageName, c.assignedToName ? `with ${c.assignedToName}` : 'in the pool'].filter(Boolean).join(' · '),
      group: 'Clients',
    }));
    return [...clientRows, ...appRows];
  }, [apps, clients, query]);

  useEffect(() => setSel(0), [rows.length]);

  const go = useCallback(
    (r: Row | undefined) => {
      if (!r) return;
      onClose();
      router.push(r.href);
    },
    [onClose, router],
  );

  const groups: Row['group'][] = ['Clients', 'Apps'];
  let index = -1;

  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-label="Search">
      <button type="button" className="scrim" aria-label="Close search" onClick={onClose} />
      <div className="palette" style={{ position: 'relative', zIndex: 1 }}>
        <div className="pin">
          <LineIcon name="search" size={20} />
          <input
            ref={input}
            type="text"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') {
                e.preventDefault();
                setSel((s) => Math.min(s + 1, rows.length - 1));
              } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setSel((s) => Math.max(s - 1, 0));
              } else if (e.key === 'Enter') {
                e.preventDefault();
                go(rows[sel]);
              }
            }}
            placeholder={canSearchClients ? 'Type a name, phone, society or an app' : 'Type an app'}
            aria-label="Search everything"
          />
          <button type="button" className="btn ghost sm" onClick={onClose}>
            Esc
          </button>
        </div>
        <div className="pres">
          {groups.map((g) => {
            const list = rows.filter((r) => r.group === g);
            if (list.length === 0) return null;
            return (
              <div className="pg" key={g}>
                <span>{g}</span>
                {list.map((r) => {
                  index += 1;
                  const i = index;
                  return (
                    <Link key={r.key} href={r.href} className="pr" aria-selected={i === sel} onClick={onClose} onMouseEnter={() => setSel(i)}>
                      {r.app ? (
                        <span className="av" style={{ background: r.app.bg, color: r.app.fg }}>
                          <AppIcon name={r.app.icon} size={16} />
                        </span>
                      ) : (
                        <span className="av">{r.title.slice(0, 2).toUpperCase()}</span>
                      )}
                      <span style={{ display: 'flex', flexDirection: 'column' }}>
                        <b>{r.title}</b>
                        {r.sub ? <span className="muted sm">{r.sub}</span> : null}
                      </span>
                    </Link>
                  );
                })}
              </div>
            );
          })}
          {rows.length === 0 ? (
            <div className="pg" style={{ paddingBottom: 12 }}>
              <span>{busy ? 'Looking…' : 'Nothing found'}</span>
            </div>
          ) : null}
        </div>
        <div className="pfoot">
          <span>Enter to open</span>
          <span>Up and down to move</span>
          <span>{canSearchClients ? 'Type a name, phone or society' : 'Type an app'}</span>
        </div>
      </div>
    </div>
  );
}
