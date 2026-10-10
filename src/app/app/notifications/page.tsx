'use client';

/**
 * Notifications (v79 design), behind the bell: everything the app has told
 * this customer, newest first, grouped Today and Earlier. Opening the list
 * marks it read. The same list the phone app shows.
 */

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Frame, Head, Tabs } from '@/components/app/ui';
import { dayLabel, timeLabel } from '@/modules/app/project-view';

interface Notice {
  id: string;
  payload: { title?: string; body?: string; url?: string };
  readAt: string | null;
  createdAt: string;
}

const IST_DAY = (iso: string) => new Date(iso).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });

export default function AppNotifications() {
  const [list, setList] = useState<Notice[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    void fetch('/api/app/v1/notifications', { credentials: 'same-origin', cache: 'no-store' })
      .then(async (r) => {
        if (!r.ok) throw new Error(r.status === 401 ? 'Sign in to see your notifications.' : 'Could not load them. Pull to try again.');
        return (await r.json()) as { unread: number; notifications: Notice[] };
      })
      .then((b) => {
        if (!live) return;
        setList(b.notifications);
        if (b.unread > 0) {
          void fetch('/api/app/v1/notifications', {
            method: 'POST',
            credentials: 'same-origin',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ all: true }),
          });
        }
      })
      .catch((e: Error) => live && setError(e.message));
    return () => {
      live = false;
    };
  }, []);

  const today = IST_DAY(new Date().toISOString());
  const groups = [
    { name: 'Today', items: (list ?? []).filter((n) => IST_DAY(n.createdAt) === today) },
    { name: 'Earlier', items: (list ?? []).filter((n) => IST_DAY(n.createdAt) !== today) },
  ].filter((g) => g.items.length);

  return (
    <Frame>
      <Head back="/app/me" />
      <main className="oa-body">
        <h1 className="oa-title">Notifications</h1>
        {error ? <p className="oa-sub">{error}</p> : null}
        {list && list.length === 0 ? (
          <p className="oa-sub">Nothing yet. Site updates, decisions, snags and payments appear here, and on your phone.</p>
        ) : null}
        {groups.map((g) => (
          <section key={g.name}>
            <p className="oa-label">{g.name}</p>
            <div className="oa-list">
              {g.items.map((n) => {
                const inner = (
                  <>
                    {!n.readAt ? <i className="dot" aria-label="New" /> : <i className="dot read" aria-hidden />}
                    <span className="min-w-0 flex-1">
                      <b>{n.payload.title ?? 'Update'}</b>
                      {n.payload.body ? <small>{n.payload.body}</small> : null}
                    </span>
                    <em>{IST_DAY(n.createdAt) === today ? timeLabel(n.createdAt) : dayLabel(n.createdAt)}</em>
                  </>
                );
                return n.payload.url?.startsWith('/app') ? (
                  <Link key={n.id} href={n.payload.url} className="oa-notice">
                    {inner}
                  </Link>
                ) : (
                  <div key={n.id} className="oa-notice">
                    {inner}
                  </div>
                );
              })}
            </div>
          </section>
        ))}
      </main>
      <Tabs />
    </Frame>
  );
}
