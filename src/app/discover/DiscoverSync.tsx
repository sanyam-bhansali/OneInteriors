'use client';

import { useEffect } from 'react';
import { syncDiscoverSavesAction } from './actions';

/**
 * Carries the rooms saved in Discover onto the Home Profile once one exists.
 * A visitor who saved rooms before starting their Home Profile has them only
 * on this device; mounted on the matches and expert pages, this hands them
 * over so the expert sees them before the call. Renders nothing.
 */
export function DiscoverSync() {
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem('oi.discover.v1');
      const saved = raw ? (JSON.parse(raw) as { saved?: unknown }).saved : null;
      if (Array.isArray(saved) && saved.length > 0) void syncDiscoverSavesAction(saved, true);
    } catch {
      /* nothing saved on this device */
    }
  }, []);
  return null;
}
