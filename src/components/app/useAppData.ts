'use client';

/**
 * The app's studio and rate data, fetched once per visit from /app/journey
 * and kept in memory. The quiz starts the fetch early (`warmAppData`) so the
 * matches screen has it the moment the last answer is in.
 */

import { useEffect, useState } from 'react';
import type { AppData } from '@/app/app/data';

let data: AppData | null = null;
let pending: Promise<AppData | null> | null = null;

export function warmAppData(): Promise<AppData | null> {
  if (data) return Promise.resolve(data);
  pending ??= fetch('/app/journey')
    .then((r) => (r.ok ? (r.json() as Promise<AppData>) : null))
    .then((d) => {
      data = d;
      if (!d) pending = null; // let the next screen try again
      return d;
    })
    .catch(() => {
      pending = null;
      return null;
    });
  return pending;
}

export function useAppData(): AppData | null {
  const [got, setGot] = useState<AppData | null>(data);
  useEffect(() => {
    if (got) return;
    let live = true;
    void warmAppData().then((d) => {
      if (live && d) setGot(d);
    });
    return () => {
      live = false;
    };
  }, [got]);
  return got;
}
