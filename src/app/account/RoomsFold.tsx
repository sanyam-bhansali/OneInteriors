'use client';

import { useEffect, useState, type ReactNode } from 'react';

/**
 * The room boards, folded. Twelve boards made the account page about twenty
 * phone screens tall, with the things below them out of reach. "Prepare for the
 * call" links to #rooms, so arriving by that link opens them.
 */
export function RoomsFold({ count, children }: { count: number; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (window.location.hash === '#rooms') {
      setOpen(true);
      document.getElementById('rooms')?.scrollIntoView();
    }
  }, []);
  return (
    <details id="rooms" className="mt-5 scroll-mt-24" open={open} onToggle={(e) => setOpen(e.currentTarget.open)}>
      <summary className="inline-flex cursor-pointer list-none items-center gap-2 rounded-full bg-[var(--soft)] px-5 py-3 text-[15px] font-medium text-[var(--ink)] [&::-webkit-details-marker]:hidden">
        {open ? 'Hide the room boards' : `Open the room boards (${count})`}
        <span aria-hidden="true">{open ? '−' : '+'}</span>
      </summary>
      <div className="mt-5">{children}</div>
    </details>
  );
}
