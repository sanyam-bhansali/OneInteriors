'use client';

import Link from 'next/link';
import { useTransition } from 'react';
import type { InboxItem } from '@/modules/studio/inbox';
import { markInboxReadAction } from './inbox-actions';

/**
 * New clients, signatures and customer choices, on the dashboard until they
 * are opened. Opening one marks it read; so does "Done" for one that needs
 * no visit.
 */
export function Inbox({ items }: { items: InboxItem[] }) {
  const [, start] = useTransition();
  if (items.length === 0) return null;

  return (
    <section className="s-card overflow-hidden">
      <div className="flex items-baseline justify-between gap-3 bg-[var(--s-surface-2)] px-4 py-2.5">
        <h2 className="m-0 text-[14.5px] font-semibold">For you</h2>
        <span className="s-num text-[12.5px] text-[var(--s-ink-3)]">{items.length} new</span>
      </div>
      <ul className="m-0 flex list-none flex-col p-0">
        {items.map((item) => (
          <li
            key={item.id}
            className="flex flex-wrap items-baseline gap-x-4 gap-y-1 border-b border-[var(--s-rule-soft)] px-4 py-3 last:border-b-0"
          >
            <Link
              href={item.url}
              onClick={() => start(() => markInboxReadAction(item.id))}
              className="min-w-0 flex-1 text-inherit no-underline"
            >
              <span className="block text-[14px] font-medium">{item.title}</span>
              {item.body ? (
                <span className="block text-[13px] leading-snug text-[var(--s-ink-2)]">{item.body}</span>
              ) : null}
            </Link>
            <span className="s-num text-[12px] text-[var(--s-ink-3)]">
              {new Date(item.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
            </span>
            <button
              type="button"
              onClick={() => start(() => markInboxReadAction(item.id))}
              className="text-[12.5px] text-[var(--s-ink-3)] hover:text-[var(--s-ink)]"
            >
              Done
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
