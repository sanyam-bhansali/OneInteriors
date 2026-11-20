'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { LineIcon } from './icons';

/**
 * The studio bell with pop-ups (owner, 20 Nov 2026: "notification should pop
 * for every approval etc"). Polls the person's unread notices every 30
 * seconds (and when the tab comes back); anything new since the page opened
 * pops up in the corner for 10 seconds. The bell shows how many are unread
 * and opens the list; opening one marks it read. `alerts` (meetings to
 * confirm, clients due) still lights the bell's dot as before.
 */

interface Item {
  id: string;
  title: string;
  body: string;
  url: string;
  at: string;
}

const POLL_MS = 30_000;
const POP_MS = 10_000;

export function NotificationBell({ alerts }: { alerts: number }) {
  const router = useRouter();
  const [items, setItems] = useState<Item[]>([]);
  const [open, setOpen] = useState(false);
  const [pops, setPops] = useState<Item[]>([]);
  const seen = useRef<Set<string> | null>(null);

  const load = useCallback(async () => {
    try {
      const r = await fetch('/api/studio/notifications', { cache: 'no-store' });
      if (!r.ok) return;
      const d = (await r.json()) as { ok: boolean; items?: Item[] };
      const list = d.items ?? [];
      setItems(list);
      // The first load only remembers what is there; later loads pop what is new.
      if (seen.current === null) {
        seen.current = new Set(list.map((i) => i.id));
        return;
      }
      const fresh = list.filter((i) => !seen.current!.has(i.id));
      fresh.forEach((i) => seen.current!.add(i.id));
      if (fresh.length) setPops((p) => [...fresh.slice(0, 3), ...p].slice(0, 3));
    } catch {
      /* Offline or signed out: try again next time. */
    }
  }, []);

  useEffect(() => {
    void load();
    const t = setInterval(() => void load(), POLL_MS);
    const onFocus = () => {
      if (document.visibilityState === 'visible') void load();
    };
    document.addEventListener('visibilitychange', onFocus);
    return () => {
      clearInterval(t);
      document.removeEventListener('visibilitychange', onFocus);
    };
  }, [load]);

  useEffect(() => {
    if (pops.length === 0) return;
    const t = setTimeout(() => setPops((p) => p.slice(0, -1)), POP_MS);
    return () => clearTimeout(t);
  }, [pops]);

  const read = async (id: string | null) => {
    setItems((l) => (id ? l.filter((i) => i.id !== id) : []));
    setPops((p) => (id ? p.filter((i) => i.id !== id) : []));
    await fetch('/api/studio/notifications', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(id ? { id } : { all: true }) }).catch(() => undefined);
  };

  const go = (i: Item) => {
    void read(i.id);
    setOpen(false);
    router.push(i.url);
  };

  const count = items.length;
  return (
    <>
      <span style={{ position: 'relative', display: 'inline-flex' }}>
        <button
          type="button"
          className="iconbtn"
          aria-label={count > 0 ? `Notifications, ${count} unread` : 'Notifications'}
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
          data-testid="notif-bell"
        >
          <LineIcon name="bell" />
          {count > 0 ? (
            <span className="oi-notif-count" aria-hidden="true">
              {count > 9 ? '9+' : count}
            </span>
          ) : alerts > 0 ? (
            <span className="pip" />
          ) : null}
        </button>
        {open ? (
          <div className="oi-notif-list" role="dialog" aria-label="Notifications" data-testid="notif-list">
            <div className="oi-notif-head">
              <b>Notifications</b>
              {count > 0 ? (
                <button type="button" className="btn ghost sm" onClick={() => void read(null)}>
                  Mark all read
                </button>
              ) : null}
            </div>
            {count === 0 ? <p className="muted sm" style={{ margin: 0, padding: '10px 12px' }}>Nothing new.</p> : null}
            <ul>
              {items.map((i) => (
                <li key={i.id}>
                  <button type="button" onClick={() => go(i)}>
                    <b>{i.title}</b>
                    <span>{i.body}</span>
                    <time dateTime={i.at}>{new Date(i.at).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}</time>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </span>
      {pops.length > 0 ? (
        <div className="oi-notif-pops" aria-live="polite" data-testid="notif-pops">
          {pops.map((i) => (
            <div key={i.id} className="oi-notif-pop" role="status">
              <button type="button" className="oi-notif-pop-body" onClick={() => go(i)}>
                <b>{i.title}</b>
                <span>{i.body}</span>
              </button>
              <button type="button" className="oi-notif-x" aria-label="Close" onClick={() => setPops((p) => p.filter((x) => x.id !== i.id))}>
                ×
              </button>
            </div>
          ))}
        </div>
      ) : null}
    </>
  );
}
