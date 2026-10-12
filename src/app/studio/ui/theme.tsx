'use client';

import { useEffect, useState } from 'react';
import { LineIcon } from './icons';

/**
 * The studio's theme: `data-theme` on <html>, kept in localStorage under
 * `oi-studio-theme` (the brief's key). Light is the default. The inline script
 * below sets it before the first paint; this button flips it.
 */
import { THEME_KEY } from './theme-script';

function current(): 'light' | 'dark' {
  if (typeof document === 'undefined') return 'light';
  return document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
}

export function ThemeToggle({ className = 'iconbtn thbtn' }: { className?: string }) {
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  useEffect(() => {
    setTheme(current());
    const sync = () => setTheme(current());
    window.addEventListener('oi-theme', sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener('oi-theme', sync);
      window.removeEventListener('storage', sync);
    };
  }, []);

  const label = theme === 'dark' ? 'Switch to the light theme' : 'Switch to the dark theme';
  return (
    <button
      type="button"
      className={className}
      aria-label={label}
      title={label}
      onClick={() => {
        const next = current() === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', next);
        try {
          localStorage.setItem(THEME_KEY, next);
        } catch {
          /* private mode: the choice lasts this page */
        }
        window.dispatchEvent(new Event('oi-theme'));
        setTheme(next);
      }}
    >
      <LineIcon name="theme" />
    </button>
  );
}
