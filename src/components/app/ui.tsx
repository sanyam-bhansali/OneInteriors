'use client';

/**
 * The app's parts — the owner's v1 screens (8 Oct 2026). Every screen is a
 * `Frame` with an optional `Head`, a `Body` and a pinned `Foot`; the project
 * screens add the `Tabs`.
 */

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useCallback, useSyncExternalStore, type ReactNode } from 'react';
import { loadBrief, saveBrief } from '@/modules/brief/store';
import type { Brief } from '@/modules/brief/types';

export function Frame({ children, dark = false }: { children: ReactNode; dark?: boolean }) {
  return <div className={`oa-frame${dark ? ' dark' : ''}`}>{children}</div>;
}

export function Head({ back, meta }: { back?: string | (() => void) | null; meta?: ReactNode }) {
  const router = useRouter();
  const goBack = () => {
    if (typeof back === 'function') back();
    else if (typeof back === 'string') router.push(back);
    else router.back();
  };
  return (
    <header className="oa-head">
      {back === null ? (
        <span />
      ) : (
        <button type="button" className="oa-back" onClick={goBack} aria-label="Back">
          <Chevron />
        </button>
      )}
      {meta ? <span className="oa-meta">{meta}</span> : null}
    </header>
  );
}

export function Progress({ step, of }: { step: number; of: number }) {
  return (
    <div className="oa-progress" aria-hidden>
      {Array.from({ length: of }, (_, i) => (
        <i key={i} className={i < step ? 'on' : ''} />
      ))}
    </div>
  );
}

export function Body({ children }: { children: ReactNode }) {
  return <main className="oa-body">{children}</main>;
}

export function Foot({ children }: { children: ReactNode }) {
  return <div className="oa-foot">{children}</div>;
}

export function Cta({
  children,
  onClick,
  href,
  disabled,
  tone,
}: {
  children: ReactNode;
  onClick?: () => void;
  href?: string;
  disabled?: boolean;
  tone?: 'black' | 'light' | 'ghost';
}) {
  const cls = `oa-cta${tone ? ` ${tone}` : ''}`;
  const inner = (
    <>
      {children}
      <Arrow />
    </>
  );
  if (href && !disabled) {
    return (
      <Link className={cls} href={href}>
        {inner}
      </Link>
    );
  }
  return (
    <button type="button" className={cls} onClick={onClick} disabled={disabled}>
      {inner}
    </button>
  );
}

/*
 * The brief, shared with the website's sessionStorage copy (`modules/brief/store`).
 *
 * Kept in memory once read, so a screen opened from another screen has it on
 * its very first paint — no blank frame while it is fetched from storage.
 * Only a full page load starts empty, for one render, because the server
 * cannot see sessionStorage.
 */
let current: Brief | undefined;
const listeners = new Set<() => void>();
const readBrief = (): Brief => (current ??= loadBrief());
const onBrief = (fn: () => void) => {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
};

export function useBrief(): [Brief | null, (patch: Partial<Brief>) => void] {
  const brief = useSyncExternalStore(onBrief, readBrief, () => null);
  const update = useCallback((patch: Partial<Brief>) => {
    current = { ...readBrief(), ...patch };
    saveBrief(current);
    listeners.forEach((fn) => fn());
  }, []);
  return [brief, update];
}

// ── After signing: the tab bar (v79) ──────────────────────────
//
// Home · Project · GEIO · Site · Me. Snags and decisions live inside
// Project, 3D inside Site, the Locker inside Me; GEIO is the orb in the
// middle, so there is no floating button over the screens.

const TABS = [
  { href: '/app/home', label: 'Home', icon: <HomeIcon />, also: [] as string[] },
  { href: '/app/project', label: 'Project', icon: <ListIcon />, also: ['/app/snags', '/app/decision'] },
  { href: '/app/geio', label: 'GEIO', icon: null, also: [] },
  { href: '/app/site', label: 'Site', icon: <CameraIcon />, also: ['/app/3d'] },
  { href: '/app/me', label: 'Me', icon: <PersonIcon />, also: ['/app/locker', '/app/notifications'] },
];

export function Tabs() {
  const path = usePathname();
  return (
    <nav className="oa-tabs" aria-label="Your project">
      {TABS.map((t) => {
        const here = path === t.href || t.also.some((a) => path?.startsWith(a));
        return (
          <Link key={t.href} href={t.href} className={`oa-tab${t.icon ? '' : ' geio'}`} aria-current={here ? 'page' : undefined}>
            {t.icon ?? <span className="oa-orb" aria-hidden />}
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}

// ── Icons, drawn here so the app needs no icon library ─────────

const S = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.7,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
} as const;

export function Chevron() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden {...S}>
      <path d="M12.5 4.5 7 10l5.5 5.5" />
    </svg>
  );
}
export function Arrow() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden {...S}>
      <path d="M3.5 9h11M10 4.5 14.5 9 10 13.5" />
    </svg>
  );
}
function HomeIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden {...S}>
      <path d="M4 11 12 4l8 7v8.5a.5.5 0 0 1-.5.5H15v-6H9v6H4.5a.5.5 0 0 1-.5-.5Z" />
    </svg>
  );
}
function ListIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden {...S}>
      <path d="M5 7h14M5 12h10M5 17h7" />
    </svg>
  );
}
export function CameraIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden {...S}>
      <path d="M4 8.5A1.5 1.5 0 0 1 5.5 7H8l1.5-2h5L16 7h2.5A1.5 1.5 0 0 1 20 8.5v9a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 17.5Z" />
      <circle cx="12" cy="13" r="3.5" />
    </svg>
  );
}
function PersonIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden {...S}>
      <circle cx="12" cy="8.5" r="3.5" />
      <path d="M5 19.5c1.2-3.2 3.8-5 7-5s5.8 1.8 7 5" />
    </svg>
  );
}
export function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden {...S}>
      <rect x="4.5" y="4.5" width="15" height="15" rx="2" />
      <path d="m8.5 12 2.5 2.5 4.5-5" />
    </svg>
  );
}
export function FolderIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden {...S}>
      <path d="M4 7.5A1.5 1.5 0 0 1 5.5 6H10l2 2h6.5A1.5 1.5 0 0 1 20 9.5v8a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 17.5Z" />
    </svg>
  );
}
export function CubeIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden {...S}>
      <path d="m12 3.5 7.5 4.25v8.5L12 20.5l-7.5-4.25v-8.5Z" />
      <path d="M12 12 4.5 7.75M12 12l7.5-4.25M12 12v8.5" />
    </svg>
  );
}
export function BellIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden {...S}>
      <path d="M6 16V11a6 6 0 1 1 12 0v5l1.5 2h-15Z" />
      <path d="M10 20a2 2 0 0 0 4 0" />
    </svg>
  );
}
export function SearchIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden {...S}>
      <circle cx="11" cy="11" r="6.5" />
      <path d="m16 16 4 4" />
    </svg>
  );
}
export function MicIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden {...S}>
      <rect x="9" y="3.5" width="6" height="11" rx="3" />
      <path d="M5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v2.5" />
    </svg>
  );
}
export function SendIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden {...S}>
      <path d="M12 19V5M6 11l6-6 6 6" />
    </svg>
  );
}

// ── After signing: the example label and GEIO's button ─────────

/** Every after-signing screen shows an invented project until the customer has a signed one. */
export function ExampleTag() {
  return <div className="oa-example">Example project · how your home will look in the app</div>;
}

export function AskGeio({ from }: { from: string }) {
  return (
    <Link href={`/app/geio?from=${encodeURIComponent(from)}`} className="oa-fab">
      <span className="oa-orb" aria-hidden />
      Ask GEIO
    </Link>
  );
}
