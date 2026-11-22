'use client';

import { useState, type ReactNode } from 'react';

/**
 * My quotations (owner, 22 Nov 2026): "display only the recent revision; everything else stays in the dropdown".
 * A client's newest quotation is the row; their older ones sit behind this toggle, shut until opened.
 */
export function OlderQuotes({ count, name, children }: { count: number; name: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <tr className="qolder">
        <td colSpan={5}>
          <button type="button" className="linkbtn muted sm" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
            {open ? '▾' : '▸'} {count} older {count === 1 ? 'quotation' : 'quotations'} for {name}
          </button>
        </td>
      </tr>
      {open ? children : null}
    </>
  );
}
