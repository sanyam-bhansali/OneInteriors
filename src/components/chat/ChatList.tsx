'use client';

/**
 * The list of conversations (the owner's v1 screens, "Chats"): each one's
 * name, its last message and when, and how many are unread; refreshed every
 * ten seconds while the screen is open. `target` decides where a row opens:
 * the client app's conversation page, or the studio's. A search box finds
 * messages by their words; "Archived" lists the conversations this person
 * archived.
 */

import Link from 'next/link';
import { useEffect, useState } from 'react';
import './chat.css';

export interface ChatRow {
  projectId: string;
  kind: 'DESIGNER' | 'TEAM' | 'ONE_INTERIORS';
  title: string;
  home: string;
  studio: string;
  last: { preview: string; at: string; from: string; mine: boolean } | null;
  unread: number;
}

const when = (iso: string) => {
  const d = new Date(iso);
  const sameDay = d.toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' }) === new Date().toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' });
  return sameDay
    ? d.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Kolkata' })
    : d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: 'Asia/Kolkata' });
};

const hrefFor = (target: 'app' | 'studio' | 'ops', c: Pick<ChatRow, 'projectId' | 'kind'>) =>
  target === 'app'
    ? `/app/chats/${c.kind.toLowerCase()}?project=${encodeURIComponent(c.projectId)}`
    : `/${target}/chats?project=${encodeURIComponent(c.projectId)}&thread=${c.kind}`;

export function ChatList({ target, empty, showHome = false, selected }: { target: 'app' | 'studio' | 'ops'; empty: string; showHome?: boolean; selected?: string | null }) {
  const [rows, setRows] = useState<ChatRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [archived, setArchived] = useState(false);
  const [q, setQ] = useState('');
  const [hits, setHits] = useState<Hit[] | null>(null);

  /* Search as they type, a moment after they stop. */
  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) return setHits(null);
    let live = true;
    const id = setTimeout(async () => {
      const res = await fetch(`/api/app/v1/chats?q=${encodeURIComponent(term)}`, { credentials: 'same-origin', cache: 'no-store' }).catch(() => null);
      const body = (await res?.json().catch(() => null)) as { hits?: Hit[] } | null;
      if (live) setHits(body?.hits ?? []);
    }, 300);
    return () => {
      live = false;
      clearTimeout(id);
    };
  }, [q]);

  useEffect(() => {
    let live = true;
    setRows(null);
    const load = async () => {
      if (document.visibilityState !== 'visible') return;
      const res = await fetch(`/api/app/v1/chats${archived ? '?archived=1' : ''}`, { credentials: 'same-origin', cache: 'no-store' }).catch(() => null);
      const body = (await res?.json().catch(() => null)) as { chats?: ChatRow[]; error?: string } | null;
      if (!live) return;
      if (!res?.ok || !body?.chats) return setError(body?.error ?? 'We could not load your conversations.');
      setError(null);
      setRows(body.chats);
    };
    void load();
    const id = setInterval(() => void load(), 10_000);
    return () => {
      live = false;
      clearInterval(id);
    };
  }, [archived]);

  const tools = (
    <div className="chat-tools">
      <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search messages" aria-label="Search messages" maxLength={60} />
      <button type="button" onClick={() => setArchived((a) => !a)} aria-pressed={archived}>
        {archived ? 'Back to chats' : 'Archived'}
      </button>
    </div>
  );

  if (hits) {
    return (
      <>
        {tools}
        {hits.length === 0 ? <p className="chat-empty">No messages with those words.</p> : null}
        <ul className="chat-rows">
          {hits.map((h, i) => (
            <li key={`${h.projectId}:${h.kind}:${h.at}:${i}`}>
              <Link href={hrefFor(target, { projectId: h.projectId, kind: h.kind })} className="chat-row">
                <span className="chat-row-main">
                  <span className="chat-row-top">
                    <b>{h.title}</b>
                    <time>{when(h.at)}</time>
                  </span>
                  <span className="chat-row-sub">
                    <span>
                      {h.from.split(' ')[0]}: {h.preview}
                    </span>
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </>
    );
  }
  if (error && !rows) return <p className="chat-error">{error}</p>;
  if (!rows) return <p className="chat-empty">Loading…</p>;
  if (!rows.length) {
    return (
      <>
        {tools}
        <p className="chat-empty">{archived ? 'Nothing archived.' : empty}</p>
      </>
    );
  }
  return (
    <>
    {tools}
    <ul className="chat-rows">
      {rows.map((c) => {
        const key = `${c.projectId}:${c.kind}`;
        return (
          <li key={key}>
            <Link href={hrefFor(target, c)} className={`chat-row${selected === key ? ' on' : ''}`}>
              <span className="chat-avatar" aria-hidden>
                {c.kind === 'ONE_INTERIORS' ? 'OI' : c.kind === 'TEAM' ? '⌂' : (c.title.trim()[0] ?? '?').toUpperCase()}
              </span>
              <span className="chat-row-main">
                <span className="chat-row-top">
                  <b>{c.title}</b>
                  {c.last ? <time>{when(c.last.at)}</time> : null}
                </span>
                <span className="chat-row-sub">
                  <span>
                    {showHome ? `${c.home} · ` : ''}
                    {c.last ? `${c.last.mine ? 'You' : c.last.from.split(' ')[0]}: ${c.last.preview}` : 'Start the conversation'}
                  </span>
                  {c.unread ? <em>{c.unread}</em> : null}
                </span>
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
    </>
  );
}

interface Hit {
  projectId: string;
  kind: ChatRow['kind'];
  title: string;
  home: string;
  from: string;
  preview: string;
  at: string;
}
