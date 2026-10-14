'use client';

import Link from 'next/link';
import { useTransition } from 'react';
import type { InboxItem } from '@/modules/studio/inbox';
import { markInboxReadAction } from './inbox-actions';
import './office-ui.css';

/**
 * New clients, signatures and customer choices, on the dashboard until they
 * are opened. Opening one marks it read; so does "Done" for one that needs
 * no visit. Drawn as one of the design's side cards (StudioHome).
 */
export function Inbox({ items }: { items: InboxItem[] }) {
  const [, start] = useTransition();
  if (items.length === 0) return null;

  return (
    <section className="card" aria-labelledby="h-inbox" style={{ gap: 6 }}>
      <div className="chead">
        <h2 id="h-inbox">For you</h2>
        <span className="chip oi">
          <span className="dot" />
          <span className="mono">{items.length}</span> new
        </span>
      </div>
      <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
        {items.map((item) => (
          <li key={item.id} className="ox-crow" style={{ alignItems: 'flex-start' }}>
            <Link href={item.url} onClick={() => start(() => markInboxReadAction(item.id))} style={{ flex: '1 1 200px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
              <b style={{ fontWeight: 600 }}>{item.title}</b>
              {item.body ? <span className="muted sm">{item.body}</span> : null}
            </Link>
            <span className="hstack" style={{ gap: 8, flexWrap: 'nowrap' }}>
              <span className="mono muted sm">{new Date(item.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</span>
              <button type="button" onClick={() => start(() => markInboxReadAction(item.id))} className="btn ghost xs">
                Done
              </button>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
