'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

/** "Search name, area…" on the pool (AxLeads). Enter searches; empty clears. */
export function PoolSearch({ query, q }: { query: string; q: string }) {
  const router = useRouter();
  const [text, setText] = useState(q);
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const p = new URLSearchParams(query);
        if (text.trim()) p.set('q', text.trim());
        else p.delete('q');
        router.push(`/studio/clients/pool?${p.toString()}`);
      }}
      className="ml-auto"
    >
      <input
        type="search"
        aria-label="Search the pool"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Search name, area…"
        className="h-[32px] w-[220px] rounded-[8px] border border-[var(--s-rule)] bg-[var(--s-surface)] px-3 text-[13px]"
      />
    </form>
  );
}
