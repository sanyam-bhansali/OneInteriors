'use client';

/**
 * The signed-in customer's real project, for the after-signing screens
 * (docs/CUSTOMER-PLATFORM-PLAN.md, step 1). Read from the same API the phone
 * app uses, with the website's sign-in cookie.
 *
 * `example` means there is no real project to show — not signed in, no
 * project started yet, or a test build with no database — and the screens
 * fall back to the labelled example project.
 */

import { useCallback, useEffect, useState } from 'react';
import type { CustomerProject } from '@/modules/portal/project-store';

/** The project as it arrives over the wire: dates are strings. */
export type MyProject = Omit<CustomerProject, 'stages'> & {
  stages: (Omit<CustomerProject['stages'][number], 'targetOn'> & { targetOn: string })[];
};

export type MyProjectState = { state: 'loading' } | { state: 'example' } | { state: 'real'; project: MyProject };

let cached: MyProjectState | null = null;
let pending: Promise<MyProjectState> | null = null;

async function load(): Promise<MyProjectState> {
  try {
    const res = await fetch('/api/app/v1/project', { credentials: 'same-origin', cache: 'no-store' });
    if (!res.ok) return { state: 'example' };
    const body = (await res.json()) as { projects?: MyProject[] };
    const project = body.projects?.[0];
    return project ? { state: 'real', project } : { state: 'example' };
  } catch {
    return { state: 'example' };
  }
}

export function useMyProject(): MyProjectState & { reload: () => void } {
  const [s, setS] = useState<MyProjectState>(cached ?? { state: 'loading' });
  const reload = useCallback(() => {
    cached = null;
    pending = null;
    void (pending = load()).then((next) => {
      cached = next;
      setS(next);
    });
  }, []);
  useEffect(() => {
    if (cached) return;
    let live = true;
    void (pending ??= load()).then((next) => {
      cached = next;
      if (live) setS(next);
    });
    return () => {
      live = false;
    };
  }, []);
  return { ...s, reload };
}

/** Choose an option on a real decision; the error to show, or null on success. */
export async function chooseOption(decisionId: string, index: number): Promise<string | null> {
  try {
    const res = await fetch(`/api/app/v1/decisions/${encodeURIComponent(decisionId)}`, {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ index }),
    });
    if (res.ok) return null;
    const body = (await res.json().catch(() => null)) as { error?: string } | null;
    return body?.error ?? 'That did not go through. Try again.';
  } catch {
    return 'No connection. Try again.';
  }
}

/** Raise a snag on a real project, with photos; the error to show, or null on success. */
export async function raiseSnagOnline(projectId: string, title: string, room: string, photos: File[]): Promise<string | null> {
  const form = new FormData();
  form.set('projectId', projectId);
  form.set('title', title);
  if (room) form.set('room', room);
  for (const p of photos) form.append('photos', p);
  try {
    const res = await fetch('/api/app/v1/snags', { method: 'POST', credentials: 'same-origin', body: form });
    if (res.ok) return null;
    const body = (await res.json().catch(() => null)) as { error?: string } | null;
    return body?.error ?? 'That did not go through. Try again.';
  } catch {
    return 'No connection. Try again.';
  }
}
