'use client';

import { useState, useTransition } from 'react';

/** Runs a leave or holiday action and keeps its answer for the screen (Leave and Settings → Holidays). */
type Result = { ok: true; message: string } | { ok: false; error: string };

export function useRun() {
  const [pending, start] = useTransition();
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const run = (fn: () => Promise<Result>, after?: () => void) =>
    start(async () => {
      setMessage(null);
      const r = await fn();
      setMessage(r.ok ? { ok: true, text: r.message } : { ok: false, text: r.error });
      if (r.ok) after?.();
    });
  return { pending, message, run };
}

export function Message({ m }: { m: { ok: boolean; text: string } | null }) {
  if (!m) return null;
  return (
    <p role={m.ok ? 'status' : 'alert'} className={m.ok ? 'ox-ok' : 'ox-err'}>
      {m.text}
    </p>
  );
}
