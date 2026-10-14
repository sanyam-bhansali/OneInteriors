'use client';

import { useEffect, useState } from 'react';
import { startOutbox, subscribe, type QueuedPost } from './queue';

/** The phone's outbox, live: every saved post and its status. Starts the retries once per page. */
export function useOutbox(): QueuedPost[] {
  const [posts, setPosts] = useState<QueuedPost[]>([]);
  useEffect(() => {
    startOutbox();
    return subscribe(setPosts);
  }, []);
  return posts;
}

/** Online, as the browser says, live. */
export function useOnline(): boolean {
  const [online, setOnline] = useState(true);
  useEffect(() => {
    const set = () => setOnline(navigator.onLine !== false);
    set();
    window.addEventListener('online', set);
    window.addEventListener('offline', set);
    return () => {
      window.removeEventListener('online', set);
      window.removeEventListener('offline', set);
    };
  }, []);
  return online;
}
