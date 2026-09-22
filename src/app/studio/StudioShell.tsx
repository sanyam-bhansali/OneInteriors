'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { Search } from './Search';

/**
 * The frame every studio screen lives in.
 *
 * ## Why a sidebar and not the top bar it replaces
 *
 * The top bar was right for three items and wrong for what this is becoming.
 * A studio's software is a tool somebody operates for an hour at a time, and
 * the navigation is the spine of it: it has to hold a growing set of modules,
 * show which one you are in, and carry counts on the ones that need you.
 * A row of small uppercase links across the top does none of that past about
 * four entries.
 *
 * It collapses to a bottom-anchored drawer on a phone rather than disappearing,
 * because a site supervisor checking a rate on the way to a flat is a real user
 * of this and a hamburger that hides everything is not an answer.
 *
 * ## The rule about `ready`
 *
 * A `ready: false` item is NOT A LINK. It is a span with a tooltip, no href and
 * no tab stop, so it cannot be clicked into an empty page. I shipped the
 * opposite of this once in the Suite — two nav items pointing at routes that
 * did not exist — and it reads as a broken product rather than an early one.
 * Add the page, then flip the flag.
 */

type IconName =
  | 'home' | 'quote' | 'calendar' | 'products' | 'listing'
  | 'clients' | 'projects' | 'vendors' | 'settings';

const PATHS: Record<IconName, string> = {
  home: 'M3.4 11.2 12 4.2l8.6 7M6 12.6v7.2M18 12.6v7.2M7.6 15.2a5 5 0 0 1 8.8 0',
  quote: 'M6.4 3.4h8.2l4 4v13.2H6.4zM14.2 3.6v4.2h4.2M9.2 13h6M9.2 16.4h4',
  calendar: 'M4.2 5.8h15.6v14H4.2zM4.2 10h15.6M8.6 3.6v4M15.4 3.6v4',
  products: 'M20.4 12.6l-7.8 7.8L3.6 11.4V3.6h7.8zM7.6 7.6h.01',
  listing: 'M4 5.6h16M4 12h16M4 18.4h10',
  clients: 'M9.2 8a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4zM3.6 19.4c0-3 2.5-4.9 5.6-4.9s5.6 1.9 5.6 4.9M16.2 5.7a3 3 0 0 1 0 5.5',
  projects: 'M3 6.4h6.4l1.6 2H21v9.2H3z',
  vendors: 'M12 3.2l8 4.2v9.2L12 20.8 4 16.6V7.4zM4 7.4l8 4.2 8-4.2M12 11.6v9.2',
  settings: 'M12 15.2a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4zM19.4 12a7.4 7.4 0 0 0-.1-1.2l2-1.5-2-3.4-2.3 1a7.4 7.4 0 0 0-2-1.2l-.3-2.5h-3.9l-.3 2.5a7.4 7.4 0 0 0-2 1.2l-2.3-1-2 3.4 2 1.5a7.4 7.4 0 0 0 0 2.4l-2 1.5 2 3.4 2.3-1a7.4 7.4 0 0 0 2 1.2l.3 2.5h3.9l.3-2.5a7.4 7.4 0 0 0 2-1.2l2.3 1 2-3.4-2-1.5c.06-.4.1-.8.1-1.2z',
};

function Icon({ name }: { name: IconName }) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="flex-none"
    >
      <path d={PATHS[name]} />
    </svg>
  );
}

/**
 * A row under a section — Pool, Analytics, Bin.
 *
 * No icon on purpose. A second column of icons at this indent competes with
 * the section's own, and the eye stops being able to find the top level.
 */
export interface NavChild {
  href: string;
  label: string;
  ready: boolean;
  count?: number;
}

export interface NavItem {
  icon: IconName;
  href: string;
  label: string;
  ready: boolean;
  /** Shown as a pill on the right of the row. Zero renders nothing. */
  count?: number;
  /**
   * Sub-tabs. A section with children is still a link to its own page —
   * Leads goes to the board — and the children appear beneath it.
   *
   * They are revealed rather than hidden behind a click by default: a studio
   * that never opens the disclosure never learns Pool and Analytics exist,
   * and a feature nobody finds may as well not be built. So the section
   * expands whenever anything inside it is the current page, and the chevron
   * only exists to open it from elsewhere.
   */
  children?: NavChild[];
}

export interface NavGroup {
  label?: string;
  items: NavItem[];
}

/**
 * One nav row, plus its sub-tabs when it has any.
 *
 * ## Why the section is a link AND a disclosure
 *
 * Making the parent a pure toggle would put a dead click on the row somebody
 * reaches for most — "Leads" means the board, and a studio that clicks it and
 * gets an accordion instead of their work will click it twice every time
 * forever. So the row navigates, and a separate chevron opens the section from
 * somewhere else in the app.
 *
 * ## Why it is open by default when you are inside it
 *
 * A collapsed section hides Pool and Analytics from a studio who has never
 * heard of them, and a feature nobody finds may as well not exist. Being on
 * any page in the section reveals the whole section, so the second visit
 * teaches what the first one hid.
 *
 * The manual toggle is therefore an override, not the source of truth: `null`
 * means "follow the URL", and only an explicit click pins it either way.
 */
function Section({
  item,
  activeHref,
  pathname,
  onNavigate,
}: {
  item: NavItem;
  activeHref: string | undefined;
  pathname: string;
  onNavigate: () => void;
}) {
  const children = item.children?.filter((c) => c.ready) ?? [];
  const inSection = pathname === item.href || pathname.startsWith(item.href + '/');
  const [pinned, setPinned] = useState<boolean | null>(null);
  const expanded = children.length > 0 && (pinned ?? inSection);

  /* The parent lights up for its own page, and stays lit — more quietly —
     while you are on a child. Going fully dark on /studio/clients/pool would
     lose the answer to "where am I". */
  const exact = activeHref === item.href;
  const panelId = `nav-${item.href.replace(/\W+/g, '-')}`;

  return (
    <div className="flex flex-col gap-0.5">
      <div className="flex items-center">
        <Link
          href={item.href}
          onClick={onNavigate}
          aria-current={exact ? 'page' : undefined}
          className={`flex min-w-0 flex-1 items-center gap-3 rounded-[9px] px-2.5 py-2 text-[14.5px] no-underline transition-colors ${
            exact
              ? 'bg-[var(--s-rail-active)] font-medium text-[var(--s-ink)] [&>svg]:text-[var(--s-accent)]'
              : inSection
                ? 'font-medium text-[var(--s-ink)] hover:bg-[var(--s-rail-active)]/60 [&>svg]:text-[var(--s-accent)]'
                : 'text-[var(--s-ink-2)] hover:bg-[var(--s-rail-active)]/60'
          }`}
        >
          <Icon name={item.icon} />
          <span className="truncate">{item.label}</span>
          {item.count ? (
            <span className="s-num ml-auto rounded-full bg-[var(--s-accent)] px-1.5 py-px text-[11px] font-semibold text-white">
              {item.count}
            </span>
          ) : null}
        </Link>

        {children.length > 0 ? (
          <button
            type="button"
            onClick={() => setPinned(!expanded)}
            aria-expanded={expanded}
            aria-controls={panelId}
            className="grid h-8 w-7 flex-none place-items-center rounded-[7px] text-[var(--s-ink-3)] transition-colors hover:bg-[var(--s-rail-active)]/60 hover:text-[var(--s-ink)]"
          >
            <span className="sr-only">
              {expanded ? `Hide ${item.label} tabs` : `Show ${item.label} tabs`}
            </span>
            <svg
              width="12"
              height="12"
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
              className={`transition-transform duration-200 motion-reduce:transition-none ${
                expanded ? 'rotate-90' : ''
              }`}
            >
              <path d="M6 3.5 L10.5 8 L6 12.5" />
            </svg>
          </button>
        ) : null}
      </div>

      {expanded ? (
        <div
          id={panelId}
          /* Indented to the parent's label, not its icon, so the sub-tabs read
             as belonging to the word rather than floating in the gutter. The
             rule down the left is what makes the group one object. */
          className="ml-[19px] flex flex-col gap-0.5 border-l border-[var(--s-rule)] pl-2.5"
        >
          {children.map((child) => (
            <Link
              key={child.href}
              href={child.href}
              onClick={onNavigate}
              aria-current={activeHref === child.href ? 'page' : undefined}
              className={`flex items-center gap-2 rounded-[8px] px-2.5 py-1.5 text-[13.5px] no-underline transition-colors ${
                activeHref === child.href
                  ? 'bg-[var(--s-rail-active)] font-medium text-[var(--s-ink)]'
                  : 'text-[var(--s-ink-2)] hover:bg-[var(--s-rail-active)]/60'
              }`}
            >
              <span className="truncate">{child.label}</span>
              {child.count ? (
                <span className="s-num ml-auto rounded-full bg-[var(--s-rail-active)] px-1.5 py-px text-[11px] font-semibold text-[var(--s-ink-2)]">
                  {child.count}
                </span>
              ) : null}
            </Link>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function StudioShell({
  groups,
  studioName,
  email,
  publicHref,
  signOut,
  children,
}: {
  groups: NavGroup[];
  studioName: string;
  email: string | null;
  /** Their live profile, when they have one. */
  publicHref: string | null;
  signOut: React.ReactNode;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  /**
   * Longest match wins, so `/studio/quotations/abc` lights Quotations rather
   * than Dashboard. A plain `startsWith` against `/studio` would light every
   * row on every page.
   */
  const activeHref = groups
    .flatMap((g) => g.items)
    .flatMap((i) => [i, ...(i.children ?? [])])
    .filter((i) => i.ready && (pathname === i.href || pathname.startsWith(i.href + '/')))
    .sort((a, b) => b.href.length - a.href.length)[0]?.href;

  return (
    <div className="studio-app oi-studio-shell flex min-h-dvh">
      {/* ── Rail ── */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-[236px] flex-none flex-col border-r border-[var(--s-rule)] bg-[var(--s-rail)] transition-transform lg:static lg:translate-x-0 ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center gap-2.5 px-5 pb-5 pt-5">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--s-accent)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3.4 11.2 12 4.2l8.6 7M6 12.6v7.2M18 12.6v7.2M7.6 15.2a5 5 0 0 1 8.8 0" />
          </svg>
          <span className="truncate text-[15px] font-semibold tracking-tight">{studioName}</span>
        </div>

        {/* Above the nav, because finding one person is more often what
            somebody wants than going to a section. */}
        <Search />

        <nav className="flex flex-1 flex-col gap-5 overflow-y-auto px-3 pb-4">
          {groups.map((group, gi) => (
            <div key={group.label ?? gi} className="flex flex-col gap-0.5">
              {group.label ? (
                <p className="s-label m-0 mb-1.5 px-2.5">{group.label}</p>
              ) : null}
              {group.items.map((item) =>
                item.ready ? (
                  <Section
                    key={item.href}
                    item={item}
                    activeHref={activeHref}
                    pathname={pathname}
                    onNavigate={() => setOpen(false)}
                  />
                ) : (
                  <span
                    key={item.href}
                    title={`${item.label} — coming soon`}
                    aria-disabled="true"
                    className="flex cursor-default items-center gap-3 rounded-[9px] px-2.5 py-2 text-[14.5px] text-[var(--s-ink-3)] opacity-45"
                  >
                    <Icon name={item.icon} />
                    <span className="truncate">{item.label}</span>
                    <span className="s-label ml-auto normal-case tracking-normal">soon</span>
                  </span>
                ),
              )}
            </div>
          ))}
        </nav>

        <div className="border-t border-[var(--s-rule)] px-3 py-3">
          {publicHref ? (
            <a
              href={publicHref}
              target="_blank"
              rel="noreferrer"
              className="mb-1 flex items-center gap-3 rounded-[9px] px-2.5 py-2 text-[14px] text-[var(--s-ink-2)] no-underline hover:bg-[var(--s-rail-active)]/60"
            >
              <Icon name="listing" />
              <span>Your public profile</span>
              <span className="ml-auto text-[var(--s-ink-3)]">↗</span>
            </a>
          ) : null}
          <p className="m-0 truncate px-2.5 pb-1 pt-1 text-[12.5px] text-[var(--s-ink-3)]">
            {email}
          </p>
          <div className="px-2.5 pb-1">{signOut}</div>
        </div>
      </aside>

      {/* Scrim, phone only. */}
      {open ? (
        <button
          type="button"
          aria-label="Close navigation"
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-30 bg-black/25 lg:hidden"
        />
      ) : null}

      <div className="flex min-w-0 flex-1 flex-col">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex items-center gap-2 border-b border-[var(--s-rule)] bg-[var(--s-rail)] px-4 py-3 text-[14px] font-medium lg:hidden"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
            <path d="M4 7h16M4 12h16M4 17h16" />
          </svg>
          Menu
        </button>

        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}

/**
 * The bar at the top of a screen: what you are looking at, and the one thing
 * you are most likely to want to do about it.
 *
 * One primary action per page, terracotta, on the right. Anything else is a
 * quiet button — if two things on a screen are both the primary action, neither
 * is.
 */
export function PageHead({
  title,
  sub,
  action,
  aside,
}: {
  title: string;
  sub?: React.ReactNode;
  action?: React.ReactNode;
  aside?: React.ReactNode;
}) {
  return (
    <div className="border-b border-[var(--s-rule)] bg-[var(--s-rail)]/50 px-5 py-4 sm:px-7">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
        <div className="min-w-0">
          <h1 className="m-0 truncate text-[20px] font-semibold tracking-tight">{title}</h1>
          {sub ? <div className="mt-0.5 text-[13.5px] text-[var(--s-ink-3)]">{sub}</div> : null}
        </div>
        {aside ? <div className="flex items-center gap-3">{aside}</div> : null}
        {action ? <div className="ml-auto flex items-center gap-2.5">{action}</div> : null}
      </div>
    </div>
  );
}

/** The page body, inside the shell. */
export function PageBody({ children }: { children: React.ReactNode }) {
  return <div className="px-5 py-6 sm:px-7">{children}</div>;
}
